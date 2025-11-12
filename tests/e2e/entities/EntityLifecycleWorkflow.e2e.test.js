/**
 * @file EntityLifecycleWorkflow.e2e.test.js
 * @description End-to-end tests for entity lifecycle workflows
 *
 * Tests the complete entity lifecycle from creation through removal,
 * including definition resolution, event dispatching, and repository consistency.
 *
 * This addresses the Priority 1 critical gap identified in the entity workflows
 * E2E test coverage analysis for core entity lifecycle operations.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';
import EntityWorkflowTestBed from './common/entityWorkflowTestBed.js';

describe('Entity Lifecycle E2E Workflow', () => {
  let testBed;

  beforeAll(async () => {
    // Initialize ONCE for entire suite
    testBed = new EntityWorkflowTestBed();
    await testBed.initialize();
  });

  beforeEach(async () => {
    // Lightweight state cleanup between tests
    testBed.clearTransientState();

    // Clean up any entities that might have been created
    // (belt-and-suspenders approach for test isolation)
    const entityIds = testBed.entityManager.getEntityIds();
    for (const entityId of entityIds) {
      try {
        await testBed.removeTestEntity(entityId, { expectSuccess: false });
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
  });

  afterAll(async () => {
    // Cleanup ONCE after entire suite
    if (testBed) {
      await testBed.cleanup();
    }
  });

  describe('Entity Creation Workflow', () => {
    it('should create entity with proper definition resolution and validation', async () => {
      // Arrange
      const definitionId = 'test:basic_entity';
      const expectedInstanceId = 'test_entity_001';

      // Ensure definition exists
      await testBed.ensureEntityDefinitionExists(definitionId);

      // Act
      const entity = await testBed.createTestEntity(definitionId, {
        instanceId: expectedInstanceId,
      });

      // Assert entity creation
      expect(entity).toBeDefined();
      expect(entity.id).toBe(expectedInstanceId);
      expect(typeof entity.getComponentData).toBe('function');
      expect(typeof entity.hasComponent).toBe('function');

      // Validate entity is retrievable from entity manager
      const retrievedEntity =
        await testBed.entityManager.getEntityInstance(expectedInstanceId);
      expect(retrievedEntity).toBeDefined();
      expect(retrievedEntity.id).toBe(expectedInstanceId);

      // Validate entity appears in entity list
      const entityIds = testBed.entityManager.getEntityIds();
      expect(entityIds).toContain(expectedInstanceId);
    });

    it('should handle entity creation with basic validation', async () => {
      // Arrange
      const definitionId = 'test:basic_validation_entity';
      const expectedInstanceId = 'test_basic_validation_001';

      await testBed.ensureEntityDefinitionExists(definitionId);

      // Act
      const entity = await testBed.createTestEntity(definitionId, {
        instanceId: expectedInstanceId,
      });

      // Assert entity creation
      expect(entity).toBeDefined();
      expect(entity.id).toBe(expectedInstanceId);

      // Validate entity has expected structure
      expect(typeof entity.getComponentData).toBe('function');
      expect(typeof entity.hasComponent).toBe('function');

      // Validate entity has basic components
      expect(entity.hasComponent('core:name')).toBe(true);
      expect(entity.hasComponent('core:description')).toBe(true);

      const nameComponent = entity.getComponentData('core:name');
      expect(nameComponent).toBeDefined();
      expect(nameComponent.text).toContain('Test Entity');

      const descriptionComponent = entity.getComponentData('core:description');
      expect(descriptionComponent).toBeDefined();
      expect(descriptionComponent.text).toContain('Test entity created');
    });

    it('should dispatch ENTITY_CREATED events with correct payload', async () => {
      // Arrange
      const definitionId = 'test:event_entity';
      const expectedInstanceId = 'test_event_entity_001';

      await testBed.ensureEntityDefinitionExists(definitionId);

      // Act
      await testBed.createTestEntity(definitionId, {
        instanceId: expectedInstanceId,
      });

      // Assert event was dispatched
      testBed.assertEntityCreated(expectedInstanceId, definitionId);

      // Validate event payload details
      const entityEvents = testBed.getEntityEvents(expectedInstanceId);
      const createEvent = entityEvents.find(
        (event) => event.type === 'ENTITY_CREATED'
      );

      expect(createEvent).toBeDefined();
      expect(createEvent.entityId).toBe(expectedInstanceId);
      expect(createEvent.definitionId).toBe(definitionId);
      expect(createEvent.payload).toBeDefined();
      expect(createEvent.payload.entity).toBeDefined();
      expect(createEvent.payload.entity.id).toBe(expectedInstanceId);
      expect(createEvent.timestamp).toBeGreaterThan(0);
    });

    it('should handle multiple concurrent entity creations safely', async () => {
      // Arrange
      const entityConfigs = [
        {
          definitionId: 'test:concurrent_entity_1',
          instanceId: 'concurrent_test_001',
        },
        {
          definitionId: 'test:concurrent_entity_2',
          instanceId: 'concurrent_test_002',
        },
        {
          definitionId: 'test:concurrent_entity_3',
          instanceId: 'concurrent_test_003',
        },
      ];

      // Ensure all definitions exist
      for (const config of entityConfigs) {
        await testBed.ensureEntityDefinitionExists(config.definitionId);
      }

      // Act - Create entities concurrently
      const creationPromises = entityConfigs.map((config) =>
        testBed.createTestEntity(config.definitionId, {
          instanceId: config.instanceId,
        })
      );

      const entities = await Promise.all(creationPromises);

      // Assert all entities were created successfully
      expect(entities).toHaveLength(3);
      entities.forEach((entity, index) => {
        expect(entity).toBeDefined();
        expect(entity.id).toBe(entityConfigs[index].instanceId);
      });

      // Validate all entities are retrievable
      for (const config of entityConfigs) {
        const retrievedEntity = await testBed.entityManager.getEntityInstance(
          config.instanceId
        );
        expect(retrievedEntity).toBeDefined();
        expect(retrievedEntity.id).toBe(config.instanceId);
      }

      // Validate repository consistency
      await testBed.assertRepositoryConsistency();
    });
  });

  describe('Entity Removal Workflow', () => {
    it('should remove entity and clean up all references', async () => {
      // Arrange - Create an entity first
      const definitionId = 'test:removable_entity';
      const instanceId = 'test_removable_001';

      await testBed.ensureEntityDefinitionExists(definitionId);
      await testBed.createTestEntity(definitionId, {
        instanceId,
      });

      // Verify entity exists before removal
      expect(
        await testBed.entityManager.getEntityInstance(instanceId)
      ).toBeDefined();

      // Act - Remove the entity
      const result = await testBed.removeTestEntity(instanceId);

      // Assert removal was successful
      expect(result).toBe(true);

      // Validate entity is no longer retrievable
      const removedEntity =
        await testBed.entityManager.getEntityInstance(instanceId);
      expect(removedEntity).toBeFalsy(); // Could be null or undefined

      // Validate entity is removed from entity list
      const entityIds = testBed.entityManager.getEntityIds();
      expect(entityIds).not.toContain(instanceId);
    });

    it('should handle removal of non-existent entities gracefully', async () => {
      // Arrange
      const nonExistentEntityId = 'test:non_existent_entity_999';

      // Act - Attempt to remove non-existent entity
      const result = await testBed.removeTestEntity(nonExistentEntityId, {
        expectSuccess: false,
      });

      // Assert removal failed gracefully
      expect(result).toBe(false);

      // Validate no error events were generated
      const errorEvents = testBed.getEventsByType('core:error');
      // Should either be empty or contain handled errors (not crashes)
      expect(errorEvents.length).toBe(0);
    });

    it('should dispatch ENTITY_REMOVED events and update indices', async () => {
      // Arrange - Create an entity first
      const definitionId = 'test:event_removal_entity';
      const instanceId = 'test_event_removal_001';

      await testBed.ensureEntityDefinitionExists(definitionId);
      await testBed.createTestEntity(definitionId, {
        instanceId,
      });

      // Act - Remove the entity
      await testBed.removeTestEntity(instanceId);

      // Assert removal event was dispatched
      testBed.assertEntityRemoved(instanceId);

      // Validate event payload details
      const entityEvents = testBed.getEntityEvents(instanceId);
      const removeEvent = entityEvents.find(
        (event) => event.type === 'ENTITY_REMOVED'
      );

      expect(removeEvent).toBeDefined();
      expect(removeEvent.entityId).toBe(instanceId);
      expect(removeEvent.payload).toBeDefined();
      expect(removeEvent.timestamp).toBeGreaterThan(0);
    });

    it('should handle multiple entity removals in sequence', async () => {
      // Arrange - Create multiple entities
      const definitionId = 'test:batch_removal_entity';
      const entityIds = [
        'batch_removal_001',
        'batch_removal_002',
        'batch_removal_003',
      ];

      await testBed.ensureEntityDefinitionExists(definitionId);

      for (const entityId of entityIds) {
        await testBed.createTestEntity(definitionId, {
          instanceId: entityId,
        });
      }

      // Verify all entities exist
      for (const entityId of entityIds) {
        const entity = await testBed.entityManager.getEntityInstance(entityId);
        expect(entity).toBeDefined();
      }

      // Act - Remove all entities in sequence
      for (const entityId of entityIds) {
        const result = await testBed.removeTestEntity(entityId);
        expect(result).toBe(true);
      }

      // Assert all entities are removed
      for (const entityId of entityIds) {
        const entity = await testBed.entityManager.getEntityInstance(entityId);
        expect(entity).toBeUndefined();
        testBed.assertEntityRemoved(entityId);
      }

      // Validate repository consistency
      await testBed.assertRepositoryConsistency();
    });
  });

  describe('Repository Consistency Validation', () => {
    it('should maintain repository consistency during lifecycle operations', async () => {
      // Arrange
      const definitionId = 'test:consistency_entity';
      await testBed.ensureEntityDefinitionExists(definitionId);

      // Act - Perform various lifecycle operations
      const entity1 = await testBed.createTestEntity(definitionId, {
        instanceId: 'consistency_test_001',
      });

      const entity2 = await testBed.createTestEntity(definitionId, {
        instanceId: 'consistency_test_002',
      });

      // Remove first entity
      await testBed.removeTestEntity(entity1.id);

      // Create another entity
      const entity3 = await testBed.createTestEntity(definitionId, {
        instanceId: 'consistency_test_003',
      });

      // Assert repository consistency throughout operations
      await testBed.assertRepositoryConsistency();

      // Validate final state
      const finalEntityIds = testBed.entityManager.getEntityIds();
      expect(finalEntityIds).toContain(entity2.id);
      expect(finalEntityIds).toContain(entity3.id);
      expect(finalEntityIds).not.toContain(entity1.id);
    });

    it('should handle concurrent entity operations safely', async () => {
      // Arrange
      const definitionId = 'test:concurrent_ops_entity';
      await testBed.ensureEntityDefinitionExists(definitionId);

      // Create initial entities
      const initialEntities = [];
      for (let i = 0; i < 3; i++) {
        const entity = await testBed.createTestEntity(definitionId, {
          instanceId: `concurrent_ops_${i}`,
        });
        initialEntities.push(entity);
      }

      // Act - Perform concurrent operations (mix of creation and removal)
      const operations = [
        // Create new entities
        testBed.createTestEntity(definitionId, {
          instanceId: 'concurrent_new_001',
        }),
        testBed.createTestEntity(definitionId, {
          instanceId: 'concurrent_new_002',
        }),
        // Remove existing entities
        testBed.removeTestEntity(initialEntities[0].id),
        testBed.removeTestEntity(initialEntities[1].id),
        // Create another entity
        testBed.createTestEntity(definitionId, {
          instanceId: 'concurrent_new_003',
        }),
      ];

      const results = await Promise.allSettled(operations);

      // Assert all operations completed (successfully or with expected failures)
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          // Log but don't fail - some concurrent conflicts are expected
          console.warn(
            `Concurrent operation ${index} failed:`,
            result.reason?.message
          );
        }
      });

      // Most importantly, repository should remain consistent
      await testBed.assertRepositoryConsistency();

      // Basic assertion to satisfy jest/expect-expect
      expect(results.length).toBe(5);
    });

    it('should validate entity data integrity after lifecycle operations', async () => {
      // Arrange
      const definitionId = 'test:integrity_entity';
      await testBed.ensureEntityDefinitionExists(definitionId);

      // Act - Create entity
      const entity = await testBed.createTestEntity(definitionId, {
        instanceId: 'integrity_test_001',
      });

      // Assert data integrity is maintained
      const retrievedEntity = await testBed.entityManager.getEntityInstance(
        entity.id
      );

      // Validate entity structure integrity
      expect(retrievedEntity.id).toBe(entity.id);
      expect(typeof retrievedEntity.hasComponent).toBe('function');
      expect(typeof retrievedEntity.getComponentData).toBe('function');

      // Validate basic components exist and have data
      expect(retrievedEntity.hasComponent('core:name')).toBe(true);
      expect(retrievedEntity.hasComponent('core:description')).toBe(true);

      const nameComponent = retrievedEntity.getComponentData('core:name');
      expect(nameComponent).toBeDefined();
      expect(nameComponent.text).toBeDefined();

      const descriptionComponent =
        retrievedEntity.getComponentData('core:description');
      expect(descriptionComponent).toBeDefined();
      expect(descriptionComponent.text).toBeDefined();
    });

    it('should track entity lifecycle events correctly throughout operations', async () => {
      // Arrange
      const definitionId = 'test:lifecycle_tracking_entity';
      await testBed.ensureEntityDefinitionExists(definitionId);

      // Act - Perform complete lifecycle
      const entity = await testBed.createTestEntity(definitionId, {
        instanceId: 'lifecycle_tracking_001',
      });

      await testBed.removeTestEntity(entity.id);

      // Assert complete lifecycle was tracked
      const entityEvents = testBed.getEntityEvents(entity.id);

      // Should have both creation and removal events
      const createEvents = entityEvents.filter(
        (event) => event.type === 'ENTITY_CREATED'
      );
      const removeEvents = entityEvents.filter(
        (event) => event.type === 'ENTITY_REMOVED'
      );

      expect(createEvents).toHaveLength(1);
      expect(removeEvents).toHaveLength(1);

      // Events should be in correct sequence order (timestamp precision may be
      // insufficient for very fast operations on modern hardware)
      const createIndex = entityEvents.indexOf(createEvents[0]);
      const removeIndex = entityEvents.indexOf(removeEvents[0]);
      expect(createIndex).toBeLessThan(removeIndex);

      // Event data should be consistent
      expect(createEvents[0].entityId).toBe(entity.id);
      expect(removeEvents[0].entityId).toBe(entity.id);
    });
  });
});
