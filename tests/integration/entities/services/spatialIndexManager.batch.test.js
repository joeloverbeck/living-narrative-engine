/**
 * @file spatialIndexManager.batch.test.js - Integration tests for SpatialIndexManager batch operations
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

// Mock configUtils at the top level
jest.mock('../../../../src/entities/utils/configUtils.js', () => {
  const mockConfigProvider = {
    getValue: jest.fn(),
    isFeatureEnabled: jest.fn(),
    getLimits: jest.fn(),
    getCacheSettings: jest.fn(),
    getValidationSettings: jest.fn(),
    getPerformanceSettings: jest.fn(),
    isProduction: jest.fn(),
  };

  return {
    getGlobalConfig: jest.fn(() => mockConfigProvider),
    isConfigInitialized: jest.fn(() => true),
    initializeGlobalConfig: jest.fn(() => mockConfigProvider),
    getConfigValue: jest.fn(),
    isFeatureEnabled: jest.fn(),
    getLimits: jest.fn(),
    getCacheSettings: jest.fn(),
    getValidationSettings: jest.fn(),
    getPerformanceSettings: jest.fn(),
    validateBatchSize: jest.fn(),
  };
});

import { createDefaultServicesWithConfig } from '../../../../src/entities/utils/createDefaultServicesWithConfig.js';
import SpatialIndexManager from '../../../../src/entities/spatialIndexManager.js';
import BatchSpatialIndexManager from '../../../../src/entities/operations/BatchSpatialIndexManager.js';

describe('SpatialIndexManager - Batch Operations Integration', () => {
  let services;
  let mockDependencies;
  let mockConfig;

  beforeEach(() => {
    // Create mock dependencies
    mockDependencies = {
      registry: {
        // Original methods
        getDefinition: jest.fn(),
        getAllDefinitions: jest.fn().mockReturnValue([]),

        // Core IDataRegistry methods
        store: jest.fn(),
        get: jest.fn(),
        getAll: jest.fn().mockReturnValue([]),
        getAllSystemRules: jest.fn().mockReturnValue([]),
        clear: jest.fn(),

        // Specific getters required by services
        getEntityDefinition: jest.fn(),
        getActionDefinition: jest.fn(),
        getEventDefinition: jest.fn(),
        getComponentDefinition: jest.fn(),
        getConditionDefinition: jest.fn(),
        getEntityInstanceDefinition: jest.fn(),
        getGoalDefinition: jest.fn(),

        // Specific getAll methods
        getAllEntityDefinitions: jest.fn().mockReturnValue([]),
        getAllActionDefinitions: jest.fn().mockReturnValue([]),
        getAllEventDefinitions: jest.fn().mockReturnValue([]),
        getAllComponentDefinitions: jest.fn().mockReturnValue([]),
        getAllConditionDefinitions: jest.fn().mockReturnValue([]),
        getAllEntityInstanceDefinitions: jest.fn().mockReturnValue([]),
        getAllGoalDefinitions: jest.fn().mockReturnValue([]),

        // Manifest methods
        getStartingPlayerId: jest.fn().mockReturnValue(null),
        getStartingLocationId: jest.fn().mockReturnValue(null),

        // Optional methods
        getContentSource: jest.fn().mockReturnValue(null),
        listContentByMod: jest.fn().mockReturnValue({}),
      },
      validator: {
        validate: jest.fn().mockReturnValue({ valid: true }),
        compile: jest.fn(),
      },
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      },
      eventDispatcher: {
        dispatch: jest.fn(),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
      },
      idGenerator: jest.fn().mockReturnValue('test-id'),
      cloner: jest.fn((obj) => JSON.parse(JSON.stringify(obj))),
      defaultPolicy: {
        apply: jest.fn(),
        getDefaults: jest.fn().mockReturnValue({}),
      },
    };

    // Create mock config
    mockConfig = {
      isFeatureEnabled: jest.fn().mockImplementation((feature) => {
        if (feature === 'performance.ENABLE_BATCH_OPERATIONS') return true;
        if (feature === 'performance.ENABLE_MONITORING') return true;
        return false;
      }),
      getValue: jest.fn().mockImplementation((path) => {
        const values = {
          'limits.MAX_ENTITIES': 1000,
          'limits.MAX_COMPONENT_SIZE': 1024,
          'cache.ENABLE_DEFINITION_CACHE': true,
          'cache.DEFINITION_CACHE_TTL': 300000,
          'cache.COMPONENT_CACHE_SIZE': 100,
          'validation.STRICT_MODE': false,
          'validation.ENABLE_VALIDATION': true,
          'performance.ENABLE_MONITORING': true,
          'performance.SLOW_OPERATION_THRESHOLD': 1000,
          'performance.MEMORY_WARNING_THRESHOLD': 0.8,
          'performance.DEFAULT_BATCH_SIZE': 50,
          'performance.SPATIAL_INDEX_BATCH_SIZE': 100,
          'batchOperations.ENABLE_TRANSACTION_ROLLBACK': true,
          'monitoring.HEALTH_CHECK_INTERVAL': 30000,
          'errorHandling.ENABLE_CIRCUIT_BREAKER': true,
          'errorHandling.CIRCUIT_BREAKER_THRESHOLD': 5,
          'errorHandling.CIRCUIT_BREAKER_TIMEOUT': 60000,
        };
        return values[path];
      }),
      getLimits: jest.fn().mockReturnValue({
        MAX_ENTITIES: 1000,
        MAX_COMPONENT_SIZE: 1024,
      }),
      getCacheSettings: jest.fn().mockReturnValue({
        ENABLE_DEFINITION_CACHE: true,
        DEFINITION_CACHE_TTL: 300000,
        COMPONENT_CACHE_SIZE: 100,
      }),
      getValidationSettings: jest.fn().mockReturnValue({
        STRICT_MODE: false,
        ENABLE_VALIDATION: true,
      }),
      getPerformanceSettings: jest.fn().mockReturnValue({
        ENABLE_MONITORING: true,
        ENABLE_BATCH_OPERATIONS: true,
      }),
      isProduction: jest.fn().mockReturnValue(false),
    };

    // Configure the mocked configUtils to return our mock config values
    const {
      getGlobalConfig,
      getLimits,
      getCacheSettings,
      getValidationSettings,
      getPerformanceSettings,
      isFeatureEnabled,
      getConfigValue,
      validateBatchSize,
    } = require('../../../../src/entities/utils/configUtils.js');

    getGlobalConfig.mockImplementation(() => mockConfig);
    getLimits.mockImplementation(() => mockConfig.getLimits());
    getCacheSettings.mockImplementation(() => mockConfig.getCacheSettings());
    getValidationSettings.mockImplementation(() =>
      mockConfig.getValidationSettings()
    );
    getPerformanceSettings.mockImplementation(() =>
      mockConfig.getPerformanceSettings()
    );
    isFeatureEnabled.mockImplementation((feature) =>
      mockConfig.isFeatureEnabled(feature)
    );
    getConfigValue.mockImplementation((path) => mockConfig.getValue(path));
    validateBatchSize.mockImplementation(() => {}); // Mock validation - just do nothing for tests
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  describe('service factory integration', () => {
    beforeEach(() => {
      services = createDefaultServicesWithConfig(mockDependencies);
    });

    it('should create SpatialIndexManager with batch operations enabled', () => {
      expect(services.spatialIndexManager).toBeInstanceOf(SpatialIndexManager);
      expect(services.batchSpatialIndexManager).toBeInstanceOf(
        BatchSpatialIndexManager
      );
    });

    it('should wire BatchSpatialIndexManager to SpatialIndexManager', () => {
      // Test that batch operations work, indicating proper wiring
      const spatialIndexManager = services.spatialIndexManager;
      const batchSpatialIndexManager = services.batchSpatialIndexManager;

      expect(batchSpatialIndexManager).toBeDefined();
      expect(spatialIndexManager).toBeDefined();

      // Test that the spatial index manager has batch capabilities
      expect(typeof spatialIndexManager.batchAdd).toBe('function');
      expect(typeof spatialIndexManager.batchRemove).toBe('function');
      expect(typeof spatialIndexManager.batchMove).toBe('function');
      expect(typeof spatialIndexManager.rebuild).toBe('function');
    });

    it('should configure BatchSpatialIndexManager with correct settings', () => {
      const stats = services.batchSpatialIndexManager.getStats();

      expect(stats.defaultBatchSize).toBe(100); // SPATIAL_INDEX_BATCH_SIZE
      expect(stats.indexSize).toBe(0); // Empty index initially
    });

    it('should log service creation with batch operations enabled', () => {
      expect(mockDependencies.logger.info).toHaveBeenCalledWith(
        'Default services created with configuration-aware settings',
        expect.objectContaining({
          batchOperationsEnabled: true,
          spatialIndexingEnabled: true,
        })
      );
    });
  });

  describe('batch operations integration', () => {
    beforeEach(() => {
      services = createDefaultServicesWithConfig(mockDependencies);
    });

    it('should perform batch add operations end-to-end', async () => {
      const spatialIndexManager = services.spatialIndexManager;

      const additions = [
        { entityId: 'entity1', locationId: 'locationA' },
        { entityId: 'entity2', locationId: 'locationB' },
        { entityId: 'entity3', locationId: 'locationA' },
      ];

      const result = await spatialIndexManager.batchAdd(additions);

      expect(result.successful).toHaveLength(3);
      expect(result.failed).toHaveLength(0);
      expect(result.totalProcessed).toBe(3);
      expect(result.processingTime).toBeGreaterThan(0);

      // Verify entities were actually added
      expect(spatialIndexManager.getEntitiesInLocation('locationA')).toContain(
        'entity1'
      );
      expect(spatialIndexManager.getEntitiesInLocation('locationA')).toContain(
        'entity3'
      );
      expect(spatialIndexManager.getEntitiesInLocation('locationB')).toContain(
        'entity2'
      );
    });

    it('should perform batch remove operations end-to-end', async () => {
      const spatialIndexManager = services.spatialIndexManager;

      // Setup: Add entities first
      spatialIndexManager.addEntity('entity1', 'locationA');
      spatialIndexManager.addEntity('entity2', 'locationB');
      spatialIndexManager.addEntity('entity3', 'locationA');

      const entityIds = ['entity1', 'entity2'];
      const result = await spatialIndexManager.batchRemove(entityIds);

      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      expect(result.totalProcessed).toBe(2);

      // Verify entities were actually removed
      expect(
        spatialIndexManager.getEntitiesInLocation('locationA')
      ).not.toContain('entity1');
      expect(
        spatialIndexManager.getEntitiesInLocation('locationB')
      ).not.toContain('entity2');
      expect(spatialIndexManager.getEntitiesInLocation('locationA')).toContain(
        'entity3'
      ); // Should remain
    });

    it('should perform batch move operations end-to-end', async () => {
      const spatialIndexManager = services.spatialIndexManager;

      // Setup: Add entities first
      spatialIndexManager.addEntity('entity1', 'locationA');
      spatialIndexManager.addEntity('entity2', 'locationB');

      const updates = [
        {
          entityId: 'entity1',
          oldLocationId: 'locationA',
          newLocationId: 'locationC',
        },
        {
          entityId: 'entity2',
          oldLocationId: 'locationB',
          newLocationId: 'locationC',
        },
      ];

      const result = await spatialIndexManager.batchMove(updates);

      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      expect(result.totalProcessed).toBe(2);

      // Verify entities were actually moved
      expect(
        spatialIndexManager.getEntitiesInLocation('locationA')
      ).not.toContain('entity1');
      expect(
        spatialIndexManager.getEntitiesInLocation('locationB')
      ).not.toContain('entity2');
      expect(spatialIndexManager.getEntitiesInLocation('locationC')).toContain(
        'entity1'
      );
      expect(spatialIndexManager.getEntitiesInLocation('locationC')).toContain(
        'entity2'
      );
    });

    it('should perform rebuild operations end-to-end', async () => {
      const spatialIndexManager = services.spatialIndexManager;

      // Setup: Add some entities first
      spatialIndexManager.addEntity('entity1', 'locationA');
      spatialIndexManager.addEntity('entity2', 'locationB');

      const entityLocations = [
        { entityId: 'entity3', locationId: 'locationC' },
        { entityId: 'entity4', locationId: 'locationD' },
      ];

      const result = await spatialIndexManager.rebuild(entityLocations);

      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      expect(result.totalProcessed).toBe(2);

      // Verify old entities were cleared and new ones added
      expect(
        spatialIndexManager.getEntitiesInLocation('locationA')
      ).not.toContain('entity1');
      expect(
        spatialIndexManager.getEntitiesInLocation('locationB')
      ).not.toContain('entity2');
      expect(spatialIndexManager.getEntitiesInLocation('locationC')).toContain(
        'entity3'
      );
      expect(spatialIndexManager.getEntitiesInLocation('locationD')).toContain(
        'entity4'
      );
    });

    it('should handle batch operations with custom options', async () => {
      const spatialIndexManager = services.spatialIndexManager;

      const additions = [
        { entityId: 'entity1', locationId: 'locationA' },
        { entityId: 'entity2', locationId: 'locationB' },
      ];

      const options = {
        batchSize: 1, // Force smaller batches
        enableParallel: true,
      };

      const result = await spatialIndexManager.batchAdd(additions, options);

      expect(result.successful).toHaveLength(2);
      expect(result.totalProcessed).toBe(2);
    });
  });

  describe('configuration-based behavior', () => {
    it('should disable batch operations when configuration disabled', () => {
      // Mock config to disable batch operations
      mockConfig.isFeatureEnabled.mockImplementation((feature) => {
        if (feature === 'performance.ENABLE_BATCH_OPERATIONS') return false;
        if (feature === 'performance.ENABLE_MONITORING') return true;
        return false;
      });

      const servicesWithDisabledBatch =
        createDefaultServicesWithConfig(mockDependencies);

      expect(servicesWithDisabledBatch.spatialIndexManager).toBeInstanceOf(
        SpatialIndexManager
      );
      expect(servicesWithDisabledBatch.batchSpatialIndexManager).toBeNull();
    });

    it('should use fallback methods when batch operations disabled', async () => {
      // Mock config to disable batch operations
      mockConfig.isFeatureEnabled.mockImplementation((feature) => {
        if (feature === 'performance.ENABLE_BATCH_OPERATIONS') return false;
        if (feature === 'performance.ENABLE_MONITORING') return true;
        return false;
      });

      const servicesWithDisabledBatch =
        createDefaultServicesWithConfig(mockDependencies);
      const spatialIndexManager = servicesWithDisabledBatch.spatialIndexManager;

      const additions = [
        { entityId: 'entity1', locationId: 'locationA' },
        { entityId: 'entity2', locationId: 'locationB' },
      ];

      // Should still work but use fallback sequential processing
      const result = await spatialIndexManager.batchAdd(additions);

      expect(result.successful).toHaveLength(2);
      expect(result.totalProcessed).toBe(2);

      // Verify entities were actually added via fallback method
      expect(spatialIndexManager.getEntitiesInLocation('locationA')).toContain(
        'entity1'
      );
      expect(spatialIndexManager.getEntitiesInLocation('locationB')).toContain(
        'entity2'
      );
    });

    it('should use custom batch sizes from configuration', () => {
      // Mock config with custom batch size
      mockConfig.getValue.mockImplementation((path) => {
        if (path === 'performance.SPATIAL_INDEX_BATCH_SIZE') return 25;

        const values = {
          'limits.MAX_ENTITIES': 1000,
          'limits.MAX_COMPONENT_SIZE': 1024,
          'cache.ENABLE_DEFINITION_CACHE': true,
          'cache.DEFINITION_CACHE_TTL': 300000,
          'cache.COMPONENT_CACHE_SIZE': 100,
          'validation.STRICT_MODE': false,
          'validation.ENABLE_VALIDATION': true,
          'performance.ENABLE_MONITORING': true,
          'performance.SLOW_OPERATION_THRESHOLD': 1000,
          'performance.MEMORY_WARNING_THRESHOLD': 0.8,
          'performance.DEFAULT_BATCH_SIZE': 50,
          'batchOperations.ENABLE_TRANSACTION_ROLLBACK': true,
          'monitoring.HEALTH_CHECK_INTERVAL': 30000,
          'errorHandling.ENABLE_CIRCUIT_BREAKER': true,
          'errorHandling.CIRCUIT_BREAKER_THRESHOLD': 5,
          'errorHandling.CIRCUIT_BREAKER_TIMEOUT': 60000,
        };
        return values[path];
      });

      const servicesWithCustomBatch =
        createDefaultServicesWithConfig(mockDependencies);
      const stats = servicesWithCustomBatch.batchSpatialIndexManager.getStats();

      expect(stats.defaultBatchSize).toBe(25);
    });
  });

  describe('error handling integration', () => {
    beforeEach(() => {
      services = createDefaultServicesWithConfig(mockDependencies);
    });

    it('should handle errors gracefully in batch operations', async () => {
      const spatialIndexManager = services.spatialIndexManager;

      // Mock the underlying spatial index to throw an error for specific entity
      const originalAdd = spatialIndexManager.add.bind(spatialIndexManager);
      jest
        .spyOn(spatialIndexManager, 'add')
        .mockImplementation((entityId, locationId) => {
          if (entityId === 'error-entity') {
            throw new Error('Simulated error');
          }
          return originalAdd(entityId, locationId);
        });

      const additions = [
        { entityId: 'entity1', locationId: 'locationA' },
        { entityId: 'error-entity', locationId: 'locationB' },
        { entityId: 'entity3', locationId: 'locationC' },
      ];

      const result = await spatialIndexManager.batchAdd(additions);

      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(1);
      expect(result.totalProcessed).toBe(3);
      expect(result.failed[0].error.message).toBe('Simulated error');
    });
  });
});
