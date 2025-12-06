import { describe, it, expect } from '@jest/globals';
import {
  CircuitBreaker,
  CircuitBreakerState,
} from '../../../src/clothing/monitoring/circuitBreaker.js';
import { ClothingServiceError } from '../../../src/clothing/errors/clothingErrors.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 *
 */
function createRecordingLogger() {
  const entries = [];
  return {
    logger: {
      debug: (message, context) =>
        entries.push({ level: 'debug', message, context }),
      info: (message, context) =>
        entries.push({ level: 'info', message, context }),
      warn: (message, context) =>
        entries.push({ level: 'warn', message, context }),
      error: (message, context) =>
        entries.push({ level: 'error', message, context }),
    },
    entries,
  };
}

describe('Clothing CircuitBreaker integration', () => {
  it('executes operations successfully and clears failure counters', async () => {
    const { logger, entries } = createRecordingLogger();
    const breaker = new CircuitBreaker('render-service', 3, 1_000, logger);

    const result = await breaker.execute(async () => 'render-complete');

    expect(result).toBe('render-complete');
    expect(breaker.isClosed()).toBe(true);
    expect(breaker.getState().failureCount).toBe(0);
    expect(entries.some((event) => event.level === 'warn')).toBe(false);
  });

  it('opens after repeated failures and uses provided fallback while open', async () => {
    const { logger, entries } = createRecordingLogger();
    const breaker = new CircuitBreaker('texture-cache', 2, 5_000, logger);

    await expect(
      breaker.execute(async () => {
        throw new Error('disk offline');
      })
    ).rejects.toThrow('disk offline');

    await expect(
      breaker.execute(async () => {
        throw new Error('still offline');
      })
    ).rejects.toThrow('still offline');

    expect(breaker.isOpen()).toBe(true);

    const fallbackValue = await breaker.execute(
      async () => {
        throw new Error('should not run when open');
      },
      () => 'cached-response'
    );

    expect(fallbackValue).toBe('cached-response');
    expect(breaker.isOpen()).toBe(true);
    expect(
      entries.find((event) => event.message.includes('using fallback'))
    ).toBeDefined();
  });

  it('throws ClothingServiceError when circuit is open without fallback', async () => {
    const { logger } = createRecordingLogger();
    const breaker = new CircuitBreaker('inventory-sync', 1, 5_000, logger);

    await expect(
      breaker.execute(async () => {
        throw new Error('sync failed');
      })
    ).rejects.toThrow('sync failed');

    await expect(
      breaker.execute(async () => 'should-not-execute')
    ).rejects.toBeInstanceOf(ClothingServiceError);
  });

  it('recovers through half-open state after timeout and closes on sustained success', async () => {
    const { logger, entries } = createRecordingLogger();
    const breaker = new CircuitBreaker('wardrobe-service', 1, 20, logger, 2);

    await expect(
      breaker.execute(async () => {
        throw new Error('initial outage');
      })
    ).rejects.toThrow('initial outage');

    expect(breaker.isOpen()).toBe(true);

    await delay(30);

    const firstSuccess = await breaker.execute(async () => 'partial-recovery');
    expect(firstSuccess).toBe('partial-recovery');
    expect(breaker.isHalfOpen()).toBe(true);

    const secondSuccess = await breaker.execute(async () => 'full-recovery');
    expect(secondSuccess).toBe('full-recovery');
    expect(breaker.isClosed()).toBe(true);

    expect(
      entries.find((event) => event.message.includes('HALF_OPEN'))
    ).toBeDefined();
    expect(
      entries.find((event) => event.message.includes('CLOSED'))
    ).toBeDefined();
  });

  it('reopens when a half-open attempt fails and supports manual state controls', async () => {
    const { logger } = createRecordingLogger();
    const breaker = new CircuitBreaker('dye-processor', 1, 10, logger);

    await expect(
      breaker.execute(async () => {
        throw new Error('processor overheated');
      })
    ).rejects.toThrow('processor overheated');

    expect(breaker.isOpen()).toBe(true);

    await delay(15);

    await expect(
      breaker.execute(async () => {
        throw new Error('cooling failed');
      })
    ).rejects.toThrow('cooling failed');

    expect(breaker.isOpen()).toBe(true);

    const stateSnapshot = breaker.getState();
    expect(stateSnapshot.state).toBe(CircuitBreakerState.OPEN);
    expect(stateSnapshot.failureCount).toBeGreaterThanOrEqual(1);
    expect(stateSnapshot.serviceName).toBe('dye-processor');

    breaker.forceClosed();
    expect(breaker.isClosed()).toBe(true);

    breaker.forceOpen();
    expect(breaker.isOpen()).toBe(true);

    breaker.reset();
    expect(breaker.isClosed()).toBe(true);
    expect(breaker.getState().failureCount).toBe(0);
  });
});
