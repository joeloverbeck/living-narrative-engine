import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import {
  createDefaultServicesWithConfig,
  createConfiguredServices,
  createPerformanceOptimizedServices,
  createStrictValidationServices,
  createTestOptimizedServices,
  validateServiceConfiguration,
  validateMonitoringConfiguration,
  validateBatchOperationConfiguration,
  getServiceConfigurationSummary,
} from '../../../../src/entities/utils/createDefaultServicesWithConfig.js';
import {
  initializeGlobalConfig,
  isConfigInitialized,
} from '../../../../src/entities/utils/configUtils.js';
import EntityRepositoryAdapter from '../../../../src/entities/services/entityRepositoryAdapter.js';
import ComponentMutationService from '../../../../src/entities/services/componentMutationService.js';
import ErrorTranslator from '../../../../src/entities/services/errorTranslator.js';
import EntityFactory from '../../../../src/entities/factories/entityFactory.js';
import DefinitionCache from '../../../../src/entities/services/definitionCache.js';
import EntityLifecycleManager from '../../../../src/entities/services/entityLifecycleManager.js';
import MonitoringCoordinator from '../../../../src/entities/monitoring/MonitoringCoordinator.js';
import {
  createSimpleMockDataRegistry,
  createMockSchemaValidator,
  createMockLogger,
  createMockSafeEventDispatcher,
} from '../../../common/mockFactories/index.js';

describe('createDefaultServicesWithConfig', () => {
  let deps;

  beforeEach(() => {
    // Setup common dependencies
    deps = {
      registry: createSimpleMockDataRegistry(),
      validator: createMockSchemaValidator(),
      logger: createMockLogger(),
      eventDispatcher: createMockSafeEventDispatcher(),
      idGenerator: jest.fn(),
      cloner: jest.fn((v) => v),
      defaultPolicy: { apply: jest.fn() },
    };
  });

  afterEach(() => {
    // Clean up any global config state
    if (isConfigInitialized()) {
      // Note: There's no way to un-initialize the global config in the current implementation
      // This is a limitation of the singleton pattern used
    }
    jest.clearAllMocks();
  });

  describe('createDefaultServicesWithConfig', () => {
    it('returns properly instantiated services including MonitoringCoordinator', () => {
      const services = createDefaultServicesWithConfig(deps);

      // Verify all original services are present
      expect(services.entityRepository).toBeInstanceOf(EntityRepositoryAdapter);
      expect(services.componentMutationService).toBeInstanceOf(
        ComponentMutationService
      );
      expect(services.errorTranslator).toBeInstanceOf(ErrorTranslator);
      expect(services.entityFactory).toBeInstanceOf(EntityFactory);
      expect(services.definitionCache).toBeInstanceOf(DefinitionCache);
      expect(services.entityLifecycleManager).toBeInstanceOf(
        EntityLifecycleManager
      );

      // Verify new monitoring service is present
      expect(services.monitoringCoordinator).toBeInstanceOf(
        MonitoringCoordinator
      );
    });

    it('uses a MonitoringCoordinator resolved from the DI container when available', () => {
      const injectedCoordinator = {
        stop: jest.fn(),
        executeMonitored: jest.fn((operationName, fn) => fn()),
        getCircuitBreaker: jest.fn(() => ({ state: 'CLOSED' })),
        getStats: jest.fn(() => ({ health: 'ok' })),
        getPerformanceMonitor: jest.fn(() => ({
          timeSync: jest.fn((label, fn) => fn()),
        })),
      };
      const container = {
        has: jest.fn(() => true),
        resolve: jest.fn(() => injectedCoordinator),
      };

      const services = createDefaultServicesWithConfig({
        ...deps,
        container,
      });

      expect(container.has).toHaveBeenCalledWith('IMonitoringCoordinator');
      expect(container.resolve).toHaveBeenCalledWith('IMonitoringCoordinator');
      expect(services.monitoringCoordinator).toBe(injectedCoordinator);
      expect(deps.logger.warn).not.toHaveBeenCalled();
    });

    it('logs a warning and falls back to direct instantiation when DI resolution fails', () => {
      const resolutionError = new Error('Missing binding');
      const container = {
        has: jest.fn(() => true),
        resolve: jest.fn(() => {
          throw resolutionError;
        }),
      };

      const services = createDefaultServicesWithConfig({
        ...deps,
        container,
      });

      expect(deps.logger.warn).toHaveBeenCalledWith(
        'Could not resolve MonitoringCoordinator from DI container:',
        resolutionError.message
      );
      expect(services.monitoringCoordinator).toBeInstanceOf(
        MonitoringCoordinator
      );
    });

    it('works without global configuration initialized', () => {
      // Ensure config is not initialized
      expect(isConfigInitialized()).toBe(false);

      const services = createDefaultServicesWithConfig(deps);

      // Should still work with defaults
      expect(services.entityRepository).toBeInstanceOf(EntityRepositoryAdapter);
      expect(services.monitoringCoordinator).toBeInstanceOf(
        MonitoringCoordinator
      );
    });

    it('uses configuration values when global config is initialized', () => {
      // Initialize global config with custom values
      initializeGlobalConfig(deps.logger, {
        limits: {
          MAX_ENTITIES: 5000,
          MAX_COMPONENT_SIZE: 2097152,
        },
        cache: {
          ENABLE_DEFINITION_CACHE: false,
        },
      });

      const services = createDefaultServicesWithConfig(deps);

      // Services should be created with config values
      expect(services.entityRepository).toBeInstanceOf(EntityRepositoryAdapter);
      expect(services.definitionCache).toBeInstanceOf(DefinitionCache);
    });
  });

  describe('Factory Variants', () => {
    beforeEach(() => {
      // Initialize config with default values for factory variant tests
      if (!isConfigInitialized()) {
        initializeGlobalConfig(deps.logger, {
          limits: {
            MAX_ENTITIES: 10000,
            MAX_COMPONENT_SIZE: 1048576,
          },
          cache: {
            ENABLE_DEFINITION_CACHE: true,
          },
          validation: {
            STRICT_MODE: false,
          },
          performance: {
            ENABLE_MONITORING: true,
            SLOW_OPERATION_THRESHOLD: 1000,
            MEMORY_WARNING_THRESHOLD: 0.8,
            DEFAULT_BATCH_SIZE: 50,
            MAX_BATCH_SIZE: 1000,
            SPATIAL_INDEX_BATCH_SIZE: 100,
            BATCH_OPERATION_THRESHOLD: 10,
            BATCH_TIMEOUT_MS: 5000,
            ENABLE_BATCH_OPERATIONS: true,
          },
          errorHandling: {
            ENABLE_CIRCUIT_BREAKER: true,
            CIRCUIT_BREAKER_THRESHOLD: 5,
            CIRCUIT_BREAKER_TIMEOUT: 60000,
          },
          monitoring: {
            HEALTH_CHECK_INTERVAL: 30000,
          },
          batchOperations: {
            ENABLE_TRANSACTION_ROLLBACK: true,
            MAX_FAILURES_PER_BATCH: 10,
          },
        });
      }
    });

    describe('createConfiguredServices', () => {
      it('creates services with custom configuration', () => {
        const customConfig = {
          'limits.MAX_ENTITIES': 100,
          'performance.ENABLE_MONITORING': false,
        };

        const services = createConfiguredServices(deps, customConfig);

        expect(services.entityRepository).toBeInstanceOf(
          EntityRepositoryAdapter
        );
        expect(services.monitoringCoordinator).toBeInstanceOf(
          MonitoringCoordinator
        );
      });
    });

    describe('createPerformanceOptimizedServices', () => {
      it('creates services optimized for performance', () => {
        const services = createPerformanceOptimizedServices(deps);

        expect(services.entityRepository).toBeInstanceOf(
          EntityRepositoryAdapter
        );
        expect(services.monitoringCoordinator).toBeInstanceOf(
          MonitoringCoordinator
        );
        // Performance optimized should have specific settings
        expect(services.definitionCache).toBeInstanceOf(DefinitionCache);
      });
    });

    describe('createStrictValidationServices', () => {
      it('creates services with strict validation enabled', () => {
        const services = createStrictValidationServices(deps);

        expect(services.entityRepository).toBeInstanceOf(
          EntityRepositoryAdapter
        );
        expect(services.componentMutationService).toBeInstanceOf(
          ComponentMutationService
        );
        expect(services.monitoringCoordinator).toBeInstanceOf(
          MonitoringCoordinator
        );
      });
    });

    describe('createTestOptimizedServices', () => {
      it('creates services optimized for testing', () => {
        const services = createTestOptimizedServices(deps);

        expect(services.entityRepository).toBeInstanceOf(
          EntityRepositoryAdapter
        );
        expect(services.monitoringCoordinator).toBeInstanceOf(
          MonitoringCoordinator
        );
        // Test optimized should disable certain features
        expect(services.definitionCache).toBeInstanceOf(DefinitionCache);
      });
    });
  });

  describe('Error Handling', () => {
    it('handles missing dependencies gracefully', () => {
      const incompleteDeps = {
        registry: deps.registry,
        validator: deps.validator,
        logger: deps.logger,
        // Missing other required deps
      };

      expect(() => {
        createDefaultServicesWithConfig(incompleteDeps);
      }).toThrow();
    });
  });

  describe('Backward Compatibility', () => {
    it('maintains compatibility with original service factory interface', () => {
      // No config needed for backward compatibility test - should work without config
      const services = createDefaultServicesWithConfig(deps);

      // Should have all the same services as the original factory
      expect(Object.keys(services)).toContain('entityRepository');
      expect(Object.keys(services)).toContain('componentMutationService');
      expect(Object.keys(services)).toContain('errorTranslator');
      expect(Object.keys(services)).toContain('entityFactory');
      expect(Object.keys(services)).toContain('definitionCache');
      expect(Object.keys(services)).toContain('entityLifecycleManager');

      // Plus the new service
      expect(Object.keys(services)).toContain('monitoringCoordinator');
    });
  });

  describe('validateServiceConfiguration', () => {
    let mockConfig;

    beforeEach(() => {
      mockConfig = {
        getValue: jest.fn(),
      };
    });

    it('validates required configuration paths', () => {
      // Mock all required paths as present with valid values
      mockConfig.getValue.mockImplementation((path) => {
        if (path === 'performance.SLOW_OPERATION_THRESHOLD') return 1000;
        if (path === 'performance.MEMORY_WARNING_THRESHOLD') return 0.8;
        if (path === 'errorHandling.CIRCUIT_BREAKER_THRESHOLD') return 5;
        if (path === 'errorHandling.CIRCUIT_BREAKER_TIMEOUT') return 60000;
        if (path === 'monitoring.HEALTH_CHECK_INTERVAL') return 30000;
        if (path === 'performance.DEFAULT_BATCH_SIZE') return 50;
        if (path === 'performance.MAX_BATCH_SIZE') return 1000;
        if (path === 'performance.SPATIAL_INDEX_BATCH_SIZE') return 100;
        if (path === 'performance.BATCH_OPERATION_THRESHOLD') return 10;
        if (path === 'performance.BATCH_TIMEOUT_MS') return 5000;
        return 100;
      });

      // Should not throw when all required paths are present
      expect(() => validateServiceConfiguration(mockConfig)).not.toThrow();
    });

    it('throws error when required configuration path is missing', () => {
      // Mock getValue to return undefined for specific path
      mockConfig.getValue.mockImplementation((path) => {
        if (path === 'limits.MAX_ENTITIES') {
          return undefined;
        }
        return 100;
      });

      expect(() => validateServiceConfiguration(mockConfig)).toThrow(
        "Required configuration path 'limits.MAX_ENTITIES' is missing"
      );
    });

    it('validates monitoring configuration when monitoring is enabled', () => {
      mockConfig.getValue.mockImplementation((path) => {
        if (path === 'performance.ENABLE_MONITORING') return true;
        if (path === 'performance.SLOW_OPERATION_THRESHOLD') return 1000;
        if (path === 'performance.MEMORY_WARNING_THRESHOLD') return 0.8;
        if (path === 'errorHandling.CIRCUIT_BREAKER_THRESHOLD') return 5;
        if (path === 'errorHandling.CIRCUIT_BREAKER_TIMEOUT') return 60000;
        if (path === 'monitoring.HEALTH_CHECK_INTERVAL') return 30000;
        return 100;
      });

      // Should call validateMonitoringConfiguration
      expect(() => validateServiceConfiguration(mockConfig)).not.toThrow();
    });

    it('validates batch operation configuration when batch operations are enabled', () => {
      mockConfig.getValue.mockImplementation((path) => {
        if (path === 'performance.ENABLE_BATCH_OPERATIONS') return true;
        if (path === 'performance.ENABLE_MONITORING') return true;
        if (path === 'performance.DEFAULT_BATCH_SIZE') return 50;
        if (path === 'performance.MAX_BATCH_SIZE') return 1000;
        if (path === 'performance.SPATIAL_INDEX_BATCH_SIZE') return 100;
        if (path === 'performance.BATCH_OPERATION_THRESHOLD') return 10;
        if (path === 'performance.BATCH_TIMEOUT_MS') return 5000;
        if (path === 'batchOperations.ENABLE_TRANSACTION_ROLLBACK') return true;
        if (path === 'batchOperations.MAX_FAILURES_PER_BATCH') return 10;
        // Monitoring values
        if (path === 'performance.SLOW_OPERATION_THRESHOLD') return 1000;
        if (path === 'performance.MEMORY_WARNING_THRESHOLD') return 0.8;
        if (path === 'errorHandling.CIRCUIT_BREAKER_THRESHOLD') return 5;
        if (path === 'errorHandling.CIRCUIT_BREAKER_TIMEOUT') return 60000;
        if (path === 'monitoring.HEALTH_CHECK_INTERVAL') return 30000;
        return 100;
      });

      // Should call validateBatchOperationConfiguration
      expect(() => validateServiceConfiguration(mockConfig)).not.toThrow();
    });
  });

  describe('validateMonitoringConfiguration', () => {
    let mockConfig;

    beforeEach(() => {
      mockConfig = {
        getValue: jest.fn(),
      };
    });

    it('validates all monitoring configuration paths', () => {
      mockConfig.getValue.mockImplementation((path) => {
        // Return valid values for all monitoring paths
        if (path === 'performance.SLOW_OPERATION_THRESHOLD') return 1000;
        if (path === 'performance.MEMORY_WARNING_THRESHOLD') return 0.8;
        if (path === 'errorHandling.CIRCUIT_BREAKER_THRESHOLD') return 5;
        if (path === 'errorHandling.CIRCUIT_BREAKER_TIMEOUT') return 60000;
        if (path === 'monitoring.HEALTH_CHECK_INTERVAL') return 30000;
        return true;
      });

      expect(() => validateMonitoringConfiguration(mockConfig)).not.toThrow();
    });

    it('throws error when monitoring configuration path is missing', () => {
      mockConfig.getValue.mockImplementation((path) => {
        if (path === 'performance.SLOW_OPERATION_THRESHOLD') {
          return undefined;
        }
        return 100;
      });

      expect(() => validateMonitoringConfiguration(mockConfig)).toThrow(
        "Required monitoring configuration path 'performance.SLOW_OPERATION_THRESHOLD' is missing"
      );
    });

    it('throws error when slow operation threshold is invalid', () => {
      mockConfig.getValue.mockImplementation((path) => {
        if (path === 'performance.SLOW_OPERATION_THRESHOLD') return -100;
        if (path === 'performance.MEMORY_WARNING_THRESHOLD') return 0.8;
        return 100;
      });

      expect(() => validateMonitoringConfiguration(mockConfig)).toThrow(
        'performance.SLOW_OPERATION_THRESHOLD must be a positive number'
      );
    });

    it('throws error when memory warning threshold is out of range', () => {
      mockConfig.getValue.mockImplementation((path) => {
        if (path === 'performance.SLOW_OPERATION_THRESHOLD') return 1000;
        if (path === 'performance.MEMORY_WARNING_THRESHOLD') return 1.5;
        return 100;
      });

      expect(() => validateMonitoringConfiguration(mockConfig)).toThrow(
        'performance.MEMORY_WARNING_THRESHOLD must be a number between 0 and 1'
      );
    });

    it('throws error when circuit breaker threshold is invalid', () => {
      mockConfig.getValue.mockImplementation((path) => {
        if (path === 'performance.SLOW_OPERATION_THRESHOLD') return 1000;
        if (path === 'performance.MEMORY_WARNING_THRESHOLD') return 0.8;
        if (path === 'errorHandling.CIRCUIT_BREAKER_THRESHOLD') return 0;
        return 100;
      });

      expect(() => validateMonitoringConfiguration(mockConfig)).toThrow(
        'errorHandling.CIRCUIT_BREAKER_THRESHOLD must be a positive number'
      );
    });

    it('throws error when circuit breaker timeout is invalid', () => {
      mockConfig.getValue.mockImplementation((path) => {
        if (path === 'performance.SLOW_OPERATION_THRESHOLD') return 1000;
        if (path === 'performance.MEMORY_WARNING_THRESHOLD') return 0.8;
        if (path === 'errorHandling.CIRCUIT_BREAKER_THRESHOLD') return 5;
        if (path === 'errorHandling.CIRCUIT_BREAKER_TIMEOUT') return -1000;
        return 100;
      });

      expect(() => validateMonitoringConfiguration(mockConfig)).toThrow(
        'errorHandling.CIRCUIT_BREAKER_TIMEOUT must be a positive number'
      );
    });

    it('throws error when health check interval is invalid', () => {
      mockConfig.getValue.mockImplementation((path) => {
        if (path === 'performance.SLOW_OPERATION_THRESHOLD') return 1000;
        if (path === 'performance.MEMORY_WARNING_THRESHOLD') return 0.8;
        if (path === 'errorHandling.CIRCUIT_BREAKER_THRESHOLD') return 5;
        if (path === 'errorHandling.CIRCUIT_BREAKER_TIMEOUT') return 60000;
        if (path === 'monitoring.HEALTH_CHECK_INTERVAL') return 0;
        return 100;
      });

      expect(() => validateMonitoringConfiguration(mockConfig)).toThrow(
        'monitoring.HEALTH_CHECK_INTERVAL must be a positive number'
      );
    });
  });

  describe('validateBatchOperationConfiguration', () => {
    let mockConfig;

    beforeEach(() => {
      mockConfig = {
        getValue: jest.fn(),
      };
    });

    it('validates all batch operation configuration paths', () => {
      mockConfig.getValue.mockImplementation((path) => {
        if (path === 'performance.DEFAULT_BATCH_SIZE') return 50;
        if (path === 'performance.MAX_BATCH_SIZE') return 1000;
        if (path === 'performance.SPATIAL_INDEX_BATCH_SIZE') return 100;
        if (path === 'performance.BATCH_OPERATION_THRESHOLD') return 10;
        if (path === 'performance.BATCH_TIMEOUT_MS') return 5000;
        return true;
      });

      expect(() =>
        validateBatchOperationConfiguration(mockConfig)
      ).not.toThrow();
    });

    it('throws error when batch operation configuration path is missing', () => {
      mockConfig.getValue.mockImplementation((path) => {
        if (path === 'performance.DEFAULT_BATCH_SIZE') {
          return undefined;
        }
        return 100;
      });

      expect(() => validateBatchOperationConfiguration(mockConfig)).toThrow(
        "Required batch operation configuration path 'performance.DEFAULT_BATCH_SIZE' is missing"
      );
    });

    it('throws error when default batch size exceeds max batch size', () => {
      mockConfig.getValue.mockImplementation((path) => {
        if (path === 'performance.DEFAULT_BATCH_SIZE') return 2000;
        if (path === 'performance.MAX_BATCH_SIZE') return 1000;
        return 100;
      });

      expect(() => validateBatchOperationConfiguration(mockConfig)).toThrow(
        'DEFAULT_BATCH_SIZE must be positive and <= MAX_BATCH_SIZE (1000)'
      );
    });

    it('throws error when spatial batch size is invalid', () => {
      mockConfig.getValue.mockImplementation((path) => {
        if (path === 'performance.DEFAULT_BATCH_SIZE') return 50;
        if (path === 'performance.MAX_BATCH_SIZE') return 1000;
        if (path === 'performance.SPATIAL_INDEX_BATCH_SIZE') return -10;
        return 100;
      });

      expect(() => validateBatchOperationConfiguration(mockConfig)).toThrow(
        'SPATIAL_INDEX_BATCH_SIZE must be positive'
      );
    });

    it('throws error when batch timeout is invalid', () => {
      mockConfig.getValue.mockImplementation((path) => {
        if (path === 'performance.DEFAULT_BATCH_SIZE') return 50;
        if (path === 'performance.MAX_BATCH_SIZE') return 1000;
        if (path === 'performance.SPATIAL_INDEX_BATCH_SIZE') return 100;
        if (path === 'performance.BATCH_OPERATION_THRESHOLD') return 10;
        if (path === 'performance.BATCH_TIMEOUT_MS') return 0;
        return 100;
      });

      expect(() => validateBatchOperationConfiguration(mockConfig)).toThrow(
        'BATCH_TIMEOUT_MS must be positive'
      );
    });
  });

  describe('getServiceConfigurationSummary', () => {
    it('returns configuration summary with all expected fields', () => {
      const mockConfig = {
        getValue: jest.fn((path) => {
          const values = {
            'limits.MAX_ENTITIES': 10000,
            'limits.MAX_COMPONENT_SIZE': 1048576,
            'cache.ENABLE_DEFINITION_CACHE': true,
            'performance.ENABLE_MONITORING': true,
            'performance.ENABLE_BATCH_OPERATIONS': true,
            'validation.STRICT_MODE': false,
            'environment.NODE_ENV': 'production',
          };
          return values[path];
        }),
      };

      const summary = getServiceConfigurationSummary(mockConfig);

      expect(summary).toEqual({
        maxEntities: 10000,
        maxComponentSize: 1048576,
        cachingEnabled: true,
        monitoringEnabled: true,
        batchOperationsEnabled: true,
        strictValidation: false,
        environment: 'production',
      });
    });
  });
});
