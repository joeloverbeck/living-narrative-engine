/**
 * @file Integration tests for ScopeCacheStrategy edge cases around expiration handling.
 */

import { describe, it, beforeEach, expect } from '@jest/globals';
import { ScopeCacheStrategy } from '../../../../src/actions/scopes/scopeCacheStrategy.js';
import { ActionResult } from '../../../../src/actions/core/actionResult.js';

/**
 * @description Minimal in-memory logger that records structured log invocations.
 */
class MemoryLogger {
  constructor() {
    this.debugEntries = [];
    this.infoEntries = [];
    this.warnEntries = [];
    this.errorEntries = [];
  }

  debug(message, context) {
    this.debugEntries.push({ message, context });
  }

  info(message, context) {
    this.infoEntries.push({ message, context });
  }

  warn(message, context) {
    this.warnEntries.push({ message, context });
  }

  error(message, context) {
    this.errorEntries.push({ message, context });
  }
}

describe('ScopeCacheStrategy expiration behaviour integration', () => {
  /** @type {Map<string, any>} */
  let cache;
  /** @type {MemoryLogger} */
  let logger;
  /** @type {ScopeCacheStrategy} */
  let strategy;
  const cacheKey = 'scope:foggyMeadow:actor-1';

  beforeEach(() => {
    cache = new Map();
    logger = new MemoryLogger();
    strategy = new ScopeCacheStrategy({
      cache,
      defaultTTL: 100,
      logger,
      maxSize: 5,
    });
  });

  it('supports default constructor dependencies when none are provided', () => {
    const defaultStrategy = new ScopeCacheStrategy();

    expect(defaultStrategy.getSync('missing')).toBeNull();
    expect(defaultStrategy.size).toBe(0);
  });

  it('evicts expired asynchronous cache entries before computing fresh results', async () => {
    const expiredEntry = ActionResult.success(new Set(['stale']));
    cache.set(cacheKey, {
      value: expiredEntry,
      timestamp: Date.now() - 1000,
      ttl: 10,
    });

    const freshResult = ActionResult.success(new Set(['fresh']));
    const result = await strategy.get(cacheKey, async () => freshResult);

    expect(result).toBe(freshResult);
    expect(cache.get(cacheKey).value).toBe(freshResult);

    const debugMessages = logger.debugEntries.map((entry) => entry.message);
    expect(debugMessages).toEqual(
      expect.arrayContaining([
        'Cache entry expired',
        'Cache miss',
        'Cached value',
      ])
    );
  });

  it('treats entries without timestamps as invalid when using synchronous lookups', () => {
    cache.set(cacheKey, {
      value: ActionResult.success(new Set(['missingTimestamp'])),
    });

    const value = strategy.getSync(cacheKey);

    expect(value).toBeNull();
    expect(cache.has(cacheKey)).toBe(false);
    expect(
      logger.debugEntries.find(
        (entry) => entry.message === 'Cache entry expired'
      )
    ).toBeDefined();
  });

  it('falls back to default TTL when cached entry omits ttl metadata', () => {
    const withDefaultTTL = ActionResult.success(new Set(['kept']));
    cache.set(cacheKey, {
      value: withDefaultTTL,
      timestamp: Date.now(),
      // ttl intentionally omitted so #isValid uses defaultTTL branch
    });

    const value = strategy.getSync(cacheKey);

    expect(value).toBe(withDefaultTTL);
    expect(
      logger.debugEntries.find((entry) => entry.message === 'Cache hit')
    ).toBeDefined();
  });

  it('does not emit invalidation logs when no keys match predicate', () => {
    cache.set(`${cacheKey}:a`, {
      value: ActionResult.success(new Set(['a'])),
      timestamp: Date.now(),
      ttl: 50,
    });

    const removed = strategy.invalidateMatching((key) => key.endsWith(':z'));

    expect(removed).toBe(0);
    expect(logger.infoEntries.length).toBe(0);
    expect(cache.size).toBe(1);
  });
});
