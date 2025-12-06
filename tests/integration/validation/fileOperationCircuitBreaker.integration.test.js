import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import FileOperationCircuitBreaker, {
  CircuitBreakerState,
  CircuitBreakerError,
} from '../../../src/validation/fileOperationCircuitBreaker.js';

class IntegrationLogger {
  constructor() {
    /** @type {Record<'debug'|'info'|'warn'|'error', Array<{ message: string, context?: object }>>} */
    this.records = {
      debug: [],
      info: [],
      warn: [],
      error: [],
    };
  }

  #record(level, message, context) {
    this.records[level].push({ message, context });
  }

  debug(message, context) {
    this.#record('debug', message, context);
  }

  info(message, context) {
    this.#record('info', message, context);
  }

  warn(message, context) {
    this.#record('warn', message, context);
  }

  error(message, context) {
    this.#record('error', message, context);
  }
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const createBreaker = (overrides = {}) => {
  const logger = new IntegrationLogger();
  const breaker = new FileOperationCircuitBreaker({
    config: {
      failureThreshold: 2,
      recoveryTimeout: 80,
      monitoringWindow: 150,
      successThreshold: 2,
      halfOpenTimeout: 120,
      ...overrides,
    },
    logger,
  });
  return { breaker, logger };
};

describe('FileOperationCircuitBreaker integration with file system operations', () => {
  let tempDir;
  let readableFile;
  let missingFile;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'focb-int-'));
    readableFile = path.join(tempDir, 'available.txt');
    missingFile = path.join(tempDir, 'missing.txt');
    await fs.writeFile(readableFile, 'live-data');
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('recovers from real file operation failures and returns to closed state', async () => {
    const { breaker, logger } = createBreaker();

    const readExisting = () => fs.readFile(readableFile, 'utf8');
    const readMissing = () => fs.readFile(missingFile, 'utf8');

    const firstResult = await breaker.executeOperation(readExisting, {
      operation: 'initial-read',
    });
    expect(firstResult).toBe('live-data');
    expect(breaker.state).toBe(CircuitBreakerState.CLOSED);

    await expect(
      breaker.executeOperation(readMissing, { attempt: 1 })
    ).rejects.toThrow(/ENOENT/);
    await expect(
      breaker.executeOperation(readMissing, { attempt: 2 })
    ).rejects.toThrow(/ENOENT/);
    expect(breaker.state).toBe(CircuitBreakerState.OPEN);
    expect(
      logger.records.error.some(({ message }) =>
        message.includes('Circuit breaker opened')
      )
    ).toBe(true);

    let blockedError;
    await expect(
      breaker
        .executeOperation(readExisting, { attempt: 'blocked' })
        .catch((error) => {
          blockedError = error;
          throw error;
        })
    ).rejects.toBeInstanceOf(CircuitBreakerError);
    expect(blockedError.context.timeUntilRetry).toBeGreaterThan(0);
    const openStats = breaker.getStats();
    expect(openStats.canAttempt).toBe(false);

    await delay(90);
    expect(breaker.state).toBe(CircuitBreakerState.HALF_OPEN);
    const halfOpenStats = breaker.getStats();
    expect(halfOpenStats.canAttempt).toBe(true);

    const recoveryOne = await breaker.executeOperation(readExisting, {
      phase: 'half-open-success-1',
    });
    expect(recoveryOne).toBe('live-data');
    expect(breaker.state).toBe(CircuitBreakerState.HALF_OPEN);

    const recoveryTwo = await breaker.executeOperation(readExisting, {
      phase: 'half-open-success-2',
    });
    expect(recoveryTwo).toBe('live-data');
    expect(breaker.state).toBe(CircuitBreakerState.CLOSED);

    const finalStats = breaker.getStats();
    expect(finalStats.failureCount).toBe(0);
    expect(finalStats.recentFailures).toBe(0);
    expect(finalStats.canAttempt).toBe(true);
    expect(
      logger.records.info.some(
        ({ message, context }) =>
          message.includes('Circuit breaker closed') &&
          context?.reason === 'Success threshold reached'
      )
    ).toBe(true);
  });

  it('supports manual overrides, half-open timeouts, and monitoring window cleanup', async () => {
    const { breaker, logger } = createBreaker({
      recoveryTimeout: 60,
      halfOpenTimeout: 70,
      monitoringWindow: 90,
      successThreshold: 1,
    });

    const readExisting = () => fs.readFile(readableFile, 'utf8');
    const readMissing = () => fs.readFile(missingFile, 'utf8');

    breaker.open('maintenance-window');
    expect(breaker.state).toBe(CircuitBreakerState.OPEN);

    let manualBlockedError;
    await expect(
      breaker
        .executeOperation(readExisting, { phase: 'manual-open-blocked' })
        .catch((error) => {
          manualBlockedError = error;
          throw error;
        })
    ).rejects.toBeInstanceOf(CircuitBreakerError);
    expect(manualBlockedError.context.timeUntilRetry).toBeNull();

    await delay(70);
    expect(breaker.state).toBe(CircuitBreakerState.HALF_OPEN);

    await delay(80);
    expect(breaker.state).toBe(CircuitBreakerState.OPEN);

    await delay(70);
    expect(breaker.state).toBe(CircuitBreakerState.HALF_OPEN);

    await expect(
      breaker.executeOperation(readMissing, { phase: 'half-open-failure' })
    ).rejects.toThrow(/ENOENT/);
    expect(breaker.state).toBe(CircuitBreakerState.OPEN);
    expect(
      logger.records.error.some(
        ({ message, context }) =>
          message.includes('Circuit breaker opened') &&
          context?.reason === 'Failure in half-open state'
      )
    ).toBe(true);

    await delay(70);
    expect(breaker.state).toBe(CircuitBreakerState.HALF_OPEN);

    await expect(
      breaker.executeOperation(readExisting, { phase: 'closing-success' })
    ).resolves.toBe('live-data');
    expect(breaker.state).toBe(CircuitBreakerState.CLOSED);

    await expect(
      breaker.executeOperation(readMissing, {
        phase: 'first-post-close-failure',
      })
    ).rejects.toThrow(/ENOENT/);
    await delay(100);
    await expect(
      breaker.executeOperation(readMissing, {
        phase: 'second-post-close-failure',
      })
    ).rejects.toThrow(/ENOENT/);
    const stats = breaker.getStats();
    expect(stats.recentFailures).toBe(1);

    breaker.reset();
    expect(breaker.state).toBe(CircuitBreakerState.CLOSED);
    const resetStats = breaker.getStats();
    expect(resetStats.failureCount).toBe(0);
    expect(resetStats.successCount).toBe(0);
    expect(
      logger.records.info.some(({ message }) =>
        message.includes('Circuit breaker manually reset')
      )
    ).toBe(true);
  });
});
