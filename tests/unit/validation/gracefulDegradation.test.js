import GracefulDegradation, { GracefulDegradation as GracefulDegradationClass, DegradationStrategy } from '../../../src/validation/gracefulDegradation.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

const createLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
});

class BareStrategiesGracefulDegradation extends GracefulDegradationClass {
  registerStrategy(errorType, strategy) {
    if (errorType === 'CORRUPTION' || errorType === 'TIMEOUT' || errorType === 'ACCESS') {
      return;
    }
    return super.registerStrategy(errorType, strategy);
  }
}

describe('GracefulDegradation', () => {
  let logger;
  let cache;
  let defaults;
  let instance;

  beforeEach(() => {
    logger = createLogger();
    cache = new Map();
    defaults = {
      'mod.special': { sentinel: 'mod-default' },
      'component.widget': { sentinel: 'component-default' }
    };
    instance = new GracefulDegradationClass({ logger, cache, defaults });
    // Clear the debug logs produced by registering default strategies so individual
    // assertions can focus on the interactions performed in each test case.
    logger.debug.mockClear();
    logger.info.mockClear();
  });

  it('validates required logger dependency', () => {
    expect(() => new GracefulDegradationClass({ logger: {} })).toThrow(InvalidArgumentError);
  });

  it('exposes enum and default export', () => {
    expect(DegradationStrategy).toMatchObject({
      SKIP_FILE: 'SKIP_FILE',
      USE_CACHED: 'USE_CACHED',
      USE_DEFAULT: 'USE_DEFAULT',
      PARTIAL_EXTRACTION: 'PARTIAL_EXTRACTION',
      REDUCED_VALIDATION: 'REDUCED_VALIDATION',
      BASIC_PARSING: 'BASIC_PARSING',
      NO_DEGRADATION: 'NO_DEGRADATION'
    });
    expect(GracefulDegradation).toBeDefined();
  });

  it('applies custom strategies and records statistics', () => {
    const strategyResult = { strategy: 'CUSTOM', data: { ok: true }, success: false };
    const customHandler = jest.fn().mockReturnValue(strategyResult);
    instance.registerStrategy('CUSTOM', customHandler);

    const error = new Error('custom failure');
    error.code = 'CUSTOM';
    const context = { filePath: 'mods/file.json', modId: 'mod-a' };

    const result = instance.applyDegradation(error, context);

    expect(result).toEqual(strategyResult);
    expect(customHandler).toHaveBeenCalledWith(error, context);
    expect(logger.info).toHaveBeenCalledWith(
      'Applying degradation strategy: CUSTOM',
      expect.objectContaining({
        errorType: 'CUSTOM',
        context: expect.objectContaining({ file: 'mods/file.json', mod: 'mod-a' })
      })
    );

    const stats = instance.getStatistics();
    expect(stats.totalDegradations).toBe(1);
    expect(stats.byStrategy.CUSTOM).toEqual({ count: 1, successes: 0 });
    expect(stats.successRate).toBe(0);
    expect(stats.recentDegradations).toHaveLength(1);

    cache.set('temp', 'value');
    instance.reset();
    expect(cache.size).toBe(0);
    expect(instance.getStatistics()).toEqual({
      totalDegradations: 0,
      byStrategy: {},
      successRate: 0,
      recentDegradations: []
    });
    expect(logger.debug).toHaveBeenCalledWith('Graceful degradation reset');
  });

  it('uses cached data when available and skips files otherwise', () => {
    cache.set('mods/broken.json', { cached: true });
    const cachedError = new Error('file missing');
    cachedError.code = 'ACCESS';
    const cachedContext = { filePath: 'mods/broken.json', modId: 'mod-a', hasCache: true };

    const cachedResult = instance.applyDegradation(cachedError, cachedContext);
    expect(cachedResult).toMatchObject({
      strategy: DegradationStrategy.USE_CACHED,
      data: { cached: true },
      success: true
    });
    expect(logger.debug).toHaveBeenCalledWith('Cache hit for mods/broken.json');

    cache.set('manual-key', { keyed: true });
    const keyedResult = instance.applyDegradation(new Error('ACCESS: cache key'), {
      cacheKey: 'manual-key',
      modId: 'mod-a',
      componentId: 'component-a',
      hasCache: true
    });
    expect(keyedResult).toMatchObject({
      strategy: DegradationStrategy.USE_CACHED,
      data: { keyed: true },
      success: true,
      fromCache: true
    });

    cache.set('mod-a:component-a', { composite: true });
    const compositeResult = instance.applyDegradation(new Error('ACCESS: composite cache'), {
      modId: 'mod-a',
      componentId: 'component-a',
      hasCache: true
    });
    expect(compositeResult).toMatchObject({
      strategy: DegradationStrategy.USE_CACHED,
      data: { composite: true },
      success: true,
      fromCache: true
    });

    const skipResult = instance.applyDegradation(new Error('ENOENT: file not found'), {
      filePath: 'mods/missing.json',
      modId: 'mod-b'
    });
    expect(skipResult).toEqual({
      strategy: DegradationStrategy.SKIP_FILE,
      data: null,
      success: true,
      message: 'File skipped due to access error'
    });
  });

  it('falls back to cache hints even without cached entry', () => {
    const result = instance.applyDegradation(new Error('mild issue'), {
      filePath: 'mods/unknown.json',
      modId: 'mod-c',
      hasCache: true
    });

    expect(result).toEqual({
      strategy: DegradationStrategy.USE_CACHED,
      data: null,
      success: false,
      fromCache: true
    });
  });

  it('supports partial extraction and basic parsing for corruption errors', () => {
    const partial = instance.applyDegradation(new Error('corruption detected'), {
      filePath: 'mods/partial.json',
      modId: 'mod-d',
      partialData: { partial: true }
    });

    expect(partial).toEqual({
      strategy: DegradationStrategy.PARTIAL_EXTRACTION,
      data: { partial: true },
      success: true,
      partial: true
    });

    const basic = instance.applyDegradation(new Error('corruption again'), {
      filePath: 'mods/basic.json',
      modId: 'mod-e',
      rawData: '{"id": "sample-id", "ref": "modA:item_01"}\nother:ref_entry'
    });

    expect(basic).toMatchObject({
      strategy: DegradationStrategy.BASIC_PARSING,
      data: {
        partial: true,
        basicParse: true,
        id: 'sample-id',
        references: expect.arrayContaining(['modA:item_01', 'other:ref_entry'])
      },
      success: true,
      partial: true
    });

    const noisy = instance.applyDegradation(new Error('corruption yet again'), {
      filePath: 'mods/noisy.json',
      modId: 'mod-f',
      rawData: {
        match: () => {
          throw new Error('boom');
        }
      }
    });

    expect(noisy).toEqual({
      strategy: DegradationStrategy.BASIC_PARSING,
      data: { partial: true, basicParse: true },
      success: true,
      partial: true,
      basic: true
    });

    const minimal = instance.applyDegradation(new Error('corruption minimal data'), {
      filePath: 'mods/minimal.json',
      modId: 'mod-f',
      rawData: '{}'
    });
    expect(minimal).toEqual({
      strategy: DegradationStrategy.BASIC_PARSING,
      data: { partial: true, basicParse: true },
      success: true,
      partial: true,
      basic: true
    });

    const empty = instance.applyDegradation(new Error('corruption without data'), {
      filePath: 'mods/empty.json',
      modId: 'mod-f'
    });
    expect(empty).toEqual({
      strategy: DegradationStrategy.BASIC_PARSING,
      data: { partial: true, basicParse: true },
      success: true,
      partial: true,
      basic: true
    });
  });

  it('performs reduced validation on timeout and blocks security violations', () => {
    const timeoutResult = instance.applyDegradation(new Error('Operation timeout occurred'), {
      filePath: 'mods/slow.json',
      modId: 'mod-g'
    });

    expect(timeoutResult).toEqual({
      strategy: DegradationStrategy.REDUCED_VALIDATION,
      data: {
        valid: 'unknown',
        reduced: true,
        checks: {
          syntax: 'skipped',
          references: 'skipped',
          schema: 'skipped'
        },
        message: 'Reduced validation due to resource constraints'
      },
      success: true,
      reduced: true
    });

    const securityResult = instance.applyDegradation(new Error('Security violation!'), {
      filePath: 'mods/forbidden.json',
      modId: 'mod-h'
    });

    expect(securityResult).toEqual({
      strategy: DegradationStrategy.NO_DEGRADATION,
      data: null,
      success: false,
      blocked: true,
      message: 'Security violation - no degradation allowed'
    });
  });

  it('honors contextual hints and default fallbacks', () => {
    const allowSkipResult = instance.applyDegradation(new Error('random failure'), {
      filePath: 'mods/hint.json',
      modId: 'mod-i',
      allowSkip: true
    });
    expect(allowSkipResult.strategy).toBe(DegradationStrategy.SKIP_FILE);
    expect(allowSkipResult.success).toBe(true);

    const defaultComponent = instance.applyDegradation(new Error('mysterious issue'), {
      filePath: 'mods/component.json',
      modId: 'mod-j',
      type: 'component',
      hasDefault: true,
      componentId: 'widget'
    });

    expect(defaultComponent).toEqual({
      strategy: DegradationStrategy.USE_DEFAULT,
      data: { id: 'widget', data: {}, partial: true },
      success: true,
      isDefault: true
    });

    const unknownDefault = instance.applyDegradation(new Error('unknown error'), {
      filePath: 'mods/unknown.json',
      modId: 'mod-k',
      hasDefault: true,
      type: 'validation'
    });

    expect(unknownDefault).toEqual({
      strategy: DegradationStrategy.USE_DEFAULT,
      data: {
        valid: false,
        errors: ['Degraded validation'],
        partial: true
      },
      success: true,
      isDefault: true
    });
  });

  it('respects contexts that explicitly forbid degradation attempts', () => {
    const result = instance.applyDegradation(new Error('no fallback permitted'), {
      filePath: 'mods/no-degrade.json',
      modId: 'mod-blocked',
      forceNoDegradation: true
    });

    expect(result).toEqual({
      strategy: DegradationStrategy.NO_DEGRADATION,
      data: null,
      success: false,
      message: 'No degradation available'
    });
  });

  it('provides meaningful defaults for different contexts', () => {
    expect(instance.getDefaultValue('mod', { id: 'special' })).toEqual({ sentinel: 'mod-default' });
    expect(instance.getDefaultValue('mod', { modId: 'generated' })).toEqual({
      id: 'generated',
      references: new Map(),
      errors: [],
      partial: true
    });
    expect(instance.getDefaultValue('mod', {})).toEqual({
      id: 'unknown',
      references: new Map(),
      errors: [],
      partial: true
    });
    expect(instance.getDefaultValue('component', { componentId: 'arm' })).toEqual({
      id: 'arm',
      data: {},
      partial: true
    });
    expect(instance.getDefaultValue('component', {})).toEqual({
      id: 'unknown',
      data: {},
      partial: true
    });
    expect(instance.getDefaultValue('references', {})).toEqual(new Map());
    expect(instance.getDefaultValue('validation', {})).toEqual({
      valid: false,
      errors: ['Degraded validation'],
      partial: true
    });
    expect(instance.getDefaultValue('unknown', {})).toBeNull();
  });

  it('derives error types from codes and message content', () => {
    const timeout = instance.applyDegradation({ message: 'no code', code: 'TIMEOUT' }, {
      filePath: 'mods/timeout.json',
      modId: 'mod-l'
    });
    expect(timeout.strategy).toBe(DegradationStrategy.REDUCED_VALIDATION);

    const messageDerived = instance.applyDegradation(new Error('File corruption occurred'), {
      filePath: 'mods/message.json',
      modId: 'mod-m',
      partialData: { fallback: true }
    });
    expect(messageDerived.strategy).toBe(DegradationStrategy.PARTIAL_EXTRACTION);

    const unknown = instance.applyDegradation(new Error('totally new issue'), {
      filePath: 'mods/default.json',
      modId: 'mod-n'
    });
    expect(unknown.strategy).toBe(DegradationStrategy.USE_DEFAULT);

    const noMessageError = new Error('');
    noMessageError.message = undefined;
    const fallbackStrategy = instance.applyDegradation(noMessageError, {
      filePath: 'mods/no-message.json',
      modId: 'mod-unknown'
    });
    expect(fallbackStrategy.strategy).toBe(DegradationStrategy.USE_DEFAULT);
  });

  it('limits degradation history to the 500 most recent entries', () => {
    const contexts = Array.from({ length: 505 }, (_, index) => ({
      filePath: `mods/${index}.json`,
      modId: 'mod-history',
      allowSkip: true
    }));

    for (const context of contexts) {
      instance.applyDegradation(new Error('history test'), context);
    }

    const stats = instance.getStatistics();
    expect(stats.totalDegradations).toBe(500);
    expect(stats.byStrategy).toEqual({
      [DegradationStrategy.SKIP_FILE]: { count: 500, successes: 500 }
    });
    expect(stats.successRate).toBe(100);
    expect(stats.recentDegradations).toHaveLength(10);
  });

  it('executes built-in fallback strategies when custom handlers are absent', () => {
    const bareLogger = createLogger();
    const bareCache = new Map();
    const bareInstance = new BareStrategiesGracefulDegradation({
      logger: bareLogger,
      cache: bareCache,
      defaults: {},
    });

    const accessSkipResult = bareInstance.applyDegradation(new Error('ENOENT: file missing'), {
      filePath: 'mods/inaccessible.json',
      modId: 'mod-bare',
    });
    expect(accessSkipResult).toEqual({
      strategy: DegradationStrategy.SKIP_FILE,
      data: null,
      success: true,
      skipped: true,
      message: 'Skipped file: mods/inaccessible.json',
    });

    bareCache.set('mods/bare-cache.json', { cached: true });
    const accessCacheResult = bareInstance.applyDegradation(new Error('ENOENT: cached file missing'), {
      filePath: 'mods/bare-cache.json',
      modId: 'mod-bare',
      hasCache: true,
    });
    expect(accessCacheResult).toEqual({
      strategy: DegradationStrategy.USE_CACHED,
      data: { cached: true },
      success: true,
      fromCache: true,
    });
    expect(bareLogger.debug).toHaveBeenCalledWith('Cache hit for mods/bare-cache.json');

    const partialResult = bareInstance.applyDegradation(new Error('corruption detected'), {
      filePath: 'mods/bare-partial.json',
      modId: 'mod-bare',
      partialData: { partial: true },
    });
    expect(partialResult).toEqual({
      strategy: DegradationStrategy.PARTIAL_EXTRACTION,
      data: { partial: true },
      success: true,
      partial: true,
    });

    const basicResult = bareInstance.applyDegradation(new Error('corruption again'), {
      filePath: 'mods/raw.json',
      modId: 'mod-bare',
      rawData: '{"id": "bare-id"}',
    });
    expect(basicResult).toEqual({
      strategy: DegradationStrategy.PARTIAL_EXTRACTION,
      data: {},
      success: true,
      partial: true,
    });

    const reducedResult = bareInstance.applyDegradation(new Error('operation timeout'), {
      filePath: 'mods/slow.json',
      modId: 'mod-bare',
    });
    expect(reducedResult).toEqual({
      strategy: DegradationStrategy.REDUCED_VALIDATION,
      data: {
        valid: 'unknown',
        reduced: true,
        checks: {
          syntax: 'skipped',
          references: 'skipped',
          schema: 'skipped',
        },
        message: 'Reduced validation due to resource constraints',
      },
      success: true,
      reduced: true,
    });
  });

  it('falls back to default degradation when no hints or handlers are available', () => {
    const bareLogger = createLogger();
    const bareInstance = new BareStrategiesGracefulDegradation({
      logger: bareLogger,
      cache: new Map(),
      defaults: { 'validation.default': { safe: true } },
    });

    const result = bareInstance.applyDegradation(new Error('mysterious failure'), {
      filePath: 'mods/unknown.json',
      modId: 'mod-bare',
      type: 'validation',
      id: 'default',
    });

    expect(result).toEqual({
      strategy: DegradationStrategy.USE_DEFAULT,
      data: { safe: true },
      success: true,
      isDefault: true,
    });
  });
});
