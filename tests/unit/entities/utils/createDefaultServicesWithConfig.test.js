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
});
