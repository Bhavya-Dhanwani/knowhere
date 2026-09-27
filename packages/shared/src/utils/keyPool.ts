// Round-robin API key pool with automatic failover, for LLM providers that rate-limit per key.
//
//   const pool = KeyPool.fromEnv('MISTRAL');           // MISTRAL_API_KEYS=a,b,c and/or MISTRAL_API_KEY1..N
//   const answer = await pool.run((key) => callMistral(key, prompt));
//
// run() hands each attempt the next healthy key; when a key fails for a key-level reason it is
// cooled down and the call moves on to the next key, so one exhausted or revoked key never
// surfaces to the user. Errors that no other key would fix (a bad request) are thrown at once.

export interface KeyFailure {
  retry: boolean;
  cooldownMs: number;
  reason: string;
}

// what an error means for the key that produced it
export function classifyKeyError(err: unknown): KeyFailure {
  const e = err as {
    status?: number;
    statusCode?: number;
    response?: { status?: number; headers?: Record<string, string> };
    message?: string;
    code?: string;
  };
  const status = e?.status ?? e?.statusCode ?? e?.response?.status;
  const msg = String(e?.message || err || '').toLowerCase();
  const retryAfter = Number(e?.response?.headers?.['retry-after']);

  // the model, not the key: another key will not help, another model will
  if (
    /subscription tier|not available in your|model[^.]*(not found|does not exist|invalid|unknown)|invalid model/.test(
      msg
    )
  ) {
    return { retry: false, cooldownMs: 0, reason: 'model unavailable' };
  }
  if (status === 429 || /\b429\b|rate.?limit|quota|too many requests|capacity/.test(msg)) {
    return {
      retry: true,
      cooldownMs: retryAfter > 0 ? retryAfter * 1000 : 30_000,
      reason: 'rate-limited'
    };
  }
  if (
    status === 401 ||
    status === 403 ||
    /\b40[13]\b|unauthori[sz]ed|invalid api key|forbidden/.test(msg)
  ) {
    return { retry: true, cooldownMs: 60 * 60_000, reason: 'key rejected' };
  }
  if (
    (status !== undefined && status >= 500) ||
    /\b5\d\d\b|timeout|timed out|econnreset|econnrefused|etimedout|enotfound|socket hang up|fetch failed|network|overloaded|unavailable/.test(
      msg
    ) ||
    ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EAI_AGAIN'].includes(String(e?.code))
  ) {
    return { retry: true, cooldownMs: 5_000, reason: 'provider or network error' };
  }
  return { retry: false, cooldownMs: 0, reason: 'request error' };
}

interface Slot {
  key: string;
  coolUntil: number;
}

export class KeyPool {
  private slots: Slot[];
  private pointer = 0;

  constructor(keys: string[]) {
    this.slots = [...new Set(keys.map((k) => k.trim()).filter(Boolean))].map((key) => ({
      key,
      coolUntil: 0
    }));
  }

  // PREFIX_API_KEYS (comma / newline / semicolon separated) plus PREFIX_API_KEY, PREFIX_API_KEY1..N
  static fromEnv(prefix: string, env: Record<string, string | undefined> = process.env) {
    const listed = (env[`${prefix}_API_KEYS`] || '').split(/[\r\n,;]+/);
    const indexed = Object.entries(env)
      .map(([name, value]) => ({
        m: name.match(new RegExp(`^${prefix}_API_KEY_?(\\d*)$`, 'i')),
        value
      }))
      .filter((x) => x.m && x.value)
      .sort((a, b) => Number(a.m![1] || 0) - Number(b.m![1] || 0))
      .map((x) => x.value as string);
    return new KeyPool([...listed, ...indexed]);
  }

  get size() {
    return this.slots.length;
  }

  get available() {
    const now = Date.now();
    return this.slots.filter((s) => s.coolUntil <= now).length;
  }

  // next healthy key in round-robin order; if every key is cooling down, the one that recovers first
  next(): string {
    if (!this.slots.length) throw new Error('No API keys configured.');
    const now = Date.now();
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[(this.pointer + i) % this.slots.length];
      if (slot.coolUntil <= now) {
        this.pointer = (this.pointer + i + 1) % this.slots.length;
        return slot.key;
      }
    }
    const soonest = this.slots.reduce((a, b) => (b.coolUntil < a.coolUntil ? b : a));
    return soonest.key;
  }

  cool(key: string, ms: number) {
    const slot = this.slots.find((s) => s.key === key);
    if (slot) slot.coolUntil = Math.max(slot.coolUntil, Date.now() + ms);
  }

  // Runs `call` with rotating keys until one succeeds. Tries up to `maxAttempts` distinct keys;
  // `onFailover` is told which key (masked) failed and why.
  async run<T>(
    call: (key: string) => Promise<T>,
    {
      maxAttempts = Math.min(this.size, 10),
      onFailover
    }: {
      maxAttempts?: number;
      onFailover?: (info: { key: string; reason: string; attempt: number }) => void;
    } = {}
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= Math.max(1, maxAttempts); attempt++) {
      const key = this.next();
      try {
        return await call(key);
      } catch (err) {
        const failure = classifyKeyError(err);
        if (!failure.retry) throw err;
        this.cool(key, failure.cooldownMs);
        onFailover?.({
          key: `${key.slice(0, 4)}…${key.slice(-4)}`,
          reason: failure.reason,
          attempt
        });
        lastError = err;
      }
    }
    throw lastError;
  }

  // model -> time until which every key was rate-limited on it (account-wide quota exhausted)
  private saturated = new Map<string, number>();

  // Key rotation plus model fallback: each model gets a few keys; a model that is rate-limited on
  // all of them, or not available in the account's tier, is skipped and the next model answers.
  // Saturated models are tried last for 60s, so later calls don't waste round-trips on them.
  async runModels<T>(
    models: string[],
    call: (key: string, model: string) => Promise<T>,
    {
      attemptsPerModel = 3,
      onFailover
    }: {
      attemptsPerModel?: number;
      onFailover?: (info: { key: string; reason: string; attempt: number; model?: string }) => void;
    } = {}
  ): Promise<T> {
    const now = Date.now();
    const order = [...new Set(models.filter(Boolean))].sort(
      (a, b) =>
        Number((this.saturated.get(a) || 0) > now) - Number((this.saturated.get(b) || 0) > now)
    );
    let lastError: unknown;
    for (const model of order) {
      try {
        const result = await this.run((key) => call(key, model), {
          maxAttempts: attemptsPerModel,
          onFailover: (info) => onFailover?.({ ...info, model })
        });
        this.saturated.delete(model);
        return result;
      } catch (err) {
        const failure = classifyKeyError(err);
        if (!failure.retry && failure.reason !== 'model unavailable') throw err;
        this.saturated.set(
          model,
          Date.now() + (failure.reason === 'model unavailable' ? 3_600_000 : 60_000)
        );
        onFailover?.({ key: '-', reason: `model ${failure.reason}`, attempt: 0, model });
        lastError = err;
      }
    }
    throw lastError;
  }

  // Streaming twin of runModels, for SSE. Chunks are passed through as they arrive; when a key
  // fails part-way (rate limit, revoked, provider error) the next key takes over and a `restart`
  // is emitted first, so the client drops the partial answer before the fresh one streams in.
  async *streamModels<T>(
    models: string[],
    open: (key: string, model: string) => AsyncIterable<T>,
    {
      attemptsPerModel = 3,
      onFailover
    }: {
      attemptsPerModel?: number;
      onFailover?: (info: { key: string; reason: string; attempt: number; model?: string }) => void;
    } = {}
  ): AsyncGenerator<{ type: 'chunk'; value: T } | { type: 'restart'; reason: string }> {
    const now = Date.now();
    const order = [...new Set(models.filter(Boolean))].sort(
      (a, b) =>
        Number((this.saturated.get(a) || 0) > now) - Number((this.saturated.get(b) || 0) > now)
    );
    let lastError: unknown = new Error('No API keys configured.');
    for (const model of order) {
      let modelUnavailable = false;
      for (let attempt = 1; attempt <= Math.max(1, attemptsPerModel); attempt++) {
        const key = this.next();
        let emitted = false;
        try {
          for await (const value of open(key, model)) {
            emitted = true;
            yield { type: 'chunk', value };
          }
          this.saturated.delete(model);
          return;
        } catch (err) {
          const failure = classifyKeyError(err);
          if (!failure.retry && failure.reason !== 'model unavailable') throw err;
          if (failure.reason === 'model unavailable') modelUnavailable = true;
          else this.cool(key, failure.cooldownMs);
          onFailover?.({
            key: `${key.slice(0, 4)}…${key.slice(-4)}`,
            reason: failure.reason,
            attempt,
            model
          });
          lastError = err;
          if (emitted) yield { type: 'restart', reason: failure.reason };
          if (modelUnavailable) break;
        }
      }
      this.saturated.set(model, Date.now() + (modelUnavailable ? 3_600_000 : 60_000));
    }
    throw lastError;
  }
}
