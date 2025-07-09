/**
 * @file createDefaultServicesWithConfig - Configuration-aware service factory
 * @description Enhanced version of createDefaultServices that uses the new configuration system
 */

import EntityRepositoryAdapter from '../services/entityRepositoryAdapter.js';
import ComponentMutationService from '../services/componentMutationService.js';
import ErrorTranslator from '../services/errorTranslator.js';
import EntityFactory from '../factories/entityFactory.js';
import DefinitionCache from '../services/definitionCache.js';
import EntityLifecycleManager from '../services/entityLifecycleManager.js';
import { getGlobalConfig, isConfigInitialized } from './configUtils.js';

/** @typedef {import('../services/entityRepositoryAdapter.js').EntityRepositoryAdapter} EntityRepositoryAdapter */
/** @typedef {import('../services/componentMutationService.js').ComponentMutationService} ComponentMutationService */
/** @typedef {import('../services/errorTranslator.js').ErrorTranslator} ErrorTranslator */
/** @typedef {import('../factories/entityFactory.js').default} EntityFactory */
/** @typedef {import('../services/definitionCache.js').DefinitionCache} DefinitionCache */
/** @typedef {import('../services/entityLifecycleManager.js').EntityLifecycleManager} EntityLifecycleManager */

/**
 * Assemble default service dependencies for EntityManager with configuration awareness.
 *
 * @param {object} deps
 * @param {import('../../interfaces/coreServices.js').IDataRegistry} deps.registry
 * @param {import('../../interfaces/coreServices.js').ISchemaValidator} deps.validator
 * @param {import('../../interfaces/coreServices.js').ILogger} deps.logger
 * @param {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} deps.eventDispatcher
 * @param {import('../../ports/IIdGenerator.js').IIdGenerator} deps.idGenerator
 * @param {import('../../ports/IComponentCloner.js').IComponentCloner} deps.cloner
 * @param {import('../../ports/IDefaultComponentPolicy.js').IDefaultComponentPolicy} deps.defaultPolicy
 * @returns {{
 *   entityRepository: EntityRepositoryAdapter,
 *   componentMutationService: ComponentMutationService,
 *   errorTranslator: ErrorTranslator,
 *   entityFactory: EntityFactory,
 *   definitionCache: DefinitionCache,
 *   entityLifecycleManager: EntityLifecycleManager,
 * }} Collection of default service instances configured according to EntityConfig.
 */
export function createDefaultServicesWithConfig({
  registry,
  validator,
  logger,
  eventDispatcher,
  idGenerator,
  cloner,
  defaultPolicy,
}) {
  // Get configuration settings
  const config = isConfigInitialized() ? getGlobalConfig() : null;
  const limits = config?.getLimits() || {};
  const cacheSettings = config?.getCacheSettings() || {};
  const validationSettings = config?.getValidationSettings() || {};
  const performanceSettings = config?.getPerformanceSettings() || {};

  logger.debug('Creating default services with configuration:', {
    limits,
    cacheSettings,
    validationSettings,
    performanceSettings,
  });

  // Create EntityRepositoryAdapter with configuration
  const entityRepository = new EntityRepositoryAdapter({
    logger,
    maxEntities: limits.MAX_ENTITIES,
    enableValidation: validationSettings.ENABLE_VALIDATION,
  });

  // Create ComponentMutationService with configuration
  const componentMutationService = new ComponentMutationService({
    registry,
    validator,
    logger,
    eventDispatcher,
    maxComponentSize: limits.MAX_COMPONENT_SIZE,
    strictValidation: validationSettings.STRICT_MODE,
    enableCircuitBreaker: config?.isFeatureEnabled(
      'errorHandling.ENABLE_CIRCUIT_BREAKER'
    ),
  });

  // Create ErrorTranslator with configuration
  const errorTranslator = new ErrorTranslator({
    logger,
    enableDetailedErrors: !config?.isProduction(),
    maxRetries: config?.getValue('errorHandling.MAX_RETRY_ATTEMPTS') || 3,
  });

  // Create EntityFactory with configuration
  const entityFactory = new EntityFactory({
    validator,
    logger,
    idGenerator,
    cloner,
    defaultPolicy,
  });

  // Create DefinitionCache with configuration
  const definitionCache = new DefinitionCache({
    logger,
    enableCache: cacheSettings.ENABLE_DEFINITION_CACHE,
    cacheTtl: cacheSettings.DEFINITION_CACHE_TTL,
    maxCacheSize: cacheSettings.COMPONENT_CACHE_SIZE,
  });

  // Create EntityLifecycleManager with configuration
  const entityLifecycleManager = new EntityLifecycleManager({
    registry,
    validator,
    logger,
    eventDispatcher,
    idGenerator,
    cloner,
    defaultPolicy,
    entityRepository,
    entityFactory,
    enableMonitoring: performanceSettings.ENABLE_MONITORING,
    slowOperationThreshold: performanceSettings.SLOW_OPERATION_THRESHOLD,
    enableBatchOperations: config?.isFeatureEnabled(
      'performance.ENABLE_BATCH_OPERATIONS'
    ),
  });

  logger.info('Default services created with configuration-aware settings');

  return {
    entityRepository,
    componentMutationService,
    errorTranslator,
    entityFactory,
    definitionCache,
    entityLifecycleManager,
  };
}

/**
 * Creates default services and applies configuration overrides.
 *
 * @param {object} deps - Dependencies (same as createDefaultServicesWithConfig)
 * @param {object} [configOverrides] - Configuration overrides to apply
 * @returns {object} Collection of configured service instances
 */
export function createConfiguredServices(deps, configOverrides = {}) {
  const config = isConfigInitialized() ? getGlobalConfig() : null;

  if (config && Object.keys(configOverrides).length > 0) {
    // Apply configuration overrides
    for (const [key, value] of Object.entries(configOverrides)) {
      config.setValue(key, value);
    }
    deps.logger.debug('Applied configuration overrides:', configOverrides);
  }

  return createDefaultServicesWithConfig(deps);
}

/**
 * Creates services with performance optimization settings.
 *
 * @param {object} deps - Dependencies
 * @returns {object} Collection of performance-optimized service instances
 */
export function createPerformanceOptimizedServices(deps) {
  const performanceOverrides = {
    'performance.ENABLE_MONITORING': true,
    'performance.ENABLE_OPERATION_TRACING': true,
    'cache.ENABLE_DEFINITION_CACHE': true,
    'cache.ENABLE_VALIDATION_CACHE': true,
    'validation.STRICT_MODE': false, // Relax validation for performance
  };

  return createConfiguredServices(deps, performanceOverrides);
}

/**
 * Creates services with strict validation settings.
 *
 * @param {object} deps - Dependencies
 * @returns {object} Collection of strictly validated service instances
 */
export function createStrictValidationServices(deps) {
  const strictOverrides = {
    'validation.STRICT_MODE': true,
    'validation.VALIDATE_COMPONENT_SCHEMAS': true,
    'validation.ENABLE_CIRCULAR_REFERENCE_CHECK': true,
    'validation.ALLOW_UNKNOWN_COMPONENTS': false,
    'errorHandling.ENABLE_CIRCUIT_BREAKER': true,
  };

  return createConfiguredServices(deps, strictOverrides);
}

/**
 * Creates services with testing optimizations.
 *
 * @param {object} deps - Dependencies
 * @returns {object} Collection of test-optimized service instances
 */
export function createTestOptimizedServices(deps) {
  const testOverrides = {
    'performance.ENABLE_MONITORING': false,
    'performance.ENABLE_OPERATION_TRACING': false,
    'cache.ENABLE_DEFINITION_CACHE': false,
    'cache.ENABLE_VALIDATION_CACHE': false,
    'logging.ENABLE_DEBUG_LOGGING': false,
    'validation.STRICT_MODE': false,
  };

  return createConfiguredServices(deps, testOverrides);
}

/**
 * Validates that all required configuration is present.
 *
 * @param {object} config - Configuration to validate
 * @throws {Error} If required configuration is missing
 */
export function validateServiceConfiguration(config) {
  const requiredPaths = [
    'limits.MAX_ENTITIES',
    'limits.MAX_COMPONENT_SIZE',
    'cache.ENABLE_DEFINITION_CACHE',
    'validation.STRICT_MODE',
    'performance.ENABLE_MONITORING',
  ];

  for (const path of requiredPaths) {
    if (config.getValue(path) === undefined) {
      throw new Error(`Required configuration path '${path}' is missing`);
    }
  }
}

/**
 * Gets service configuration summary for logging.
 *
 * @param {object} config - Configuration provider
 * @returns {object} Configuration summary
 */
export function getServiceConfigurationSummary(config) {
  return {
    maxEntities: config.getValue('limits.MAX_ENTITIES'),
    maxComponentSize: config.getValue('limits.MAX_COMPONENT_SIZE'),
    cachingEnabled: config.getValue('cache.ENABLE_DEFINITION_CACHE'),
    monitoringEnabled: config.getValue('performance.ENABLE_MONITORING'),
    strictValidation: config.getValue('validation.STRICT_MODE'),
    environment: config.getValue('environment.NODE_ENV'),
  };
}
