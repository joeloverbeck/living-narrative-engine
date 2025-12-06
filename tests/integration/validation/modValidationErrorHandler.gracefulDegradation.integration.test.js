/**
 * @file Integration tests that wire ModValidationErrorHandler with the graceful degradation engine.
 * @description Exercises the real implementations together to verify recovery strategies,
 *              degradation fallbacks, and event propagation without relying on mocks.
 */

import { describe, it, beforeEach, expect } from '@jest/globals';
import GracefulDegradation, {
  GracefulDegradation as GracefulDegradationClass,
  DegradationStrategy,
} from '../../../src/validation/gracefulDegradation.js';
import ModValidationErrorHandler, {
  ModValidationErrorHandler as ModValidationErrorHandlerClass,
  ErrorType,
  RecoveryStrategy,
} from '../../../src/validation/modValidationErrorHandler.js';
import { ModAccessError } from '../../../src/errors/modAccessError.js';
import { ModCorruptionError } from '../../../src/errors/modCorruptionError.js';
import { ModValidationError } from '../../../src/errors/modValidationError.js';
import {
  ModSecurityError,
  SecurityLevel,
} from '../../../src/errors/modSecurityError.js';

/**
 * Lightweight logger that captures structured messages from the real services.
 * Implements the same shape that dependency validation expects.
 */
class MemoryLogger {
  constructor() {
    this.records = {
      info: [],
      warn: [],
      error: [],
      debug: [],
    };
  }

  info(message, context) {
    this.records.info.push({ message, context });
  }

  warn(message, context) {
    this.records.warn.push({ message, context });
  }

  error(message, context) {
    this.records.error.push({ message, context });
  }

  debug(message, context) {
    this.records.debug.push({ message, context });
  }
}

/**
 * Minimal event bus implementation used by the integration harness.
 * Matches the signature the handler expects (`dispatch(eventObject)`).
 */
class RecordingEventBus {
  constructor(logger) {
    this.logger = logger;
    this.events = [];
  }

  dispatch(event) {
    this.events.push(event);
    this.logger.debug('event-dispatched', event);
    return Promise.resolve();
  }
}

/**
 * Small orchestrator that routes errors through the handler and applies degradation
 * whenever the recovery strategy indicates that fallback data should be returned.
 */
class ValidationRecoveryPipeline {
  constructor({ handler, degradation }) {
    this.handler = handler;
    this.degradation = degradation;
  }

  processExtraction(error, context) {
    const recovery = this.handler.handleExtractionError(error, context);
    const degradationResult = recovery.degradationApplied
      ? this.degradation.applyDegradation(
          this.#mapErrorForDegradation(error),
          this.#decorateContext(context)
        )
      : null;

    return { recovery, degradation: degradationResult };
  }

  processValidation(error, context) {
    const recovery = this.handler.handleValidationError(error, context);
    const degradationResult = recovery.degradationApplied
      ? this.degradation.applyDegradation(
          this.#mapErrorForDegradation(error),
          this.#decorateContext(context)
        )
      : null;

    return { recovery, degradation: degradationResult };
  }

  #decorateContext(context) {
    return {
      ...context,
      cacheKey: context.cacheKey || context.filePath || context.modPath,
    };
  }

  #mapErrorForDegradation(error) {
    if (error instanceof ModAccessError) {
      const normalized = new Error(error.message);
      normalized.code = 'ACCESS';
      return normalized;
    }

    if (error instanceof ModCorruptionError) {
      const normalized = new Error(error.message);
      normalized.code = 'CORRUPTION';
      return normalized;
    }

    if (error instanceof ModValidationError) {
      const normalized = new Error(error.message);
      normalized.code = error.code || 'VALIDATION';
      return normalized;
    }

    return error;
  }
}

describe('Mod validation error handling with graceful degradation (integration)', () => {
  /** @type {MemoryLogger} */
  let logger;
  /** @type {RecordingEventBus} */
  let eventBus;
  /** @type {GracefulDegradationClass} */
  let degradation;
  /** @type {ModValidationErrorHandlerClass} */
  let handler;
  /** @type {ValidationRecoveryPipeline} */
  let pipeline;

  beforeEach(() => {
    logger = new MemoryLogger();
    eventBus = new RecordingEventBus(logger);

    const cache = new Map();
    cache.set('/mods/physical-control/actions/turn_around.action.json', {
      id: 'physical-control:turn_around',
      cached: true,
    });

    const defaults = {
      'mod.positioning': { id: 'positioning', partial: true },
      'component.core:actor': { id: 'core:actor', data: {}, partial: true },
    };

    degradation = new GracefulDegradationClass({ logger, cache, defaults });
    handler = new ModValidationErrorHandlerClass({
      logger,
      eventBus,
      config: { maxRetries: 1 },
    });

    pipeline = new ValidationRecoveryPipeline({ handler, degradation });
  });

  it('reuses cached data when access errors occur and records emitted events', () => {
    const error = new ModAccessError(
      'ENOENT: missing file',
      '/mods/physical-control/actions/turn_around.action.json',
      { hasDefault: true }
    );

    const context = {
      filePath: '/mods/physical-control/actions/turn_around.action.json',
      modId: 'positioning',
      type: 'mod',
      hasDefault: true,
      hasCache: true,
      defaultValue: { id: 'physical-control:turn_around', placeholder: true },
    };

    const { recovery, degradation: degradationResult } =
      pipeline.processExtraction(error, context);

    expect(recovery.strategy).toBe(RecoveryStrategy.USE_DEFAULT);
    expect(recovery.usedDefault).toBe(true);
    expect(recovery.partialResults).toEqual(context.defaultValue);
    expect(degradationResult.strategy).toBe(DegradationStrategy.USE_CACHED);
    expect(degradationResult.data).toEqual({
      id: 'physical-control:turn_around',
      cached: true,
    });

    expect(eventBus.events).toHaveLength(1);
    expect(eventBus.events[0]).toEqual({
      type: 'MOD_VALIDATION_ERROR',
      payload: expect.objectContaining({
        errorType: ErrorType.ACCESS,
        strategy: RecoveryStrategy.USE_DEFAULT,
        context,
      }),
    });

    expect(
      logger.records.warn.some((entry) =>
        entry.message.includes(
          'Handling extraction error: ENOENT: missing file'
        )
      )
    ).toBe(true);
  });

  it('returns partial results for recoverable corruption errors', () => {
    const error = new ModCorruptionError(
      'Malformed JSON data',
      'mods/bad.json',
      {
        partialData: { fragments: ['action', 'component'] },
      }
    );

    const context = {
      filePath: 'mods/bad.json',
      modId: 'broken-mod',
      partialData: { fragments: ['action', 'component'] },
    };

    const { recovery, degradation: degradationResult } =
      pipeline.processExtraction(error, context);

    expect(recovery.strategy).toBe(RecoveryStrategy.PARTIAL_RESULT);
    expect(recovery.partialResults).toEqual(context.partialData);
    expect(degradationResult.strategy).toBe(
      DegradationStrategy.PARTIAL_EXTRACTION
    );
    expect(degradationResult.data).toEqual(context.partialData);
  });

  it('retries timeouts and eventually performs reduced validation fallback', () => {
    const context = {
      filePath: 'mods/slow.json',
      modId: 'slow-mod',
      partialData: { lastValid: { id: 'slow:action' } },
    };

    const firstAttempt = pipeline.processExtraction(
      new Error('Operation timeout while reading file'),
      context
    );

    expect(firstAttempt.recovery.strategy).toBe(RecoveryStrategy.RETRY);
    expect(firstAttempt.recovery.shouldRetry).toBe(true);
    expect(firstAttempt.degradation).toBeNull();

    const secondAttempt = pipeline.processExtraction(
      new Error('timeout again retrieving file'),
      context
    );

    expect(secondAttempt.recovery.strategy).toBe(RecoveryStrategy.SKIP);
    expect(secondAttempt.recovery.skipped).toBe(true);
    expect(secondAttempt.recovery.partialResults).toEqual(context.partialData);
    expect(secondAttempt.degradation.strategy).toBe(
      DegradationStrategy.REDUCED_VALIDATION
    );
    expect(secondAttempt.degradation.data).toEqual(
      expect.objectContaining({
        reduced: true,
        message: expect.stringContaining('Reduced validation'),
      })
    );

    expect(eventBus.events).toHaveLength(2);
    expect(eventBus.events[1].payload.errorType).toBe(ErrorType.TIMEOUT);
  });

  it('fails fast for resource exhaustion and security incidents', () => {
    const resourceContext = {
      filePath: 'mods/huge.json',
      modId: 'resource-heavy',
    };

    expect(() =>
      pipeline.processExtraction(
        new Error('Memory allocation failure in parser'),
        resourceContext
      )
    ).toThrow('Memory allocation failure in parser');

    const securityError = new ModSecurityError(
      'Malicious content detected',
      SecurityLevel.CRITICAL,
      { module: 'evil-mod' }
    );

    const securityContext = {
      modPath: 'mods/evil',
      filePath: 'mods/evil/mod.json',
    };

    expect(() =>
      pipeline.processExtraction(securityError, securityContext)
    ).toThrow(ModSecurityError);

    expect(eventBus.events[eventBus.events.length - 1].payload.errorType).toBe(
      ErrorType.SECURITY
    );
    expect(
      logger.records.warn.some((entry) =>
        entry.message.includes(
          'Handling extraction error: Malicious content detected'
        )
      )
    ).toBe(true);
  });

  it('delegates non-critical validation errors and throws on critical ones', () => {
    const validationError = new ModValidationError(
      'Schema mismatch',
      'SCHEMA_ERROR',
      { field: 'id' },
      true
    );

    const validationContext = {
      filePath: 'mods/core/action.json',
      modId: 'core',
      partialData: { recovered: true },
      allowSkip: true,
    };

    const { recovery, degradation: degradationResult } =
      pipeline.processValidation(validationError, validationContext);

    expect(recovery.strategy).toBe(RecoveryStrategy.SKIP);
    expect(recovery.degradationApplied).toBe(true);
    expect(degradationResult.strategy).toBe(DegradationStrategy.SKIP_FILE);

    expect(() =>
      pipeline.processValidation(
        new ModSecurityError('Security breach', SecurityLevel.HIGH, {
          module: 'bad',
        }),
        { module: 'bad' }
      )
    ).toThrow(ModSecurityError);
  });

  it('aggregates statistics across both systems and resets cleanly', () => {
    const missingError = new Error('ENOENT: missing mod');
    missingError.code = 'ACCESS';
    pipeline.processExtraction(missingError, {
      filePath: 'mods/missing.json',
      modId: 'missing',
      type: 'mod',
      hasDefault: true,
      defaultValue: { id: 'missing', placeholder: true },
    });

    pipeline.processExtraction(new Error('timeout waiting for manifest'), {
      filePath: 'mods/wait.json',
      modId: 'wait',
      partialData: { id: 'wait:manifest' },
    });

    pipeline.processExtraction(
      new Error('timeout waiting for manifest again'),
      {
        filePath: 'mods/wait.json',
        modId: 'wait',
        partialData: { id: 'wait:manifest' },
      }
    );

    const corruptionError = new ModCorruptionError(
      'Corruption detected',
      'mods/corrupt.json',
      { partialData: { kept: true } }
    );
    pipeline.processExtraction(corruptionError, {
      filePath: 'mods/corrupt.json',
      modId: 'corrupt',
      partialData: { kept: true },
    });

    const errorStats = handler.getErrorStatistics();
    expect(errorStats.totalErrors).toBe(4);
    expect(errorStats.errorsByType[ErrorType.ACCESS]).toBeGreaterThanOrEqual(1);
    expect(errorStats.errorsByType[ErrorType.TIMEOUT]).toBeGreaterThanOrEqual(
      1
    );
    expect(errorStats.recentErrors).toHaveLength(4);

    const degradationStats = degradation.getStatistics();
    expect(degradationStats.totalDegradations).toBe(3);
    expect(
      Object.keys(degradationStats.byStrategy).length
    ).toBeGreaterThanOrEqual(2);

    handler.reset();
    degradation.reset();

    expect(handler.getErrorStatistics().totalErrors).toBe(0);
    expect(degradation.getStatistics().totalDegradations).toBe(0);
  });
});
