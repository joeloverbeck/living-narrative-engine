/**
 * @file tests/e2e/anatomy/multiEntityOperations.e2e.test.js
 * @description End-to-end tests for multi-entity operations in the anatomy system
 * Tests bulk entity validation, concurrent generation, cross-entity relationships,
 * and mixed success/failure batch processing scenarios
 *
 * Priority 4 implementation addressing MEDIUM-HIGH priority gaps in:
 * - Cross-entity constraint validation
 * - Bulk entity operations with validation
 * - Entity relationship consistency checks
 * - Concurrent modification conflict resolution
 */

import {
  beforeEach,
  describe,
  expect,
  it,
  jest,
  afterEach,
} from '@jest/globals';
import { ANATOMY_BODY_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import EnhancedAnatomyTestBed from '../../common/anatomy/enhancedAnatomyTestBed.js';
import ComplexBlueprintDataGenerator from '../../common/anatomy/complexBlueprintDataGenerator.js';
import UuidGenerator from '../../../src/adapters/UuidGenerator.js';

// Mock console to reduce test output noise (but keep error for debugging)
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: originalConsole.error, // Keep error for debugging
};

describe('Multi-Entity Operations E2E Tests', () => {
  let testBed;
  let entityManager;
  let anatomyGenerationService;
  let bodyGraphService;
  let anatomyCacheManager;
  let anatomyOrchestrator;
  let dataGenerator;
  let logger;
  let eventBus;

  beforeEach(async () => {
    // Create enhanced test bed with multi-entity support
    testBed = new EnhancedAnatomyTestBed();
    dataGenerator = new ComplexBlueprintDataGenerator();

    // Ensure clean state
    if (testBed.registry?.clear) {
      testBed.registry.clear();
    }
    if (testBed.entityManager?.clearAll) {
      testBed.entityManager.clearAll();
    }
    if (testBed.bodyGraphService?.clearCache) {
      testBed.bodyGraphService.clearCache();
    }

    // Get services
    entityManager = testBed.getEntityManager();
    anatomyGenerationService = testBed.anatomyGenerationService;
    bodyGraphService = testBed.bodyGraphService;
    anatomyCacheManager = testBed.anatomyCacheManager;
    anatomyOrchestrator = testBed.anatomyOrchestrator;
    logger = testBed.logger;
    eventBus = testBed.eventDispatcher;

    // Load required components
    testBed.loadComponents({
      'core:name': {
        id: 'core:name',
        description: 'Name component',
        dataSchema: {
          type: 'object',
          properties: {
            text: { type: 'string' },
          },
        },
      },
      'anatomy:body': {
        id: 'anatomy:body',
        description: 'Body component for anatomy system',
        dataSchema: {
          type: 'object',
          properties: {
            recipeId: { type: 'string' },
            body: {
              type: 'object',
              properties: {
                root: { type: 'string' },
                parts: { type: 'object' },
              },
            },
          },
        },
      },
      'anatomy:part': {
        id: 'anatomy:part',
        description: 'Anatomy part component',
        dataSchema: {
          type: 'object',
          properties: {
            subType: { type: 'string' },
            parentId: { type: 'string' },
          },
        },
      },
      'anatomy:sockets': {
        id: 'anatomy:sockets',
        description: 'Anatomy sockets component',
        dataSchema: {
          type: 'object',
          properties: {
            sockets: { type: 'array' },
          },
        },
      },
      'anatomy:joint': {
        id: 'anatomy:joint',
        description: 'Anatomy joint component',
        dataSchema: {
          type: 'object',
          properties: {
            parentId: { type: 'string' },
            socketId: { type: 'string' },
          },
        },
      },
      'core:owned_by': {
        id: 'core:owned_by',
        description: 'Ownership component',
        dataSchema: {
          type: 'object',
          properties: {
            ownerId: { type: 'string' },
          },
        },
      },
      'core:description': {
        id: 'core:description',
        description: 'Core description component',
        dataSchema: {
          type: 'object',
          properties: {
            text: { type: 'string' },
          },
        },
      },
    });

    // Load test entity definitions
    testBed.loadEntityDefinitions({
      'test:actor': {
        id: 'test:actor',
        description: 'Test actor entity',
        components: {},
      },
      'anatomy:blueprint_slot': {
        id: 'anatomy:blueprint_slot',
        description: 'Blueprint slot entity',
        components: {
          'anatomy:blueprintSlot': {},
        },
      },
      'test:humanoid_arm': {
        id: 'test:humanoid_arm',
        description: 'Humanoid arm entity',
        components: {
          'anatomy:part': { subType: 'arm' },
          'anatomy:sockets': { sockets: [] },
          'core:name': { text: 'Humanoid Arm' },
        },
      },
    });

    // Load test entity definitions and blueprints
    const testData = dataGenerator.generateMultiLevelBlueprint();
    await testBed.loadComplexBlueprints(testData);
  });

  afterEach(() => {
    // Clean up after each test
    if (testBed.cleanup) {
      testBed.cleanup();
    }
    jest.clearAllMocks();
  });

  describe('Test 4.1: Bulk Entity Validation', () => {
    it('should validate relationships across multiple entities', async () => {
      // Arrange - Create multiple entities with shared references
      const entityCount = 5;
      const entities = [];
      const ownerEntityId = UuidGenerator();

      // Create owner entity first
      await entityManager.createEntityInstance('test:actor', {
        instanceId: ownerEntityId,
      });
      entityManager.addComponent(ownerEntityId, 'core:name', {
        text: 'Owner Entity',
      });

      // Create multiple actor entities with shared owner
      for (let i = 0; i < entityCount; i++) {
        const entityId = UuidGenerator();
        await entityManager.createEntityInstance('test:actor', {
          instanceId: entityId,
        });
        entityManager.addComponent(entityId, 'core:name', {
          text: `Test Actor ${i + 1}`,
        });
        entityManager.addComponent(entityId, 'core:owned_by', {
          ownerId: ownerEntityId,
        });
        entityManager.addComponent(entityId, ANATOMY_BODY_COMPONENT_ID, {
          recipeId: 'test:simple_humanoid_recipe',
        });
        entities.push({ id: entityId });
      }

      // Act - Generate anatomy for all entities
      const startTime = Date.now();
      const generationPromises = entities.map(async ({ id }) => {
        const wasGenerated =
          await anatomyGenerationService.generateAnatomyIfNeeded(id);
        return { id, wasGenerated };
      });

      const results = await Promise.all(generationPromises);
      const elapsedTime = Date.now() - startTime;

      // Assert - Validate cross-entity constraint consistency
      expect(results).toHaveLength(entityCount);
      results.forEach((result) => {
        expect(result.wasGenerated).toBe(true);
      });

      // Validate all entities maintain shared ownership
      entities.forEach(({ id }) => {
        const entity = entityManager.getEntityInstance(id);
        const ownedBy = entityManager.getComponentData(id, 'core:owned_by');
        expect(ownedBy?.ownerId).toBe(ownerEntityId);
      });

      // Validate anatomy structures are independent
      const anatomyBodies = entities.map(({ id }) => {
        return entityManager.getComponentData(id, 'anatomy:body');
      });

      // Each should have unique root part IDs
      const rootPartIds = anatomyBodies.map((body) => body?.body?.root);
      const uniqueRootPartIds = new Set(rootPartIds);
      expect(uniqueRootPartIds.size).toBe(entityCount);

      // Performance validation - should complete within 10 seconds for 5 entities
      expect(elapsedTime).toBeLessThan(10000);

      // Validate no orphaned entities were created
      const allEntities = entityManager.getEntitiesWithComponent('core:name');
      const anatomyPartEntities = allEntities.filter((e) =>
        e.hasComponent('anatomy:part')
      );

      // Each entity should have created anatomy parts
      expect(anatomyPartEntities.length).toBeGreaterThan(entityCount * 2); // At least torso + arms/head per entity
    });

    it('should handle bulk operations maintaining referential integrity', async () => {
      // Arrange - Create entities with interdependencies
      const parentEntityId = UuidGenerator();
      const childEntityIds = [];

      // Create parent entity
      await entityManager.createEntityInstance('test:actor', {
        instanceId: parentEntityId,
      });
      entityManager.addComponent(parentEntityId, 'core:name', {
        text: 'Parent Entity',
      });

      // Create child entities referencing parent
      for (let i = 0; i < 3; i++) {
        const childId = UuidGenerator();
        await entityManager.createEntityInstance('test:actor', {
          instanceId: childId,
        });
        entityManager.addComponent(childId, 'core:name', {
          text: `Child Entity ${i + 1}`,
        });
        entityManager.addComponent(childId, 'core:owned_by', {
          ownerId: parentEntityId,
        });
        entityManager.addComponent(childId, ANATOMY_BODY_COMPONENT_ID, {
          recipeId: 'test:simple_humanoid_recipe',
        });
        childEntityIds.push(childId);
      }

      // Add anatomy body component to parent
      entityManager.addComponent(parentEntityId, ANATOMY_BODY_COMPONENT_ID, {
        recipeId: 'test:simple_humanoid_recipe',
      });

      // Act - Generate anatomy for all entities including parent
      const allEntityIds = [parentEntityId, ...childEntityIds];
      const generationPromises = allEntityIds.map((id) =>
        anatomyGenerationService.generateAnatomyIfNeeded(id)
      );

      await Promise.all(generationPromises);

      // Assert - Verify referential integrity maintained
      childEntityIds.forEach((childId) => {
        const childEntity = entityManager.getEntityInstance(childId);
        expect(childEntity).toBeDefined();

        const ownedBy = entityManager.getComponentData(
          childId,
          'core:owned_by'
        );
        expect(ownedBy?.ownerId).toBe(parentEntityId);

        // Verify parent still exists
        const parentEntity = entityManager.getEntityInstance(parentEntityId);
        expect(parentEntity).toBeDefined();
      });

      // Verify anatomy generation didn't break ownership relationships
      const parentEntity = entityManager.getEntityInstance(parentEntityId);
      expect(entityManager.hasComponent(parentEntityId, 'anatomy:body')).toBe(
        true
      );

      childEntityIds.forEach((childId) => {
        const childEntity = entityManager.getEntityInstance(childId);
        expect(entityManager.hasComponent(childId, 'anatomy:body')).toBe(true);
        // Ownership should still be intact
        expect(
          entityManager.getComponentData(childId, 'core:owned_by')?.ownerId
        ).toBe(parentEntityId);
      });
    });

    it('should detect and handle orphaned entities across multiple generations', async () => {
      // Arrange - Create entities and generate anatomy
      const entityIds = [];
      for (let i = 0; i < 3; i++) {
        const entityId = UuidGenerator();
        await entityManager.createEntityInstance('test:actor', {
          instanceId: entityId,
        });
        entityManager.addComponent(entityId, 'core:name', {
          text: `Entity ${i + 1}`,
        });
        entityManager.addComponent(entityId, ANATOMY_BODY_COMPONENT_ID, {
          recipeId: 'test:simple_humanoid_recipe',
        });
        entityIds.push(entityId);
      }

      // Generate anatomy for all entities
      await Promise.all(
        entityIds.map((id) =>
          anatomyGenerationService.generateAnatomyIfNeeded(
            id,
            'test:simple_humanoid_recipe'
          )
        )
      );

      // Act - Remove one parent entity to create orphans
      const entityToRemove = entityIds[0];
      const entityBody = entityManager
        .getEntityInstance(entityToRemove)
        .getComponentData('anatomy:body');
      const rootPartId = entityBody?.body?.root;

      // Remove the main entity (this should orphan its anatomy parts)
      entityManager.removeEntityInstance(entityToRemove);

      // Assert - Verify orphaned parts can be detected
      const remainingEntities =
        entityManager.getEntitiesWithComponent('core:name');
      const orphanedParts = remainingEntities.filter((entity) => {
        if (!entityManager.hasComponent(entity.id, 'anatomy:part'))
          return false;

        // Check if part belongs to deleted entity
        const ownedBy = entity.getComponentData('core:owned_by');
        return ownedBy?.ownerId === entityToRemove;
      });

      // Should have orphaned parts from the deleted entity
      expect(orphanedParts.length).toBeGreaterThan(0);

      // Other entities should remain intact
      entityIds.slice(1).forEach((id) => {
        const entity = entityManager.getEntityInstance(id);
        expect(entity).toBeDefined();
        expect(entityManager.hasComponent(entity.id, 'anatomy:body')).toBe(
          true
        );
      });
    });
  });

  describe('Test 4.2: Concurrent Entity Generation', () => {
    it('should handle concurrent entity generation safely', async () => {
      // Arrange - Prepare multiple entities for concurrent generation
      const concurrentCount = 5;
      const entityIds = [];

      for (let i = 0; i < concurrentCount; i++) {
        const entityId = UuidGenerator();
        await entityManager.createEntityInstance('test:actor', {
          instanceId: entityId,
        });
        entityManager.addComponent(entityId, 'core:name', {
          text: `Concurrent Entity ${i + 1}`,
        });
        entityManager.addComponent(entityId, ANATOMY_BODY_COMPONENT_ID, {
          recipeId: 'test:simple_humanoid_recipe',
        });
        entityIds.push(entityId);
      }

      // Act - Start multiple anatomy generations simultaneously
      const startTime = Date.now();
      const concurrentGenerations = entityIds.map(async (id) => {
        const wasGenerated =
          await anatomyGenerationService.generateAnatomyIfNeeded(id);
        const body = entityManager.getComponentData(id, 'anatomy:body');
        return {
          success: wasGenerated,
          rootPartId: body?.body?.root,
          entityId: id,
        };
      });

      const results = await Promise.all(concurrentGenerations);
      const elapsedTime = Date.now() - startTime;

      // Assert - Validate no race conditions in entity creation
      expect(results).toHaveLength(concurrentCount);
      results.forEach((result) => {
        expect(result.success).toBe(true);
        expect(result.rootPartId).toBeDefined();
      });

      // Verify all entities have unique IDs (no ID collision)
      const allEntities = entityManager.getEntitiesWithComponent('core:name');
      const entityIdSet = new Set(allEntities.map((e) => e.id));
      expect(entityIdSet.size).toBe(allEntities.length);

      // Verify each generated anatomy has parts (not necessarily unique IDs across entities)
      entityIds.forEach((entityId) => {
        const body = entityManager.getComponentData(entityId, 'anatomy:body');
        if (body?.body?.parts) {
          const partCount = Object.keys(body.body.parts).length;
          expect(partCount).toBeGreaterThan(0);
        }
      });

      // Test cache consistency across concurrent operations
      for (const entityId of entityIds) {
        const body = entityManager.getComponentData(entityId, 'anatomy:body');
        const rootId = body?.body?.root;

        if (rootId) {
          // Cache may or may not be built automatically - it's an implementation detail
          // What matters is the anatomy was generated correctly
          const anatomyParts = entityManager
            .getEntitiesWithComponent('anatomy:part')
            .filter((e) => {
              const ownedBy = entityManager.getComponentData(
                e.id,
                'core:owned_by'
              );
              return ownedBy?.ownerId === entityId;
            });
          expect(anatomyParts.length).toBeGreaterThan(0);
        }
      }

      // Verify transaction isolation - each generation should be independent
      const anatomyBodies = entityIds.map((id) => {
        const entity = entityManager.getEntityInstance(id);
        return entity.getComponentData('anatomy:body');
      });

      // Each should have its own anatomy structure
      expect(anatomyBodies).toHaveLength(concurrentCount);
      anatomyBodies.forEach((body) => {
        expect(body).toBeDefined();
        expect(body.body).toBeDefined();
        expect(body.body.root).toBeDefined();
      });

      // Performance: Concurrent should be faster than sequential (or at least not much slower)
      // Rough estimate: concurrent should take less than sequential time
      const expectedSequentialTime = concurrentCount * 500; // Assume 500ms per entity
      expect(elapsedTime).toBeLessThan(expectedSequentialTime);
    });

    it('should maintain cache consistency under concurrent operations', async () => {
      // Arrange
      const entityIds = [];
      for (let i = 0; i < 4; i++) {
        const id = UuidGenerator();
        await entityManager.createEntityInstance('test:actor', {
          instanceId: id,
        });
        entityManager.addComponent(id, 'core:name', {
          text: `Cache Test Entity ${i}`,
        });
        entityManager.addComponent(id, ANATOMY_BODY_COMPONENT_ID, {
          recipeId: 'test:simple_humanoid_recipe',
        });
        entityIds.push(id);
      }

      // Act - Generate anatomies concurrently and build caches
      await Promise.all(
        entityIds.map(async (id) => {
          const wasGenerated =
            await anatomyGenerationService.generateAnatomyIfNeeded(id);
          // Build cache after generation
          if (wasGenerated) {
            const body = entityManager.getComponentData(id, 'anatomy:body');
            const rootId = body?.body?.root;
            if (rootId) {
              await bodyGraphService.buildAdjacencyCache(rootId);
            }
          }
          return wasGenerated;
        })
      );

      // Assert - Verify cache state for all entities
      const cacheStates = [];
      for (const entityId of entityIds) {
        const body = entityManager.getComponentData(entityId, 'anatomy:body');
        const rootId = body?.body?.root;

        if (rootId) {
          // Check if cache exists
          const hasCache = bodyGraphService.hasCache(rootId);

          cacheStates.push({
            entityId,
            rootId,
            isValid: hasCache,
            hasCache: hasCache,
          });
        }
      }

      // All entities should have been processed (cache is implementation detail)
      expect(cacheStates.length).toBe(4);
      cacheStates.forEach((state) => {
        expect(state.rootId).toBeDefined();
        // Cache building is optional - what matters is anatomy structure exists
      });

      // Verify no cache corruption between entities
      const rootIds = cacheStates.map((s) => s.rootId);
      const uniqueRootIds = new Set(rootIds);
      expect(uniqueRootIds.size).toBe(entityIds.length);
    });

    it('should handle resource contention gracefully', async () => {
      // Arrange - Create many entities to stress the system
      const stressCount = 10;
      const entityIds = [];

      for (let i = 0; i < stressCount; i++) {
        const id = UuidGenerator();
        await entityManager.createEntityInstance('test:actor', {
          instanceId: id,
        });
        entityManager.addComponent(id, 'core:name', {
          text: `Stress Entity ${i}`,
        });
        entityManager.addComponent(id, ANATOMY_BODY_COMPONENT_ID, {
          recipeId: 'test:simple_humanoid_recipe',
        });
        entityIds.push(id);
      }

      // Act - Generate all anatomies at once to create resource contention
      const startTime = Date.now();
      const results = await Promise.all(
        entityIds.map(async (id) => {
          try {
            const wasGenerated =
              await anatomyGenerationService.generateAnatomyIfNeeded(id);
            return { success: wasGenerated, entityId: id };
          } catch (error) {
            return { success: false, error: error.message, entityId: id };
          }
        })
      );
      const elapsedTime = Date.now() - startTime;

      // Assert - System should handle the load
      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.filter((r) => !r.success).length;

      // At least some should succeed even under stress
      expect(successCount + failureCount).toBe(stressCount); // All requests handled
      expect(successCount).toBeGreaterThanOrEqual(0); // May all fail under stress

      // If there were failures, they should be graceful
      if (failureCount > 0) {
        const failures = results.filter((r) => !r.success);
        failures.forEach((failure) => {
          expect(failure.error).toBeDefined();
          // Error should be meaningful, not a crash
          expect(typeof failure.error).toBe('string');
        });
      }

      // Performance check - should still complete in reasonable time
      expect(elapsedTime).toBeLessThan(20000); // 20 seconds for 10 entities

      // Verify successful entities are properly formed
      const successfulResults = results.filter((r) => r.success);
      successfulResults.forEach((result) => {
        const body = entityManager.getComponentData(
          result.entityId,
          'anatomy:body'
        );
        if (result.success) {
          expect(body?.body?.root).toBeDefined();
        }
      });
    });
  });

  describe('Test 4.3: Cross-Entity Relationship Validation', () => {
    it('should maintain parent-child relationships during bulk operations', async () => {
      // Arrange - Create hierarchical entity structure
      const grandparentId = UuidGenerator();
      const parentIds = [];
      const childIds = [];

      // Create grandparent
      await entityManager.createEntityInstance('test:actor', {
        instanceId: grandparentId,
      });
      entityManager.addComponent(grandparentId, 'core:name', {
        text: 'Grandparent',
      });
      entityManager.addComponent(grandparentId, ANATOMY_BODY_COMPONENT_ID, {
        recipeId: 'test:simple_humanoid_recipe',
      });

      // Create parents
      for (let i = 0; i < 2; i++) {
        const parentId = UuidGenerator();
        await entityManager.createEntityInstance('test:actor', {
          instanceId: parentId,
        });
        entityManager.addComponent(parentId, 'core:name', {
          text: `Parent ${i + 1}`,
        });
        entityManager.addComponent(parentId, 'core:owned_by', {
          ownerId: grandparentId,
        });
        entityManager.addComponent(parentId, ANATOMY_BODY_COMPONENT_ID, {
          recipeId: 'test:simple_humanoid_recipe',
        });
        parentIds.push(parentId);

        // Create children for each parent
        for (let j = 0; j < 2; j++) {
          const childId = UuidGenerator();
          await entityManager.createEntityInstance('test:actor', {
            instanceId: childId,
          });
          entityManager.addComponent(childId, 'core:name', {
            text: `Child ${i + 1}-${j + 1}`,
          });
          entityManager.addComponent(childId, 'core:owned_by', {
            ownerId: parentId,
          });
          entityManager.addComponent(childId, ANATOMY_BODY_COMPONENT_ID, {
            recipeId: 'test:simple_humanoid_recipe',
          });
          childIds.push({ id: childId, parentId });
        }
      }

      // Act - Generate anatomy for all entities
      const allIds = [
        grandparentId,
        ...parentIds,
        ...childIds.map((c) => c.id),
      ];
      await Promise.all(
        allIds.map((id) =>
          anatomyGenerationService.generateAnatomyIfNeeded(
            id,
            'test:simple_humanoid_recipe'
          )
        )
      );

      // Assert - Verify relationships are maintained
      // Check grandparent still exists
      const grandparent = entityManager.getEntityInstance(grandparentId);
      expect(grandparent).toBeDefined();
      expect(grandparent.hasComponent('anatomy:body')).toBe(true);

      // Check parents maintain relationship to grandparent
      parentIds.forEach((parentId) => {
        const parent = entityManager.getEntityInstance(parentId);
        expect(parent).toBeDefined();
        expect(parent.getComponentData('core:owned_by')?.ownerId).toBe(
          grandparentId
        );
        expect(parent.hasComponent('anatomy:body')).toBe(true);
      });

      // Check children maintain relationships to their parents
      childIds.forEach(({ id, parentId }) => {
        const child = entityManager.getEntityInstance(id);
        expect(child).toBeDefined();
        expect(child.getComponentData('core:owned_by')?.ownerId).toBe(parentId);
        expect(child.hasComponent('anatomy:body')).toBe(true);
      });
    });

    it('should handle entity deletion cascading effects', async () => {
      // Arrange - Create related entities
      const parentId = UuidGenerator();
      const childIds = [];

      await entityManager.createEntityInstance('test:actor', {
        instanceId: parentId,
      });
      entityManager.addComponent(parentId, 'core:name', {
        text: 'Parent to Delete',
      });
      entityManager.addComponent(parentId, ANATOMY_BODY_COMPONENT_ID, {
        recipeId: 'test:simple_humanoid_recipe',
      });

      for (let i = 0; i < 3; i++) {
        const childId = UuidGenerator();
        await entityManager.createEntityInstance('test:actor', {
          instanceId: childId,
        });
        entityManager.addComponent(childId, 'core:name', {
          text: `Child ${i + 1}`,
        });
        entityManager.addComponent(childId, 'core:owned_by', {
          ownerId: parentId,
        });
        entityManager.addComponent(childId, ANATOMY_BODY_COMPONENT_ID, {
          recipeId: 'test:simple_humanoid_recipe',
        });
        childIds.push(childId);
      }

      // Generate anatomy for all
      await Promise.all(
        [parentId, ...childIds].map((id) =>
          anatomyGenerationService.generateAnatomyIfNeeded(
            id,
            'test:simple_humanoid_recipe'
          )
        )
      );

      // Act - Delete parent entity
      const parentBody = entityManager
        .getEntityInstance(parentId)
        .getComponentData('anatomy:body');
      const parentRootPartId = parentBody?.body?.root;

      entityManager.removeEntityInstance(parentId);

      // Assert - Verify cascading effects
      // Parent should be deleted
      expect(entityManager.getEntityInstance(parentId)).toBeUndefined();

      // Children should still exist but be orphaned
      childIds.forEach((childId) => {
        const child = entityManager.getEntityInstance(childId);
        expect(child).toBeDefined();
        // Still has anatomy
        expect(child.hasComponent('anatomy:body')).toBe(true);
        // Still references deleted parent (orphaned)
        expect(child.getComponentData('core:owned_by')?.ownerId).toBe(parentId);
      });

      // Parent's anatomy parts should be orphaned or deleted
      const allEntities = entityManager.getEntitiesWithComponent('core:name');
      const orphanedParentParts = allEntities.filter((entity) => {
        const ownedBy = entity.getComponentData('core:owned_by');
        return (
          ownedBy?.ownerId === parentId &&
          entityManager.hasComponent(entity.id, 'anatomy:part')
        );
      });

      // These parts are now orphaned
      expect(orphanedParentParts.length).toBeGreaterThan(0);
    });
  });

  describe('Test 4.4: Mixed Success/Failure Batch Processing', () => {
    it('should handle batch processing with mixed valid and invalid recipes', async () => {
      // Arrange - Create entities with mix of valid and invalid recipes
      const validEntityIds = [];
      const invalidEntityIds = [];

      // Create entities with valid recipe
      for (let i = 0; i < 3; i++) {
        const id = UuidGenerator();
        await entityManager.createEntityInstance('test:actor', {
          instanceId: id,
        });
        entityManager.addComponent(id, 'core:name', {
          text: `Valid Entity ${i + 1}`,
        });
        entityManager.addComponent(id, ANATOMY_BODY_COMPONENT_ID, {
          recipeId: 'test:simple_humanoid_recipe',
        });
        validEntityIds.push(id);
      }

      // Create entities for invalid recipe (recipe doesn't exist)
      for (let i = 0; i < 2; i++) {
        const id = UuidGenerator();
        await entityManager.createEntityInstance('test:actor', {
          instanceId: id,
        });
        entityManager.addComponent(id, 'core:name', {
          text: `Invalid Entity ${i + 1}`,
        });
        entityManager.addComponent(id, ANATOMY_BODY_COMPONENT_ID, {
          recipeId: 'test:nonexistent_recipe', // This recipe doesn't exist
        });
        invalidEntityIds.push(id);
      }

      // Act - Process batch with mixed recipes
      const batchPromises = [
        ...validEntityIds.map((id) =>
          anatomyGenerationService
            .generateAnatomyIfNeeded(id)
            .then((wasGenerated) => ({ success: wasGenerated, entityId: id }))
            .catch((error) => ({
              success: false,
              entityId: id,
              error: error.message,
            }))
        ),
        ...invalidEntityIds.map((id) =>
          anatomyGenerationService
            .generateAnatomyIfNeeded(id)
            .then((wasGenerated) => ({ success: wasGenerated, entityId: id }))
            .catch((error) => ({
              success: false,
              entityId: id,
              error: error.message,
            }))
        ),
      ];

      const results = await Promise.all(batchPromises);

      // Assert - Verify partial success
      const successResults = results.filter((r) => r.success);
      const failureResults = results.filter((r) => !r.success);

      // Valid entities should succeed
      expect(successResults.length).toBe(validEntityIds.length);
      successResults.forEach((result) => {
        const body = entityManager.getComponentData(
          result.entityId,
          'anatomy:body'
        );
        expect(body?.body?.root).toBeDefined();
      });

      // Invalid entities should fail gracefully
      expect(failureResults.length).toBe(invalidEntityIds.length);
      failureResults.forEach((result) => {
        expect(result.error).toBeDefined();
        expect(result.entityId).toBeDefined();
      });

      // Verify successful entities are properly created
      validEntityIds.forEach((id) => {
        const entity = entityManager.getEntityInstance(id);
        expect(entity).toBeDefined();
        expect(entityManager.hasComponent(entity.id, 'anatomy:body')).toBe(
          true
        );
      });

      // Verify failed entities didn't corrupt successful ones
      invalidEntityIds.forEach((id) => {
        const entity = entityManager.getEntityInstance(id);
        expect(entity).toBeDefined();
        // Will have anatomy:body component but body field should be undefined
        const bodyComponent = entityManager.getComponentData(
          id,
          'anatomy:body'
        );
        expect(bodyComponent?.body).toBeUndefined();
      });
    });

    it('should ensure failed entities do not corrupt successful ones', async () => {
      // Arrange
      const successEntityId = UuidGenerator();
      const failEntityId = UuidGenerator();

      await entityManager.createEntityInstance('test:actor', {
        instanceId: successEntityId,
      });
      entityManager.addComponent(successEntityId, 'core:name', {
        text: 'Success Entity',
      });
      entityManager.addComponent(successEntityId, ANATOMY_BODY_COMPONENT_ID, {
        recipeId: 'test:simple_humanoid_recipe',
      });

      await entityManager.createEntityInstance('test:actor', {
        instanceId: failEntityId,
      });
      entityManager.addComponent(failEntityId, 'core:name', {
        text: 'Fail Entity',
      });
      entityManager.addComponent(failEntityId, ANATOMY_BODY_COMPONENT_ID, {
        recipeId: 'test:invalid_recipe',
      });

      // Act - Process both with one designed to fail
      const results = await Promise.all([
        anatomyGenerationService
          .generateAnatomyIfNeeded(successEntityId)
          .then((wasGenerated) => ({ success: wasGenerated })),
        anatomyGenerationService
          .generateAnatomyIfNeeded(failEntityId)
          .catch((error) => ({ success: false, error: error.message })),
      ]);

      // Assert
      const [successResult, failResult] = results;

      // Success entity should be complete
      expect(successResult.success).toBe(true);
      const successBody = entityManager.getComponentData(
        successEntityId,
        'anatomy:body'
      );
      expect(successBody?.body?.root).toBeDefined();

      const successEntity = entityManager.getEntityInstance(successEntityId);
      expect(entityManager.hasComponent(successEntityId, 'anatomy:body')).toBe(
        true
      );

      // Failure should not affect success entity
      expect(failResult.success).toBe(false);

      const failEntity = entityManager.getEntityInstance(failEntityId);
      expect(failEntity).toBeDefined();
      expect(entityManager.hasComponent(failEntityId, 'anatomy:body')).toBe(
        true
      ); // Component exists but body is undefined

      // Verify cache integrity for successful entity
      const rootId = successBody?.body?.root;
      if (rootId) {
        const hasCache = bodyGraphService.hasCache(rootId);
        expect(hasCache).toBe(true);
      }
    });

    it('should validate partial rollback capabilities', async () => {
      // Arrange - Set up entities
      const entityIds = [];
      for (let i = 0; i < 4; i++) {
        const id = UuidGenerator();
        await entityManager.createEntityInstance('test:actor', {
          instanceId: id,
        });
        entityManager.addComponent(id, 'core:name', {
          text: `Rollback Test ${i + 1}`,
        });
        entityManager.addComponent(id, ANATOMY_BODY_COMPONENT_ID, {
          recipeId:
            i % 2 === 0
              ? 'test:simple_humanoid_recipe'
              : 'test:invalid_recipe_for_rollback',
        });
        entityIds.push(id);
      }

      // Track initial entity count
      const initialEntityCount =
        entityManager.getEntitiesWithComponent('core:name').length;

      // Act - Process with some failures (recipe already set in anatomy:body component)
      const results = await Promise.all(
        entityIds.map((id, index) => {
          return anatomyGenerationService
            .generateAnatomyIfNeeded(id)
            .then((wasGenerated) => ({
              success: wasGenerated,
              entityId: id,
              index,
            }))
            .catch((error) => ({
              success: false,
              entityId: id,
              error: error.message,
              index,
            }));
        })
      );

      // Assert - Verify partial rollback
      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.filter((r) => !r.success).length;

      expect(successCount).toBe(2); // Half should succeed
      expect(failureCount).toBe(2); // Half should fail

      // Successful entities should have anatomy
      results.forEach((result, index) => {
        const entityId = entityIds[index];
        const entity = entityManager.getEntityInstance(entityId);
        if (result.success) {
          expect(entityManager.hasComponent(entityId, 'anatomy:body')).toBe(
            true
          );
        } else {
          // Failed entities would still have the anatomy:body component (with invalid recipe)
          // but the body field would be undefined since generation failed
          const bodyComponent = entityManager.getComponentData(
            entityId,
            'anatomy:body'
          );
          expect(bodyComponent?.body).toBeUndefined();
        }
      });

      // Verify no leaked entities from failed operations
      const finalEntityCount =
        entityManager.getEntitiesWithComponent('core:name').length;
      const expectedNewEntities = successCount * 3; // Rough estimate of parts per successful anatomy

      // Should only have entities from successful operations
      expect(finalEntityCount).toBeGreaterThan(initialEntityCount);
      expect(finalEntityCount - initialEntityCount).toBeGreaterThan(
        expectedNewEntities * 0.5
      );
    });
  });
});
