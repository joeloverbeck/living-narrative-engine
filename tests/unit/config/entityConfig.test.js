import { describe, it, expect } from '@jest/globals';
import EntityConfig from '../../../src/entities/config/EntityConfig.js';

describe('EntityConfig.getConfig base configuration', () => {
  it('returns base configuration without environment overrides', () => {
    const config = EntityConfig.getConfig();
    // Base configuration should have default values
    expect(config.logging.ENABLE_DEBUG_LOGGING).toBe(false);
    expect(config.performance.ENABLE_OPERATION_TRACING).toBe(false);
    expect(config.validation.STRICT_MODE).toBe(true);
    expect(config.performance.ENABLE_MONITORING).toBe(true);
    expect(config.cache.ENABLE_VALIDATION_CACHE).toBe(true);
    expect(config.cache.ENABLE_DEFINITION_CACHE).toBe(true);
  });
});

describe('EntityConfig.validateConfig', () => {
  const validConfig = {
    limits: { MAX_ENTITIES: 1, MAX_COMPONENT_SIZE: 1, MAX_BATCH_SIZE: 1 },
    cache: { DEFINITION_CACHE_TTL: 1, VALIDATION_CACHE_SIZE: 1 },
    performance: {
      SLOW_OPERATION_THRESHOLD: 1,
      MEMORY_WARNING_THRESHOLD: 0.5,
      DEFAULT_BATCH_SIZE: 1,
      MAX_BATCH_SIZE: 2,
    },
    batchOperations: {
      MAX_FAILURES_PER_BATCH: 1,
      BATCH_RETRY_ATTEMPTS: 1,
      BATCH_RETRY_DELAY_MS: 1000,
    },
    worldLoading: {
      WORLD_LOADING_BATCH_SIZE: 10,
      WORLD_LOADING_MAX_BATCH_SIZE: 20,
      WORLD_LOADING_BATCH_THRESHOLD: 1,
      WORLD_LOADING_TIMEOUT_MS: 30000,
      MEMORY_THRESHOLD: 0.75,
      MAX_BATCH_FAILURES_BEFORE_FALLBACK: 1,
    },
  };

  it('returns true for valid config', () => {
    expect(EntityConfig.validateConfig(validConfig)).toBe(true);
  });

  it('throws when config is not an object', () => {
    expect(() => EntityConfig.validateConfig(null)).toThrow(
      'must be an object'
    );
  });

  describe('limits validation', () => {
    it('throws when MAX_ENTITIES is invalid', () => {
      const bad = { ...validConfig, limits: { MAX_ENTITIES: 0 } };
      expect(() => EntityConfig.validateConfig(bad)).toThrow('MAX_ENTITIES');
    });

    it('throws when MAX_COMPONENT_SIZE is invalid', () => {
      const bad = { ...validConfig, limits: { MAX_COMPONENT_SIZE: 0 } };
      expect(() => EntityConfig.validateConfig(bad)).toThrow(
        'MAX_COMPONENT_SIZE'
      );
    });

    it('throws when MAX_BATCH_SIZE is invalid', () => {
      const bad = { ...validConfig, limits: { MAX_BATCH_SIZE: 0 } };
      expect(() => EntityConfig.validateConfig(bad)).toThrow('MAX_BATCH_SIZE');
    });
  });

  describe('cache validation', () => {
    it('throws when DEFINITION_CACHE_TTL is invalid', () => {
      const bad = { ...validConfig, cache: { DEFINITION_CACHE_TTL: 0 } };
      expect(() => EntityConfig.validateConfig(bad)).toThrow(
        'DEFINITION_CACHE_TTL'
      );
    });

    it('throws when VALIDATION_CACHE_SIZE is invalid', () => {
      const bad = { ...validConfig, cache: { VALIDATION_CACHE_SIZE: 0 } };
      expect(() => EntityConfig.validateConfig(bad)).toThrow(
        'VALIDATION_CACHE_SIZE'
      );
    });
  });

  describe('performance validation', () => {
    it('throws when SLOW_OPERATION_THRESHOLD is invalid', () => {
      const bad = {
        ...validConfig,
        performance: { SLOW_OPERATION_THRESHOLD: 0 },
      };
      expect(() => EntityConfig.validateConfig(bad)).toThrow(
        'SLOW_OPERATION_THRESHOLD'
      );
    });

    it('throws when MEMORY_WARNING_THRESHOLD is too low', () => {
      const bad = {
        ...validConfig,
        performance: { MEMORY_WARNING_THRESHOLD: 0 },
      };
      expect(() => EntityConfig.validateConfig(bad)).toThrow(
        'MEMORY_WARNING_THRESHOLD'
      );
    });

    it('throws when MEMORY_WARNING_THRESHOLD is too high', () => {
      const bad = {
        ...validConfig,
        performance: { MEMORY_WARNING_THRESHOLD: 1.5 },
      };
      expect(() => EntityConfig.validateConfig(bad)).toThrow(
        'MEMORY_WARNING_THRESHOLD'
      );
    });

    it('throws when DEFAULT_BATCH_SIZE is invalid', () => {
      const bad = { ...validConfig, performance: { DEFAULT_BATCH_SIZE: 0 } };
      expect(() => EntityConfig.validateConfig(bad)).toThrow(
        'DEFAULT_BATCH_SIZE'
      );
    });

    it('throws when MAX_BATCH_SIZE is invalid', () => {
      const bad = { ...validConfig, performance: { MAX_BATCH_SIZE: 0 } };
      expect(() => EntityConfig.validateConfig(bad)).toThrow('MAX_BATCH_SIZE');
    });

    it('throws when DEFAULT_BATCH_SIZE exceeds MAX_BATCH_SIZE', () => {
      const bad = {
        ...validConfig,
        performance: { DEFAULT_BATCH_SIZE: 10, MAX_BATCH_SIZE: 5 },
      };
      expect(() => EntityConfig.validateConfig(bad)).toThrow(
        'DEFAULT_BATCH_SIZE must be <= MAX_BATCH_SIZE'
      );
    });
  });

  describe('batchOperations validation', () => {
    it('throws when MAX_FAILURES_PER_BATCH is negative', () => {
      const bad = {
        ...validConfig,
        batchOperations: { MAX_FAILURES_PER_BATCH: -1 },
      };
      expect(() => EntityConfig.validateConfig(bad)).toThrow(
        'MAX_FAILURES_PER_BATCH'
      );
    });

    it('throws when BATCH_RETRY_ATTEMPTS is negative', () => {
      const bad = {
        ...validConfig,
        batchOperations: { BATCH_RETRY_ATTEMPTS: -1 },
      };
      expect(() => EntityConfig.validateConfig(bad)).toThrow(
        'BATCH_RETRY_ATTEMPTS'
      );
    });

    it('throws when BATCH_RETRY_DELAY_MS is negative', () => {
      const bad = {
        ...validConfig,
        batchOperations: { BATCH_RETRY_DELAY_MS: -1 },
      };
      expect(() => EntityConfig.validateConfig(bad)).toThrow(
        'BATCH_RETRY_DELAY_MS'
      );
    });
  });

  describe('worldLoading validation', () => {
    it('throws when WORLD_LOADING_BATCH_SIZE is invalid', () => {
      const bad = {
        ...validConfig,
        worldLoading: { WORLD_LOADING_BATCH_SIZE: 0 },
      };
      expect(() => EntityConfig.validateConfig(bad)).toThrow(
        'WORLD_LOADING_BATCH_SIZE'
      );
    });

    it('throws when WORLD_LOADING_MAX_BATCH_SIZE is invalid', () => {
      const bad = {
        ...validConfig,
        worldLoading: { WORLD_LOADING_MAX_BATCH_SIZE: 0 },
      };
      expect(() => EntityConfig.validateConfig(bad)).toThrow(
        'WORLD_LOADING_MAX_BATCH_SIZE'
      );
    });

    it('throws when WORLD_LOADING_BATCH_SIZE exceeds WORLD_LOADING_MAX_BATCH_SIZE', () => {
      const bad = {
        ...validConfig,
        worldLoading: {
          WORLD_LOADING_BATCH_SIZE: 50,
          WORLD_LOADING_MAX_BATCH_SIZE: 25,
        },
      };
      expect(() => EntityConfig.validateConfig(bad)).toThrow(
        'WORLD_LOADING_BATCH_SIZE must be <= WORLD_LOADING_MAX_BATCH_SIZE'
      );
    });

    it('throws when WORLD_LOADING_BATCH_THRESHOLD is negative', () => {
      const bad = {
        ...validConfig,
        worldLoading: { WORLD_LOADING_BATCH_THRESHOLD: -1 },
      };
      expect(() => EntityConfig.validateConfig(bad)).toThrow(
        'WORLD_LOADING_BATCH_THRESHOLD'
      );
    });

    it('throws when WORLD_LOADING_TIMEOUT_MS is invalid', () => {
      const bad = {
        ...validConfig,
        worldLoading: { WORLD_LOADING_TIMEOUT_MS: 0 },
      };
      expect(() => EntityConfig.validateConfig(bad)).toThrow(
        'WORLD_LOADING_TIMEOUT_MS'
      );
    });

    it('throws when MEMORY_THRESHOLD is too low', () => {
      const bad = { ...validConfig, worldLoading: { MEMORY_THRESHOLD: -0.1 } };
      expect(() => EntityConfig.validateConfig(bad)).toThrow(
        'MEMORY_THRESHOLD'
      );
    });

    it('throws when MEMORY_THRESHOLD is too high', () => {
      const bad = { ...validConfig, worldLoading: { MEMORY_THRESHOLD: 1.5 } };
      expect(() => EntityConfig.validateConfig(bad)).toThrow(
        'MEMORY_THRESHOLD'
      );
    });

    it('throws when MAX_BATCH_FAILURES_BEFORE_FALLBACK is negative', () => {
      const bad = {
        ...validConfig,
        worldLoading: { MAX_BATCH_FAILURES_BEFORE_FALLBACK: -1 },
      };
      expect(() => EntityConfig.validateConfig(bad)).toThrow(
        'MAX_BATCH_FAILURES_BEFORE_FALLBACK'
      );
    });
  });
});

describe('EntityConfig.mergeConfig', () => {
  it('merges user config with defaults', () => {
    process.env.NODE_ENV = 'development';
    const merged = EntityConfig.mergeConfig({ limits: { MAX_ENTITIES: 5 } });
    expect(merged.limits.MAX_ENTITIES).toBe(5);
    // Should still include other default sections
    expect(merged.cache).toBeDefined();
  });

  it('throws for invalid user config', () => {
    expect(() =>
      EntityConfig.mergeConfig({ limits: { MAX_ENTITIES: 0 } })
    ).toThrow();
  });

  it('merges nested objects correctly', () => {
    const userConfig = {
      performance: {
        ENABLE_MONITORING: false,
        nested: {
          value: 42,
        },
      },
    };
    const merged = EntityConfig.mergeConfig(userConfig);
    expect(merged.performance.ENABLE_MONITORING).toBe(false);
    expect(merged.performance.nested.value).toBe(42);
    // Should preserve other performance defaults
    expect(merged.performance.SLOW_OPERATION_THRESHOLD).toBeDefined();
  });

  it('handles array values correctly in merge', () => {
    const userConfig = {
      defaults: {
        DEFAULT_COMPONENT_TYPES: ['custom:component'],
      },
    };
    const merged = EntityConfig.mergeConfig(userConfig);
    expect(merged.defaults.DEFAULT_COMPONENT_TYPES).toEqual([
      'custom:component',
    ]);
  });

  it('handles null and undefined values in merge', () => {
    const userConfig = {
      limits: {
        MAX_ENTITIES: 100,
        MAX_COMPONENT_SIZE: 1000, // Valid value to avoid validation error
        MAX_BATCH_SIZE: 50,
      },
      custom: {
        null_value: null,
        undefined_value: undefined,
      },
    };
    const merged = EntityConfig.mergeConfig(userConfig);
    expect(merged.limits.MAX_ENTITIES).toBe(100);
    expect(merged.limits.MAX_COMPONENT_SIZE).toBe(1000);
    expect(merged.custom.null_value).toBeNull();
    expect(merged.custom.undefined_value).toBeUndefined();
  });

  it('works with empty user config', () => {
    const merged = EntityConfig.mergeConfig({});
    expect(merged.limits).toBeDefined();
    expect(merged.cache).toBeDefined();
  });

  it('works without user config parameter', () => {
    const merged = EntityConfig.mergeConfig();
    expect(merged.limits).toBeDefined();
    expect(merged.cache).toBeDefined();
  });
});

describe('EntityConfig helper methods', () => {
  it('getSection retrieves config sections', () => {
    const section = EntityConfig.getSection('logging');
    expect(section).toHaveProperty('DEFAULT_LOG_LEVEL');
    expect(EntityConfig.getSection('nonexistent')).toBeNull();
  });

  it('isFeatureEnabled checks nested flags', () => {
    // Base config has ENABLE_OPERATION_TRACING = false
    expect(
      EntityConfig.isFeatureEnabled('performance.ENABLE_OPERATION_TRACING')
    ).toBe(false);
    expect(EntityConfig.isFeatureEnabled('unknown.feature')).toBe(false);
  });

  it('isFeatureEnabled returns false for missing nested properties', () => {
    expect(EntityConfig.isFeatureEnabled('performance.NONEXISTENT')).toBe(
      false
    );
    expect(EntityConfig.isFeatureEnabled('nonexistent.property')).toBe(false);
  });

  it('isFeatureEnabled works with boolean values', () => {
    expect(EntityConfig.isFeatureEnabled('validation.STRICT_MODE')).toBe(true);
    expect(EntityConfig.isFeatureEnabled('performance.ENABLE_MONITORING')).toBe(
      true
    );
  });
});

describe('EntityConfig additional validation edge cases', () => {
  it('validateConfig passes when optional sections are missing', () => {
    const minimalConfig = {
      limits: { MAX_ENTITIES: 1, MAX_COMPONENT_SIZE: 1, MAX_BATCH_SIZE: 1 },
    };
    expect(EntityConfig.validateConfig(minimalConfig)).toBe(true);
  });

  it('validateConfig passes when worldLoading MEMORY_THRESHOLD is not defined', () => {
    const configWithoutMemoryThreshold = {
      limits: { MAX_ENTITIES: 1, MAX_COMPONENT_SIZE: 1, MAX_BATCH_SIZE: 1 },
      worldLoading: {
        WORLD_LOADING_BATCH_SIZE: 10,
        WORLD_LOADING_MAX_BATCH_SIZE: 20,
        WORLD_LOADING_BATCH_THRESHOLD: 1,
        WORLD_LOADING_TIMEOUT_MS: 30000,
        MAX_BATCH_FAILURES_BEFORE_FALLBACK: 1,
      },
    };
    expect(EntityConfig.validateConfig(configWithoutMemoryThreshold)).toBe(
      true
    );
  });
});

describe('EntityConfig environment behavior', () => {
  const originalProcess = globalThis.process;
  const originalEnv = originalProcess?.env?.NODE_ENV;

  afterEach(() => {
    // Restore original process and environment
    globalThis.process = originalProcess;
    if (originalProcess && originalEnv !== undefined) {
      originalProcess.env.NODE_ENV = originalEnv;
    }
  });

  it('handles missing process environment', () => {
    globalThis.process = undefined;

    const config = EntityConfig.getConfig();
    expect(config.environment.NODE_ENV).toBe('development');
    // When process is undefined, IS_DEVELOPMENT is false because undefined !== 'development'
    expect(config.environment.IS_DEVELOPMENT).toBe(false);
    expect(config.environment.IS_PRODUCTION).toBe(false);
    expect(config.environment.IS_TEST).toBe(false);
  });

  it('handles different NODE_ENV values', () => {
    if (originalProcess) {
      // Test production
      originalProcess.env.NODE_ENV = 'production';
      let config = EntityConfig.getConfig();
      expect(config.environment.IS_PRODUCTION).toBe(true);
      expect(config.environment.IS_DEVELOPMENT).toBe(false);
      expect(config.environment.IS_TEST).toBe(false);

      // Test test
      originalProcess.env.NODE_ENV = 'test';
      config = EntityConfig.getConfig();
      expect(config.environment.IS_TEST).toBe(true);
      expect(config.environment.IS_DEVELOPMENT).toBe(false);
      expect(config.environment.IS_PRODUCTION).toBe(false);
    }
  });
});
