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
import MonitoringCoordinator from '../monitoring/MonitoringCoordinator.js';
import BatchOperationManager from '../operations/BatchOperationManager.js';
import BatchSpatialIndexManager from '../operations/BatchSpatialIndexManager.js';
import SpatialIndexManager from '../spatialIndexManager.js';
import { getGlobalConfig, isConfigInitialized } from './configUtils.js';

/** @typedef {import('../services/entityRepositoryAdapter.js').EntityRepositoryAdapter} EntityRepositoryAdapter */
/** @typedef {import('../services/componentMutationService.js').ComponentMutationService} ComponentMutationService */
/** @typedef {import('../services/errorTranslator.js').ErrorTranslator} ErrorTranslator */
/** @typedef {import('../factories/entityFactory.js').default} EntityFactory */
/** @typedef {import('../services/definitionCache.js').DefinitionCache} DefinitionCache */
/** @typedef {import('../services/entityLifecycleManager.js').EntityLifecycleManager} EntityLifecycleManager */
/** @typedef {import('../monitoring/MonitoringCoordinator.js').default} MonitoringCoordinator */
/** @typedef {import('../operations/BatchOperationManager.js').default} BatchOperationManager */
/** @typedef {import('../operations/BatchSpatialIndexManager.js').default} BatchSpatialIndexManager */
/** @typedef {import('../spatialIndexManager.js').default} SpatialIndexManager */

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
 * @param {import('../../dependencyInjection/appContainer.js').default} [deps.container] - Optional DI container
 * @returns {{
 *   entityRepository: EntityRepositoryAdapter,
 *   componentMutationService: ComponentMutationService,
 *   errorTranslator: ErrorTranslator,
 *   entityFactory: EntityFactory,
 *   definitionCache: DefinitionCache,
 *   entityLifecycleManager: EntityLifecycleManager,
 *   monitoringCoordinator: MonitoringCoordinator,
 *   spatialIndexManager: SpatialIndexManager,
 *   batchSpatialIndexManager: BatchSpatialIndexManager,
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
  container,
}) {
  // Get configuration settings
  const config = isConfigInitialized() ? getGlobalConfig() : null;
  const limits = config?.getLimits() || {};
  const cacheSettings = config?.getCacheSettings() || {};
  const validationSettings = config?.getValidationSettings() || {};
  const performanceSettings = config?.getPerformanceSettings() || {};

  // Validate configuration if available
  if (config) {
    validateServiceConfiguration(config);
  }

  logger.debug('Creating default services with configuration:', {
    limits,
    cacheSettings,
    validationSettings,
    performanceSettings,
  });

  // Get MonitoringCoordinator from DI container if available, otherwise create it
  let monitoringCoordinator = null;
  if (container) {
    try {
      // Try to resolve IMonitoringCoordinator from the container
      // We have to use a hardcoded string to avoid circular import dependencies
      const monitoringCoordinatorToken = 'IMonitoringCoordinator';
      if (container.has(monitoringCoordinatorToken)) {
        monitoringCoordinator = container.resolve(monitoringCoordinatorToken);
        logger.debug('MonitoringCoordinator resolved from DI container');
      }
    } catch (error) {
      logger.warn(
        'Could not resolve MonitoringCoordinator from DI container:',
        error.message
      );
    }
  }

  // If not available from DI, create it directly (for backward compatibility)
  if (!monitoringCoordinator) {
    monitoringCoordinator = new MonitoringCoordinator({
      logger,
      enabled:
        config?.isFeatureEnabled('performance.ENABLE_MONITORING') ?? true,
      checkInterval:
        config?.getValue('monitoring.HEALTH_CHECK_INTERVAL') ?? 30000,
      circuitBreakerOptions: {
        failureThreshold:
          config?.getValue('errorHandling.CIRCUIT_BREAKER_THRESHOLD') ?? 5,
        timeout:
          config?.getValue('errorHandling.CIRCUIT_BREAKER_TIMEOUT') ?? 60000,
      },
    });
    logger.debug('MonitoringCoordinator created directly (fallback)');
  }

  // Create EntityRepositoryAdapter with configuration
  const entityRepository = new EntityRepositoryAdapter({
    logger,
    maxEntities: limits.MAX_ENTITIES,
    enableValidation: validationSettings.ENABLE_VALIDATION,
    monitoringCoordinator,
  });

  // Create ComponentMutationService with configuration
  const componentMutationService = new ComponentMutationService({
    entityRepository,
    validator,
    logger,
    eventDispatcher,
    cloner,
    maxComponentSize: limits.MAX_COMPONENT_SIZE,
    strictValidation: validationSettings.STRICT_MODE,
    enableCircuitBreaker: config?.isFeatureEnabled(
      'errorHandling.ENABLE_CIRCUIT_BREAKER'
    ),
    monitoringCoordinator,
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
    registry,
    logger,
    enableCache: cacheSettings.ENABLE_DEFINITION_CACHE,
    cacheTtl: cacheSettings.DEFINITION_CACHE_TTL,
    maxCacheSize: cacheSettings.COMPONENT_CACHE_SIZE,
  });

  // BatchOperationManager will be created after EntityLifecycleManager to avoid circular dependency
  let batchOperationManager = null;
  const enableBatchOperations =
    config?.isFeatureEnabled('performance.ENABLE_BATCH_OPERATIONS') ?? true;

  // Create SpatialIndexManager first (without batch manager)
  const spatialIndexManager = new SpatialIndexManager({
    logger,
    batchSpatialIndexManager: null, // Will be set after BatchSpatialIndexManager creation
    enableBatchOperations,
  });

  // Create BatchSpatialIndexManager
  let batchSpatialIndexManager = null;
  if (enableBatchOperations) {
    batchSpatialIndexManager = new BatchSpatialIndexManager({
      spatialIndex: spatialIndexManager,
      logger,
      defaultBatchSize:
        config?.getValue('performance.SPATIAL_INDEX_BATCH_SIZE') ?? 100,
    });

    // Wire the batch manager into the spatial index manager
    spatialIndexManager.setBatchSpatialIndexManager(batchSpatialIndexManager);
  }

  // Create EntityLifecycleManager with configuration
  const entityLifecycleManager = new EntityLifecycleManager({
    registry,
    logger,
    eventDispatcher,
    entityRepository,
    factory: entityFactory,
    errorTranslator,
    definitionCache,
    monitoringCoordinator,
    batchOperationManager: null, // Will be set after BatchOperationManager creation
    enableBatchOperations, // Pass the actual setting
  });

  // Create BatchOperationManager now that EntityLifecycleManager is available
  if (enableBatchOperations) {
    batchOperationManager = new BatchOperationManager({
      lifecycleManager: entityLifecycleManager,
      componentMutationService,
      logger,
      defaultBatchSize:
        config?.getValue('performance.DEFAULT_BATCH_SIZE') ?? 50,
      enableTransactions:
        config?.isFeatureEnabled(
          'batchOperations.ENABLE_TRANSACTION_ROLLBACK'
        ) ?? true,
    });
  }

  logger.info('Default services created with configuration-aware settings', {
    batchOperationsEnabled: enableBatchOperations,
    spatialIndexingEnabled: true,
  });

  return {
    entityRepository,
    componentMutationService,
    errorTranslator,
    entityFactory,
    definitionCache,
    entityLifecycleManager,
    monitoringCoordinator,
    spatialIndexManager,
    batchSpatialIndexManager,
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

  // Validate monitoring configuration if enabled
  if (config.getValue('performance.ENABLE_MONITORING')) {
    validateMonitoringConfiguration(config);
  }

  // Validate batch operation configuration if enabled
  if (config.getValue('performance.ENABLE_BATCH_OPERATIONS')) {
    validateBatchOperationConfiguration(config);
  }
}

/**
 * Validates monitoring-specific configuration.
 *
 * @param {object} config - Configuration to validate
 * @throws {Error} If monitoring configuration is invalid
 */
export function validateMonitoringConfiguration(config) {
  const requiredMonitoringPaths = [
    'performance.SLOW_OPERATION_THRESHOLD',
    'performance.MEMORY_WARNING_THRESHOLD',
    'errorHandling.ENABLE_CIRCUIT_BREAKER',
    'errorHandling.CIRCUIT_BREAKER_THRESHOLD',
    'errorHandling.CIRCUIT_BREAKER_TIMEOUT',
    'monitoring.HEALTH_CHECK_INTERVAL',
  ];

  for (const path of requiredMonitoringPaths) {
    if (config.getValue(path) === undefined) {
      throw new Error(
        `Required monitoring configuration path '${path}' is missing`
      );
    }
  }

  // Validate threshold values
  const slowOperationThreshold = config.getValue(
    'performance.SLOW_OPERATION_THRESHOLD'
  );
  if (
    typeof slowOperationThreshold !== 'number' ||
    slowOperationThreshold <= 0
  ) {
    throw new Error(
      'performance.SLOW_OPERATION_THRESHOLD must be a positive number'
    );
  }

  const memoryWarningThreshold = config.getValue(
    'performance.MEMORY_WARNING_THRESHOLD'
  );
  if (
    typeof memoryWarningThreshold !== 'number' ||
    memoryWarningThreshold <= 0 ||
    memoryWarningThreshold > 1
  ) {
    throw new Error(
      'performance.MEMORY_WARNING_THRESHOLD must be a number between 0 and 1'
    );
  }

  const circuitBreakerThreshold = config.getValue(
    'errorHandling.CIRCUIT_BREAKER_THRESHOLD'
  );
  if (
    typeof circuitBreakerThreshold !== 'number' ||
    circuitBreakerThreshold <= 0
  ) {
    throw new Error(
      'errorHandling.CIRCUIT_BREAKER_THRESHOLD must be a positive number'
    );
  }

  const circuitBreakerTimeout = config.getValue(
    'errorHandling.CIRCUIT_BREAKER_TIMEOUT'
  );
  if (typeof circuitBreakerTimeout !== 'number' || circuitBreakerTimeout <= 0) {
    throw new Error(
      'errorHandling.CIRCUIT_BREAKER_TIMEOUT must be a positive number'
    );
  }

  const healthCheckInterval = config.getValue(
    'monitoring.HEALTH_CHECK_INTERVAL'
  );
  if (typeof healthCheckInterval !== 'number' || healthCheckInterval <= 0) {
    throw new Error(
      'monitoring.HEALTH_CHECK_INTERVAL must be a positive number'
    );
  }
}

/**
 * Validates batch operation-specific configuration.
 *
 * @param {object} config - Configuration to validate
 * @throws {Error} If batch operation configuration is invalid
 */
export function validateBatchOperationConfiguration(config) {
  const requiredBatchPaths = [
    'performance.DEFAULT_BATCH_SIZE',
    'performance.MAX_BATCH_SIZE',
    'performance.SPATIAL_INDEX_BATCH_SIZE',
    'performance.BATCH_OPERATION_THRESHOLD',
    'performance.BATCH_TIMEOUT_MS',
    'batchOperations.ENABLE_TRANSACTION_ROLLBACK',
    'batchOperations.MAX_FAILURES_PER_BATCH',
  ];

  for (const path of requiredBatchPaths) {
    if (config.getValue(path) === undefined) {
      throw new Error(
        `Required batch operation configuration path '${path}' is missing`
      );
    }
  }

  // Validate batch size constraints
  const defaultBatchSize = config.getValue('performance.DEFAULT_BATCH_SIZE');
  const maxBatchSize = config.getValue('performance.MAX_BATCH_SIZE');

  if (defaultBatchSize <= 0 || defaultBatchSize > maxBatchSize) {
    throw new Error(
      `DEFAULT_BATCH_SIZE must be positive and <= MAX_BATCH_SIZE (${maxBatchSize})`
    );
  }

  // Validate spatial index batch size
  const spatialBatchSize = config.getValue(
    'performance.SPATIAL_INDEX_BATCH_SIZE'
  );
  if (spatialBatchSize <= 0) {
    throw new Error('SPATIAL_INDEX_BATCH_SIZE must be positive');
  }

  // Validate timeout
  const batchTimeout = config.getValue('performance.BATCH_TIMEOUT_MS');
  if (batchTimeout <= 0) {
    throw new Error('BATCH_TIMEOUT_MS must be positive');
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
    batchOperationsEnabled: config.getValue(
      'performance.ENABLE_BATCH_OPERATIONS'
    ),
    strictValidation: config.getValue('validation.STRICT_MODE'),
    environment: config.getValue('environment.NODE_ENV'),
  };
}
