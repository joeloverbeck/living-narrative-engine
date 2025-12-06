/**
 * @file Integration tests for EntityConfigProvider using real configuration modules.
 * @jest-environment node
 */
import {
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import EntityConfigProvider from '../../../src/entities/config/EntityConfigProvider.js';
import { ProcessEnvironmentProvider } from '../../../src/configuration/ProcessEnvironmentProvider.js';
import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';

/**
 * Creates an EntityConfigProvider wired with the real logger and environment provider.
 *
 * @param {object} [options]
 * @param {object} [options.userConfig]
 * @param {ProcessEnvironmentProvider} [options.environmentProvider]
 * @returns {EntityConfigProvider}
 */
function createProvider({ userConfig, environmentProvider } = {}) {
  const deps = {
    logger: new ConsoleLogger(LogLevel.NONE),
  };

  if (environmentProvider !== undefined) {
    deps.environmentProvider = environmentProvider;
  }

  if (userConfig !== undefined) {
    deps.userConfig = userConfig;
  }

  return new EntityConfigProvider(deps);
}

describe('EntityConfigProvider integration', () => {
  /** @type {string | undefined} */
  let originalNodeEnv;
  /** @type {jest.SpyInstance[]} */
  let consoleSpies;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
    consoleSpies = [
      jest.spyOn(console, 'info').mockImplementation(() => {}),
      jest.spyOn(console, 'warn').mockImplementation(() => {}),
      jest.spyOn(console, 'error').mockImplementation(() => {}),
      jest.spyOn(console, 'debug').mockImplementation(() => {}),
    ];
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
    consoleSpies.forEach((spy) => spy.mockRestore());
  });

  it('applies production safeguards and merges user overrides across sections', () => {
    process.env.NODE_ENV = 'production';

    const provider = createProvider({
      userConfig: {
        limits: { MAX_ENTITIES: 777 },
        cache: { ENABLE_DEFINITION_CACHE: false },
        validation: { STRICT_MODE: true },
      },
    });

    const config = provider.getConfig();
    expect(config.environment).toEqual(
      expect.objectContaining({
        NODE_ENV: 'production',
        IS_PRODUCTION: true,
        IS_DEVELOPMENT: false,
        IS_TEST: false,
      })
    );

    expect(provider.getLimits().MAX_ENTITIES).toBe(777);
    expect(provider.getCacheSettings().ENABLE_DEFINITION_CACHE).toBe(false);
    expect(provider.getValidationSettings().STRICT_MODE).toBe(true);
    expect(provider.getPerformanceSettings().ENABLE_OPERATION_TRACING).toBe(
      false
    );
    expect(provider.getLoggingSettings().ENABLE_DEBUG_LOGGING).toBe(false);
    expect(provider.getErrorHandlingSettings().ENABLE_ERROR_RECOVERY).toBe(
      true
    );
    expect(provider.getDefaultsSettings().ENABLE_DEFAULT_COMPONENTS).toBe(true);
    expect(provider.getEntityCreationSettings().ENABLE_ID_VALIDATION).toBe(
      true
    );
    expect(provider.getSpatialIndexSettings().ENABLE_SPATIAL_INDEXING).toBe(
      true
    );
  });

  it('reloads configuration when environment changes and exposes summary + feature helpers', () => {
    process.env.NODE_ENV = 'test';
    const provider = createProvider({
      userConfig: {
        performance: { DEFAULT_BATCH_SIZE: 25 },
      },
    });

    const initialConfig = provider.getConfig();
    expect(initialConfig.cache.ENABLE_VALIDATION_CACHE).toBe(false);
    expect(initialConfig.cache.ENABLE_DEFINITION_CACHE).toBe(false);
    expect(initialConfig.performance.ENABLE_MONITORING).toBe(false);
    expect(initialConfig.performance.DEFAULT_BATCH_SIZE).toBe(25);
    expect(provider.isTest()).toBe(true);

    process.env.NODE_ENV = 'development';
    provider.reload({
      performance: { ENABLE_MONITORING: true },
    });

    expect(provider.isDevelopment()).toBe(true);
    expect(provider.isProduction()).toBe(false);
    expect(provider.isTest()).toBe(false);

    const reloadedConfig = provider.getConfig();
    expect(reloadedConfig.performance.ENABLE_MONITORING).toBe(true);
    expect(reloadedConfig.performance.ENABLE_OPERATION_TRACING).toBe(true);
    expect(reloadedConfig.logging.ENABLE_DEBUG_LOGGING).toBe(true);

    expect(
      provider.isFeatureEnabled('performance.ENABLE_OPERATION_TRACING')
    ).toBe(true);
    expect(provider.isFeatureEnabled('cache.ENABLE_DEFINITION_CACHE')).toBe(
      reloadedConfig.cache.ENABLE_DEFINITION_CACHE
    );
    expect(provider.isFeatureEnabled('unknown.section.flag')).toBe(false);

    expect(provider.getConfigSummary()).toMatchObject({
      environment: 'development',
      maxEntities: reloadedConfig.limits.MAX_ENTITIES,
      cachingEnabled: reloadedConfig.cache.ENABLE_DEFINITION_CACHE,
      monitoringEnabled: true,
    });
  });

  it('supports runtime updates via setValue and protects against prototype pollution paths', () => {
    process.env.NODE_ENV = 'staging';
    const provider = createProvider();

    expect(provider.getSection('nonexistent')).toBeNull();
    expect(provider.isFeatureEnabled('logging.ENABLE_DEBUG_LOGGING')).toBe(
      false
    );
    expect(provider.getValue('missing.section')).toBeUndefined();

    provider.setValue('custom.feature.enabled', true);
    provider.setValue('custom.threshold', 42);
    expect(provider.getValue('custom.feature.enabled')).toBe(true);
    expect(provider.getValue('custom.threshold')).toBe(42);
    expect(provider.isFeatureEnabled('custom.feature.enabled')).toBe(true);

    provider.setValue('cache.ENABLE_DEFINITION_CACHE', true);
    expect(provider.getCacheSettings().ENABLE_DEFINITION_CACHE).toBe(true);

    expect(() => provider.setValue('cache.__proto__', {})).toThrow(
      "Invalid configuration path: '__proto__' is a reserved property name."
    );
    expect(() => provider.setValue('cache.constructor', {})).toThrow(
      "Invalid configuration path: 'constructor' is a reserved property name."
    );
    expect(() => provider.setValue('__proto__.dangerous', true)).toThrow(
      "Invalid configuration path: '__proto__' is a reserved property name."
    );

    const inheritedOverrides = Object.create({ inheritedFlag: true });
    inheritedOverrides.defaults = { ENABLE_DEFAULT_COMPONENTS: false };
    provider.reload(inheritedOverrides);
    expect(provider.getDefaultsSettings().ENABLE_DEFAULT_COMPONENTS).toBe(
      false
    );

    provider.reload();

    expect(provider.validateConfig()).toBe(true);
  });

  it('throws descriptive errors when user overrides break validation', () => {
    process.env.NODE_ENV = 'development';

    expect(() =>
      createProvider({
        userConfig: {
          limits: { MAX_ENTITIES: -5 },
        },
      })
    ).toThrow('EntityConfig: MAX_ENTITIES must be positive');
  });
});
