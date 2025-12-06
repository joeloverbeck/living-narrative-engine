import { beforeEach, describe, expect, it } from '@jest/globals';
import GracefulDegradation, {
  DegradationStrategy,
  GracefulDegradation as GracefulDegradationClass,
} from '../../../src/validation/gracefulDegradation.js';

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

const originalRegisterStrategy =
  GracefulDegradationClass.prototype.registerStrategy;

/**
 *
 * @param dependencies
 */
function createBareInstance(dependencies) {
  GracefulDegradationClass.prototype.registerStrategy =
    function registerStrategyStub() {
      return undefined;
    };

  try {
    return new GracefulDegradationClass(dependencies);
  } finally {
    GracefulDegradationClass.prototype.registerStrategy =
      originalRegisterStrategy;
  }
}

describe('GracefulDegradation behavioural coverage', () => {
  let logger;

  beforeEach(() => {
    logger = new MemoryLogger();
  });

  it('generates deterministic defaults for unconfigured contexts', () => {
    const defaults = {
      'mod.alpha': { id: 'alpha', sentinel: true },
      'component.actor:core': {
        id: 'actor:core',
        data: { slots: [] },
        partial: true,
      },
    };

    const degradation = new GracefulDegradation({
      logger,
      cache: new Map(),
      defaults,
    });

    const explicitDefault = degradation.getDefaultValue('mod', { id: 'alpha' });
    expect(explicitDefault).toBe(defaults['mod.alpha']);

    const generatedModDefault = degradation.getDefaultValue('mod', {
      modId: 'omega',
    });
    expect(generatedModDefault).toMatchObject({
      id: 'omega',
      errors: [],
      partial: true,
    });
    expect(generatedModDefault.references).toBeInstanceOf(Map);
    expect(generatedModDefault.references.size).toBe(0);

    const generatedComponentDefault = degradation.getDefaultValue('component', {
      componentId: 'renderer',
    });
    expect(generatedComponentDefault).toEqual({
      id: 'renderer',
      data: {},
      partial: true,
    });

    const validationDefault = degradation.getDefaultValue('validation', {});
    expect(validationDefault).toEqual({
      valid: false,
      errors: ['Degraded validation'],
      partial: true,
    });

    const referencesDefault = degradation.getDefaultValue('references', {});
    expect(referencesDefault).toBeInstanceOf(Map);

    expect(degradation.getDefaultValue('unknown', {})).toBeNull();
  });

  it('falls back to built-in strategies when registry entries are missing', () => {
    const cache = new Map([
      ['/mods/cached.json', { id: 'cached', cached: true }],
    ]);
    const degradation = createBareInstance({
      logger,
      cache,
      defaults: {},
    });

    const skipError = new Error('ENOENT: file not found');
    const skipResult = degradation.applyDegradation(skipError, {
      filePath: '/mods/missing.json',
      allowSkip: true,
    });
    expect(skipResult.strategy).toBe(DegradationStrategy.SKIP_FILE);
    expect(skipResult.skipped).toBe(true);

    const cacheResult = degradation.applyDegradation(
      new Error('ENOENT: cached file not found'),
      {
        filePath: '/mods/cached.json',
        cacheKey: '/mods/cached.json',
        hasCache: true,
      }
    );
    expect(cacheResult.strategy).toBe(DegradationStrategy.USE_CACHED);
    expect(cacheResult.fromCache).toBe(true);
    expect(cacheResult.data).toEqual({ id: 'cached', cached: true });
    expect(
      logger.records.debug.find((entry) => entry.message.includes('Cache hit'))
    ).toBeDefined();

    const corruptionResult = degradation.applyDegradation(
      new Error('malformed data encountered'),
      {
        filePath: '/mods/glitched.json',
        partialData: { id: 'glitched', partial: true },
      }
    );
    expect(corruptionResult.strategy).toBe(
      DegradationStrategy.PARTIAL_EXTRACTION
    );
    expect(corruptionResult.partial).toBe(true);

    const timeoutResult = degradation.applyDegradation(
      new Error('validation timeout while contacting orchestrator'),
      {
        filePath: '/mods/slow.json',
      }
    );
    expect(timeoutResult.strategy).toBe(DegradationStrategy.REDUCED_VALIDATION);
    expect(timeoutResult.reduced).toBe(true);
    expect(timeoutResult.data).toMatchObject({
      reduced: true,
      checks: {
        syntax: 'skipped',
        references: 'skipped',
        schema: 'skipped',
      },
    });

    const defaultFallback = degradation.applyDegradation(
      new Error('unexpected validator failure'),
      {
        type: 'validation',
        modId: 'omega',
      }
    );
    expect(defaultFallback.strategy).toBe(DegradationStrategy.USE_DEFAULT);
    expect(defaultFallback.isDefault).toBe(true);
    expect(defaultFallback.data).toMatchObject({
      valid: false,
      errors: ['Degraded validation'],
      partial: true,
    });
  });

  it('records history, performs parsing and honours cache-backed recovery strategies', () => {
    const cache = new Map([
      ['story-cache', { id: 'story:cached', cached: true }],
    ]);
    const defaults = {
      'validation.story': {
        valid: false,
        errors: ['Story degraded'],
        partial: true,
      },
    };
    const degradation = new GracefulDegradation({
      logger,
      cache,
      defaults,
    });

    const corruption = new Error('Corruption detected in payload');
    const corruptionResult = degradation.applyDegradation(corruption, {
      filePath: '/mods/story.json',
      rawData: '{"id":"story"}\nscene:chapter:intro\nactor:core:hero',
    });
    expect(corruptionResult.strategy).toBe(DegradationStrategy.BASIC_PARSING);
    expect(corruptionResult.data).toMatchObject({
      basicParse: true,
      id: 'story',
      references: expect.arrayContaining(['scene:chapter', 'actor:core']),
    });

    const accessError = new Error('ENOENT: cannot access cached file');
    accessError.code = 'ACCESS';
    const cacheResult = degradation.applyDegradation(accessError, {
      filePath: 'story-cache',
      cacheKey: 'story-cache',
      hasCache: true,
    });
    expect(cacheResult.strategy).toBe(DegradationStrategy.USE_CACHED);
    expect(cacheResult.success).toBe(true);
    expect(cacheResult.data).toEqual({ id: 'story:cached', cached: true });

    const securityError = new Error(
      'security violation detected while parsing'
    );
    const securityResult = degradation.applyDegradation(securityError, {
      filePath: '/mods/story.json',
    });
    expect(securityResult.strategy).toBe(DegradationStrategy.NO_DEGRADATION);
    expect(securityResult.success).toBe(false);
    expect(securityResult.blocked).toBe(true);

    const stats = degradation.getStatistics();
    expect(stats.totalDegradations).toBe(3);
    expect(stats.byStrategy.CORRUPTION.count).toBe(1);
    expect(stats.byStrategy.ACCESS.successes).toBe(1);
    expect(stats.byStrategy.SECURITY.count).toBe(1);
    expect(stats.successRate).toBeCloseTo((2 / 3) * 100, 5);
    expect(stats.recentDegradations).toHaveLength(3);

    degradation.reset();
    expect(cache.size).toBe(0);
    expect(degradation.getStatistics()).toEqual({
      totalDegradations: 0,
      byStrategy: {},
      successRate: 0,
      recentDegradations: [],
    });
  });
});
