import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import FileOperationCircuitBreaker, {
  CircuitBreakerState,
  CircuitBreakerError,
} from '../../../src/validation/fileOperationCircuitBreaker.js';

class RecordingLogger {
  constructor() {
    /** @type {Record<'debug'|'info'|'warn'|'error', Array<{ message: string, context?: object }>>} */
    this.records = {
      debug: [],
      info: [],
      warn: [],
      error: [],
    };
  }

  #push(level, message, context) {
    this.records[level].push({ message, context });
  }

  debug(message, context) {
    this.#push('debug', message, context);
  }

  info(message, context) {
    this.#push('info', message, context);
  }

  warn(message, context) {
    this.#push('warn', message, context);
  }

  error(message, context) {
    this.#push('error', message, context);
  }
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('FileOperationCircuitBreaker additional integration coverage', () => {
  let tempDir;
  let readableFile;
  let missingFile;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'focb-extra-'));
    readableFile = path.join(tempDir, 'available.txt');
    missingFile = path.join(tempDir, 'missing.txt');
    await fs.writeFile(readableFile, 'live-data');
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('uses default configuration fallbacks and clears scheduled timers on reset', async () => {
    const logger = new RecordingLogger();
    const breaker = new FileOperationCircuitBreaker({ logger });

    // Defaults should be applied when config values are missing
    expect(breaker.failureThreshold).toBe(5);
    expect(breaker.recoveryTimeout).toBe(60000);
    expect(breaker.monitoringWindow).toBe(300000);
    expect(breaker.successThreshold).toBe(3);
    expect(breaker.halfOpenTimeout).toBe(30000);

    breaker.open();
    expect(breaker.state).toBe(CircuitBreakerState.OPEN);

    const blocked = await breaker
      .executeOperation(() => fs.readFile(readableFile, 'utf8'), {
        attempt: 'blocked-default-open',
      })
      .catch((error) => error);

    expect(blocked).toBeInstanceOf(CircuitBreakerError);
    expect(blocked.context.failureCount).toBe(0);
    expect(blocked.context.timeUntilRetry).toBeNull();

    // Manual open without a reason should use the default label
    expect(
      logger.records.error.some(
        ({ message, context }) =>
          message.includes('Circuit breaker opened') &&
          context?.reason === 'Manual open'
      )
    ).toBe(true);

    // Ensure reset clears the scheduled half-open timer
    breaker.reset();
    expect(breaker.state).toBe(CircuitBreakerState.CLOSED);
    expect(
      logger.records.info.some(({ message }) =>
        message.includes('Circuit breaker manually reset')
      )
    ).toBe(true);

    const result = await breaker.executeOperation(
      () => fs.readFile(readableFile, 'utf8'),
      { attempt: 'post-reset' }
    );
    expect(result).toBe('live-data');
  });

  it('clears failure history after recovery and transitions to half-open automatically', async () => {
    const logger = new RecordingLogger();
    const breaker = new FileOperationCircuitBreaker({
      config: {
        failureThreshold: 3,
        recoveryTimeout: 50,
        monitoringWindow: 200,
        successThreshold: 2,
        halfOpenTimeout: 80,
      },
      logger,
    });

    const readExisting = () => fs.readFile(readableFile, 'utf8');
    const readMissing = () => fs.readFile(missingFile, 'utf8');

    await expect(
      breaker.executeOperation(readMissing, { phase: 'pre-threshold-failure' })
    ).rejects.toThrow(/ENOENT/);
    expect(breaker.state).toBe(CircuitBreakerState.CLOSED);
    expect(breaker.getStats().failureCount).toBe(1);

    const recovery = await breaker.executeOperation(readExisting, {
      phase: 'recovery-success',
    });
    expect(recovery).toBe('live-data');
    const statsAfterRecovery = breaker.getStats();
    expect(statsAfterRecovery.failureCount).toBe(0);
    expect(statsAfterRecovery.recentFailures).toBe(0);

    await expect(
      breaker.executeOperation(readMissing, { phase: 'open-first' })
    ).rejects.toThrow(/ENOENT/);
    await expect(
      breaker.executeOperation(readMissing, { phase: 'open-second' })
    ).rejects.toThrow(/ENOENT/);
    await expect(
      breaker.executeOperation(readMissing, { phase: 'open-third' })
    ).rejects.toThrow(/ENOENT/);

    expect(breaker.state).toBe(CircuitBreakerState.OPEN);

    // Allow the recovery timeout to elapse so the breaker transitions automatically
    await delay(70);
    const statsAfterTimeout = breaker.getStats();
    expect(breaker.state).toBe(CircuitBreakerState.HALF_OPEN);
    expect(statsAfterTimeout.canAttempt).toBe(true);

    // Successful attempts in half-open state should close the breaker again
    const halfOpenSuccess = await breaker.executeOperation(readExisting, {
      phase: 'half-open-success',
    });
    expect(halfOpenSuccess).toBe('live-data');

    const finalSuccess = await breaker.executeOperation(readExisting, {
      phase: 'final-close-success',
    });
    expect(finalSuccess).toBe('live-data');
    expect(breaker.state).toBe(CircuitBreakerState.CLOSED);
  });
});
