import GracefulDegradation, { GracefulDegradation as GracefulDegradationClass, DegradationStrategy } from '../../../src/validation/gracefulDegradation.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

const createLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
});

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
      partial: true
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

  it('provides meaningful defaults for different contexts', () => {
    expect(instance.getDefaultValue('mod', { id: 'special' })).toEqual({ sentinel: 'mod-default' });
    expect(instance.getDefaultValue('mod', { modId: 'generated' })).toEqual({
      id: 'generated',
      references: new Map(),
      errors: [],
      partial: true
    });
    expect(instance.getDefaultValue('component', { componentId: 'arm' })).toEqual({
      id: 'arm',
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
});
