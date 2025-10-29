import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import EntityConfigProvider from '../../../../src/entities/config/EntityConfigProvider.js';
import EntityConfig from '../../../../src/entities/config/EntityConfig.js';
import { TestEnvironmentProvider } from '../../../../src/configuration/TestEnvironmentProvider.js';

describe('EntityConfigProvider', () => {
  let mockLogger;
  let consoleErrorSpy;
  let consoleWarnSpy;
  let consoleInfoSpy;
  let consoleDebugSpy;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    // Spy on console methods to ensure they're not called directly
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    consoleDebugSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should initialize with valid logger', () => {
      const provider = new EntityConfigProvider({ logger: mockLogger });
      expect(provider).toBeInstanceOf(EntityConfigProvider);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'EntityConfigProvider initialized successfully'
      );
    });

    it('should initialize with user config overrides', () => {
      const userConfig = {
        limits: { MAX_ENTITIES: 5000 },
        cache: { ENABLE_DEFINITION_CACHE: false },
      };
      const provider = new EntityConfigProvider({
        logger: mockLogger,
        userConfig,
      });
      expect(provider.getValue('limits.MAX_ENTITIES')).toBe(5000);
      expect(provider.getValue('cache.ENABLE_DEFINITION_CACHE')).toBe(false);
    });

    it('should throw error when logger is null', () => {
      expect(() => new EntityConfigProvider({ logger: null })).toThrow(
        'Missing required dependency: ILogger'
      );
    });

    it('should validate logger has required methods', () => {
      const invalidLogger = { info: jest.fn() }; // missing error, warn, debug
      expect(
        () => new EntityConfigProvider({ logger: invalidLogger })
      ).toThrow();
    });

    it('should throw error when initialization fails', () => {
      const invalidUserConfig = {
        limits: { MAX_ENTITIES: -1 }, // Invalid configuration
      };
      expect(
        () =>
          new EntityConfigProvider({
            logger: mockLogger,
            userConfig: invalidUserConfig,
          })
      ).toThrow();
    });

    it('should log debug information about enabled features', () => {
      new EntityConfigProvider({ logger: mockLogger });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Configuration loaded:',
        expect.objectContaining({
          environment: expect.any(String),
          features: expect.objectContaining({
            monitoring: expect.any(Boolean),
            debugging: expect.any(Boolean),
            validation: expect.any(Boolean),
            caching: expect.any(Boolean),
          }),
        })
      );
    });
  });

  describe('environment override application', () => {
    let getConfigSpy;
    let validateConfigSpy;
    let baseConfig;

    const createBaseConfig = () => ({
      limits: {
        MAX_ENTITIES: 1000,
        MAX_COMPONENT_SIZE: 2048,
      },
      cache: {
        ENABLE_VALIDATION_CACHE: true,
        ENABLE_DEFINITION_CACHE: true,
      },
      validation: {
        STRICT_MODE: true,
      },
      performance: {
        ENABLE_OPERATION_TRACING: false,
        ENABLE_MONITORING: true,
      },
      logging: {
        ENABLE_DEBUG_LOGGING: false,
      },
      errorHandling: {},
      defaults: {},
      entityCreation: {},
      spatialIndex: {},
    });

    const cloneConfig = (config) => JSON.parse(JSON.stringify(config));

    const createEnvironmentProvider = (overrides) => ({
      getEnvironment: jest.fn().mockReturnValue({
        NODE_ENV: 'custom',
        IS_PRODUCTION: false,
        IS_DEVELOPMENT: false,
        IS_TEST: false,
        ...overrides,
      }),
    });

    beforeEach(() => {
      baseConfig = createBaseConfig();
      getConfigSpy = jest
        .spyOn(EntityConfig, 'getConfig')
        .mockImplementation(() => cloneConfig(baseConfig));
      validateConfigSpy = jest
        .spyOn(EntityConfig, 'validateConfig')
        .mockImplementation(() => true);
    });

    afterEach(() => {
      getConfigSpy.mockRestore();
      validateConfigSpy.mockRestore();
    });

    it('applies production overrides for logging, performance, and validation', () => {
      baseConfig.logging.ENABLE_DEBUG_LOGGING = true;
      baseConfig.performance.ENABLE_OPERATION_TRACING = true;
      baseConfig.validation.STRICT_MODE = false;

      const provider = new EntityConfigProvider({
        logger: mockLogger,
        environmentProvider: createEnvironmentProvider({
          NODE_ENV: 'production',
          IS_PRODUCTION: true,
        }),
      });

      expect(provider.getLoggingSettings().ENABLE_DEBUG_LOGGING).toBe(false);
      expect(provider.getPerformanceSettings().ENABLE_OPERATION_TRACING).toBe(
        false
      );
      expect(provider.getValidationSettings().STRICT_MODE).toBe(true);
    });

    it('applies development overrides when environment is development', () => {
      baseConfig.logging.ENABLE_DEBUG_LOGGING = false;
      baseConfig.performance.ENABLE_OPERATION_TRACING = false;
      baseConfig.validation.STRICT_MODE = true;

      const provider = new EntityConfigProvider({
        logger: mockLogger,
        environmentProvider: createEnvironmentProvider({
          NODE_ENV: 'development',
          IS_DEVELOPMENT: true,
        }),
      });

      expect(provider.getLoggingSettings().ENABLE_DEBUG_LOGGING).toBe(true);
      expect(provider.getPerformanceSettings().ENABLE_OPERATION_TRACING).toBe(
        true
      );
      expect(provider.getValidationSettings().STRICT_MODE).toBe(false);
    });

    it('applies test overrides for logging, monitoring, and cache behavior', () => {
      baseConfig.logging.ENABLE_DEBUG_LOGGING = true;
      baseConfig.performance.ENABLE_MONITORING = true;
      baseConfig.cache.ENABLE_VALIDATION_CACHE = true;
      baseConfig.cache.ENABLE_DEFINITION_CACHE = true;

      const provider = new EntityConfigProvider({
        logger: mockLogger,
        environmentProvider: createEnvironmentProvider({
          NODE_ENV: 'test',
          IS_TEST: true,
        }),
      });

      expect(provider.getLoggingSettings().ENABLE_DEBUG_LOGGING).toBe(false);
      expect(provider.getPerformanceSettings().ENABLE_MONITORING).toBe(false);
      expect(provider.getCacheSettings().ENABLE_VALIDATION_CACHE).toBe(false);
      expect(provider.getCacheSettings().ENABLE_DEFINITION_CACHE).toBe(false);
    });
  });

  describe('getConfig', () => {
    let provider;

    beforeEach(() => {
      provider = new EntityConfigProvider({ logger: mockLogger });
    });

    it('should return complete configuration object', () => {
      const config = provider.getConfig();
      expect(config).toHaveProperty('limits');
      expect(config).toHaveProperty('cache');
      expect(config).toHaveProperty('validation');
      expect(config).toHaveProperty('performance');
      expect(config).toHaveProperty('logging');
      expect(config).toHaveProperty('errorHandling');
      expect(config).toHaveProperty('defaults');
      expect(config).toHaveProperty('entityCreation');
      expect(config).toHaveProperty('spatialIndex');
      expect(config).toHaveProperty('environment');
    });

    it('should return a copy of the configuration', () => {
      const config1 = provider.getConfig();
      const config2 = provider.getConfig();
      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });

    it('should work correctly when initialized', () => {
      const config = provider.getConfig();
      expect(config).toBeDefined();
      expect(typeof config).toBe('object');
    });
  });

  describe('getSection', () => {
    let provider;

    beforeEach(() => {
      provider = new EntityConfigProvider({ logger: mockLogger });
    });

    it('should return specific configuration section', () => {
      const limits = provider.getSection('limits');
      expect(limits).toHaveProperty('MAX_ENTITIES');
      expect(limits).toHaveProperty('MAX_COMPONENT_SIZE');
    });

    it('should return null for non-existent section', () => {
      const nonExistent = provider.getSection('nonexistent');
      expect(nonExistent).toBeNull();
    });

    it('should work correctly with initialized provider', () => {
      const limits = provider.getSection('limits');
      expect(limits).toBeDefined();
    });
  });

  describe('specific section getters', () => {
    let provider;

    beforeEach(() => {
      provider = new EntityConfigProvider({ logger: mockLogger });
    });

    it('should return limits section', () => {
      const limits = provider.getLimits();
      expect(limits).toHaveProperty('MAX_ENTITIES');
      expect(limits).toHaveProperty('MAX_COMPONENT_SIZE');
      expect(limits).toHaveProperty('MAX_BATCH_SIZE');
    });

    it('should return cache settings', () => {
      const cache = provider.getCacheSettings();
      expect(cache).toHaveProperty('ENABLE_DEFINITION_CACHE');
      expect(cache).toHaveProperty('DEFINITION_CACHE_TTL');
    });

    it('should return validation settings', () => {
      const validation = provider.getValidationSettings();
      expect(validation).toHaveProperty('STRICT_MODE');
      expect(validation).toHaveProperty('VALIDATE_COMPONENT_SCHEMAS');
    });

    it('should return performance settings', () => {
      const performance = provider.getPerformanceSettings();
      expect(performance).toHaveProperty('ENABLE_MONITORING');
      expect(performance).toHaveProperty('SLOW_OPERATION_THRESHOLD');
    });

    it('should return logging settings', () => {
      const logging = provider.getLoggingSettings();
      expect(logging).toHaveProperty('DEFAULT_LOG_LEVEL');
      expect(logging).toHaveProperty('ENABLE_DEBUG_LOGGING');
    });

    it('should return error handling settings', () => {
      const errorHandling = provider.getErrorHandlingSettings();
      expect(errorHandling).toHaveProperty('ENABLE_ERROR_RECOVERY');
      expect(errorHandling).toHaveProperty('CIRCUIT_BREAKER_THRESHOLD');
    });

    it('should return defaults settings', () => {
      const defaults = provider.getDefaultsSettings();
      expect(defaults).toHaveProperty('ENABLE_DEFAULT_COMPONENTS');
      expect(defaults).toHaveProperty('DEFAULT_COMPONENT_TYPES');
    });

    it('should return entity creation settings', () => {
      const entityCreation = provider.getEntityCreationSettings();
      expect(entityCreation).toHaveProperty('ENABLE_ID_VALIDATION');
      expect(entityCreation).toHaveProperty('REQUIRE_UNIQUE_IDS');
    });

    it('should return spatial index settings', () => {
      const spatialIndex = provider.getSpatialIndexSettings();
      expect(spatialIndex).toHaveProperty('ENABLE_SPATIAL_INDEXING');
      expect(spatialIndex).toHaveProperty('MAX_ENTITIES_PER_LOCATION');
    });
  });

  describe('isFeatureEnabled', () => {
    let provider;

    beforeEach(() => {
      provider = new EntityConfigProvider({ logger: mockLogger });
    });

    it('should check if feature is enabled', () => {
      const isEnabled = provider.isFeatureEnabled(
        'performance.ENABLE_MONITORING'
      );
      expect(typeof isEnabled).toBe('boolean');
    });

    it('should return false for non-existent feature', () => {
      const isEnabled = provider.isFeatureEnabled('nonexistent.FEATURE');
      expect(isEnabled).toBe(false);
    });

    it('should work correctly with initialized provider', () => {
      const result = provider.isFeatureEnabled('performance.ENABLE_MONITORING');
      expect(typeof result).toBe('boolean');
    });

    it('should respect environment-specific overrides', () => {
      // Test with test environment provider
      const testEnvProvider = new TestEnvironmentProvider();
      const testProvider = new EntityConfigProvider({
        logger: mockLogger,
        environmentProvider: testEnvProvider,
      });

      // In test environment, ENABLE_MONITORING should be false
      expect(
        testProvider.isFeatureEnabled('performance.ENABLE_MONITORING')
      ).toBe(false);
    });
  });

  describe('getValue', () => {
    let provider;

    beforeEach(() => {
      provider = new EntityConfigProvider({ logger: mockLogger });
    });

    it('should get value by path', () => {
      const value = provider.getValue('limits.MAX_ENTITIES');
      expect(typeof value).toBe('number');
      expect(value).toBeGreaterThan(0);
    });

    it('should return undefined for non-existent path', () => {
      const value = provider.getValue('nonexistent.path');
      expect(value).toBeUndefined();
    });

    it('should handle nested paths', () => {
      const value = provider.getValue('environment.NODE_ENV');
      expect(typeof value).toBe('string');
    });

    it('should handle empty path', () => {
      const value = provider.getValue('');
      expect(value).toBeUndefined();
    });

    it('should work correctly with initialized provider', () => {
      const value = provider.getValue('limits.MAX_ENTITIES');
      expect(value).toBeDefined();
    });
  });

  describe('setValue', () => {
    let provider;

    beforeEach(() => {
      provider = new EntityConfigProvider({ logger: mockLogger });
    });

    it('should set value by path', () => {
      provider.setValue('limits.MAX_ENTITIES', 5000);
      expect(provider.getValue('limits.MAX_ENTITIES')).toBe(5000);
    });

    it('should create nested objects if they do not exist', () => {
      provider.setValue('new.nested.property', 'value');
      expect(provider.getValue('new.nested.property')).toBe('value');
    });

    it('should log debug message when setting value', () => {
      provider.setValue('limits.MAX_ENTITIES', 5000);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Configuration value set: limits.MAX_ENTITIES = 5000'
      );
    });

    it('should throw error for __proto__ path', () => {
      expect(() => provider.setValue('__proto__.malicious', 'value')).toThrow(
        'Invalid configuration path'
      );
    });

    it('should throw error for constructor path', () => {
      expect(() => provider.setValue('constructor.malicious', 'value')).toThrow(
        'Invalid configuration path'
      );
    });

    it('should throw error for __proto__ in nested path', () => {
      expect(() =>
        provider.setValue('limits.__proto__.malicious', 'value')
      ).toThrow('Invalid configuration path');
    });

    it('should throw error for constructor in nested path', () => {
      expect(() =>
        provider.setValue('limits.constructor.malicious', 'value')
      ).toThrow('Invalid configuration path');
    });

    it('should throw error for __proto__ as last part of path', () => {
      expect(() => provider.setValue('limits.__proto__', 'value')).toThrow(
        'Invalid configuration path'
      );
    });

    it('should throw error for constructor as last part of path', () => {
      expect(() => provider.setValue('limits.constructor', 'value')).toThrow(
        'Invalid configuration path'
      );
    });

    it('should work correctly with initialized provider', () => {
      expect(() =>
        provider.setValue('limits.MAX_ENTITIES', 5000)
      ).not.toThrow();
    });
  });

  describe('validateConfig', () => {
    let provider;

    beforeEach(() => {
      provider = new EntityConfigProvider({ logger: mockLogger });
    });

    it('should validate current configuration', () => {
      const isValid = provider.validateConfig();
      expect(isValid).toBe(true);
    });

    it('should delegate to EntityConfig.validateConfig', () => {
      const spy = jest.spyOn(EntityConfig, 'validateConfig');
      provider.validateConfig();
      expect(spy).toHaveBeenCalledWith(expect.any(Object));
      spy.mockRestore();
    });

    it('should work correctly with initialized provider', () => {
      expect(() => provider.validateConfig()).not.toThrow();
    });
  });

  describe('reload', () => {
    let provider;

    beforeEach(() => {
      provider = new EntityConfigProvider({ logger: mockLogger });
    });

    it('should reload configuration with new user config', () => {
      const newUserConfig = { limits: { MAX_ENTITIES: 7000 } };
      provider.reload(newUserConfig);
      expect(provider.getValue('limits.MAX_ENTITIES')).toBe(7000);
    });

    it('should log reload message', () => {
      provider.reload();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Reloading EntityConfigProvider configuration'
      );
    });

    it('should handle empty user config', () => {
      expect(() => provider.reload()).not.toThrow();
    });

    it('should throw error for invalid user config', () => {
      const invalidUserConfig = { limits: { MAX_ENTITIES: -1 } };
      expect(() => provider.reload(invalidUserConfig)).toThrow();
    });
  });

  describe('environment methods', () => {
    let provider;

    beforeEach(() => {
      provider = new EntityConfigProvider({ logger: mockLogger });
    });

    it('should return environment information', () => {
      const env = provider.getEnvironment();
      expect(env).toHaveProperty('NODE_ENV');
      expect(env).toHaveProperty('IS_PRODUCTION');
      expect(env).toHaveProperty('IS_DEVELOPMENT');
      expect(env).toHaveProperty('IS_TEST');
    });

    it('should check if is production', () => {
      const isProd = provider.isProduction();
      expect(typeof isProd).toBe('boolean');
    });

    it('should check if is development', () => {
      const isDev = provider.isDevelopment();
      expect(typeof isDev).toBe('boolean');
    });

    it('should check if is test', () => {
      const isTest = provider.isTest();
      expect(typeof isTest).toBe('boolean');
    });
  });

  describe('getConfigSummary', () => {
    let provider;

    beforeEach(() => {
      provider = new EntityConfigProvider({ logger: mockLogger });
    });

    it('should return configuration summary', () => {
      const summary = provider.getConfigSummary();
      expect(summary).toHaveProperty('environment');
      expect(summary).toHaveProperty('maxEntities');
      expect(summary).toHaveProperty('maxComponentSize');
      expect(summary).toHaveProperty('cachingEnabled');
      expect(summary).toHaveProperty('monitoringEnabled');
      expect(summary).toHaveProperty('strictValidation');
    });

    it('should have correct types in summary', () => {
      const summary = provider.getConfigSummary();
      expect(typeof summary.environment).toBe('string');
      expect(typeof summary.maxEntities).toBe('number');
      expect(typeof summary.maxComponentSize).toBe('number');
      expect(typeof summary.cachingEnabled).toBe('boolean');
      expect(typeof summary.monitoringEnabled).toBe('boolean');
      expect(typeof summary.strictValidation).toBe('boolean');
    });

    it('should work correctly with initialized provider', () => {
      const summary = provider.getConfigSummary();
      expect(summary).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle initialization errors gracefully', () => {
      const invalidUserConfig = {
        limits: { MAX_ENTITIES: 0 }, // Invalid value
      };
      expect(
        () =>
          new EntityConfigProvider({
            logger: mockLogger,
            userConfig: invalidUserConfig,
          })
      ).toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to initialize EntityConfigProvider')
      );
    });

    it('should re-throw initialization errors', () => {
      const invalidUserConfig = {
        limits: { MAX_ENTITIES: 0 },
      };
      expect(
        () =>
          new EntityConfigProvider({
            logger: mockLogger,
            userConfig: invalidUserConfig,
          })
      ).toThrow();
    });
  });

  describe('private methods behavior', () => {
    it('should call getEnabledFeatures during initialization', () => {
      // Test that getEnabledFeatures is called by checking debug log
      new EntityConfigProvider({ logger: mockLogger });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Configuration loaded:',
        expect.objectContaining({
          features: expect.objectContaining({
            monitoring: expect.any(Boolean),
            debugging: expect.any(Boolean),
            validation: expect.any(Boolean),
            caching: expect.any(Boolean),
          }),
        })
      );
    });

    it('should have public methods that work with initialized provider', () => {
      const provider = new EntityConfigProvider({ logger: mockLogger });

      // Test that all public methods work correctly
      expect(() => provider.getConfig()).not.toThrow();
      expect(() => provider.getSection('limits')).not.toThrow();
      expect(() => provider.getLimits()).not.toThrow();
      expect(() => provider.getCacheSettings()).not.toThrow();
      expect(() => provider.getValidationSettings()).not.toThrow();
      expect(() => provider.getPerformanceSettings()).not.toThrow();
      expect(() => provider.getLoggingSettings()).not.toThrow();
      expect(() => provider.getErrorHandlingSettings()).not.toThrow();
      expect(() => provider.getDefaultsSettings()).not.toThrow();
      expect(() => provider.getEntityCreationSettings()).not.toThrow();
      expect(() => provider.getSpatialIndexSettings()).not.toThrow();
      expect(() => provider.isFeatureEnabled('test')).not.toThrow();
      expect(() => provider.getValue('test')).not.toThrow();
      expect(() => provider.setValue('test', 'value')).not.toThrow();
      expect(() => provider.validateConfig()).not.toThrow();
      expect(() => provider.getEnvironment()).not.toThrow();
      expect(() => provider.isProduction()).not.toThrow();
      expect(() => provider.isDevelopment()).not.toThrow();
      expect(() => provider.isTest()).not.toThrow();
      expect(() => provider.getConfigSummary()).not.toThrow();
    });

    it('should throw when accessing configuration before initialization', () => {
      const environmentProvider = {
        getEnvironment: jest.fn().mockReturnValue({
          NODE_ENV: 'test',
          IS_PRODUCTION: false,
          IS_DEVELOPMENT: false,
          IS_TEST: true,
        }),
      };

      const provider = new EntityConfigProvider({
        logger: mockLogger,
        environmentProvider,
        autoInitialize: false,
      });

      expect(() => provider.getConfig()).toThrow(
        'EntityConfigProvider is not initialized'
      );
    });
  });
});
