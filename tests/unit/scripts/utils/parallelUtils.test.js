/**
 * @jest-environment node
 */
import { jest } from '@jest/globals';

const {
  parallelLimit,
  batchProcess,
  withTimeout,
  retryWithBackoff,
  createSemaphore,
} = require('../../../../scripts/utils/parallelUtils.js');

describe('parallelUtils.parallelLimit', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('respects concurrency limits and preserves task ordering', async () => {
    jest.useFakeTimers();

    let active = 0;
    let maxActive = 0;
    const completionOrder = [];

    const makeTask = (label, delay) => () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      return new Promise((resolve) => {
        setTimeout(() => {
          completionOrder.push(label);
          active -= 1;
          resolve(label);
        }, delay);
      });
    };

    const tasks = [
      makeTask('first', 30),
      makeTask('second', 10),
      makeTask('third', 5),
      makeTask('fourth', 25),
    ];

    const promise = parallelLimit(tasks, 2);

    await Promise.resolve();
    await jest.runAllTimersAsync();
    const results = await promise;

    expect(maxActive).toBeLessThanOrEqual(2);
    expect(completionOrder).toEqual(['second', 'third', 'first', 'fourth']);
    expect(results).toEqual([
      { status: 'fulfilled', value: 'first' },
      { status: 'fulfilled', value: 'second' },
      { status: 'fulfilled', value: 'third' },
      { status: 'fulfilled', value: 'fourth' },
    ]);
  });

  test('captures rejections without failing the overall execution', async () => {
    jest.useFakeTimers();

    const expectedError = new Error('boom');
    const tasks = [
      async () => 'ok',
      async () => {
        throw expectedError;
      },
      async () => 'still works',
    ];

    const resultsPromise = parallelLimit(tasks, 2);
    await jest.runAllTimersAsync();
    const results = await resultsPromise;

    expect(results[0]).toEqual({ status: 'fulfilled', value: 'ok' });
    expect(results[1]).toEqual({ status: 'rejected', reason: expectedError });
    expect(results[2]).toEqual({ status: 'fulfilled', value: 'still works' });
  });
});

describe('parallelUtils.batchProcess', () => {
  test('processes items in batches and preserves processor order', async () => {
    const processed = [];
    const processor = jest.fn(async (item) => {
      processed.push(item);
      return `${item}-done`;
    });

    const result = await batchProcess(['a', 'b', 'c', 'd'], processor, 2);

    expect(result).toEqual(['a-done', 'b-done', 'c-done', 'd-done']);
    expect(processor).toHaveBeenCalledTimes(4);
    expect(processed).toEqual(['a', 'b', 'c', 'd']);
  });

  test('propagates processor errors immediately', async () => {
    const processor = jest.fn(async (item) => {
      if (item === 'b') {
        throw new Error('failure');
      }
      return item;
    });

    await expect(batchProcess(['a', 'b', 'c'], processor, 2)).rejects.toThrow(
      'failure'
    );
    expect(processor).toHaveBeenCalledTimes(2);
  });
});

describe('parallelUtils.withTimeout', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test('resolves when the operation finishes before the timeout', async () => {
    jest.useFakeTimers();

    const resultPromise = withTimeout(
      new Promise((resolve) => setTimeout(() => resolve('done'), 50)),
      100
    );

    await jest.advanceTimersByTimeAsync(50);
    await expect(resultPromise).resolves.toBe('done');
  });
});

describe('parallelUtils.retryWithBackoff', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('retries operations with exponential backoff before succeeding', async () => {
    jest.useFakeTimers();
    const operation = jest
      .fn()
      .mockRejectedValueOnce(new Error('first fail'))
      .mockRejectedValueOnce(new Error('second fail'))
      .mockRejectedValueOnce(new Error('third fail'))
      .mockResolvedValue('success');

    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    const promise = retryWithBackoff(operation, {
      maxRetries: 3,
      initialDelay: 100,
      maxDelay: 250,
      factor: 2,
    });

    await Promise.resolve();
    expect(operation).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(100);
    await Promise.resolve();
    expect(operation).toHaveBeenCalledTimes(2);

    await jest.advanceTimersByTimeAsync(200);
    await Promise.resolve();
    expect(operation).toHaveBeenCalledTimes(3);

    await jest.advanceTimersByTimeAsync(250);
    await Promise.resolve();

    await expect(promise).resolves.toBe('success');
    expect(operation).toHaveBeenCalledTimes(4);
    expect(
      setTimeoutSpy.mock.calls.slice(0, 3).map(([, delay]) => delay)
    ).toEqual([100, 200, 250]);
  });
});

describe('parallelUtils.createSemaphore', () => {
  test('enforces concurrency and releases waiting tasks in order', async () => {
    const semaphore = createSemaphore(1);

    await semaphore.acquire();

    let secondAcquired = false;
    const secondAcquire = semaphore.acquire().then(() => {
      secondAcquired = true;
    });

    await Promise.resolve();
    expect(secondAcquired).toBe(false);

    semaphore.release();
    await secondAcquire;
    expect(secondAcquired).toBe(true);

    semaphore.release();

    let immediateAcquired = false;
    await semaphore.acquire();
    immediateAcquired = true;

    expect(immediateAcquired).toBe(true);

    semaphore.release();
  });
});
