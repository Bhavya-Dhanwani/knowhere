import { ChatMistralAI } from '@langchain/mistralai';
import env from '../../shared/config/env.config.js';
import logger from '../../shared/config/logger.config.js';

export interface KeyStatus {
  key: string;
  maskedKey: string;
  cooldownUntil: number | null;
  consecutiveFailures: number;
  totalCalls: number;
}

export class MistralKeyPoolManager {
  private static instance: MistralKeyPoolManager | null = null;
  private keys: KeyStatus[] = [];
  private keyMap: Map<string, KeyStatus> = new Map();
  private pointer: number = 0;

  constructor(customKeys?: string[]) {
    this.initKeys(customKeys);
  }

  public static getInstance(): MistralKeyPoolManager {
    if (!MistralKeyPoolManager.instance) {
      MistralKeyPoolManager.instance = new MistralKeyPoolManager();
    }
    return MistralKeyPoolManager.instance;
  }

  /**
   * Discovers all Mistral API keys dynamically:
   * 1. customKeys if explicitly passed
   * 2. env.MISTRAL_API_KEYS or process.env.MISTRAL_API_KEYS (comma, newline, semicolon, or JSON array separated)
   * 3. Any environment variable matching /^MISTRAL_API_KEY(_\d+|\d+)?$/i
   *    (e.g., MISTRAL_API_KEY, MISTRAL_API_KEY1 .. MISTRAL_API_KEY50 .. MISTRAL_API_KEY1000000)
   */
  public discoverKeys(customKeys?: string[]): string[] {
    // 1. If custom keys are explicitly passed (e.g. in tests or custom runners), use them exclusively
    if (customKeys && customKeys.length > 0) {
      const explicitSet = new Set<string>();
      for (const k of customKeys) {
        const trimmed = k.trim();
        if (trimmed) explicitSet.add(trimmed);
      }
      return Array.from(explicitSet);
    }

    const keySet = new Set<string>();

    // 2. Comma/newline/semicolon/JSON separated MISTRAL_API_KEYS
    const envList = env.MISTRAL_API_KEYS || process.env.MISTRAL_API_KEYS;
    if (envList) {
      const trimmedList = envList.trim();
      if (trimmedList.startsWith('[') && trimmedList.endsWith(']')) {
        try {
          const parsed = JSON.parse(trimmedList);
          if (Array.isArray(parsed)) {
            for (const k of parsed) {
              if (typeof k === 'string' && k.trim()) keySet.add(k.trim());
            }
          }
        } catch {
          // fall through to regex split
        }
      }
      trimmedList.split(/[\r\n,;]+/).forEach((k) => {
        const trimmed = k.trim();
        if (trimmed) keySet.add(trimmed);
      });
    }

    // 3. Dynamic scan across ALL process.env variables (supports unlimited indexed keys)
    const indexedKeys: { index: number; key: string }[] = [];
    for (const [name, val] of Object.entries(process.env)) {
      if (!val || typeof val !== 'string') continue;
      const match = name.match(/^MISTRAL_API_KEY_?(\d+)?$/i);
      if (match) {
        const trimmed = val.trim();
        if (!trimmed) continue;
        const index = match[1] ? parseInt(match[1], 10) : 0;
        indexedKeys.push({ index, key: trimmed });
      }
    }

    // Sort numerically so MISTRAL_API_KEY1 comes before MISTRAL_API_KEY2, etc.
    indexedKeys.sort((a, b) => a.index - b.index);
    for (const item of indexedKeys) {
      keySet.add(item.key);
    }

    return Array.from(keySet);
  }

  /**
   * Initializes the pool with discovered or provided keys.
   */
  public initKeys(customKeys?: string[]): void {
    const discovered = this.discoverKeys(customKeys);

    this.keys = [];
    this.keyMap.clear();

    for (const k of discovered) {
      const status: KeyStatus = {
        key: k,
        maskedKey: k.length > 8 ? `${k.slice(0, 4)}...${k.slice(-4)}` : '***',
        cooldownUntil: null,
        consecutiveFailures: 0,
        totalCalls: 0
      };
      this.keys.push(status);
      this.keyMap.set(k, status);
    }

    this.pointer = 0;
    if (this.keys.length > 0) {
      logger.info({ count: this.keys.length }, 'Mistral Round-Robin Key Pool initialized');
    }
  }

  /**
   * Dynamically adds a new key into the active pool at runtime.
   */
  public addKey(key: string): void {
    const trimmed = key.trim();
    if (!trimmed || this.keyMap.has(trimmed)) return;

    const status: KeyStatus = {
      key: trimmed,
      maskedKey: trimmed.length > 8 ? `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}` : '***',
      cooldownUntil: null,
      consecutiveFailures: 0,
      totalCalls: 0
    };
    this.keys.push(status);
    this.keyMap.set(trimmed, status);
    logger.info(
      { maskedKey: status.maskedKey, total: this.keys.length },
      'Added new key to Mistral pool'
    );
  }

  /**
   * Dynamically adds multiple keys into the active pool at runtime.
   */
  public addKeys(keys: string[]): void {
    for (const k of keys) {
      this.addKey(k);
    }
  }

  /**
   * Reloads keys dynamically from the environment.
   */
  public reloadFromEnv(): void {
    this.initKeys();
  }

  public hasKeys(): boolean {
    return this.keys.length > 0;
  }

  public getKeyCount(): number {
    return this.keys.length;
  }

  /**
   * Returns the next available API key using Round-Robin rotation.
   * O(1) fast-path execution. Automatically skips keys currently on cooldown.
   * Scales gracefully to unlimited (N) keys.
   */
  public getNextKey(): string {
    if (this.keys.length === 0) {
      this.reloadFromEnv();
    }

    if (this.keys.length === 0) {
      throw new Error('No Mistral API keys configured in the pool.');
    }

    const total = this.keys.length;
    const current = this.keys[this.pointer];

    // O(1) Ultra-Fast Path: current pointer key is active and healthy
    if (current.cooldownUntil === null) {
      this.pointer = (this.pointer + 1) % total;
      current.totalCalls++;
      return current.key;
    }

    const now = Date.now();
    const maxProbes = Math.min(total, 500);

    for (let attempts = 0; attempts < maxProbes; attempts++) {
      const idx = (this.pointer + attempts) % total;
      const keyObj = this.keys[idx];

      // Check if cooldown expired
      if (keyObj.cooldownUntil && keyObj.cooldownUntil <= now) {
        keyObj.cooldownUntil = null;
        keyObj.consecutiveFailures = 0;
        logger.info(
          { maskedKey: keyObj.maskedKey },
          'Mistral API key cooldown expired; key restored to pool'
        );
      }

      if (!keyObj.cooldownUntil) {
        // Advance round-robin pointer for next call
        this.pointer = (idx + 1) % total;
        keyObj.totalCalls++;
        return keyObj.key;
      }
    }

    // If all sampled keys are currently cooling down, fallback to the one with earliest cooldown
    logger.warn(
      'All examined Mistral API keys are currently on cooldown; falling back to key with earliest expiration'
    );
    let earliestKey = this.keys[0];
    let earliestTime = earliestKey.cooldownUntil ?? Infinity;

    for (let i = 0; i < maxProbes; i++) {
      const k = this.keys[(this.pointer + i) % total];
      const time = k.cooldownUntil ?? 0;
      if (time < earliestTime) {
        earliestTime = time;
        earliestKey = k;
      }
    }

    this.pointer = (this.pointer + 1) % total;
    return earliestKey.key;
  }

  /**
   * Reports a rate limit (HTTP 429) or quota exhaustion, placing the key on cooldown.
   */
  public reportRateLimit(key: string, cooldownDurationMs = 60000): void {
    const keyObj = this.keyMap.get(key) || this.keys.find((k) => k.key === key);
    if (keyObj) {
      keyObj.cooldownUntil = Date.now() + cooldownDurationMs;
      keyObj.consecutiveFailures++;
      logger.warn(
        { maskedKey: keyObj.maskedKey, cooldownSeconds: cooldownDurationMs / 1000 },
        'Mistral API key placed on rate-limit cooldown'
      );
    }
  }

  /**
   * Reports a successful call, resetting failure counts.
   */
  public reportSuccess(key: string): void {
    const keyObj = this.keyMap.get(key) || this.keys.find((k) => k.key === key);
    if (keyObj) {
      keyObj.consecutiveFailures = 0;
    }
  }

  /**
   * Instantiates a LangChain ChatMistralAI client using the next Round-Robin API key.
   */
  public getChatMistralInstance(options?: {
    modelName?: string;
    temperature?: number;
    maxRetries?: number;
  }): { model: ChatMistralAI; selectedKey: string } {
    const key = this.getNextKey();
    const model = new ChatMistralAI({
      apiKey: key,
      modelName: options?.modelName || env.MISTRAL_MODEL || 'mistral-medium-latest',
      temperature: options?.temperature ?? 0.1,
      maxRetries: options?.maxRetries ?? 2
    });

    return { model, selectedKey: key };
  }

  /**
   * Diagnostic pool status report.
   */
  public getPoolStatus(): Array<Omit<KeyStatus, 'key'>> {
    const now = Date.now();
    return this.keys.map((k) => ({
      maskedKey: k.maskedKey,
      cooldownUntil: k.cooldownUntil,
      consecutiveFailures: k.consecutiveFailures,
      totalCalls: k.totalCalls,
      isAvailable: !k.cooldownUntil || k.cooldownUntil <= now
    }));
  }
}

export const defaultKeyPool = MistralKeyPoolManager.getInstance();
export default defaultKeyPool;
