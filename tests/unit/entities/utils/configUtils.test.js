import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as configUtils from '../../../../src/entities/utils/configUtils.js';
import EntityConfigProvider from '../../../../src/entities/config/EntityConfigProvider.js';

describe('configUtils', () => {
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

    // Reset global config before each test
    configUtils.resetGlobalConfig();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    consoleDebugSpy.mockRestore();

    // Clean up global config after each test
    configUtils.resetGlobalConfig();
  });

  describe('Global Configuration Management', () => {
    describe('initializeGlobalConfig', () => {
      it('should initialize global configuration provider with logger', () => {
        const provider = configUtils.initializeGlobalConfig(mockLogger);
        expect(provider).toBeInstanceOf(EntityConfigProvider);
        expect(configUtils.isConfigInitialized()).toBe(true);
      });

      it('should initialize global configuration provider with user config', () => {
        const userConfig = { limits: { MAX_ENTITIES: 5000 } };
        const provider = configUtils.initializeGlobalConfig(
          mockLogger,
          userConfig
        );
        expect(provider).toBeInstanceOf(EntityConfigProvider);
        expect(configUtils.getConfigValue('limits.MAX_ENTITIES')).toBe(5000);
      });

      it('should replace the global provider on subsequent calls', () => {
        const provider1 = configUtils.initializeGlobalConfig(mockLogger);
        const provider2 = configUtils.initializeGlobalConfig(mockLogger);
        expect(provider2).not.toBe(provider1);
        expect(provider2).toBeInstanceOf(EntityConfigProvider);
        expect(configUtils.getGlobalConfig()).toBe(provider2);
      });
    });

    describe('getGlobalConfig', () => {
      it('should return the global configuration provider when initialized', () => {
        configUtils.initializeGlobalConfig(mockLogger);
        const provider = configUtils.getGlobalConfig();
        expect(provider).toBeInstanceOf(EntityConfigProvider);
      });

      it('should throw error when configuration provider is not initialized', () => {
        expect(() => configUtils.getGlobalConfig()).toThrow(
          'Global configuration provider is not initialized. Call initializeGlobalConfig() first.'
        );
      });
    });

    describe('isConfigInitialized', () => {
      it('should return false when configuration is not initialized', () => {
        expect(configUtils.isConfigInitialized()).toBe(false);
      });

      it('should return true when configuration is initialized', () => {
        configUtils.initializeGlobalConfig(mockLogger);
        expect(configUtils.isConfigInitialized()).toBe(true);
      });
    });

    describe('resetGlobalConfig', () => {
      it('should reset the global configuration provider', () => {
        configUtils.initializeGlobalConfig(mockLogger);
        expect(configUtils.isConfigInitialized()).toBe(true);

        configUtils.resetGlobalConfig();
        expect(configUtils.isConfigInitialized()).toBe(false);
      });
    });
  });

  describe('Configuration Value Retrieval', () => {
    beforeEach(() => {
      configUtils.initializeGlobalConfig(mockLogger);
    });

    describe('getConfigValue', () => {
      it('should return configuration value for valid path', () => {
        const value = configUtils.getConfigValue('limits.MAX_ENTITIES');
        expect(typeof value).toBe('number');
        expect(value).toBeGreaterThan(0);
      });

      it('should return undefined for non-existent path', () => {
        const value = configUtils.getConfigValue('nonexistent.path');
        expect(value).toBeUndefined();
      });

      it('should throw error when config not initialized', () => {
        configUtils.resetGlobalConfig();
        expect(() => configUtils.getConfigValue('limits.MAX_ENTITIES')).toThrow(
          'Global configuration provider is not initialized'
        );
      });
    });

    describe('getLimits', () => {
      it('should return limits configuration', () => {
        const limits = configUtils.getLimits();
        expect(limits).toHaveProperty('MAX_ENTITIES');
        expect(limits).toHaveProperty('MAX_COMPONENT_SIZE');
        expect(limits).toHaveProperty('MAX_BATCH_SIZE');
        expect(limits).toHaveProperty('MAX_STRING_LENGTH');
        expect(limits).toHaveProperty('MAX_COMPONENT_DEPTH');
        expect(limits).toHaveProperty('MAX_COMPONENT_PROPERTIES');
      });

      it('should throw error when config not initialized', () => {
        configUtils.resetGlobalConfig();
        expect(() => configUtils.getLimits()).toThrow(
          'Global configuration provider is not initialized'
        );
      });
    });

    describe('getCacheSettings', () => {
      it('should return cache settings', () => {
        const cache = configUtils.getCacheSettings();
        expect(cache).toHaveProperty('ENABLE_DEFINITION_CACHE');
        expect(typeof cache.ENABLE_DEFINITION_CACHE).toBe('boolean');
      });
    });

    describe('getValidationSettings', () => {
      it('should return validation settings', () => {
        const validation = configUtils.getValidationSettings();
        expect(validation).toHaveProperty('STRICT_MODE');
        expect(typeof validation.STRICT_MODE).toBe('boolean');
      });
    });

    describe('getPerformanceSettings', () => {
      it('should return performance settings', () => {
        const performance = configUtils.getPerformanceSettings();
        expect(performance).toHaveProperty('ENABLE_MONITORING');
        expect(performance).toHaveProperty('SLOW_OPERATION_THRESHOLD');
        expect(typeof performance.ENABLE_MONITORING).toBe('boolean');
        expect(typeof performance.SLOW_OPERATION_THRESHOLD).toBe('number');
      });
    });
  });

  describe('Feature Checks', () => {
    beforeEach(() => {
      configUtils.initializeGlobalConfig(mockLogger);
    });

    describe('isFeatureEnabled', () => {
      it('should check if feature is enabled', () => {
        const result = configUtils.isFeatureEnabled(
          'performance.ENABLE_MONITORING'
        );
        expect(typeof result).toBe('boolean');
      });

      it('should return false for non-existent feature', () => {
        const result = configUtils.isFeatureEnabled('nonexistent.FEATURE');
        expect(result).toBe(false);
      });

      it('should throw error when config not initialized', () => {
        configUtils.resetGlobalConfig();
        expect(() =>
          configUtils.isFeatureEnabled('performance.ENABLE_MONITORING')
        ).toThrow();
      });
    });

    describe('isDebugEnabled', () => {
      it('should check if debug logging is enabled', () => {
        const result = configUtils.isDebugEnabled();
        expect(typeof result).toBe('boolean');
      });
    });

    describe('isMonitoringEnabled', () => {
      it('should check if performance monitoring is enabled', () => {
        const result = configUtils.isMonitoringEnabled();
        expect(typeof result).toBe('boolean');
      });
    });

    describe('isStrictValidationEnabled', () => {
      it('should check if strict validation is enabled', () => {
        const result = configUtils.isStrictValidationEnabled();
        expect(typeof result).toBe('boolean');
      });
    });

    describe('isCachingEnabled', () => {
      it('should check if caching is enabled', () => {
        const result = configUtils.isCachingEnabled();
        expect(typeof result).toBe('boolean');
      });
    });
  });

  describe('Validation Functions', () => {
    beforeEach(() => {
      configUtils.initializeGlobalConfig(mockLogger);
    });

    describe('validateEntityCount', () => {
      it('should not throw error for valid entity count', () => {
        expect(() => configUtils.validateEntityCount(100)).not.toThrow();
      });

      it('should throw error when entity count exceeds maximum', () => {
        const limits = configUtils.getLimits();
        const exceededCount = limits.MAX_ENTITIES + 1;
        expect(() => configUtils.validateEntityCount(exceededCount)).toThrow(
          `Entity count ${exceededCount} exceeds maximum limit of ${limits.MAX_ENTITIES}`
        );
      });

      it('should allow count equal to maximum', () => {
        const limits = configUtils.getLimits();
        expect(() =>
          configUtils.validateEntityCount(limits.MAX_ENTITIES)
        ).not.toThrow();
      });
    });

    describe('validateComponentSize', () => {
      it('should not throw error for valid component size', () => {
        expect(() => configUtils.validateComponentSize(1000)).not.toThrow();
      });

      it('should throw error when component size exceeds maximum', () => {
        const limits = configUtils.getLimits();
        const exceededSize = limits.MAX_COMPONENT_SIZE + 1;
        expect(() => configUtils.validateComponentSize(exceededSize)).toThrow(
          `Component size ${exceededSize} bytes exceeds maximum limit of ${limits.MAX_COMPONENT_SIZE} bytes`
        );
      });

      it('should allow size equal to maximum', () => {
        const limits = configUtils.getLimits();
        expect(() =>
          configUtils.validateComponentSize(limits.MAX_COMPONENT_SIZE)
        ).not.toThrow();
      });
    });

    describe('validateBatchSize', () => {
      it('should not throw error for valid batch size', () => {
        expect(() => configUtils.validateBatchSize(10)).not.toThrow();
      });

      it('should throw error when batch size exceeds maximum', () => {
        const limits = configUtils.getLimits();
        const exceededSize = limits.MAX_BATCH_SIZE + 1;
        expect(() => configUtils.validateBatchSize(exceededSize)).toThrow(
          `Batch size ${exceededSize} exceeds maximum limit of ${limits.MAX_BATCH_SIZE}`
        );
      });

      it('should allow size equal to maximum', () => {
        const limits = configUtils.getLimits();
        expect(() =>
          configUtils.validateBatchSize(limits.MAX_BATCH_SIZE)
        ).not.toThrow();
      });
    });

    describe('validateStringLength', () => {
      it('should not throw error for valid string length', () => {
        expect(() =>
          configUtils.validateStringLength('short string')
        ).not.toThrow();
      });

      it('should not throw error for null or undefined', () => {
        expect(() => configUtils.validateStringLength(null)).not.toThrow();
        expect(() => configUtils.validateStringLength(undefined)).not.toThrow();
      });

      it('should throw error when string length exceeds maximum', () => {
        const limits = configUtils.getLimits();
        const longString = 'a'.repeat(limits.MAX_STRING_LENGTH + 1);
        expect(() => configUtils.validateStringLength(longString)).toThrow(
          `String length ${longString.length} exceeds maximum limit of ${limits.MAX_STRING_LENGTH}`
        );
      });

      it('should allow string length equal to maximum', () => {
        const limits = configUtils.getLimits();
        const maxString = 'a'.repeat(limits.MAX_STRING_LENGTH);
        expect(() => configUtils.validateStringLength(maxString)).not.toThrow();
      });
    });

    describe('validateObjectDepth', () => {
      it('should not throw error for shallow object', () => {
        const obj = { a: 1, b: 'string' };
        expect(() => configUtils.validateObjectDepth(obj)).not.toThrow();
      });

      it('should not throw error for null or non-object', () => {
        expect(() => configUtils.validateObjectDepth(null)).not.toThrow();
        expect(() => configUtils.validateObjectDepth('string')).not.toThrow();
        expect(() => configUtils.validateObjectDepth(123)).not.toThrow();
      });

      it('should throw error when object depth exceeds maximum', () => {
        const limits = configUtils.getLimits();
        // Create deeply nested object
        let deepObj = {};
        let current = deepObj;
        for (let i = 0; i <= limits.MAX_COMPONENT_DEPTH + 1; i++) {
          current.nested = {};
          current = current.nested;
        }

        expect(() => configUtils.validateObjectDepth(deepObj)).toThrow(
          `Object depth ${limits.MAX_COMPONENT_DEPTH + 1} exceeds maximum limit of ${limits.MAX_COMPONENT_DEPTH}`
        );
      });

      it('should handle arrays without counting them as object depth', () => {
        const obj = { array: [1, 2, 3] };
        expect(() => configUtils.validateObjectDepth(obj)).not.toThrow();
      });
    });

    describe('validateObjectProperties', () => {
      it('should not throw error for object with few properties', () => {
        const obj = { a: 1, b: 2, c: 3 };
        expect(() => configUtils.validateObjectProperties(obj)).not.toThrow();
      });

      it('should not throw error for null or non-object', () => {
        expect(() => configUtils.validateObjectProperties(null)).not.toThrow();
        expect(() =>
          configUtils.validateObjectProperties('string')
        ).not.toThrow();
      });

      it('should throw error when property count exceeds maximum', () => {
        const limits = configUtils.getLimits();
        const obj = {};
        for (let i = 0; i < limits.MAX_COMPONENT_PROPERTIES + 1; i++) {
          obj[`prop${i}`] = i;
        }

        expect(() => configUtils.validateObjectProperties(obj)).toThrow(
          `Object property count ${limits.MAX_COMPONENT_PROPERTIES + 1} exceeds maximum limit of ${limits.MAX_COMPONENT_PROPERTIES}`
        );
      });
    });

    describe('validateComponentData', () => {
      it('should not throw error for valid component data', () => {
        const componentData = { type: 'test', value: 'valid' };
        expect(() =>
          configUtils.validateComponentData(componentData)
        ).not.toThrow();
      });

      it('should not throw error for null or non-object', () => {
        expect(() => configUtils.validateComponentData(null)).not.toThrow();
        expect(() => configUtils.validateComponentData('string')).not.toThrow();
      });

      it('should validate component size', () => {
        const limits = configUtils.getLimits();
        // Create component data that's too large
        const largeData = { data: 'x'.repeat(limits.MAX_COMPONENT_SIZE) };
        expect(() => configUtils.validateComponentData(largeData)).toThrow(
          /Component size .* bytes exceeds maximum limit/
        );
      });

      it('should validate object depth', () => {
        const limits = configUtils.getLimits();
        // Create deeply nested component data
        let deepData = {};
        let current = deepData;
        for (let i = 0; i <= limits.MAX_COMPONENT_DEPTH + 1; i++) {
          current.nested = {};
          current = current.nested;
        }

        expect(() => configUtils.validateComponentData(deepData)).toThrow(
          /Object depth .* exceeds maximum limit/
        );
      });

      it('should validate property count', () => {
        const limits = configUtils.getLimits();
        const manyPropsData = {};
        for (let i = 0; i < limits.MAX_COMPONENT_PROPERTIES + 1; i++) {
          manyPropsData[`prop${i}`] = i;
        }

        expect(() => configUtils.validateComponentData(manyPropsData)).toThrow(
          /Object property count .* exceeds maximum limit/
        );
      });

      it('should validate string lengths in nested objects', () => {
        const limits = configUtils.getLimits();
        const longString = 'x'.repeat(limits.MAX_STRING_LENGTH + 1);
        const dataWithLongString = {
          nested: {
            longValue: longString,
          },
        };

        expect(() =>
          configUtils.validateComponentData(dataWithLongString)
        ).toThrow(/String length .* exceeds maximum limit/);
      });

      it('should validate string lengths in property keys', () => {
        const limits = configUtils.getLimits();
        const longKey = 'x'.repeat(limits.MAX_STRING_LENGTH + 1);
        const dataWithLongKey = { [longKey]: 'value' };

        expect(() =>
          configUtils.validateComponentData(dataWithLongKey)
        ).toThrow(/String length .* exceeds maximum limit/);
      });

      it('should handle arrays in component data without recursive validation', () => {
        const componentData = {
          array: [{ nested: 'value' }],
          normalProp: 'value',
        };
        expect(() =>
          configUtils.validateComponentData(componentData)
        ).not.toThrow();
      });

      it('should recursively validate nested objects but not arrays', () => {
        const limits = configUtils.getLimits();
        const longString = 'x'.repeat(limits.MAX_STRING_LENGTH + 1);

        // Should validate nested object strings
        const dataWithNestedLongString = {
          nested: {
            deepValue: longString,
          },
        };
        expect(() =>
          configUtils.validateComponentData(dataWithNestedLongString)
        ).toThrow(/String length .* exceeds maximum limit/);

        // Should NOT validate array element strings (arrays are skipped)
        const dataWithArrayLongString = {
          array: [{ badValue: longString }],
        };
        expect(() =>
          configUtils.validateComponentData(dataWithArrayLongString)
        ).not.toThrow();
      });

      it('should handle objects with non-string keys', () => {
        // Create object with symbol key to test the typeof key === 'string' branch
        const symbolKey = Symbol('test');
        const objWithSymbolKey = {
          [symbolKey]: 'value',
          normalKey: 'normalValue',
        };
        expect(() =>
          configUtils.validateComponentData(objWithSymbolKey)
        ).not.toThrow();
      });
    });
  });

  describe('Performance and Circuit Breaker Getters', () => {
    beforeEach(() => {
      configUtils.initializeGlobalConfig(mockLogger);
    });

    describe('getSlowOperationThreshold', () => {
      it('should return slow operation threshold', () => {
        const threshold = configUtils.getSlowOperationThreshold();
        expect(typeof threshold).toBe('number');
        expect(threshold).toBeGreaterThan(0);
      });
    });

    describe('getMemoryWarningThreshold', () => {
      it('should return memory warning threshold', () => {
        const threshold = configUtils.getMemoryWarningThreshold();
        expect(typeof threshold).toBe('number');
        expect(threshold).toBeGreaterThanOrEqual(0);
        expect(threshold).toBeLessThanOrEqual(1);
      });
    });

    describe('getCircuitBreakerThreshold', () => {
      it('should return circuit breaker threshold', () => {
        const threshold = configUtils.getCircuitBreakerThreshold();
        expect(typeof threshold).toBe('number');
        expect(threshold).toBeGreaterThan(0);
      });
    });

    describe('getCircuitBreakerTimeout', () => {
      it('should return circuit breaker timeout', () => {
        const timeout = configUtils.getCircuitBreakerTimeout();
        expect(typeof timeout).toBe('number');
        expect(timeout).toBeGreaterThan(0);
      });
    });

    describe('getDefaultComponentTypes', () => {
      it('should return default component types array', () => {
        const types = configUtils.getDefaultComponentTypes();
        expect(Array.isArray(types)).toBe(true);
      });
    });
  });

  describe('Error Handling', () => {
    it('should throw consistent error messages for uninitialized config', () => {
      const functionsRequiringInit = [
        () => configUtils.getConfigValue('test'),
        () => configUtils.isFeatureEnabled('test'),
        () => configUtils.getLimits(),
        () => configUtils.getCacheSettings(),
        () => configUtils.getValidationSettings(),
        () => configUtils.getPerformanceSettings(),
        () => configUtils.validateEntityCount(1),
        () => configUtils.validateComponentSize(1),
        () => configUtils.validateBatchSize(1),
        () => configUtils.validateStringLength('test'),
        () => configUtils.validateObjectDepth({}),
        () => configUtils.validateObjectProperties({}),
        () => configUtils.validateComponentData({}),
        () => configUtils.isDebugEnabled(),
        () => configUtils.isMonitoringEnabled(),
        () => configUtils.isStrictValidationEnabled(),
        () => configUtils.isCachingEnabled(),
        () => configUtils.getSlowOperationThreshold(),
        () => configUtils.getMemoryWarningThreshold(),
        () => configUtils.getCircuitBreakerThreshold(),
        () => configUtils.getCircuitBreakerTimeout(),
        () => configUtils.getDefaultComponentTypes(),
      ];

      functionsRequiringInit.forEach((fn) => {
        expect(fn).toThrow('Global configuration provider is not initialized');
      });
    });

    it('should handle invalid logger gracefully in initialization', () => {
      expect(() => configUtils.initializeGlobalConfig(null)).toThrow();
      expect(() => configUtils.initializeGlobalConfig(undefined)).toThrow();
      expect(() => configUtils.initializeGlobalConfig({})).toThrow();
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      configUtils.initializeGlobalConfig(mockLogger);
    });

    it('should handle zero values in validation functions', () => {
      expect(() => configUtils.validateEntityCount(0)).not.toThrow();
      expect(() => configUtils.validateComponentSize(0)).not.toThrow();
      expect(() => configUtils.validateBatchSize(0)).not.toThrow();
    });

    it('should handle empty string validation', () => {
      expect(() => configUtils.validateStringLength('')).not.toThrow();
    });

    it('should handle empty object validation', () => {
      expect(() => configUtils.validateObjectDepth({})).not.toThrow();
      expect(() => configUtils.validateObjectProperties({})).not.toThrow();
      expect(() => configUtils.validateComponentData({})).not.toThrow();
    });

    it('should handle custom depth parameter in validateObjectDepth', () => {
      const obj = { nested: { deep: 'value' } };
      expect(() => configUtils.validateObjectDepth(obj, 0)).not.toThrow();

      const limits = configUtils.getLimits();
      expect(() =>
        configUtils.validateObjectDepth(obj, limits.MAX_COMPONENT_DEPTH)
      ).toThrow();
    });
  });
});
