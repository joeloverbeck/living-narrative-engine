import { describe, it, expect, afterEach } from '@jest/globals';
import EntityConfig from '../../../src/entities/config/EntityConfig.js';

// Preserve original NODE_ENV
const ORIGINAL_ENV = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = ORIGINAL_ENV;
});

describe('EntityConfig.getConfig environment overrides', () => {
  it('applies production overrides', () => {
    process.env.NODE_ENV = 'production';
    const config = EntityConfig.getConfig();
    expect(config.logging.ENABLE_DEBUG_LOGGING).toBe(false);
    expect(config.performance.ENABLE_OPERATION_TRACING).toBe(false);
    expect(config.validation.STRICT_MODE).toBe(true);
  });

  it('applies development overrides', () => {
    process.env.NODE_ENV = 'development';
    const config = EntityConfig.getConfig();
    expect(config.logging.ENABLE_DEBUG_LOGGING).toBe(true);
    expect(config.performance.ENABLE_OPERATION_TRACING).toBe(true);
    expect(config.validation.STRICT_MODE).toBe(false);
  });

  it('applies test overrides', () => {
    process.env.NODE_ENV = 'test';
    const config = EntityConfig.getConfig();
    expect(config.logging.ENABLE_DEBUG_LOGGING).toBe(false);
    expect(config.performance.ENABLE_MONITORING).toBe(false);
    expect(config.cache.ENABLE_VALIDATION_CACHE).toBe(false);
    expect(config.cache.ENABLE_DEFINITION_CACHE).toBe(false);
  });
});

describe('EntityConfig.validateConfig', () => {
  const validConfig = {
    limits: { MAX_ENTITIES: 1, MAX_COMPONENT_SIZE: 1, MAX_BATCH_SIZE: 1 },
    cache: { DEFINITION_CACHE_TTL: 1, VALIDATION_CACHE_SIZE: 1 },
    performance: { SLOW_OPERATION_THRESHOLD: 1, MEMORY_WARNING_THRESHOLD: 0.5 },
  };

  it('returns true for valid config', () => {
    expect(EntityConfig.validateConfig(validConfig)).toBe(true);
  });

  it('throws when config is not an object', () => {
    expect(() => EntityConfig.validateConfig(null)).toThrow(
      'must be an object'
    );
  });

  it('throws when limits are invalid', () => {
    const bad = { ...validConfig, limits: { MAX_ENTITIES: 0 } };
    expect(() => EntityConfig.validateConfig(bad)).toThrow('MAX_ENTITIES');
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
});

describe('EntityConfig helper methods', () => {
  it('getSection retrieves config sections', () => {
    const section = EntityConfig.getSection('logging');
    expect(section).toHaveProperty('DEFAULT_LOG_LEVEL');
    expect(EntityConfig.getSection('nonexistent')).toBeNull();
  });

  it('isFeatureEnabled checks nested flags', () => {
    process.env.NODE_ENV = 'development';
    expect(
      EntityConfig.isFeatureEnabled('performance.ENABLE_OPERATION_TRACING')
    ).toBe(true);
    expect(EntityConfig.isFeatureEnabled('unknown.feature')).toBe(false);
  });
});
