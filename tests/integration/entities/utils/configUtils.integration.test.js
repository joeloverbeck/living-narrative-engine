/**
 * @file Integration tests for configUtils backed by the real EntityConfigProvider.
 * @jest-environment node
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import ConsoleLogger, {
  LogLevel,
} from '../../../../src/logging/consoleLogger.js';
import EntityConfigProvider from '../../../../src/entities/config/EntityConfigProvider.js';
import {
  initializeGlobalConfig,
  getGlobalConfig,
  getConfigValue,
  getLimits,
  getCacheSettings,
  getValidationSettings,
  getPerformanceSettings,
  getDefaultComponentTypes,
  isFeatureEnabled,
  isDebugEnabled,
  isMonitoringEnabled,
  isStrictValidationEnabled,
  isCachingEnabled,
  validateEntityCount,
  validateComponentSize,
  validateBatchSize,
  validateStringLength,
  validateObjectDepth,
  validateObjectProperties,
  validateComponentData,
  getSlowOperationThreshold,
  getMemoryWarningThreshold,
  getCircuitBreakerThreshold,
  getCircuitBreakerTimeout,
  resetGlobalConfig,
  isConfigInitialized,
} from '../../../../src/entities/utils/configUtils.js';

const createLogger = () => new ConsoleLogger(LogLevel.NONE);

describe('configUtils integration', () => {
  /** @type {string | undefined} */
  let originalNodeEnv;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
    resetGlobalConfig();
  });

  afterEach(() => {
    resetGlobalConfig();
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('initializes the global provider with environment-aware defaults and exposes config helpers', () => {
    process.env.NODE_ENV = 'production';
    const logger = createLogger();

    const provider = initializeGlobalConfig(logger, {
      performance: { SLOW_OPERATION_THRESHOLD: 155 },
      limits: { MAX_ENTITIES: 4321 },
    });

    expect(provider).toBeInstanceOf(EntityConfigProvider);
    expect(getGlobalConfig()).toBe(provider);
    expect(isConfigInitialized()).toBe(true);

    const limits = getLimits();
    expect(limits.MAX_ENTITIES).toBe(4321);

    const performance = getPerformanceSettings();
    expect(performance.ENABLE_OPERATION_TRACING).toBe(false);
    expect(getSlowOperationThreshold()).toBe(155);
    expect(getMemoryWarningThreshold()).toBe(
      performance.MEMORY_WARNING_THRESHOLD
    );

    const cache = getCacheSettings();
    const validation = getValidationSettings();
    expect(isCachingEnabled()).toBe(cache.ENABLE_DEFINITION_CACHE);
    expect(isStrictValidationEnabled()).toBe(validation.STRICT_MODE);

    expect(isFeatureEnabled('performance.ENABLE_MONITORING')).toBe(true);
    expect(isMonitoringEnabled()).toBe(true);
    expect(isDebugEnabled()).toBe(false);

    expect(getCircuitBreakerThreshold()).toBe(
      getConfigValue('errorHandling.CIRCUIT_BREAKER_THRESHOLD')
    );
    expect(getCircuitBreakerTimeout()).toBe(
      getConfigValue('errorHandling.CIRCUIT_BREAKER_TIMEOUT')
    );

    const defaultTypes = getDefaultComponentTypes();
    expect(defaultTypes).toEqual(
      expect.arrayContaining(['core:short_term_memory', 'core:goals'])
    );

    expect(getConfigValue('does.not.exist')).toBeUndefined();
  });

  it('enforces live configuration limits when validating entities and component payloads', () => {
    process.env.NODE_ENV = 'development';
    const logger = createLogger();

    initializeGlobalConfig(logger, {
      limits: {
        MAX_ENTITIES: 2,
        MAX_COMPONENT_SIZE: 120,
        MAX_COMPONENT_DEPTH: 1,
        MAX_COMPONENT_PROPERTIES: 2,
        MAX_STRING_LENGTH: 5,
        MAX_BATCH_SIZE: 2,
      },
    });

    expect(() => validateEntityCount(2)).not.toThrow();
    expect(() => validateEntityCount(3)).toThrow(
      'Entity count 3 exceeds maximum limit of 2'
    );

    expect(() => validateComponentSize(120)).not.toThrow();
    expect(() => validateComponentSize(121)).toThrow(
      'Component size 121 bytes exceeds maximum limit of 120 bytes'
    );

    expect(() => validateBatchSize(2)).not.toThrow();
    expect(() => validateBatchSize(3)).toThrow(
      'Batch size 3 exceeds maximum limit of 2'
    );

    expect(() => validateStringLength('abcde')).not.toThrow();
    expect(() => validateStringLength(null)).not.toThrow();
    expect(() => validateStringLength('abcdef')).toThrow(
      'String length 6 exceeds maximum limit of 5'
    );

    const shallowObject = { first: { second: 'ok' } };
    expect(() => validateObjectDepth(shallowObject)).not.toThrow();
    const deepObject = { first: { second: { third: 'fail' } } };
    expect(() => validateObjectDepth(deepObject)).toThrow(
      'Object depth 2 exceeds maximum limit of 1'
    );
    expect(() => validateObjectDepth(null)).not.toThrow();
    expect(() => validateObjectDepth('string')).not.toThrow();

    expect(() => validateObjectProperties({ a: 1, b: 2 })).not.toThrow();
    expect(() => validateObjectProperties({ a: 1, b: 2, c: 3 })).toThrow(
      'Object property count 3 exceeds maximum limit of 2'
    );
    expect(() => validateObjectProperties('string')).not.toThrow();

    expect(() => validateComponentData(null)).not.toThrow();
    expect(() => validateComponentData('string')).not.toThrow();
    const safeComponent = { nm: 'short', dt: { nt: 'fine' } };
    expect(() => validateComponentData(safeComponent)).not.toThrow();

    const tooManyProps = { a: '1', b: '2', c: '3' };
    expect(() => validateComponentData(tooManyProps)).toThrow(
      'Object property count 3 exceeds maximum limit of 2'
    );

    const tooDeepComponent = { layer1: { layer2: { layer3: 'x' } } };
    expect(() => validateComponentData(tooDeepComponent)).toThrow(
      'Object depth 2 exceeds maximum limit of 1'
    );

    const longStringComponent = { nested: { description: 'abcdef' } };
    expect(() => validateComponentData(longStringComponent)).toThrow(
      'String length 6 exceeds maximum limit of 5'
    );
  });

  it('guards access before initialization and supports full resets between runs', () => {
    resetGlobalConfig();
    expect(isConfigInitialized()).toBe(false);
    expect(() => getGlobalConfig()).toThrow(
      'Global configuration provider is not initialized. Call initializeGlobalConfig() first.'
    );
    expect(() => getConfigValue('limits.MAX_ENTITIES')).toThrow(
      'Global configuration provider is not initialized. Call initializeGlobalConfig() first.'
    );

    process.env.NODE_ENV = 'test';
    initializeGlobalConfig(createLogger());
    expect(isConfigInitialized()).toBe(true);

    resetGlobalConfig();
    expect(isConfigInitialized()).toBe(false);
    expect(() => getCacheSettings()).toThrow(
      'Global configuration provider is not initialized. Call initializeGlobalConfig() first.'
    );
  });

  it('re-initializes against new environments and updates feature flags accordingly', () => {
    process.env.NODE_ENV = 'test';
    initializeGlobalConfig(createLogger());

    expect(isCachingEnabled()).toBe(false);
    expect(isMonitoringEnabled()).toBe(false);
    expect(isDebugEnabled()).toBe(false);

    process.env.NODE_ENV = 'development';
    const logger = createLogger();
    initializeGlobalConfig(logger, {
      cache: { ENABLE_DEFINITION_CACHE: true },
      performance: { ENABLE_MONITORING: true },
    });

    expect(isCachingEnabled()).toBe(true);
    expect(isMonitoringEnabled()).toBe(true);
    expect(isDebugEnabled()).toBe(true);
  });
});
