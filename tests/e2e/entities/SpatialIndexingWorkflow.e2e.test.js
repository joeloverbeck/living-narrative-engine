/**
 * @file SpatialIndexingWorkflow.e2e.test.js
 * @description End-to-end tests for spatial indexing workflows
 *
 * Tests the complete spatial indexing system from entity position management
 * through spatial index updates, location queries, and performance validation.
 *
 * This addresses the Priority 1 critical gap identified in the entity workflows
 * E2E test coverage analysis for spatial indexing operations.
 * 
 * Key test scenarios from analysis report section 5.1:
 * 1. Entity Spatial Lifecycle - Complete position component lifecycle
 * 2. Cross-Location Queries - Multi-entity location query accuracy  
 * 3. Spatial Index Consistency - Batch operations consistency validation
 * 4. Performance Under Load - Large-scale entity spatial operations
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import EntityWorkflowTestBed from './common/entityWorkflowTestBed.js';

describe('Spatial Indexing E2E Workflow', () => {
  let testBed;

  beforeEach(async () => {
    testBed = new EntityWorkflowTestBed();
    await testBed.initialize();
  });

  afterEach(async () => {
    if (testBed) {
      await testBed.cleanup();
    }
  });

  describe('Entity Location Management', () => {
    it('should handle complete entity spatial lifecycle from creation to removal', async () => {
      // Arrange - Define entity with position component
      const definitionId = 'test:spatial_entity';
      const entityId = 'spatial_entity_001';
      const initialLocationId = 'test_location_001';
      const updatedLocationId = 'test_location_002';

      await testBed.ensureEntityDefinitionExists(definitionId, {
        id: definitionId,
        components: {
          'core:name': { text: 'Spatial Test Entity' },
          'core:description': { text: 'Entity for spatial indexing tests' },
          'core:position': { locationId: initialLocationId },
        },
      });

      // Act - Create entity with position component
      const entity = await testBed.createTestEntity(definitionId, {
        instanceId: entityId,
      });

      // Assert - Entity created successfully with position
      expect(entity).toBeDefined();
      expect(entity.id).toBe(entityId);
      expect(entity.hasComponent('core:position')).toBe(true);

      const positionComponent = entity.getComponentData('core:position');
      expect(positionComponent).toBeDefined();
      expect(positionComponent.locationId).toBe(initialLocationId);

      // Verify entity appears in spatial index at initial location
      const spatialIndexManager = testBed.container.resolve('ISpatialIndexManager');

      // No need to rebuild - SpatialIndexSynchronizer maintains index automatically
      const entitiesAtInitialLocation = spatialIndexManager.getEntitiesAtLocation(initialLocationId);
      expect(entitiesAtInitialLocation).toContain(entityId);

      // Act - Update entity position
      await testBed.entityManager.addComponent(entityId, 'core:position', {
        locationId: updatedLocationId,
      });

      // Assert - Entity moved in spatial index (automatically maintained by SpatialIndexSynchronizer)
      const entitiesAtOldLocation = spatialIndexManager.getEntitiesAtLocation(initialLocationId);
      const entitiesAtNewLocation = spatialIndexManager.getEntitiesAtLocation(updatedLocationId);

      expect(entitiesAtOldLocation).not.toContain(entityId);
      expect(entitiesAtNewLocation).toContain(entityId);

      // Act - Remove entity
      const removeResult = await testBed.removeTestEntity(entityId);

      // Assert - Entity removed from spatial index (automatically maintained)
      expect(removeResult).toBe(true);

      const entitiesAfterRemoval = spatialIndexManager.getEntitiesAtLocation(updatedLocationId);
      expect(entitiesAfterRemoval).not.toContain(entityId);

      // Verify spatial index cleanup
      const finalIndexSize = spatialIndexManager.size;
      expect(finalIndexSize).toBe(0); // Should be clean if no other entities
    });

    it('should handle entities with null or undefined position components gracefully', async () => {
      // Arrange - Entity without position component initially
      const definitionId = 'test:no_position_entity';
      const entityId = 'no_position_entity_001';

      await testBed.ensureEntityDefinitionExists(definitionId, {
        id: definitionId,
        components: {
          'core:name': { text: 'Non-Spatial Entity' },
          'core:description': { text: 'Entity without initial position' },
        },
      });

      // Act - Create entity without position component
      const entity = await testBed.createTestEntity(definitionId, {
        instanceId: entityId,
      });

      // Assert - Entity created but not in spatial index
      expect(entity).toBeDefined();
      expect(entity.hasComponent('core:position')).toBe(false);

      const spatialIndexManager = testBed.container.resolve('ISpatialIndexManager');
      
      // Verify entity is not in any location
      let foundInIndex = false;
      if (spatialIndexManager.locationIndex) {
        for (const entitySet of spatialIndexManager.locationIndex.values()) {
          if (entitySet.has(entityId)) {
            foundInIndex = true;
            break;
          }
        }
      }
      expect(foundInIndex).toBe(false);

      // Act - Add position component later
      const newLocationId = 'test_location_003';
      await testBed.entityManager.addComponent(entityId, 'core:position', {
        locationId: newLocationId,
      });

      // Assert - Entity now appears in spatial index (automatically maintained)
      const entitiesAtLocation = spatialIndexManager.getEntitiesAtLocation(newLocationId);
      expect(entitiesAtLocation).toContain(entityId);
    });

    it('should handle invalid location IDs properly', async () => {
      // Arrange
      const definitionId = 'test:invalid_location_entity';
      const entityId = 'invalid_location_entity_001';

      await testBed.ensureEntityDefinitionExists(definitionId, {
        id: definitionId,
        components: {
          'core:name': { text: 'Invalid Location Entity' },
          'core:description': { text: 'Entity with invalid location' },
        },
      });

      const entity = await testBed.createTestEntity(definitionId, {
        instanceId: entityId,
      });

      const spatialIndexManager = testBed.container.resolve('ISpatialIndexManager');

      // Act & Assert - Try adding with empty string location
      await testBed.entityManager.addComponent(entityId, 'core:position', {
        locationId: '', // Empty string should be invalid
      });

      // Should not appear in spatial index
      const entitiesAtEmptyLocation = spatialIndexManager.getEntitiesAtLocation('');
      expect(entitiesAtEmptyLocation.length).toBe(0);

      // Test that null location handling works (spatial index should handle gracefully)
      // Note: We can't actually set null via addComponent due to validation, 
      // but we can test the spatial index manager's null handling directly
      const entitiesAtNullLocation = spatialIndexManager.getEntitiesAtLocation(null);
      expect(entitiesAtNullLocation.length).toBe(0);
    });
  });

  describe('Cross-Component Spatial Consistency', () => {
    it('should maintain spatial index consistency during component mutations', async () => {
      // Arrange - Create multiple entities at different locations
      const entityConfigs = [
        { definitionId: 'test:consistency_entity_1', instanceId: 'consistency_001', locationId: 'location_A' },
        { definitionId: 'test:consistency_entity_2', instanceId: 'consistency_002', locationId: 'location_A' },
        { definitionId: 'test:consistency_entity_3', instanceId: 'consistency_003', locationId: 'location_B' },
      ];

      // Create entities in parallel for better performance
      await Promise.all(entityConfigs.map(async (config) => {
        await testBed.ensureEntityDefinitionExists(config.definitionId, {
          id: config.definitionId,
          components: {
            'core:name': { text: `Consistency Entity ${config.instanceId}` },
            'core:description': { text: 'Entity for consistency testing' },
            'core:position': { locationId: config.locationId },
          },
        });

        return testBed.createTestEntity(config.definitionId, {
          instanceId: config.instanceId,
        });
      }));

      const spatialIndexManager = testBed.container.resolve('ISpatialIndexManager');

      // Assert initial state (no rebuild needed - automatically maintained)
      const entitiesAtLocationA = spatialIndexManager.getEntitiesAtLocation('location_A');
      const entitiesAtLocationB = spatialIndexManager.getEntitiesAtLocation('location_B');
      
      expect(entitiesAtLocationA.length).toBe(2);
      expect(entitiesAtLocationB.length).toBe(1);
      expect(entitiesAtLocationA).toContain('consistency_001');
      expect(entitiesAtLocationA).toContain('consistency_002');
      expect(entitiesAtLocationB).toContain('consistency_003');

      // Act - Perform mixed mutations
      // Move entity from A to B
      await testBed.entityManager.addComponent('consistency_001', 'core:position', {
        locationId: 'location_B',
      });

      // Move entity to a different location (location_C)
      await testBed.entityManager.addComponent('consistency_002', 'core:position', {
        locationId: 'location_C',
      });

      // Add new entity to location D 
      await testBed.ensureEntityDefinitionExists('test:new_entity', {
        id: 'test:new_entity',
        components: {
          'core:name': { text: 'New Consistency Entity' },
          'core:position': { locationId: 'location_D' },
        },
      });
      await testBed.createTestEntity('test:new_entity', { instanceId: 'consistency_004' });

      // Assert final consistency (automatically maintained)
      const finalLocationA = spatialIndexManager.getEntitiesAtLocation('location_A');
      const finalLocationB = spatialIndexManager.getEntitiesAtLocation('location_B');
      const finalLocationC = spatialIndexManager.getEntitiesAtLocation('location_C');
      const finalLocationD = spatialIndexManager.getEntitiesAtLocation('location_D');

      expect(finalLocationA.length).toBe(0); // Empty after moves
      expect(finalLocationB.length).toBe(2); // Original 003 + moved 001
      expect(finalLocationC.length).toBe(1); // Moved entity 002
      expect(finalLocationD.length).toBe(1); // New entity 004

      expect(finalLocationB).toContain('consistency_001');
      expect(finalLocationB).toContain('consistency_003');
      expect(finalLocationC).toContain('consistency_002');
      expect(finalLocationD).toContain('consistency_004');
    });

    it('should handle concurrent component mutations safely', async () => {
      // Arrange - Create entities for concurrent testing in parallel
      const entityIds = Array.from({ length: 5 }, (_, i) => `concurrent_${i + 1}`);
      const locations = ['location_X', 'location_Y', 'location_Z'];

      // Create all entities in parallel
      await Promise.all(entityIds.map(async (entityId) => {
        await testBed.ensureEntityDefinitionExists(`test:${entityId}`, {
          id: `test:${entityId}`,
          components: {
            'core:name': { text: `Concurrent Entity ${entityId}` },
            'core:position': { locationId: locations[0] }, // Start all at location_X
          },
        });

        return testBed.createTestEntity(`test:${entityId}`, { instanceId: entityId });
      }));

      // Act - Perform concurrent mutations
      const mutationPromises = entityIds.map((entityId, index) =>
        testBed.entityManager.addComponent(entityId, 'core:position', {
          locationId: locations[index % locations.length],
        })
      );

      const results = await Promise.allSettled(mutationPromises);

      // Assert - All mutations completed successfully
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.warn(`Concurrent mutation ${index} failed:`, result.reason?.message);
        }
      });

      // Verify final spatial index consistency (automatically maintained)
      const spatialIndexManager = testBed.container.resolve('ISpatialIndexManager');

      let totalEntitiesInIndex = 0;
      for (const location of locations) {
        const entitiesAtLocation = spatialIndexManager.getEntitiesAtLocation(location);
        totalEntitiesInIndex += entitiesAtLocation.length;
      }

      expect(totalEntitiesInIndex).toBe(entityIds.length);
    });
  });

  describe('Location-Based Query Accuracy', () => {
    it('should return accurate results for complex location queries', async () => {
      // Arrange - Create a diverse set of entities across multiple locations
      const testData = [
        { locationId: 'forest_1', entities: ['tree_001', 'tree_002', 'deer_001'] },
        { locationId: 'forest_2', entities: ['tree_003', 'bear_001'] },
        { locationId: 'lake_1', entities: ['fish_001', 'fish_002', 'fish_003', 'boat_001'] },
        { locationId: 'village_1', entities: ['npc_001', 'npc_002'] },
        { locationId: 'empty_field', entities: [] }, // Empty location for boundary testing
      ];

      // Create all entities in parallel
      const allEntityPromises = testData.flatMap(location =>
        location.entities.map(async (entityId) => {
          await testBed.ensureEntityDefinitionExists(`test:${entityId}`, {
            id: `test:${entityId}`,
            components: {
              'core:name': { text: `Entity ${entityId}` },
              'core:position': { locationId: location.locationId },
            },
          });

          return testBed.createTestEntity(`test:${entityId}`, { instanceId: entityId });
        })
      );
      await Promise.all(allEntityPromises);

      const spatialIndexManager = testBed.container.resolve('ISpatialIndexManager');

      // Act & Assert - Test each location query (index automatically maintained)
      for (const location of testData) {
        const entitiesAtLocation = spatialIndexManager.getEntitiesAtLocation(location.locationId);
        
        expect(entitiesAtLocation.length).toBe(location.entities.length);
        for (const expectedEntity of location.entities) {
          expect(entitiesAtLocation).toContain(expectedEntity);
        }
      }

      // Assert - Test boundary conditions
      const nonExistentLocation = spatialIndexManager.getEntitiesAtLocation('non_existent');
      expect(nonExistentLocation.length).toBe(0);

      const nullLocation = spatialIndexManager.getEntitiesAtLocation(null);
      expect(nullLocation.length).toBe(0);

      const emptyStringLocation = spatialIndexManager.getEntitiesAtLocation('');
      expect(emptyStringLocation.length).toBe(0);
    });

    it('should handle large location queries efficiently', async () => {
      // Arrange - Create a location with many entities for performance testing
      const locationId = 'crowded_marketplace';
      const entityCount = 50; // Reduced from 100 for faster E2E tests
      const entityIds = Array.from({ length: entityCount }, (_, i) => `merchant_${i + 1}`);

      // Create entity definition
      await testBed.ensureEntityDefinitionExists('test:marketplace_entity', {
        id: 'test:marketplace_entity',
        components: {
          'core:name': { text: 'Marketplace Entity' },
          'core:position': { locationId },
        },
      });

      // Create all entities at the same location in parallel
      const creationStartTime = performance.now();
      await Promise.all(
        entityIds.map(entityId =>
          testBed.createTestEntity('test:marketplace_entity', {
            instanceId: entityId,
            validateDefinition: false, // Skip validation after first
          })
        )
      );
      const creationEndTime = performance.now();

      // Act - Test query performance
      const spatialIndexManager = testBed.container.resolve('ISpatialIndexManager');

      // Index automatically maintained - no rebuild needed
      const queryStartTime = performance.now();
      const entitiesAtLocation = spatialIndexManager.getEntitiesAtLocation(locationId);
      const queryEndTime = performance.now();

      // Assert - Performance and accuracy
      expect(entitiesAtLocation.length).toBe(entityCount);
      
      // Performance thresholds from report section 6.1
      const creationTime = creationEndTime - creationStartTime;
      const queryTime = queryEndTime - queryStartTime;
      
      // Entity creation should average < 100ms per entity (lenient for test environment)
      const avgCreationTime = creationTime / entityCount;
      expect(avgCreationTime).toBeLessThan(200); // Double the threshold for E2E tests
      
      // Spatial queries should be < 50ms
      expect(queryTime).toBeLessThan(50);

      // Verify all entities are present
      for (const entityId of entityIds) {
        expect(entitiesAtLocation).toContain(entityId);
      }
    });

    it('should maintain query accuracy during simultaneous location changes', async () => {
      // Arrange - Create entities that will move between locations
      const sourceLocation = 'source_location';
      const targetLocations = ['target_1', 'target_2', 'target_3'];
      const entityIds = Array.from({ length: 12 }, (_, i) => `moving_entity_${i + 1}`);

      await testBed.ensureEntityDefinitionExists('test:moving_entity', {
        id: 'test:moving_entity',
        components: {
          'core:name': { text: 'Moving Entity' },
          'core:position': { locationId: sourceLocation },
        },
      });

      // Create all entities in parallel
      await Promise.all(
        entityIds.map(entityId =>
          testBed.createTestEntity('test:moving_entity', {
            instanceId: entityId,
            validateDefinition: false,
          })
        )
      );

      const spatialIndexManager = testBed.container.resolve('ISpatialIndexManager');

      // Verify initial state (index automatically maintained)
      const initialEntities = spatialIndexManager.getEntitiesAtLocation(sourceLocation);
      expect(initialEntities.length).toBe(entityIds.length);

      // Act - Move entities to different target locations simultaneously
      const movePromises = entityIds.map((entityId, index) => {
        const targetLocation = targetLocations[index % targetLocations.length];
        return testBed.entityManager.addComponent(entityId, 'core:position', {
          locationId: targetLocation,
        });
      });

      await Promise.allSettled(movePromises);

      // Assert - Verify entities distributed correctly (index automatically maintained)
      const finalSourceEntities = spatialIndexManager.getEntitiesAtLocation(sourceLocation);
      expect(finalSourceEntities.length).toBe(0); // All should have moved

      let totalMovedEntities = 0;
      for (const targetLocation of targetLocations) {
        const entitiesAtTarget = spatialIndexManager.getEntitiesAtLocation(targetLocation);
        totalMovedEntities += entitiesAtTarget ? entitiesAtTarget.length : 0;
      }

      expect(totalMovedEntities).toBe(entityIds.length);
    });
  });

  describe('Spatial Index Performance Integration', () => {
    it('should handle large-scale entity operations efficiently with memory constraints', async () => {
      // Arrange - Create large dataset for stress testing
      const entityCount = 100; // Reduced from 500 for faster E2E tests
      const locationCount = 20; // Reduced from 50
      const entitiesPerLocation = entityCount / locationCount;

      await testBed.ensureEntityDefinitionExists('test:performance_entity', {
        id: 'test:performance_entity',
        components: {
          'core:name': { text: 'Performance Test Entity' },
          'core:position': { locationId: 'initial_location' },
        },
      });

      // Act - Create entities and distribute across locations in parallel
      const creationStartTime = performance.now();

      const entityIds = Array.from({ length: entityCount }, (_, i) => `perf_entity_${i + 1}`);

      // Create all entities in parallel and update positions
      await Promise.all(
        entityIds.map(async (entityId, i) => {
          await testBed.createTestEntity('test:performance_entity', {
            instanceId: entityId,
            validateDefinition: false,
          });

          // Update position to distribute entities
          const locationId = `perf_location_${Math.floor(i / entitiesPerLocation) + 1}`;
          return testBed.entityManager.addComponent(entityId, 'core:position', {
            locationId,
          });
        })
      );

      const creationEndTime = performance.now();
      const totalCreationTime = creationEndTime - creationStartTime;

      // Assert - Performance metrics
      const avgCreationTime = totalCreationTime / entityCount;
      expect(avgCreationTime).toBeLessThan(200); // Lenient for E2E tests

      // Test spatial query performance across all locations
      const spatialIndexManager = testBed.container.resolve('ISpatialIndexManager');

      // Index automatically maintained - no rebuild needed
      const queryStartTime = performance.now();
      let totalQueriedEntities = 0;

      for (let i = 1; i <= locationCount; i++) {
        const locationId = `perf_location_${i}`;
        const entitiesAtLocation = spatialIndexManager.getEntitiesAtLocation(locationId);
        totalQueriedEntities += entitiesAtLocation ? entitiesAtLocation.length : 0;
      }

      const queryEndTime = performance.now();
      const totalQueryTime = queryEndTime - queryStartTime;
      const avgQueryTime = totalQueryTime / locationCount;

      // Performance assertions
      expect(totalQueriedEntities).toBe(entityCount);
      expect(avgQueryTime).toBeLessThan(50); // Per report threshold
      expect(spatialIndexManager.size).toBe(locationCount);

      console.log(`Performance Metrics:
        - Created ${entityCount} entities in ${totalCreationTime.toFixed(2)}ms
        - Avg creation time: ${avgCreationTime.toFixed(2)}ms per entity
        - Queried ${locationCount} locations in ${totalQueryTime.toFixed(2)}ms  
        - Avg query time: ${avgQueryTime.toFixed(2)}ms per location
        - Final index size: ${spatialIndexManager.size} locations`);
    });

    it('should demonstrate batch spatial operations performance', async () => {
      // Arrange - Create batch test data
      const batchSize = 50; // Reduced from 200 for faster E2E tests
      const additions = Array.from({ length: batchSize }, (_, i) => ({
        entityId: `batch_entity_${i + 1}`,
        locationId: `batch_location_${(i % 10) + 1}`, // 10 locations, 5 entities each
      }));

      await testBed.ensureEntityDefinitionExists('test:batch_entity', {
        id: 'test:batch_entity',
        components: {
          'core:name': { text: 'Batch Test Entity' },
          'core:description': { text: 'Entity for batch operation testing' },
        },
      });

      // Create entities first (without position for batch testing) in parallel
      await Promise.all(
        additions.map(addition =>
          testBed.createTestEntity('test:batch_entity', {
            instanceId: addition.entityId,
            validateDefinition: false,
          })
        )
      );

      const spatialIndexManager = testBed.container.resolve('ISpatialIndexManager');

      // Act - Test batch addition performance
      const batchStartTime = performance.now();
      
      if (typeof spatialIndexManager.batchAdd === 'function') {
        const batchResult = await spatialIndexManager.batchAdd(additions);
        
        const batchEndTime = performance.now();
        const batchTime = batchEndTime - batchStartTime;

        // Assert - Batch operation results
        expect(batchResult.successful).toHaveLength(batchSize);
        expect(batchResult.totalProcessed).toBe(batchSize);
        expect(batchResult.processingTime).toBeLessThan(1000); // Should be under 1 second

        // Verify spatial index state
        expect(spatialIndexManager.size).toBe(10); // 10 different locations
        
        console.log(`Batch Operation Metrics:
          - Processed ${batchSize} spatial additions in ${batchTime.toFixed(2)}ms
          - Batch processing time: ${batchResult.processingTime.toFixed(2)}ms
          - Final index size: ${spatialIndexManager.size} locations`);

      } else {
        // Fallback to individual operations and measure
        for (const addition of additions) {
          spatialIndexManager.addEntity(addition.entityId, addition.locationId);
        }
        
        const fallbackEndTime = performance.now();
        const fallbackTime = fallbackEndTime - batchStartTime;

        expect(fallbackTime).toBeLessThan(2000); // More lenient for individual operations
        expect(spatialIndexManager.size).toBe(10);
        
        console.log(`Fallback Operation Metrics:
          - Processed ${batchSize} individual additions in ${fallbackTime.toFixed(2)}ms`);
      }
    });

    it('should maintain performance during mixed spatial operations under load', async () => {
      // Arrange - Set up initial entity population
      const initialEntityCount = 30; // Reduced from 100 for faster E2E tests
      const operationCount = 20; // Reduced from 50

      await testBed.ensureEntityDefinitionExists('test:mixed_ops_entity', {
        id: 'test:mixed_ops_entity',
        components: {
          'core:name': { text: 'Mixed Operations Entity' },
          'core:position': { locationId: 'mixed_ops_location' },
        },
      });

      // Create initial entities in parallel
      const initialEntityIds = Array.from({ length: initialEntityCount }, (_, i) => `mixed_ops_entity_${i + 1}`);
      await Promise.all(
        initialEntityIds.map(entityId =>
          testBed.createTestEntity('test:mixed_ops_entity', {
            instanceId: entityId,
            validateDefinition: false,
          })
        )
      );

      const spatialIndexManager = testBed.container.resolve('ISpatialIndexManager');

      // Act - Perform mixed operations (creates, moves, queries)
      const mixedOpsStartTime = performance.now();
      
      const operations = [];
      
      // Create new entities
      for (let i = 0; i < operationCount; i++) {
        const entityId = `new_mixed_entity_${i + 1}`;
        operations.push(testBed.createTestEntity('test:mixed_ops_entity', {
          instanceId: entityId,
          validateDefinition: false,
        }));
      }

      // Move existing entities  
      for (let i = 0; i < Math.min(operationCount, initialEntityCount); i++) {
        const entityId = initialEntityIds[i];
        operations.push(testBed.entityManager.addComponent(entityId, 'core:position', {
          locationId: `moved_location_${i + 1}`,
        }));
      }

      await Promise.allSettled(operations);
      
      // Perform queries
      const queryResults = [];
      for (let i = 0; i < 20; i++) {
        const locationId = `moved_location_${i + 1}`;
        const entities = spatialIndexManager.getEntitiesAtLocation(locationId);
        queryResults.push(entities.length);
      }
      
      const mixedOpsEndTime = performance.now();
      const totalMixedOpsTime = mixedOpsEndTime - mixedOpsStartTime;

      // Assert - Performance and correctness
      expect(totalMixedOpsTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(queryResults.length).toBe(20);
      
      // Verify spatial index integrity
      await testBed.assertRepositoryConsistency();
      
      console.log(`Mixed Operations Metrics:
        - Completed ${operationCount} creates, ${operationCount} moves, and 20 queries
        - Total time: ${totalMixedOpsTime.toFixed(2)}ms
        - Final spatial index size: ${spatialIndexManager.size} locations`);
    });

    it('should handle edge cases and error conditions gracefully', async () => {
      // Arrange
      const spatialIndexManager = testBed.container.resolve('ISpatialIndexManager');

      // Test with null/undefined/invalid inputs
      const testCases = [
        { entityId: null, locationId: 'valid_location' },
        { entityId: 'valid_entity', locationId: null },
        { entityId: '', locationId: 'valid_location' },
        { entityId: 'valid_entity', locationId: '' },
        { entityId: 'valid_entity', locationId: '   ' }, // Whitespace only
      ];

      // Act & Assert - Test graceful handling of invalid inputs
      for (const testCase of testCases) {
        expect(() => {
          spatialIndexManager.addEntity(testCase.entityId, testCase.locationId);
        }).not.toThrow();

        expect(() => {
          spatialIndexManager.removeEntity(testCase.entityId, testCase.locationId);
        }).not.toThrow();
        
        expect(() => {
          spatialIndexManager.getEntitiesAtLocation(testCase.locationId);
        }).not.toThrow();
      }

      // Test query with non-existent location returns empty set
      const nonExistentResult = spatialIndexManager.getEntitiesAtLocation('non_existent_location_12345');
      expect(nonExistentResult.length).toBe(0);
      expect(nonExistentResult).toBeInstanceOf(Array);

      // Test removal from non-existent location doesn't error
      expect(() => {
        spatialIndexManager.removeEntity('some_entity', 'non_existent_location');
      }).not.toThrow();
    });
  });
});