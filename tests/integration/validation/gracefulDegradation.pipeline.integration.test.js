/**
 * @file Integration tests exercising GracefulDegradation together with the
 *       ModValidationErrorHandler and related utilities. The scenarios walk
 *       through realistic validation flows in order to exercise the remaining
 *       branches inside the graceful degradation engine using real
 *       collaborators and stateful caches.
 */

import { describe, it, beforeEach, expect } from '@jest/globals';
import GracefulDegradation, {
  GracefulDegradation as GracefulDegradationClass,
  DegradationStrategy,
} from '../../../src/validation/gracefulDegradation.js';
import ModValidationErrorHandler, {
  ModValidationErrorHandler as ModValidationErrorHandlerClass,
  RecoveryStrategy,
} from '../../../src/validation/modValidationErrorHandler.js';
import { ModAccessError } from '../../../src/errors/modAccessError.js';
import { ModCorruptionError } from '../../../src/errors/modCorruptionError.js';
import { ModValidationError } from '../../../src/errors/modValidationError.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

/**
 * Lightweight in-memory logger that satisfies the dependency contract required
 * by both the handler and the graceful degradation engine while capturing every
 * logged message for later assertions.
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
 * Minimal event bus capturing each dispatched event. The real handler expects
 * an object with a `dispatch` method that returns a promise, so the helper
 * mirrors that behaviour without introducing mocks.
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
 * Orchestrates extraction error handling and graceful degradation by wiring the
 * real services together. The helper keeps the code inside the tests focused on
 * the high level scenarios instead of the plumbing required to invoke the
 * collaborators correctly.
 */
class ValidationIntegrationPipeline {
  constructor({ handler, degradation, cache, defaults }) {
    this.handler = handler;
    this.degradation = degradation;
    this.cache = cache;
    this.defaults = defaults;
  }

  processExtraction(error, context, overrides = {}) {
    const recovery = this.handler.handleExtractionError(error, context);
    const degradeContext = this.#decorateContext(context, overrides);
    const mappedError = this.#mapErrorForDegradation(error);
    const degradationResult = recovery.degradationApplied
      ? this.degradation.applyDegradation(mappedError, degradeContext)
      : null;

    return { recovery, degradation: degradationResult, degradeContext };
  }

  #decorateContext(context, overrides) {
    const decorated = {
      ...context,
      ...overrides,
    };

    if (!decorated.cacheKey) {
      const fallbackKey =
        decorated.filePath ||
        (decorated.modId && decorated.componentId
          ? `${decorated.modId}:${decorated.componentId}`
          : decorated.modId || null);
      decorated.cacheKey = fallbackKey;
    }

    if (decorated.hasCache === undefined && decorated.cacheKey) {
      decorated.hasCache = this.cache.has(decorated.cacheKey);
    }

    if (decorated.hasDefault === undefined) {
      const defaultKey = this.#resolveDefaultKey(decorated);
      decorated.hasDefault = Boolean(defaultKey && this.defaults[defaultKey]);
    }

    return decorated;
  }

  #resolveDefaultKey(context) {
    const baseId =
      context.id || context.modId || context.componentId || context.name;
    return baseId ? `${context.type}.${baseId}` : null;
  }

  #mapErrorForDegradation(error) {
    if (error instanceof ModAccessError) {
      const mapped = new Error(error.message);
      mapped.code = 'ACCESS';
      return mapped;
    }

    if (error instanceof ModCorruptionError) {
      const mapped = new Error(error.message);
      mapped.code = 'CORRUPTION';
      return mapped;
    }

    if (error instanceof ModValidationError) {
      const mapped = new Error(error.message);
      mapped.code = error.code || 'VALIDATION';
      return mapped;
    }

    return error;
  }
}

/**
 *
 */
function createHarness() {
  const logger = new MemoryLogger();
  const eventBus = new RecordingEventBus(logger);
  const cache = new Map([
    ['/mods/seeded.json', { id: 'seeded:cached', cached: true }],
  ]);
  const defaults = {
    'mod.alpha': {
      id: 'alpha',
      references: new Map(),
      errors: [],
      partial: true,
    },
    'component.core:actor': {
      id: 'core:actor',
      data: { slots: [] },
      partial: true,
    },
    'validation.alpha': {
      valid: false,
      errors: ['Alpha degraded'],
      partial: true,
    },
  };

  const degradation = new GracefulDegradationClass({ logger, cache, defaults });
  const handler = new ModValidationErrorHandlerClass({
    logger,
    eventBus,
    config: { maxRetries: 2 },
  });

  const pipeline = new ValidationIntegrationPipeline({
    handler,
    degradation,
    cache,
    defaults,
  });

  return { logger, eventBus, cache, defaults, degradation, handler, pipeline };
}

describe('GracefulDegradation integration pipeline', () => {
  let harness;

  beforeEach(() => {
    harness = createHarness();
  });

  it('recovers across diverse validation failures with caches, defaults, and parsing fallbacks', () => {
    const {
      logger,
      eventBus,
      cache,
      defaults,
      degradation,
      handler,
      pipeline,
    } = harness;

    // Scenario 1: missing mod definition falls back to configured defaults
    const missingModError = new ModAccessError(
      'ENOENT: missing mod manifest',
      '/mods/alpha/main.json',
      { recoverable: true }
    );
    const missingModContext = {
      filePath: '/mods/alpha/main.json',
      modId: 'alpha',
      type: 'mod',
      id: 'alpha',
      hasDefault: true,
    };
    const missingMod = pipeline.processExtraction(
      missingModError,
      missingModContext
    );
    expect(missingMod.recovery.strategy).toBe(RecoveryStrategy.USE_DEFAULT);
    expect(missingMod.degradation.strategy).toBe(DegradationStrategy.SKIP_FILE);
    expect(missingMod.degradation).toMatchObject({
      strategy: DegradationStrategy.SKIP_FILE,
      data: null,
      success: true,
      message: 'File skipped due to access error',
    });
    expect(eventBus.events.at(-1).payload.strategy).toBe(
      RecoveryStrategy.USE_DEFAULT
    );

    // Store degraded data to simulate cache priming for later requests
    cache.set(missingMod.degradeContext.cacheKey, defaults['mod.alpha']);

    // Scenario 2: same file now leverages cached fallback data
    const cachedAccess = pipeline.processExtraction(
      new ModAccessError('ENOENT: still missing', '/mods/alpha/main.json', {
        recoverable: true,
      }),
      {
        filePath: '/mods/alpha/main.json',
        modId: 'alpha',
        type: 'mod',
        hasDefault: true,
        hasCache: true,
      }
    );
    expect(cachedAccess.degradation.strategy).toBe(
      DegradationStrategy.USE_CACHED
    );
    expect(cachedAccess.degradation.data).toEqual(defaults['mod.alpha']);
    expect(cachedAccess.degradation.success).toBe(true);

    // Scenario 3: component level default resolution with fallback cache key
    const componentError = new Error('Component descriptor missing');
    const componentContext = {
      filePath: '/mods/alpha/components/actor.json',
      modId: 'alpha',
      componentId: 'core:actor',
      type: 'component',
      id: 'core:actor',
      hasDefault: true,
    };
    const componentResult = pipeline.processExtraction(
      componentError,
      componentContext,
      {
        cacheKey: null,
      }
    );
    expect(componentResult.degradation.strategy).toBe(
      DegradationStrategy.USE_DEFAULT
    );
    expect(componentResult.degradation.data).toEqual(
      defaults['component.core:actor']
    );

    // Simulate direct lookup by mod/component identifier with a cached entry
    cache.set('alpha:core:actor', { id: 'core:actor', cached: true });
    const componentCacheHit = degradation.applyDegradation(
      new Error('ENOENT: cached component lookup'),
      { modId: 'alpha', componentId: 'core:actor', hasCache: true }
    );
    expect(componentCacheHit.strategy).toBe(DegradationStrategy.USE_CACHED);
    expect(componentCacheHit.data).toEqual({ id: 'core:actor', cached: true });

    // Scenario 4: references fallback produces empty map for downstream use
    const referencesError = new ModValidationError(
      'Unresolved references',
      'REFERENCE_MISSING',
      { modPath: '/mods/alpha' },
      true
    );
    const referencesResult = pipeline.processExtraction(referencesError, {
      filePath: '/mods/alpha/references.json',
      modId: 'alpha',
      type: 'references',
      hasDefault: true,
    });
    expect(referencesResult.degradation.strategy).toBe(
      DegradationStrategy.USE_DEFAULT
    );
    expect(referencesResult.degradation.data instanceof Map).toBe(true);

    // Scenario 5: validation failure relies on generic degraded validation report
    const validationError = new ModValidationError(
      'Schema mismatch',
      'SCHEMA',
      { file: '/mods/alpha/schema.json' },
      true
    );
    const validationResult = pipeline.processExtraction(validationError, {
      filePath: '/mods/alpha/schema.json',
      modId: 'alpha',
      type: 'validation',
      hasDefault: true,
      id: 'alpha',
    });
    expect(validationResult.degradation.strategy).toBe(
      DegradationStrategy.USE_DEFAULT
    );
    expect(validationResult.degradation.data).toEqual({
      valid: false,
      errors: ['Alpha degraded'],
      partial: true,
    });

    // Scenario 6: recoverable unknown issue prefers module-level defaults
    const modDefaultResult = pipeline.processExtraction(
      new Error('Unclassified but recoverable issue'),
      {
        filePath: '/mods/alpha/fallback.json',
        modId: 'alpha',
        type: 'mod',
        id: 'alpha',
        hasDefault: true,
      }
    );
    expect(modDefaultResult.degradation.strategy).toBe(
      DegradationStrategy.USE_DEFAULT
    );
    expect(modDefaultResult.degradation.data).toEqual(defaults['mod.alpha']);

    // Scenario 7: unknown context without defaults yields null degraded value
    const unknownResult = pipeline.processExtraction(
      new Error('mystery failure'),
      {
        filePath: '/mods/alpha/unknown.json',
        modId: 'alpha',
        type: 'mystery',
      }
    );
    expect(unknownResult.degradation.strategy).toBe(
      DegradationStrategy.USE_DEFAULT
    );
    expect(unknownResult.degradation.data).toBeNull();

    // Scenario 8: explicit skip hint keeps track of skipped files
    const skippedResult = pipeline.processExtraction(
      new Error('transient issue'),
      {
        filePath: '/mods/alpha/temporary.json',
        modId: 'alpha',
        allowSkip: true,
      }
    );
    expect(skippedResult.degradation.strategy).toBe(
      DegradationStrategy.SKIP_FILE
    );
    expect(skippedResult.degradation.skipped).toBe(true);

    // Scenario 9: repeated timeouts escalate to reduced validation strategy
    const timeoutContext = {
      filePath: '/mods/alpha/slow.json',
      modId: 'alpha',
      type: 'validation',
    };
    const timeoutAttempt1 = pipeline.processExtraction(
      new Error('Timeout contacting service'),
      timeoutContext
    );
    const timeoutAttempt2 = pipeline.processExtraction(
      new Error('Timeout contacting service'),
      timeoutContext
    );
    const timeoutAttempt3 = pipeline.processExtraction(
      new Error('Timeout contacting service'),
      timeoutContext
    );
    expect(timeoutAttempt1.recovery.strategy).toBe(RecoveryStrategy.RETRY);
    expect(timeoutAttempt1.degradation).toBeNull();
    expect(timeoutAttempt2.recovery.strategy).toBe(RecoveryStrategy.RETRY);
    expect(timeoutAttempt3.recovery.strategy).toBe(RecoveryStrategy.SKIP);
    expect(timeoutAttempt3.degradation.strategy).toBe(
      DegradationStrategy.REDUCED_VALIDATION
    );
    expect(timeoutAttempt3.degradation.data.reduced).toBe(true);

    // Scenario 10: cache hint without entry reports unsuccessful cache lookup
    const emptyCacheResult = pipeline.processExtraction(
      new Error('minor glitch'),
      {
        filePath: '/mods/alpha/uncached.json',
        modId: 'alpha',
        hasCache: true,
      }
    );
    expect(emptyCacheResult.degradation.strategy).toBe(
      DegradationStrategy.USE_CACHED
    );
    expect(emptyCacheResult.degradation.success).toBe(false);

    // Scenario 11: corruption with partial data keeps extracted subset
    const partialCorruptionError = new ModCorruptionError(
      'Malformed JSON near reference list',
      '/mods/alpha/partial.json',
      { partialData: { id: 'alpha:partial', partial: true } }
    );
    const partialCorruption = pipeline.processExtraction(
      partialCorruptionError,
      {
        filePath: '/mods/alpha/partial.json',
        modId: 'alpha',
        partialData: { id: 'alpha:partial', partial: true },
      }
    );
    expect(partialCorruption.degradation.strategy).toBe(
      DegradationStrategy.PARTIAL_EXTRACTION
    );
    expect(partialCorruption.degradation.data).toEqual({
      id: 'alpha:partial',
      partial: true,
    });

    // Scenario 12: corruption with raw text performs best-effort parsing
    const parseableRaw =
      '{"id":"alpha:parsed"}\nbody:component_01 other:attachment-02';
    const parseCorruption = pipeline.processExtraction(
      new ModCorruptionError(
        'Corruption with salvageable data',
        '/mods/alpha/raw.json',
        {
          parseError: 'trailing comma',
        }
      ),
      {
        filePath: '/mods/alpha/raw.json',
        modId: 'alpha',
        rawData: parseableRaw,
      }
    );
    expect(parseCorruption.degradation.strategy).toBe(
      DegradationStrategy.BASIC_PARSING
    );
    expect(parseCorruption.degradation.data).toMatchObject({
      id: 'alpha:parsed',
      references: expect.arrayContaining([
        'body:component_01',
        'other:attachment-02',
      ]),
    });

    // Scenario 13: parsing failure path still yields structured debug information
    const failingParse = pipeline.processExtraction(
      new ModCorruptionError('Unreadable payload', '/mods/alpha/failing.json', {
        parseError: 'trailing comma',
      }),
      {
        filePath: '/mods/alpha/failing.json',
        modId: 'alpha',
        rawData: { cannot: 'be parsed' },
      }
    );
    expect(failingParse.degradation.strategy).toBe(
      DegradationStrategy.BASIC_PARSING
    );
    expect(failingParse.degradation.data).toEqual({
      partial: true,
      basicParse: true,
    });
    expect(
      logger.records.debug.some((entry) =>
        entry.message.startsWith('Basic parsing failed:')
      )
    ).toBe(true);

    // Scenario 14: security flavoured failures are blocked entirely
    const securityResult = pipeline.processExtraction(
      new Error('Security violation while loading mod assets'),
      {
        filePath: '/mods/alpha/secure.json',
        modId: 'alpha',
      }
    );
    expect(securityResult.degradation.strategy).toBe(
      DegradationStrategy.NO_DEGRADATION
    );
    expect(securityResult.degradation.success).toBe(false);
    expect(securityResult.degradation.blocked).toBe(true);

    const stats = degradation.getStatistics();
    expect(stats.totalDegradations).toBeGreaterThanOrEqual(14);
    expect(Object.keys(stats.byStrategy)).toEqual(
      expect.arrayContaining([
        'ACCESS',
        'TIMEOUT',
        'CORRUPTION',
        'SECURITY',
        DegradationStrategy.USE_DEFAULT,
        DegradationStrategy.USE_CACHED,
        DegradationStrategy.SKIP_FILE,
      ])
    );
    expect(stats.successRate).toBeGreaterThan(0);
    expect(stats.successRate).toBeLessThan(100);
    expect(stats.recentDegradations.length).toBeGreaterThan(0);

    const handlerStats = handler.getErrorStatistics();
    expect(handlerStats.totalErrors).toBe(eventBus.events.length);
    expect(handlerStats.errorsByType.ACCESS).toBeGreaterThanOrEqual(2);
    expect(handlerStats.errorsByType.CORRUPTION).toBeGreaterThanOrEqual(3);

    degradation.reset();
    expect(cache.size).toBe(0);
    expect(degradation.getStatistics()).toEqual({
      totalDegradations: 0,
      byStrategy: {},
      successRate: 0,
      recentDegradations: [],
    });
    expect(
      logger.records.debug.some(
        (entry) => entry.message === 'Graceful degradation reset'
      )
    ).toBe(true);
  });

  it('maintains bounded history and stays aligned with handler statistics on reset', () => {
    const { logger, cache, degradation, handler, pipeline } = harness;

    for (let index = 0; index < 505; index += 1) {
      pipeline.processExtraction(new Error(`history issue ${index}`), {
        filePath: `/mods/history-${index}.json`,
        modId: 'history',
        allowSkip: true,
      });
    }

    const stats = degradation.getStatistics();
    expect(stats.totalDegradations).toBe(500);
    expect(stats.byStrategy[DegradationStrategy.SKIP_FILE]).toEqual({
      count: 500,
      successes: 500,
    });
    expect(stats.recentDegradations).toHaveLength(10);

    const handlerStats = handler.getErrorStatistics();
    expect(handlerStats.totalErrors).toBe(505);
    expect(handlerStats.errorsByType.UNKNOWN).toBeGreaterThan(0);

    handler.reset();
    expect(handler.getErrorStatistics()).toEqual({
      totalErrors: 0,
      errorsByType: {},
      recoverySuccessRate: 0,
      recentErrors: [],
    });
    expect(
      logger.records.debug.some(
        (entry) => entry.message === 'Error handler reset'
      )
    ).toBe(true);

    degradation.reset();
    expect(cache.size).toBe(0);
    expect(degradation.getStatistics()).toEqual({
      totalDegradations: 0,
      byStrategy: {},
      successRate: 0,
      recentDegradations: [],
    });
  });

  it('validates logger dependency end-to-end using the real dependency validation', () => {
    expect(() => new GracefulDegradationClass({ logger: {} })).toThrow(
      InvalidArgumentError
    );
    expect(() => new ModValidationErrorHandlerClass({ logger: {} })).toThrow(
      InvalidArgumentError
    );
  });
});
