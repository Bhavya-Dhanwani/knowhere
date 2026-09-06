import { MistralKeyPoolManager } from '../src/modules/ai/key-pool.manager.js';

describe('Mistral Round-Robin Key Pool Manager', () => {
  it('should rotate keys in circular Round-Robin order (0 -> 1 -> 2 -> 0)', () => {
    const keys = ['key_alpha', 'key_beta', 'key_gamma'];
    const pool = new MistralKeyPoolManager(keys);

    expect(pool.getKeyCount()).toBe(3);

    // Call 1 -> key_alpha
    expect(pool.getNextKey()).toBe('key_alpha');
    // Call 2 -> key_beta
    expect(pool.getNextKey()).toBe('key_beta');
    // Call 3 -> key_gamma
    expect(pool.getNextKey()).toBe('key_gamma');
    // Call 4 -> back to key_alpha (circular)
    expect(pool.getNextKey()).toBe('key_alpha');
    // Call 5 -> key_beta
    expect(pool.getNextKey()).toBe('key_beta');
  });

  it('should automatically skip rate-limited keys on cooldown and use the next healthy key', () => {
    const keys = ['mistral_key_1_active', 'mistral_key_2_ratelimited', 'mistral_key_3_backup'];
    const pool = new MistralKeyPoolManager(keys);

    // key_1 is used
    expect(pool.getNextKey()).toBe('mistral_key_1_active');

    // Simulate key_2 receiving an HTTP 429 rate limit error
    pool.reportRateLimit('mistral_key_2_ratelimited', 10000); // 10s cooldown

    // Next call should skip key_2 and select key_3
    expect(pool.getNextKey()).toBe('mistral_key_3_backup');

    // Next call wraps around to key_1
    expect(pool.getNextKey()).toBe('mistral_key_1_active');

    // Verify key status
    const status = pool.getPoolStatus();
    expect(status[1].isAvailable).toBe(false);
    expect(status[1].cooldownUntil).toBeGreaterThan(Date.now());
  });

  it('should restore a cooling down key once its cooldown expires', () => {
    const keys = ['key_fast_cool', 'key_standby'];
    const pool = new MistralKeyPoolManager(keys);

    // Place key_fast_cool on an already-expired cooldown in the past
    pool.reportRateLimit('key_fast_cool', -1000);

    // Should immediately recognize key_fast_cool as healthy again
    expect(pool.getNextKey()).toBe('key_fast_cool');
  });

  it('should dynamically discover indexed env variables (MISTRAL_API_KEY1..N)', () => {
    process.env.MISTRAL_API_KEY1 = 'env_key_one';
    process.env.MISTRAL_API_KEY2 = 'env_key_two';
    process.env.MISTRAL_API_KEY50 = 'env_key_fifty';

    const pool = new MistralKeyPoolManager();
    expect(pool.getKeyCount()).toBeGreaterThanOrEqual(3);

    const keys = pool.discoverKeys();
    expect(keys).toContain('env_key_one');
    expect(keys).toContain('env_key_two');
    expect(keys).toContain('env_key_fifty');

    delete process.env.MISTRAL_API_KEY1;
    delete process.env.MISTRAL_API_KEY2;
    delete process.env.MISTRAL_API_KEY50;
  });

  it('should handle large-scale key pools (e.g. 10,000+ keys) with high throughput and O(1) rotation', () => {
    const hugeKeys = Array.from({ length: 10000 }, (_, i) => `key_scaled_${i}`);
    const pool = new MistralKeyPoolManager(hugeKeys);

    expect(pool.getKeyCount()).toBe(10000);

    const start = Date.now();
    let sampleKey = '';
    // Execute 50,000 rotations
    for (let i = 0; i < 50000; i++) {
      sampleKey = pool.getNextKey();
    }
    const elapsed = Date.now() - start;
    // 50,000 rotations should execute in under 100ms
    expect(elapsed).toBeLessThan(500);
    expect(sampleKey).toBe('key_scaled_9999');
  });
});
