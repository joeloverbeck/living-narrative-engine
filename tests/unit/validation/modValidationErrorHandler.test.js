import { describe, it, expect, jest } from '@jest/globals';
import {
  ModValidationErrorHandler,
  ErrorType,
  RecoveryStrategy,
} from '../../../src/validation/modValidationErrorHandler.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { ModAccessError } from '../../../src/errors/modAccessError.js';
import { ModCorruptionError } from '../../../src/errors/modCorruptionError.js';
import { ModValidationError } from '../../../src/errors/modValidationError.js';
import {
  ModSecurityError,
  SecurityLevel,
} from '../../../src/errors/modSecurityError.js';
import {
  createMockLogger,
  createMockValidatedEventDispatcher,
} from '../../common/mockFactories/index.js';

const createHandler = (options = {}) => {
  const logger = options.logger ?? createMockLogger();
  const eventBus =
    options.eventBus ??
    (options.includeEventBus ? createMockValidatedEventDispatcher() : null);

  return {
    handler: new ModValidationErrorHandler({
      logger,
      eventBus,
      config: options.config,
    }),
    logger,
    eventBus,
  };
};

describe('ModValidationErrorHandler', () => {
  it('throws when logger dependency is invalid', () => {
    expect(
      () => new ModValidationErrorHandler({ logger: /** @type {any} */ ({}) })
    ).toThrow(InvalidArgumentError);
  });

  it('throws when event bus dependency is invalid', () => {
    const logger = createMockLogger();

    expect(
      () =>
        new ModValidationErrorHandler({
          logger,
          // Missing dispatch method
          eventBus: /** @type {any} */ ({}),
        })
    ).toThrow(InvalidArgumentError);
  });

  it('applies defaults for access errors and dispatches events', () => {
    const logger = createMockLogger();
    const eventBus = createMockValidatedEventDispatcher();
    const handler = new ModValidationErrorHandler({ logger, eventBus });
    const error = new Error('ENOENT: file not found');
    const context = {
      filePath: 'mods/test/mod.json',
      hasDefault: true,
      defaultValue: { id: 'default-mod' },
    };

    const result = handler.handleExtractionError(error, context);

    expect(result.strategy).toBe(RecoveryStrategy.USE_DEFAULT);
    expect(result.usedDefault).toBe(true);
    expect(result.partialResults).toEqual(context.defaultValue);
    expect(result.degradationApplied).toBe(true);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Handling extraction error'),
      expect.objectContaining({
        errorType: ErrorType.ACCESS,
        strategy: RecoveryStrategy.USE_DEFAULT,
        context,
      })
    );
    expect(eventBus.dispatch).toHaveBeenCalledWith({
      type: 'MOD_VALIDATION_ERROR',
      payload: {
        error: error.message,
        errorType: ErrorType.ACCESS,
        context,
        strategy: RecoveryStrategy.USE_DEFAULT,
      },
    });

    const stats = handler.getErrorStatistics();
    expect(stats.totalErrors).toBe(1);
    expect(stats.errorsByType[ErrorType.ACCESS]).toBe(1);
    expect(stats.recentErrors[0].type).toBe(ErrorType.ACCESS);
  });

  it('skips recoverable access errors when no defaults exist', () => {
    const { handler } = createHandler();
    const accessError = new ModAccessError(
      'ENOENT: missing file',
      'mods/missing.json',
      {}
    );

    const result = handler.handleExtractionError(accessError, {
      filePath: 'mods/missing.json',
    });

    expect(result.strategy).toBe(RecoveryStrategy.SKIP);
    expect(result.skipped).toBe(true);
    expect(result.degradationApplied).toBe(true);
  });

  it('retries timeout errors and skips after exceeding retry limit', () => {
    const logger = createMockLogger();
    const { handler } = createHandler({ logger, config: { maxRetries: 1 } });
    const context = {
      filePath: 'mods/sample/timeout.json',
      partialData: { fallback: true },
    };

    const retryResult = handler.handleExtractionError(
      new Error('Operation timeout while reading file'),
      context
    );

    expect(retryResult.strategy).toBe(RecoveryStrategy.RETRY);
    expect(retryResult.shouldRetry).toBe(true);
    expect(retryResult.retryCount).toBe(1);

    const skipResult = handler.handleExtractionError(
      new Error('timeout again retrieving file'),
      context
    );

    expect(skipResult.strategy).toBe(RecoveryStrategy.SKIP);
    expect(skipResult.skipped).toBe(true);
    expect(skipResult.degradationApplied).toBe(true);
    expect(skipResult.partialResults).toEqual(context.partialData);

    const stats = handler.getErrorStatistics();
    expect(stats.errorsByType[ErrorType.TIMEOUT]).toBe(2);
  });

  it('returns partial results when corruption errors allow recovery', () => {
    const { handler } = createHandler();
    const error = new ModCorruptionError('Malformed JSON', 'mods/bad.json', {
      partialData: { kept: true },
    });
    const context = {
      filePath: 'mods/bad.json',
      partialData: { kept: true },
    };

    const result = handler.handleExtractionError(error, context);

    expect(result.strategy).toBe(RecoveryStrategy.PARTIAL_RESULT);
    expect(result.partialResults).toEqual(context.partialData);
    expect(result.degradationApplied).toBe(true);
  });

  it('throws for unrecoverable corruption errors detected by message', () => {
    const { handler } = createHandler();
    const error = new Error('Unexpected token in JSON');

    expect(() =>
      handler.handleExtractionError(error, { filePath: 'mods/broken.json' })
    ).toThrow(error);
  });

  it('quarantines security errors and rethrows them', () => {
    const logger = createMockLogger();
    const { handler } = createHandler({ logger });
    const securityError = new ModSecurityError(
      'Malicious content detected',
      SecurityLevel.CRITICAL,
      { module: 'evil-mod' }
    );

    expect(() =>
      handler.handleExtractionError(securityError, { modPath: 'mods/evil' })
    ).toThrow(ModSecurityError);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Handling extraction error'),
      expect.objectContaining({
        errorType: ErrorType.SECURITY,
        strategy: RecoveryStrategy.QUARANTINE,
      })
    );
  });

  it('fails fast for resource exhaustion errors', () => {
    const { handler } = createHandler();
    const error = new Error('Memory allocation failure in parser');

    expect(() =>
      handler.handleExtractionError(error, { filePath: 'mods/large.json' })
    ).toThrow(error);
  });

  it('delegates validation errors that are not critical', () => {
    const { handler } = createHandler();
    const validationError = new ModValidationError(
      'Schema mismatch',
      'SCHEMA_ERROR',
      { field: 'id' },
      true
    );
    const context = {
      filePath: 'mods/validation.json',
      partialData: { recovered: true },
    };
    const extractionSpy = jest.spyOn(handler, 'handleExtractionError');

    const result = handler.handleValidationError(validationError, context);

    expect(extractionSpy).toHaveBeenCalledWith(validationError, context);
    expect(result.strategy).toBe(RecoveryStrategy.SKIP);
    extractionSpy.mockRestore();
  });

  it('throws on critical validation errors and logs them', () => {
    const logger = createMockLogger();
    const { handler } = createHandler({ logger });
    const securityError = new ModSecurityError(
      'Security breach',
      SecurityLevel.HIGH,
      { module: 'bad' }
    );

    expect(() =>
      handler.handleValidationError(securityError, { module: 'bad' })
    ).toThrow(ModSecurityError);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Critical validation error'),
      expect.objectContaining({
        errorType: ErrorType.SECURITY,
        context: { module: 'bad' },
      })
    );
  });

  it('creates enriched security errors for violations', () => {
    const logger = createMockLogger();
    const { handler } = createHandler({ logger });
    const violation = {
      message: 'Unauthorized access',
      level: SecurityLevel.MEDIUM,
    };

    expect(() =>
      handler.handleSecurityViolation(violation, { file: 'mods/bad' })
    ).toThrow(ModSecurityError);
    expect(logger.error).toHaveBeenCalledWith(
      'Security violation detected',
      expect.objectContaining({
        violation,
        context: { file: 'mods/bad' },
        incidentReport: expect.any(Object),
      })
    );
  });

  it('caps stored error history and reports statistics', () => {
    const { handler } = createHandler();

    for (let i = 0; i < 1001; i += 1) {
      handler.handleExtractionError(new Error(`issue ${i}`), {
        filePath: `mods/file-${i}.json`,
      });
    }

    const stats = handler.getErrorStatistics();
    expect(stats.totalErrors).toBe(1000);
    expect(stats.errorsByType[ErrorType.UNKNOWN]).toBe(1000);
    expect(stats.recentErrors).toHaveLength(10);
  });

  it('calculates recovery success rate across attempted recoveries', () => {
    const { handler } = createHandler({ config: { maxRetries: 1 } });

    handler.handleExtractionError(new Error('ENOENT: missing mod'), {
      filePath: 'mods/default.json',
      hasDefault: true,
      defaultValue: { id: 'fallback-mod' },
    });

    handler.handleExtractionError(new Error('timeout while loading'), {
      filePath: 'mods/retry.json',
      partialData: { safe: true },
    });

    expect(() =>
      handler.handleExtractionError(new Error('Unexpected token in JSON'), {
        filePath: 'mods/broken.json',
      })
    ).toThrow('Unexpected token in JSON');

    const stats = handler.getErrorStatistics();
    expect(stats.totalErrors).toBe(3);
    expect(stats.recoverySuccessRate).toBeCloseTo(33.33, 1);
  });

  it('supports overriding recovery strategy and guards unknown overrides', () => {
    const { handler } = createHandler();

    expect(() =>
      handler.handleExtractionError(new Error('mystery failure'), {
        filePath: 'mods/custom.json',
        overrideStrategy: 'CUSTOM',
      })
    ).toThrow('mystery failure');
  });

  it('resets history and retry tracking', () => {
    const logger = createMockLogger();
    const { handler } = createHandler({ logger, config: { maxRetries: 1 } });

    handler.handleExtractionError(new Error('timeout during load'), {
      filePath: 'mods/reset.json',
    });

    handler.reset();

    expect(logger.debug).toHaveBeenCalledWith('Error handler reset');
    const stats = handler.getErrorStatistics();
    expect(stats.totalErrors).toBe(0);

    const result = handler.handleExtractionError(
      new Error('timeout during load'),
      { filePath: 'mods/reset.json' }
    );

    expect(result.retryCount).toBe(1);
  });
});
