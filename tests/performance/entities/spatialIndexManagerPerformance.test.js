/**
 * @file Performance benchmarks for SpatialIndexManager batch operations
 * @description Tests focused on measuring and validating spatial index performance
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock configUtils at the top level
jest.mock('../../../src/entities/utils/configUtils.js', () => {
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

import { createDefaultServicesWithConfig } from '../../../src/entities/utils/createDefaultServicesWithConfig.js';

describe('SpatialIndexManager Performance', () => {
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
        SLOW_OPERATION_THRESHOLD: 1000,
        MEMORY_WARNING_THRESHOLD: 0.8,
        DEFAULT_BATCH_SIZE: 50,
        SPATIAL_INDEX_BATCH_SIZE: 100,
      }),
      isProduction: jest.fn().mockReturnValue(false),
    };

    mockDependencies.getPerformanceSettings = jest.fn();

    // Mock the config utils to return our mock config
    const configUtils = require('../../../src/entities/utils/configUtils.js');
    configUtils.getGlobalConfig.mockReturnValue(mockConfig);
    configUtils.getPerformanceSettings.mockReturnValue(
      mockConfig.getPerformanceSettings()
    );

    mockDependencies.getPerformanceSettings.mockImplementation(() =>
      mockConfig.getPerformanceSettings()
    );
  });

  describe('performance integration', () => {
    beforeEach(() => {
      services = createDefaultServicesWithConfig(mockDependencies);
    });

    it('should complete batch operations within reasonable time', async () => {
      const spatialIndexManager = services.spatialIndexManager;

      // Create a larger batch to test performance
      const additions = Array.from({ length: 100 }, (_, i) => ({
        entityId: `entity${i}`,
        locationId: `location${i % 10}`, // Distribute across 10 locations
      }));

      const startTime = performance.now();
      const result = await spatialIndexManager.batchAdd(additions);
      const endTime = performance.now();

      expect(result.successful).toHaveLength(100);
      expect(result.totalProcessed).toBe(100);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second

      // Verify all entities were added correctly
      expect(spatialIndexManager.size).toBe(10); // 10 different locations
      for (let i = 0; i < 10; i++) {
        const entities = spatialIndexManager.getEntitiesInLocation(
          `location${i}`
        );
        expect(entities.size).toBe(10); // 10 entities per location
      }
    });

    it('should handle large-scale batch additions efficiently', async () => {
      const spatialIndexManager = services.spatialIndexManager;

      // Create a very large batch to stress test
      const additions = Array.from({ length: 500 }, (_, i) => ({
        entityId: `entity${i}`,
        locationId: `location${i % 50}`, // Distribute across 50 locations
      }));

      const startTime = performance.now();
      const result = await spatialIndexManager.batchAdd(additions);
      const endTime = performance.now();

      expect(result.successful).toHaveLength(500);
      expect(result.totalProcessed).toBe(500);
      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds

      console.log(
        `Added 500 entities to spatial index in ${endTime - startTime}ms`
      );
      console.log(
        `Average time per entity: ${((endTime - startTime) / 500).toFixed(2)}ms`
      );

      // Verify distribution
      expect(spatialIndexManager.size).toBe(50); // 50 different locations
    });

    it('should demonstrate batch removal performance', async () => {
      const spatialIndexManager = services.spatialIndexManager;

      // First add entities
      const additions = Array.from({ length: 200 }, (_, i) => ({
        entityId: `entity${i}`,
        locationId: `location${i % 20}`, // Distribute across 20 locations
      }));

      await spatialIndexManager.batchAdd(additions);

      // Now test removal performance
      const removals = additions.map((item) => item.entityId);

      const startTime = performance.now();
      const result = await spatialIndexManager.batchRemove(removals);
      const endTime = performance.now();

      expect(result.successful).toHaveLength(200);
      expect(result.totalProcessed).toBe(200);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second

      console.log(
        `Removed 200 entities from spatial index in ${endTime - startTime}ms`
      );

      // Verify all entities were removed
      expect(spatialIndexManager.size).toBe(0);
    });

    it('should handle mixed batch operations efficiently', async () => {
      const spatialIndexManager = services.spatialIndexManager;

      // Add initial entities
      const initialAdditions = Array.from({ length: 100 }, (_, i) => ({
        entityId: `initial${i}`,
        locationId: `location${i % 10}`,
      }));

      await spatialIndexManager.batchAdd(initialAdditions);

      // Prepare mixed operations
      const newAdditions = Array.from({ length: 50 }, (_, i) => ({
        entityId: `new${i}`,
        locationId: `location${i % 10}`,
      }));

      const removals = Array.from({ length: 30 }, (_, i) => `initial${i}`);

      // Test mixed operation performance
      const startTime = performance.now();

      const addResult = await spatialIndexManager.batchAdd(newAdditions);
      const removeResult = await spatialIndexManager.batchRemove(removals);

      const endTime = performance.now();

      expect(addResult.successful).toHaveLength(50);
      expect(removeResult.successful).toHaveLength(30);
      expect(endTime - startTime).toBeLessThan(1500); // Should complete within 1.5 seconds

      console.log(
        `Mixed operations (50 adds, 30 removes) completed in ${endTime - startTime}ms`
      );

      // Verify final state: 100 initial - 30 removed + 50 new = 120 entities
      let totalEntities = 0;
      for (let i = 0; i < 10; i++) {
        const entities = spatialIndexManager.getEntitiesInLocation(
          `location${i}`
        );
        totalEntities += entities.size;
      }
      expect(totalEntities).toBe(120);
    });
  });
});
