import { KeyPool, classifyKeyError } from '@lms/shared';

const err = (status: number, message = `HTTP ${status}`) =>
  Object.assign(new Error(message), { status });

describe('KeyPool', () => {
  it('rotates round-robin', () => {
    const pool = new KeyPool(['a', 'b', 'c']);
    expect([pool.next(), pool.next(), pool.next(), pool.next()]).toEqual(['a', 'b', 'c', 'a']);
  });

  it('reads MISTRAL_API_KEYS and MISTRAL_API_KEY1..N, without duplicates', () => {
    const pool = KeyPool.fromEnv('MISTRAL', {
      MISTRAL_API_KEYS: 'a, b',
      MISTRAL_API_KEY2: 'c',
      MISTRAL_API_KEY1: 'b',
      OTHER: 'x'
    });
    expect(pool.size).toBe(3);
  });

  it('fails over to the next key on a rate limit and skips the cooled key afterwards', async () => {
    const pool = new KeyPool(['a', 'b', 'c']);
    const seen: string[] = [];
    const result = await pool.run(async (key) => {
      seen.push(key);
      if (key === 'a') throw err(429, 'Too Many Requests');
      return `ok:${key}`;
    });
    expect(result).toBe('ok:b');
    expect(seen).toEqual(['a', 'b']);
    expect(pool.available).toBe(2);
    // 'a' is cooling down, so the rotation continues c, b, ...
    expect([pool.next(), pool.next(), pool.next()]).toEqual(['c', 'b', 'c']);
  });

  it('survives many failing keys and a revoked key', async () => {
    const pool = new KeyPool(['bad1', 'bad2', 'revoked', 'good']);
    const result = await pool.run(async (key) => {
      if (key.startsWith('bad')) throw err(503, 'Service Unavailable');
      if (key === 'revoked') throw err(401, 'Unauthorized');
      return 'ok';
    });
    expect(result).toBe('ok');
    expect(pool.available).toBe(1);
  });

  it('does not burn keys on a bad request', async () => {
    const pool = new KeyPool(['a', 'b']);
    let calls = 0;
    await expect(
      pool.run(async () => {
        calls++;
        throw err(400, 'Invalid request body');
      })
    ).rejects.toThrow('Invalid request body');
    expect(calls).toBe(1);
    expect(pool.available).toBe(2);
  });

  it('still answers when every key is cooling down (earliest recovery first)', () => {
    const pool = new KeyPool(['a', 'b']);
    pool.cool('a', 60_000);
    pool.cool('b', 5_000);
    expect(pool.next()).toBe('b');
  });

  it('classifies provider errors', () => {
    expect(classifyKeyError(err(429)).reason).toBe('rate-limited');
    expect(classifyKeyError(Object.assign(new Error('x'), { code: 'ECONNRESET' })).retry).toBe(
      true
    );
    expect(classifyKeyError(err(422, 'Unprocessable')).retry).toBe(false);
  });

  it('falls back to the next model when a model is exhausted on every key, and skips it next time', async () => {
    const pool = new KeyPool(['a', 'b', 'c', 'd', 'e', 'f']);
    const calls: string[] = [];
    const call = async (key: string, model: string) => {
      calls.push(model);
      if (model === 'medium') throw err(429, 'Rate limit exceeded');
      return `${model}:${key}`;
    };
    expect(await pool.runModels(['medium', 'small'], call, { attemptsPerModel: 3 })).toMatch(
      /^small:/
    );
    expect(calls).toEqual(['medium', 'medium', 'medium', 'small']);
    calls.length = 0;
    // medium is saturated now: the next request goes straight to small
    expect(await pool.runModels(['medium', 'small'], call)).toMatch(/^small:/);
    expect(calls).toEqual(['small']);
  });

  it('streams, and restarts on the next key when one dies mid-answer', async () => {
    const pool = new KeyPool(['a', 'b']);
    async function* reply(key: string) {
      yield `${key}1`;
      if (key === 'a') throw err(429, 'Rate limit exceeded');
      yield `${key}2`;
    }
    const events: string[] = [];
    for await (const e of pool.streamModels(['m'], (key) => reply(key))) {
      events.push(e.type === 'chunk' ? e.value : `<${e.type}>`);
    }
    expect(events).toEqual(['a1', '<restart>', 'b1', 'b2']);
    expect(pool.available).toBe(1);
  });

  it('streams from the next model when one is exhausted on every key', async () => {
    const pool = new KeyPool(['a', 'b']);
    async function* reply(_key: string, model: string) {
      if (model === 'medium') throw err(429, 'Rate limit exceeded');
      yield model;
    }
    const out: string[] = [];
    for await (const e of pool.streamModels(['medium', 'small'], reply, { attemptsPerModel: 2 })) {
      if (e.type === 'chunk') out.push(e.value);
    }
    expect(out).toEqual(['small']);
  });

  it('treats "not in your tier" as a model problem and never cools the key', async () => {
    const pool = new KeyPool(['a', 'b']);
    const result = await pool.runModels(['large', 'small'], async (_key, model) => {
      if (model === 'large')
        throw err(403, 'This model is not available in your subscription tier');
      return 'ok';
    });
    expect(result).toBe('ok');
    expect(pool.available).toBe(2);
  });
});
