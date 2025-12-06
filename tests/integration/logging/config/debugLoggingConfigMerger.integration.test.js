import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import ConsoleLogger, {
  LogLevel,
} from '../../../../src/logging/consoleLogger.js';
import { DebugLoggingConfigMerger } from '../../../../src/logging/config/configMerger.js';
import LogFilter from '../../../../src/logging/logFilter.js';

describe('DebugLoggingConfigMerger integration', () => {
  let consoleInfoSpy;
  let consoleWarnSpy;
  let consoleErrorSpy;
  let consoleDebugSpy;

  beforeEach(() => {
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('merges presets, overrides, and env vars with full precedence for live log tooling', () => {
    const logger = new ConsoleLogger(LogLevel.DEBUG);
    const merger = new DebugLoggingConfigMerger({ logger });

    const overrides = {
      enabled: true,
      console: {
        enabled: false,
        useColors: false,
      },
      remote: {
        compression: {
          enabled: true,
          algorithm: 'brotli',
          level: 9,
        },
        batching: {
          targetLatency: 50,
        },
      },
      categories: {
        ai: { enabled: false, level: 'error' },
      },
      performance: {
        metricsInterval: null,
      },
      lastRefresh: new Date('2023-12-31T23:59:59Z'),
    };

    const envVars = {
      DEBUG_LOG_ENABLED: 'false',
      DEBUG_LOG_MODE: 'remote',
      DEBUG_LOG_ENDPOINT: 'https://logs.example.com/collect',
      DEBUG_LOG_CONSOLE_ENABLED: 'true',
      DEBUG_LOG_CONSOLE_TIMESTAMP: 'true',
      DEBUG_LOG_PERFORMANCE_THRESHOLD: '250.5',
      DEBUG_LOG_CATEGORY_ENGINE_ENABLED: 'false',
      DEBUG_LOG_CATEGORY_UI_LEVEL: 'error',
      DEBUG_LOG_CATEGORY_CUSTOM_ANALYTICS_ENABLED: 'true',
      DEBUG_LOG_CATEGORY_CUSTOM_ANALYTICS_LEVEL: 'debug',
    };

    const report = merger.mergeWithReport(overrides, 'production', envVars);

    expect(report.appliedPreset).toBe('production');
    expect(report.appliedOverrides).toEqual(
      expect.arrayContaining([
        'enabled',
        'console',
        'remote',
        'categories',
        'performance',
        'lastRefresh',
      ])
    );
    expect(report.appliedEnvVars).toEqual(
      expect.arrayContaining([
        'DEBUG_LOG_ENABLED',
        'DEBUG_LOG_MODE',
        'DEBUG_LOG_ENDPOINT',
        'DEBUG_LOG_CONSOLE_ENABLED',
        'DEBUG_LOG_CONSOLE_TIMESTAMP',
        'DEBUG_LOG_PERFORMANCE_THRESHOLD',
      ])
    );
    expect(report.warnings).toHaveLength(0);

    const mergedConfig = report.config;

    expect(mergedConfig.enabled).toBe(false);
    expect(mergedConfig.mode).toBe('remote');
    expect(mergedConfig.remote.endpoint).toBe(
      'https://logs.example.com/collect'
    );
    expect(mergedConfig.remote.compression.algorithm).toBe('brotli');
    expect(mergedConfig.remote.batching.targetLatency).toBe(50);
    expect(mergedConfig.console.enabled).toBe(true);
    expect(mergedConfig.console.useColors).toBe(false);
    expect(mergedConfig.console.showTimestamp).toBe(true);
    expect(mergedConfig.performance.metricsInterval).toBeNull();
    expect(mergedConfig.performance.slowLogThreshold).toBeCloseTo(250.5);
    expect(mergedConfig.categories.engine.enabled).toBe(false);
    expect(mergedConfig.categories.ui.level).toBe('error');
    expect(mergedConfig.categories.custom_analytics).toMatchObject({
      enabled: true,
      level: 'debug',
    });

    expect(mergedConfig.lastRefresh).toBeInstanceOf(Date);
    expect(mergedConfig.lastRefresh.toISOString()).toBe(
      '2023-12-31T23:59:59.000Z'
    );
    expect(mergedConfig.lastRefresh).not.toBe(overrides.lastRefresh);

    expect(merger.getNestedValue(mergedConfig, 'console.showCategory')).toBe(
      true
    );
    expect(
      merger.getNestedValue(mergedConfig, 'remote.compression.level')
    ).toBe(9);

    // Use the merged configuration with another real module to ensure integration coverage
    const logFilter = new LogFilter({
      logger,
      callbacks: {
        onFilterChange: jest.fn(),
      },
    });

    const now = Date.now();
    logFilter.setLogs([
      {
        message: 'engine warning',
        category: 'engine',
        level: 'warn',
        timestamp: now,
      },
      {
        message: 'custom analytics insight',
        category: 'custom_analytics',
        level: 'debug',
        timestamp: now,
      },
      { message: 'ui failure', category: 'ui', level: 'error', timestamp: now },
    ]);

    logFilter.setFilter({
      category: 'custom_analytics',
      level: 'all',
      searchText: '',
    });
    const filtered = logFilter.getFilteredLogs();
    expect(filtered).toHaveLength(1);
    expect(filtered[0].category).toBe('custom_analytics');

    expect(consoleDebugSpy).toHaveBeenCalledWith(
      'Starting configuration merge',
      expect.objectContaining({ preset: 'production' })
    );
    expect(
      consoleInfoSpy.mock.calls.some(
        ([message]) =>
          typeof message === 'string' &&
          message.includes('environment variable overrides')
      )
    ).toBe(true);

    // Exercise unknown preset branch for completeness
    const diagnosticReport = merger.mergeWithReport({}, 'mystery', {});
    expect(diagnosticReport.warnings).toContain('Unknown preset: mystery');
    expect(
      consoleWarnSpy.mock.calls.some(
        ([message]) => message === 'Unknown preset requested: mystery'
      )
    ).toBe(true);
  });

  it('migrates legacy configurations while respecting environment precedence', () => {
    const logger = new ConsoleLogger(LogLevel.DEBUG);
    const merger = new DebugLoggingConfigMerger({ logger });

    const legacyConfig = { logLevel: 'NONE' };
    const currentConfig = {
      console: { enabled: true },
    };

    const envVars = {
      DEBUG_LOG_ENABLED: 'true',
      DEBUG_LOG_MODE: 'hybrid',
      DEBUG_LOG_CONSOLE_ENABLED: 'false',
    };

    const merged = merger.mergeWithLegacySupport(
      currentConfig,
      legacyConfig,
      'development',
      envVars
    );

    expect(merged.mode).toBe('hybrid');
    expect(merged.enabled).toBe(true);
    expect(merged.console.enabled).toBe(false);
    expect(merged.logLevel).toBe('NONE');
    expect(merger.getNestedValue(merged, 'console.showTimestamp')).toBe(true);

    expect(consoleInfoSpy).toHaveBeenCalledWith(
      'Migrating legacy configuration'
    );
    expect(
      consoleDebugSpy.mock.calls.some(
        ([message, metadata]) =>
          message === 'Configuration merge completed' &&
          metadata?.mode === 'hybrid' &&
          metadata?.enabled === true
      )
    ).toBe(true);

    const legacyWarnConfig = merger.mergeWithLegacySupport(
      {},
      { logLevel: 'WARN' },
      null,
      {}
    );

    expect(legacyWarnConfig.mode).toBe('development');
    expect(legacyWarnConfig.enabled).toBe(true);

    const failingConfig = {};
    Object.defineProperty(failingConfig, 'remote', {
      enumerable: true,
      get() {
        throw new Error('legacy config access failure');
      },
    });

    expect(() =>
      merger.mergeWithLegacySupport(
        failingConfig,
        { logLevel: 'INFO' },
        null,
        {}
      )
    ).toThrow(/legacy config access failure/);

    expect(
      consoleErrorSpy.mock.calls.some(
        ([message]) => message === 'Error during legacy configuration merge'
      )
    ).toBe(true);
  });

  it('surfaces merge errors with contextual logging', () => {
    const logger = new ConsoleLogger(LogLevel.DEBUG);
    const merger = new DebugLoggingConfigMerger({ logger });

    const problematicOverrides = {};
    Object.defineProperty(problematicOverrides, 'remote', {
      enumerable: true,
      get() {
        throw new Error('remote override failed');
      },
    });

    expect(() => merger.mergeConfig(problematicOverrides, null, null)).toThrow(
      'Configuration merge failed: remote override failed'
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error during configuration merge',
      expect.any(Error)
    );

    // Ensure baseline merge still works without env vars to hit early return branch
    const fallbackConfig = merger.mergeConfig(
      { console: { enabled: true } },
      null,
      undefined
    );

    expect(fallbackConfig.console.enabled).toBe(true);

    expect(() =>
      merger.mergeWithReport(problematicOverrides, null, null)
    ).toThrow('Configuration merge failed: remote override failed');

    expect(
      consoleErrorSpy.mock.calls.some(
        ([message]) => message === 'Error generating configuration merge report'
      )
    ).toBe(true);
  });

  it('provides helper utilities for manual diagnostics', () => {
    const logger = new ConsoleLogger(LogLevel.DEBUG);
    const merger = new DebugLoggingConfigMerger({ logger });

    expect(merger.deepMerge({ a: 1 }, null)).toEqual({ a: 1 });
    expect(
      merger.deepMerge(
        { list: [1, 2], nested: { keep: true } },
        { list: ['a', 'b'], nested: { added: 'value' } }
      )
    ).toEqual({ list: ['a', 'b'], nested: { keep: true, added: 'value' } });

    const arraySource = [1, { value: 2 }];
    const cloned = merger.deepClone(arraySource);
    expect(cloned).toEqual(arraySource);
    expect(cloned).not.toBe(arraySource);

    const protoSource = Object.create({ inherited: true });
    protoSource.own = 'value';
    expect(merger.deepMerge({}, protoSource)).toEqual({ own: 'value' });

    const protoCloneSource = Object.create({ legacy: 'yes' });
    protoCloneSource.payload = { ready: true };
    const protoCloned = merger.deepClone(protoCloneSource);
    expect(protoCloned).toEqual({ payload: { ready: true } });
    expect(Object.prototype.hasOwnProperty.call(protoCloned, 'legacy')).toBe(
      false
    );

    expect(merger.parseEnvironmentValue(true)).toBe(true);
    expect(merger.parseEnvironmentValue('FALSE')).toBe(false);
    expect(merger.parseEnvironmentValue('42')).toBe(42);
    expect(merger.parseEnvironmentValue('3.14')).toBeCloseTo(3.14);
    expect(merger.parseEnvironmentValue(' verbose ')).toBe('verbose');

    const nestedTarget = {};
    merger.setNestedValue(nestedTarget, 'remote.upload.retry', 3);
    expect(nestedTarget.remote.upload.retry).toBe(3);

    expect(merger.getNestedValue(null, 'any.path', 'fallback')).toBe(
      'fallback'
    );
    expect(merger.getNestedValue({ data: { value: 7 } }, 'data.value', 0)).toBe(
      7
    );
    expect(merger.getNestedValue({ data: null }, 'data.value', 'missing')).toBe(
      'missing'
    );

    const categoryOnlyConfig = merger.applyEnvironmentVariables(
      {},
      {
        DEBUG_LOG_CATEGORY_TEMP_ENABLED: 'true',
        DEBUG_LOG_CATEGORY_MALFORMED_FLAG: 'true',
      }
    );
    expect(categoryOnlyConfig.categories.temp.enabled).toBe(true);

    const untouchedConfig = { untouched: true };
    expect(merger.applyEnvironmentVariables(untouchedConfig, null)).toEqual(
      untouchedConfig
    );

    const nullCategoryResult = merger.mergeConfig(
      { categories: null },
      null,
      {}
    );
    expect(nullCategoryResult.categories).toBeNull();

    const fallbackMerge = merger.mergeConfig('noop', null, {});
    expect(fallbackMerge).toBeDefined();

    const reportNoOverrides = merger.mergeWithReport('noop', null, {});
    expect(reportNoOverrides.appliedOverrides).toEqual([]);

    expect(() => merger.mergeWithReport(null, 'production', {})).not.toThrow();

    expect(() =>
      merger.mergeWithLegacySupport(undefined, null, null, {})
    ).not.toThrow();
    expect(() => merger.mergeWithLegacySupport({}, {}, null, {})).not.toThrow();
    const preservedMode = merger.mergeWithLegacySupport(
      { mode: 'preexisting', enabled: false },
      { logLevel: 'INFO' },
      null,
      {}
    );
    expect(preservedMode.mode).toBe('preexisting');
    expect(preservedMode.enabled).toBe(false);

    const defaultEnvMerge = merger.mergeConfig(undefined, null, undefined);
    expect(defaultEnvMerge).toBeDefined();
  });
});
