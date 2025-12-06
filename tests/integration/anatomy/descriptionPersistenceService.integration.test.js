/**
 * @file Integration tests for DescriptionPersistenceService
 * @description Comprehensive integration tests to achieve near 100% coverage
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { DescriptionPersistenceService } from '../../../src/anatomy/DescriptionPersistenceService.js';
import { DESCRIPTION_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import EntityManagerIntegrationTestBed from '../../common/entities/entityManagerIntegrationTestBed.js';
import { buildEntityDefinition } from '../../common/entities/index.js';

describe('DescriptionPersistenceService Integration Tests', () => {
  let service;
  let testBed;
  let entityManager;
  let dataRegistry;
  let mockLogger;

  beforeEach(() => {
    // Create test bed with real EntityManager and data registry
    testBed = new EntityManagerIntegrationTestBed();
    entityManager = testBed.entityManager;
    dataRegistry = testBed.registry;
    mockLogger = testBed.logger;

    // Create service with real dependencies
    service = new DescriptionPersistenceService({
      logger: mockLogger,
      entityManager: entityManager,
    });
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  describe('Service Initialization Integration', () => {
    it('should create service with real dependencies successfully', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(DescriptionPersistenceService);
    });

    it('should throw error when logger is missing (lines 26)', () => {
      expect(() => {
        new DescriptionPersistenceService({
          entityManager: entityManager,
        });
      }).toThrow('logger is required');
    });

    it('should throw error when entityManager is missing (lines 27)', () => {
      expect(() => {
        new DescriptionPersistenceService({
          logger: mockLogger,
        });
      }).toThrow('entityManager is required');
    });

    it('should assign dependencies correctly (lines 29-30)', () => {
      const newService = new DescriptionPersistenceService({
        logger: mockLogger,
        entityManager: entityManager,
      });

      expect(newService).toBeDefined();
      // Dependencies are private, but we can verify through behavior
    });
  });

  describe('Entity Description Updates - Integration Scenarios', () => {
    it('should successfully update description for real entity (lines 51-58)', async () => {
      // Create a real entity definition using test builder
      const entityDefinition = buildEntityDefinition('test:entity', {
        'core:name': { text: 'Test Entity' },
      });

      // Store entity definition in registry
      dataRegistry.store('entityDefinitions', 'test:entity', entityDefinition);

      // Create entity instance
      const entityInstance = await entityManager.createEntityInstance(
        'test:entity',
        {
          instanceId: 'test-instance-1',
        }
      );

      const description = 'Test description for integration';
      const result = service.updateDescription('test-instance-1', description);

      expect(result).toBe(true);

      // Verify component was actually added through real EntityManager
      const entity = entityManager.getEntityInstance('test-instance-1');
      expect(entity.hasComponent(DESCRIPTION_COMPONENT_ID)).toBe(true);
      expect(entity.getComponentData(DESCRIPTION_COMPONENT_ID)).toEqual({
        text: description,
      });

      // Verify logging occurred (line 55-57)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `DescriptionPersistenceService: Updated description for entity 'test-instance-1'`
      );
    });

    it('should return false and log warning for non-existent entity (lines 44-48)', () => {
      const result = service.updateDescription(
        'non-existent-entity',
        'description'
      );

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `DescriptionPersistenceService: Entity 'non-existent-entity' not found`
      );
    });

    it('should handle EntityManager errors and return false (lines 59-65)', async () => {
      // Create entity but simulate EntityManager failure
      const entityDefinition = buildEntityDefinition('test:failing_entity', {});

      dataRegistry.store(
        'entityDefinitions',
        'test:failing_entity',
        entityDefinition
      );
      const entityInstance = await entityManager.createEntityInstance(
        'test:failing_entity',
        {
          instanceId: 'failing-instance',
        }
      );

      // Mock addComponent to throw error
      const originalAddComponent = entityManager.addComponent;
      entityManager.addComponent = jest.fn(() => {
        throw new Error('Simulated EntityManager failure');
      });

      const result = service.updateDescription(
        'failing-instance',
        'description'
      );

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        `DescriptionPersistenceService: Failed to update description for entity 'failing-instance'`,
        expect.any(Error)
      );

      // Restore original method
      entityManager.addComponent = originalAddComponent;
    });
  });

  describe('Batch Description Updates Integration', () => {
    beforeEach(async () => {
      // Set up multiple real entities for batch testing
      const entities = [
        { id: 'test:entity1', instanceId: 'entity-1' },
        { id: 'test:entity2', instanceId: 'entity-2' },
        { id: 'test:entity3', instanceId: 'entity-3' },
      ];

      for (const { id, instanceId } of entities) {
        const definition = buildEntityDefinition(id, {
          'core:name': { text: `Entity ${instanceId}` },
        });
        dataRegistry.store('entityDefinitions', id, definition);
        await entityManager.createEntityInstance(id, { instanceId });
      }
    });

    it('should successfully update all valid entities (lines 78-82, 86-90)', async () => {
      const descriptionsMap = new Map([
        ['entity-1', 'Description for entity 1'],
        ['entity-2', 'Description for entity 2'],
        ['entity-3', 'Description for entity 3'],
      ]);

      const result = await service.updateMultipleDescriptions(descriptionsMap);

      expect(result.successful).toBe(3);
      expect(result.failed).toEqual([]);

      // Verify all entities have descriptions
      ['entity-1', 'entity-2', 'entity-3'].forEach((entityId) => {
        const entity = entityManager.getEntityInstance(entityId);
        expect(entity.hasComponent(DESCRIPTION_COMPONENT_ID)).toBe(true);
      });

      // Verify info logging (line 86-88)
      expect(mockLogger.info).toHaveBeenCalledWith(
        'DescriptionPersistenceService: Updated 3 descriptions, 0 failed'
      );
    });

    it('should handle mixed success/failure scenarios (lines 82)', async () => {
      const descriptionsMap = new Map([
        ['entity-1', 'Description for entity 1'],
        ['non-existent', 'Description for non-existent'],
        ['entity-2', 'Description for entity 2'],
      ]);

      const result = await service.updateMultipleDescriptions(descriptionsMap);

      expect(result.successful).toBe(2);
      expect(result.failed).toEqual(['non-existent']);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'DescriptionPersistenceService: Updated 2 descriptions, 1 failed'
      );
    });

    it('should handle empty batch gracefully', async () => {
      const descriptionsMap = new Map();
      const result = await service.updateMultipleDescriptions(descriptionsMap);

      expect(result.successful).toBe(0);
      expect(result.failed).toEqual([]);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'DescriptionPersistenceService: Updated 0 descriptions, 0 failed'
      );
    });
  });

  describe('Description Removal Integration', () => {
    let testEntityId;

    beforeEach(async () => {
      // Create entity with description
      const entityDefinition = buildEntityDefinition(
        'test:removable_entity',
        {}
      );

      dataRegistry.store(
        'entityDefinitions',
        'test:removable_entity',
        entityDefinition
      );
      testEntityId = 'removable-entity-1';
      await entityManager.createEntityInstance('test:removable_entity', {
        instanceId: testEntityId,
      });

      // Add description component
      entityManager.addComponent(testEntityId, DESCRIPTION_COMPONENT_ID, {
        text: 'Initial description',
      });
    });

    it('should successfully remove description component (lines 106-111)', () => {
      // Verify entity has description initially
      const entity = entityManager.getEntityInstance(testEntityId);
      expect(entity.hasComponent(DESCRIPTION_COMPONENT_ID)).toBe(true);

      const result = service.removeDescription(testEntityId);

      expect(result).toBe(true);

      // Verify component was removed
      const updatedEntity = entityManager.getEntityInstance(testEntityId);
      expect(updatedEntity.hasComponent(DESCRIPTION_COMPONENT_ID)).toBe(false);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        `DescriptionPersistenceService: Removed description from entity '${testEntityId}'`
      );
    });

    it('should return false for non-existent entity (lines 102-104)', () => {
      const result = service.removeDescription('non-existent-entity');
      expect(result).toBe(false);
    });

    it('should return false when entity has no description component (lines 114)', async () => {
      // Create entity without description
      const entityDefinition = buildEntityDefinition('test:no_desc_entity', {});

      dataRegistry.store(
        'entityDefinitions',
        'test:no_desc_entity',
        entityDefinition
      );
      const entityId = 'no-desc-entity';
      await entityManager.createEntityInstance('test:no_desc_entity', {
        instanceId: entityId,
      });

      const result = service.removeDescription(entityId);
      expect(result).toBe(false);
    });

    it('should handle removal errors and return false (lines 115-121)', () => {
      // Mock removeComponent to throw error
      const originalRemoveComponent = entityManager.removeComponent;
      entityManager.removeComponent = jest.fn(() => {
        throw new Error('Simulated removal failure');
      });

      const result = service.removeDescription(testEntityId);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        `DescriptionPersistenceService: Failed to remove description from entity '${testEntityId}'`,
        expect.any(Error)
      );

      // Restore original method
      entityManager.removeComponent = originalRemoveComponent;
    });
  });

  describe('Description Retrieval Integration', () => {
    let testEntityId;

    beforeEach(async () => {
      const entityDefinition = buildEntityDefinition(
        'test:retrievable_entity',
        {}
      );

      dataRegistry.store(
        'entityDefinitions',
        'test:retrievable_entity',
        entityDefinition
      );
      testEntityId = 'retrievable-entity-1';
      await entityManager.createEntityInstance('test:retrievable_entity', {
        instanceId: testEntityId,
      });
    });

    it('should successfully retrieve description data (lines 137)', () => {
      const descriptionData = { text: 'Retrieved description' };
      entityManager.addComponent(
        testEntityId,
        DESCRIPTION_COMPONENT_ID,
        descriptionData
      );

      const result = service.getDescription(testEntityId);

      expect(result).toEqual(descriptionData);
    });

    it('should return null for non-existent entity (lines 134)', () => {
      const result = service.getDescription('non-existent-entity');
      expect(result).toBeNull();
    });

    it('should handle retrieval errors and return null (lines 138-143)', () => {
      // Create entity but mock getComponentData to throw error
      const entity = entityManager.getEntityInstance(testEntityId);
      const originalGetComponentData = entity.getComponentData;
      entity.getComponentData = jest.fn(() => {
        throw new Error('Simulated retrieval failure');
      });

      const result = service.getDescription(testEntityId);

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        `DescriptionPersistenceService: Failed to get description for entity '${testEntityId}'`,
        expect.any(Error)
      );

      // Restore original method
      entity.getComponentData = originalGetComponentData;
    });
  });

  describe('Description Existence Checks Integration', () => {
    let testEntityId;

    beforeEach(async () => {
      const entityDefinition = buildEntityDefinition(
        'test:checkable_entity',
        {}
      );

      dataRegistry.store(
        'entityDefinitions',
        'test:checkable_entity',
        entityDefinition
      );
      testEntityId = 'checkable-entity-1';
      await entityManager.createEntityInstance('test:checkable_entity', {
        instanceId: testEntityId,
      });
    });

    it('should return true when entity has description (lines 156)', () => {
      entityManager.addComponent(testEntityId, DESCRIPTION_COMPONENT_ID, {
        text: 'Has description',
      });

      const result = service.hasDescription(testEntityId);
      expect(result).toBe(true);
    });

    it('should return false when entity has no description (lines 156)', () => {
      const result = service.hasDescription(testEntityId);
      expect(result).toBe(false);
    });

    it('should return false for non-existent entity (lines 156)', () => {
      const result = service.hasDescription('non-existent-entity');
      expect(result).toBe(false);
    });

    it('should handle exceptions and return false (lines 157-159)', () => {
      // This covers the critical uncovered lines 157-159
      // Mock getEntityInstance to throw error
      const originalGetEntityInstance = entityManager.getEntityInstance;
      entityManager.getEntityInstance = jest.fn(() => {
        throw new Error('Simulated entity lookup failure');
      });

      const result = service.hasDescription(testEntityId);

      expect(result).toBe(false);
      // Note: hasDescription doesn't log errors, it just returns false

      // Restore original method
      entityManager.getEntityInstance = originalGetEntityInstance;
    });
  });

  describe('Complex Integration Workflows', () => {
    let workflowEntityId;

    beforeEach(async () => {
      const entityDefinition = buildEntityDefinition(
        'test:workflow_entity',
        {}
      );

      dataRegistry.store(
        'entityDefinitions',
        'test:workflow_entity',
        entityDefinition
      );
      workflowEntityId = 'workflow-entity-1';
      await entityManager.createEntityInstance('test:workflow_entity', {
        instanceId: workflowEntityId,
      });
    });

    it('should handle complete workflow: update → retrieve → remove → check', () => {
      const description = 'Workflow test description';

      // Step 1: Update description
      const updateResult = service.updateDescription(
        workflowEntityId,
        description
      );
      expect(updateResult).toBe(true);

      // Step 2: Retrieve description
      const retrievedData = service.getDescription(workflowEntityId);
      expect(retrievedData).toEqual({ text: description });

      // Step 3: Check existence
      const hasDesc1 = service.hasDescription(workflowEntityId);
      expect(hasDesc1).toBe(true);

      // Step 4: Remove description
      const removeResult = service.removeDescription(workflowEntityId);
      expect(removeResult).toBe(true);

      // Step 5: Verify removal
      const hasDesc2 = service.hasDescription(workflowEntityId);
      expect(hasDesc2).toBe(false);

      const retrievedAfterRemoval = service.getDescription(workflowEntityId);
      expect(retrievedAfterRemoval).toBeUndefined();
    });

    it('should handle batch update followed by individual operations', async () => {
      // Create additional entities for batch testing
      const entities = ['workflow-entity-2', 'workflow-entity-3'];
      for (const entityId of entities) {
        await entityManager.createEntityInstance('test:workflow_entity', {
          instanceId: entityId,
        });
      }

      // Batch update
      const descriptionsMap = new Map([
        [workflowEntityId, 'Batch description 1'],
        ['workflow-entity-2', 'Batch description 2'],
        ['workflow-entity-3', 'Batch description 3'],
      ]);

      const batchResult =
        await service.updateMultipleDescriptions(descriptionsMap);
      expect(batchResult.successful).toBe(3);

      // Individual verifications
      [workflowEntityId, 'workflow-entity-2', 'workflow-entity-3'].forEach(
        (entityId) => {
          expect(service.hasDescription(entityId)).toBe(true);
          expect(service.getDescription(entityId)).toHaveProperty('text');
        }
      );

      // Individual removals
      expect(service.removeDescription(workflowEntityId)).toBe(true);
      expect(service.hasDescription(workflowEntityId)).toBe(false);
    });

    it('should handle error recovery scenarios', () => {
      // Update description successfully
      expect(
        service.updateDescription(workflowEntityId, 'Initial description')
      ).toBe(true);

      // Simulate temporary EntityManager failure during retrieval
      const originalGetEntityInstance = entityManager.getEntityInstance;
      entityManager.getEntityInstance = jest.fn(() => {
        throw new Error('Temporary failure');
      });

      // Operations should gracefully handle errors
      expect(service.getDescription(workflowEntityId)).toBeNull();
      expect(service.hasDescription(workflowEntityId)).toBe(false);
      expect(service.removeDescription(workflowEntityId)).toBe(false);

      // Restore EntityManager and verify state is still intact
      entityManager.getEntityInstance = originalGetEntityInstance;

      // Entity should still have description (the error was in retrieval, not storage)
      expect(service.hasDescription(workflowEntityId)).toBe(true);
    });
  });

  describe('Service Interaction Edge Cases', () => {
    it('should handle concurrent operations on same entity', async () => {
      const entityDefinition = buildEntityDefinition(
        'test:concurrent_entity',
        {}
      );

      dataRegistry.store(
        'entityDefinitions',
        'test:concurrent_entity',
        entityDefinition
      );
      const entityId = 'concurrent-entity';
      await entityManager.createEntityInstance('test:concurrent_entity', {
        instanceId: entityId,
      });

      // Simulate concurrent updates (in real world these would be async)
      const results = [];
      results.push(service.updateDescription(entityId, 'Description 1'));
      results.push(service.updateDescription(entityId, 'Description 2'));
      results.push(service.updateDescription(entityId, 'Final Description'));

      // All should succeed (last one wins)
      expect(results).toEqual([true, true, true]);

      const finalDescription = service.getDescription(entityId);
      expect(finalDescription.text).toBe('Final Description');
    });

    it('should maintain consistency during rapid operations', async () => {
      const entityDefinition = buildEntityDefinition('test:rapid_entity', {});

      dataRegistry.store(
        'entityDefinitions',
        'test:rapid_entity',
        entityDefinition
      );
      const entityId = 'rapid-entity';
      await entityManager.createEntityInstance('test:rapid_entity', {
        instanceId: entityId,
      });

      // Rapid sequence of operations
      expect(service.updateDescription(entityId, 'Rapid test')).toBe(true);
      expect(service.hasDescription(entityId)).toBe(true);
      expect(service.getDescription(entityId).text).toBe('Rapid test');
      expect(service.removeDescription(entityId)).toBe(true);
      expect(service.hasDescription(entityId)).toBe(false);
      expect(service.getDescription(entityId)).toBeUndefined();
    });
  });
});
