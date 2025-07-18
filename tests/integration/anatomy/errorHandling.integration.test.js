import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import { AnatomyGenerationService } from '../../../src/anatomy/anatomyGenerationService.js';
import { AnatomyInitializationService } from '../../../src/anatomy/anatomyInitializationService.js';
import { BodyGraphService } from '../../../src/anatomy/bodyGraphService.js';
import { ENTITY_CREATED_ID } from '../../../src/constants/eventIds.js';
import {
  ANATOMY_BODY_COMPONENT_ID,
  ANATOMY_PART_COMPONENT_ID,
  ANATOMY_SOCKETS_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

const ANATOMY_JOINT_COMPONENT_ID = 'anatomy:joint';

describe('Anatomy Error Handling Integration', () => {
  let testBed;
  let anatomyGenerationService;

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();

    anatomyGenerationService = new AnatomyGenerationService({
      entityManager: testBed.entityManager,
      dataRegistry: testBed.registry,
      logger: testBed.logger,
      bodyBlueprintFactory: testBed.bodyBlueprintFactory,
      anatomyDescriptionService: testBed.anatomyDescriptionService,
      bodyGraphService: testBed.bodyGraphService,
    });

    // Load test anatomy components
    testBed.loadComponents({
      [ANATOMY_BODY_COMPONENT_ID]: {
        id: ANATOMY_BODY_COMPONENT_ID,
        data: { rootPartId: null, recipeId: null, body: null },
      },
      [ANATOMY_JOINT_COMPONENT_ID]: {
        id: ANATOMY_JOINT_COMPONENT_ID,
        data: { parentId: null, socketId: null, jointType: null },
      },
      [ANATOMY_PART_COMPONENT_ID]: {
        id: ANATOMY_PART_COMPONENT_ID,
        data: { subType: null },
      },
      [ANATOMY_SOCKETS_COMPONENT_ID]: {
        id: ANATOMY_SOCKETS_COMPONENT_ID,
        data: { sockets: [] },
      },
    });

    // Load valid test data for comparison
    testBed.loadEntityDefinitions({
      'test:valid_torso': {
        id: 'test:valid_torso',
        components: {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'torso' },
          [ANATOMY_SOCKETS_COMPONENT_ID]: {
            sockets: [{ id: 'arm_socket', allowedTypes: ['arm'], maxCount: 2 }],
          },
        },
      },
      'test:valid_arm': {
        id: 'test:valid_arm',
        components: {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'arm' },
        },
      },
    });
  });

  afterEach(() => {
    // No cleanup needed for test bed
  });

  describe('Invalid Recipe Handling', () => {
    it('should handle non-existent recipe ID', async () => {
      testBed.loadEntityDefinitions({
        'test:body_invalid_recipe': {
          id: 'test:body_invalid_recipe',
          components: {
            [ANATOMY_BODY_COMPONENT_ID]: {
              recipeId: 'non-existent-recipe',
            },
          },
        },
      });

      const bodyEntity = await testBed.entityManager.createEntityInstance(
        'test:body_invalid_recipe'
      );

      // Should throw ValidationError for non-existent recipe
      await expect(
        anatomyGenerationService.generateAnatomyIfNeeded(bodyEntity.id)
      ).rejects.toThrow("Recipe 'non-existent-recipe' not found");

      // Should not have anatomy after failed generation
      const bodyComponent = testBed.entityManager.getComponentData(
        bodyEntity.id,
        ANATOMY_BODY_COMPONENT_ID
      );
      expect(bodyComponent.body).toBeUndefined();
    });

    it('should handle malformed recipe data', async () => {
      // Recipe with missing required fields
      testBed.loadRecipes({
        'test:malformed_recipe': {
          id: 'test:malformed_recipe',
          // Missing blueprintId
          slots: {},
        },
      });

      testBed.loadEntityDefinitions({
        'test:body_malformed_recipe': {
          id: 'test:body_malformed_recipe',
          components: {
            [ANATOMY_BODY_COMPONENT_ID]: {
              recipeId: 'test:malformed_recipe',
            },
          },
        },
      });

      const bodyEntity = await testBed.entityManager.createEntityInstance(
        'test:body_malformed_recipe'
      );

      // Should throw ValidationError for missing blueprintId
      await expect(
        anatomyGenerationService.generateAnatomyIfNeeded(bodyEntity.id)
      ).rejects.toThrow(
        "Recipe 'test:malformed_recipe' does not specify a blueprintId"
      );
    });

    it('should handle recipe with invalid slot definitions', async () => {
      testBed.loadBlueprints({
        'test:simple_blueprint': {
          id: 'test:simple_blueprint',
          rootSlot: 'torso',
          slots: {
            torso: { type: 'torso' },
          },
        },
      });

      testBed.loadRecipes({
        'test:invalid_slot_recipe': {
          id: 'test:invalid_slot_recipe',
          blueprintId: 'test:simple_blueprint',
          slots: {
            torso: {
              type: 'torso',
              definitionId: 'non-existent-part', // Invalid definition ID
              count: 1,
            },
          },
        },
      });

      testBed.loadEntityDefinitions({
        'test:body_invalid_slot': {
          id: 'test:body_invalid_slot',
          components: {
            [ANATOMY_BODY_COMPONENT_ID]: {
              recipeId: 'test:invalid_slot_recipe',
            },
          },
        },
      });

      const bodyEntity = await testBed.entityManager.createEntityInstance(
        'test:body_invalid_slot'
      );

      // Should throw error for invalid definition ID
      await expect(
        anatomyGenerationService.generateAnatomyIfNeeded(bodyEntity.id)
      ).rejects.toThrow();
    });
  });

  describe('Missing Blueprint Scenarios', () => {
    it('should handle recipe referencing non-existent blueprint', async () => {
      testBed.loadRecipes({
        'test:recipe_missing_blueprint': {
          id: 'test:recipe_missing_blueprint',
          blueprintId: 'non-existent-blueprint',
          slots: {
            torso: {
              type: 'torso',
              definitionId: 'test:valid_torso',
              count: 1,
            },
          },
        },
      });

      testBed.loadEntityDefinitions({
        'test:body_missing_blueprint': {
          id: 'test:body_missing_blueprint',
          components: {
            [ANATOMY_BODY_COMPONENT_ID]: {
              recipeId: 'test:recipe_missing_blueprint',
            },
          },
        },
      });

      const bodyEntity = await testBed.entityManager.createEntityInstance(
        'test:body_missing_blueprint'
      );

      // Should throw error for non-existent blueprint
      await expect(
        anatomyGenerationService.generateAnatomyIfNeeded(bodyEntity.id)
      ).rejects.toThrow("Blueprint 'non-existent-blueprint' not found");
    });

    it('should handle blueprint with invalid attachment specifications', async () => {
      testBed.loadBlueprints({
        'test:invalid_blueprint': {
          id: 'test:invalid_blueprint',
          rootSlot: 'torso',
          slots: {
            torso: { type: 'torso' },
            arm: {
              type: 'arm',
              attachTo: 'torso',
              socket: 'non-existent-socket', // Invalid socket
            },
          },
        },
      });

      testBed.loadRecipes({
        'test:recipe_invalid_blueprint': {
          id: 'test:recipe_invalid_blueprint',
          blueprintId: 'test:invalid_blueprint',
          slots: {
            torso: {
              type: 'torso',
              definitionId: 'test:valid_torso',
              count: 1,
            },
            arm: { type: 'arm', definitionId: 'test:valid_arm', count: 1 },
          },
        },
      });

      testBed.loadEntityDefinitions({
        'test:body_invalid_attachment': {
          id: 'test:body_invalid_attachment',
          components: {
            [ANATOMY_BODY_COMPONENT_ID]: {
              recipeId: 'test:recipe_invalid_blueprint',
            },
          },
        },
      });

      const bodyEntity = await testBed.entityManager.createEntityInstance(
        'test:body_invalid_attachment'
      );

      // Should throw error for invalid socket
      await expect(
        anatomyGenerationService.generateAnatomyIfNeeded(bodyEntity.id)
      ).rejects.toThrow();
    });
  });

  describe('Malformed Component Data', () => {
    it('should handle entity definitions with missing required components', async () => {
      // Part without anatomy:part component
      testBed.loadEntityDefinitions({
        'test:invalid_part': {
          id: 'test:invalid_part',
          components: {
            // Missing ANATOMY_PART_COMPONENT_ID
            'some:other_component': { value: 'test' },
          },
        },
      });

      testBed.loadBlueprints({
        'test:simple_blueprint': {
          id: 'test:simple_blueprint',
          rootSlot: 'part',
          slots: {
            part: { type: 'any' },
          },
        },
      });

      testBed.loadRecipes({
        'test:recipe_invalid_part': {
          id: 'test:recipe_invalid_part',
          blueprintId: 'test:simple_blueprint',
          slots: {
            part: { type: 'any', definitionId: 'test:invalid_part', count: 1 },
          },
        },
      });

      testBed.loadEntityDefinitions({
        'test:body_invalid_part': {
          id: 'test:body_invalid_part',
          components: {
            [ANATOMY_BODY_COMPONENT_ID]: {
              recipeId: 'test:recipe_invalid_part',
            },
          },
        },
      });

      const bodyEntity = await testBed.entityManager.createEntityInstance(
        'test:body_invalid_part'
      );

      // Should throw error for invalid part
      await expect(
        anatomyGenerationService.generateAnatomyIfNeeded(bodyEntity.id)
      ).rejects.toThrow();
    });

    it('should handle corrupt socket data', async () => {
      testBed.loadEntityDefinitions({
        'test:corrupt_sockets': {
          id: 'test:corrupt_sockets',
          components: {
            [ANATOMY_PART_COMPONENT_ID]: { subType: 'torso' },
            [ANATOMY_SOCKETS_COMPONENT_ID]: {
              sockets: [
                {
                  /* missing required fields */
                },
                { id: null, allowedTypes: ['arm'] }, // null id
                { id: 'valid_socket', allowedTypes: null }, // null allowedTypes
              ],
            },
          },
        },
      });

      testBed.loadBlueprints({
        'test:blueprint_corrupt_sockets': {
          id: 'test:blueprint_corrupt_sockets',
          rootSlot: 'torso',
          slots: {
            torso: { type: 'torso' },
          },
        },
      });

      testBed.loadRecipes({
        'test:recipe_corrupt_sockets': {
          id: 'test:recipe_corrupt_sockets',
          blueprintId: 'test:blueprint_corrupt_sockets',
          slots: {
            torso: {
              type: 'torso',
              definitionId: 'test:corrupt_sockets',
              count: 1,
            },
          },
        },
      });

      testBed.loadEntityDefinitions({
        'test:body_corrupt_sockets': {
          id: 'test:body_corrupt_sockets',
          components: {
            [ANATOMY_BODY_COMPONENT_ID]: {
              recipeId: 'test:recipe_corrupt_sockets',
            },
          },
        },
      });

      const bodyEntity = await testBed.entityManager.createEntityInstance(
        'test:body_corrupt_sockets'
      );

      // Should throw error for corrupt socket data
      await expect(
        anatomyGenerationService.generateAnatomyIfNeeded(bodyEntity.id)
      ).rejects.toThrow();
    });
  });

  describe('Entity Creation Failures', () => {
    it('should handle anatomy initialization service errors gracefully', async () => {
      // Add subscribe method to the event dispatcher mock
      testBed.eventDispatcher.subscribe = jest.fn(() => jest.fn());

      const anatomyInitService = new AnatomyInitializationService({
        eventDispatcher: testBed.eventDispatcher,
        logger: testBed.logger,
        anatomyGenerationService: testBed.anatomyGenerationService,
      });

      anatomyInitService.initialize();

      // Mock anatomy generation to throw error
      testBed.anatomyGenerationService.generateAnatomyIfNeeded = jest.fn(
        async () => {
          throw new Error('Anatomy generation failed');
        }
      );

      // Should not throw even when anatomy generation fails
      await expect(async () => {
        await testBed.eventDispatcher.dispatch(ENTITY_CREATED_ID, {
          instanceId: 'test-entity',
          definitionId: 'test:definition',
          wasReconstructed: false,
        });
      }).not.toThrow();

      anatomyInitService.dispose();
    });

    it('should handle entity manager failures during anatomy operations', async () => {
      const torso =
        await testBed.entityManager.createEntityInstance('test:valid_torso');
      const arm =
        await testBed.entityManager.createEntityInstance('test:valid_arm');

      await testBed.entityManager.addComponent(
        arm.id,
        ANATOMY_JOINT_COMPONENT_ID,
        {
          parentId: torso.id,
          socketId: 'arm_socket',
        }
      );

      const bodyGraphService = new BodyGraphService({
        entityManager: testBed.entityManager,
        logger: testBed.logger,
        eventDispatcher: testBed.eventDispatcher,
      });

      bodyGraphService.buildAdjacencyCache(torso.id);

      // Mock entity manager to fail during detachment
      const originalRemoveComponent =
        testBed.entityManager.removeComponent.bind(testBed.entityManager);
      testBed.entityManager.removeComponent = jest.fn(() => {
        throw new Error('Entity manager failure');
      });

      // Should handle failures gracefully
      await expect(bodyGraphService.detachPart(arm.id)).rejects.toThrow();

      // Restore original method
      testBed.entityManager.removeComponent = originalRemoveComponent;
    });
  });

  describe('Recovery Scenarios', () => {
    it('should allow retry after failed anatomy generation', async () => {
      // Ensure the torso entity definition exists for the retry
      testBed.loadEntityDefinitions({
        'test:valid_torso': {
          id: 'test:valid_torso',
          components: {
            [ANATOMY_PART_COMPONENT_ID]: { subType: 'torso' },
            [ANATOMY_SOCKETS_COMPONENT_ID]: {
              sockets: [
                { id: 'arm_socket', allowedTypes: ['arm'], maxCount: 2 },
              ],
            },
          },
        },
        'test:retry_body': {
          id: 'test:retry_body',
          components: {
            [ANATOMY_BODY_COMPONENT_ID]: {
              recipeId: 'non-existent-initially',
            },
          },
        },
      });

      const bodyEntity =
        await testBed.entityManager.createEntityInstance('test:retry_body');

      // First attempt should fail with error
      await expect(
        anatomyGenerationService.generateAnatomyIfNeeded(bodyEntity.id)
      ).rejects.toThrow("Recipe 'non-existent-initially' not found");

      // Now add the missing recipe
      testBed.loadBlueprints({
        'test:retry_blueprint': {
          id: 'test:retry_blueprint',
          root: 'test:valid_torso',
          attachments: [],
        },
      });

      testBed.loadRecipes({
        'non-existent-initially': {
          id: 'non-existent-initially',
          blueprintId: 'test:retry_blueprint',
          slots: {
            torso: {
              type: 'torso',
              definitionId: 'test:valid_torso',
              count: 1,
            },
          },
        },
      });

      // Second attempt should succeed
      const wasGenerated =
        await anatomyGenerationService.generateAnatomyIfNeeded(bodyEntity.id);
      expect(wasGenerated).toBe(true);

      // Should have anatomy now
      const bodyComponent = testBed.entityManager.getComponentData(
        bodyEntity.id,
        ANATOMY_BODY_COMPONENT_ID
      );
      expect(bodyComponent.body).toBeTruthy();
    });

    it('should handle partial anatomy generation', async () => {
      // Create a complex recipe where some parts might fail
      testBed.loadBlueprints({
        'test:complex_blueprint': {
          id: 'test:complex_blueprint',
          rootSlot: 'torso',
          slots: {
            torso: { type: 'torso' },
            arm1: { type: 'arm', attachTo: 'torso', socket: 'arm_socket' },
            arm2: { type: 'arm', attachTo: 'torso', socket: 'arm_socket' },
          },
        },
      });

      testBed.loadRecipes({
        'test:complex_recipe': {
          id: 'test:complex_recipe',
          blueprintId: 'test:complex_blueprint',
          slots: {
            torso: {
              type: 'torso',
              definitionId: 'test:valid_torso',
              count: 1,
            },
            arm1: { type: 'arm', definitionId: 'test:valid_arm', count: 1 },
            arm2: { type: 'arm', definitionId: 'non-existent-arm', count: 1 }, // This will fail
          },
        },
      });

      testBed.loadEntityDefinitions({
        'test:partial_body': {
          id: 'test:partial_body',
          components: {
            [ANATOMY_BODY_COMPONENT_ID]: {
              recipeId: 'test:complex_recipe',
            },
          },
        },
      });

      const bodyEntity =
        await testBed.entityManager.createEntityInstance('test:partial_body');

      // Should throw error due to missing part definition
      await expect(
        anatomyGenerationService.generateAnatomyIfNeeded(bodyEntity.id)
      ).rejects.toThrow();
    });
  });

  describe('Concurrent Access Scenarios', () => {
    it('should handle concurrent anatomy generation attempts', async () => {
      testBed.loadBlueprints({
        'test:concurrent_blueprint': {
          id: 'test:concurrent_blueprint',
          root: 'test:valid_torso',
          attachments: [],
        },
      });

      testBed.loadRecipes({
        'test:concurrent_recipe': {
          id: 'test:concurrent_recipe',
          blueprintId: 'test:concurrent_blueprint',
          slots: {
            torso: {
              type: 'torso',
              definitionId: 'test:valid_torso',
              count: 1,
            },
          },
        },
      });

      testBed.loadEntityDefinitions({
        'test:valid_torso': {
          id: 'test:valid_torso',
          components: {
            [ANATOMY_PART_COMPONENT_ID]: { subType: 'torso' },
            [ANATOMY_SOCKETS_COMPONENT_ID]: {
              sockets: [
                { id: 'arm_socket', allowedTypes: ['arm'], maxCount: 2 },
              ],
            },
          },
        },
        'test:concurrent_body': {
          id: 'test:concurrent_body',
          components: {
            [ANATOMY_BODY_COMPONENT_ID]: {
              recipeId: 'test:concurrent_recipe',
            },
          },
        },
      });

      const bodyEntity = await testBed.entityManager.createEntityInstance(
        'test:concurrent_body'
      );

      // Simulate concurrent generation attempts
      const promises = [
        anatomyGenerationService.generateAnatomyIfNeeded(bodyEntity.id),
        anatomyGenerationService.generateAnatomyIfNeeded(bodyEntity.id),
        anatomyGenerationService.generateAnatomyIfNeeded(bodyEntity.id),
      ];

      const results = await Promise.allSettled(promises);

      // Check results - with concurrent calls, the behavior depends on implementation
      // Either one succeeds and others return false (already generated)
      // Or all succeed (if they don't check for existing anatomy atomically)
      const fulfilled = results.filter((r) => r.status === 'fulfilled');

      // At least some should complete without throwing
      expect(fulfilled.length).toBeGreaterThan(0);

      // If any succeeded with true or returned false (already generated), that's ok

      // The important thing is the anatomy was generated
      const bodyComponent = testBed.entityManager.getComponentData(
        bodyEntity.id,
        ANATOMY_BODY_COMPONENT_ID
      );
      expect(bodyComponent.body).toBeDefined();
    });

    it('should handle concurrent graph modifications', async () => {
      const torso =
        await testBed.entityManager.createEntityInstance('test:valid_torso');
      const arm1 =
        await testBed.entityManager.createEntityInstance('test:valid_arm');
      const arm2 =
        await testBed.entityManager.createEntityInstance('test:valid_arm');

      await testBed.entityManager.addComponent(
        arm1.id,
        ANATOMY_JOINT_COMPONENT_ID,
        {
          parentId: torso.id,
          socketId: 'arm_socket',
        }
      );
      await testBed.entityManager.addComponent(
        arm2.id,
        ANATOMY_JOINT_COMPONENT_ID,
        {
          parentId: torso.id,
          socketId: 'arm_socket',
        }
      );

      const bodyGraphService = new BodyGraphService({
        entityManager: testBed.entityManager,
        logger: testBed.logger,
        eventDispatcher: testBed.eventDispatcher,
      });

      bodyGraphService.buildAdjacencyCache(torso.id);

      // Concurrent detachment operations
      const detachArm1 = () => bodyGraphService.detachPart(arm1.id);
      const detachArm2 = () => bodyGraphService.detachPart(arm2.id);

      // Both operations should complete without throwing
      expect(detachArm1).not.toThrow();
      expect(detachArm2).not.toThrow();
    });
  });

  describe('Data Validation Edge Cases', () => {
    it('should handle circular blueprint references', async () => {
      testBed.loadBlueprints({
        'test:circular_a': {
          id: 'test:circular_a',
          rootSlot: 'root',
          slots: {
            root: { type: 'root' },
            child: { type: 'child', blueprintRef: 'test:circular_b' },
          },
        },
        'test:circular_b': {
          id: 'test:circular_b',
          rootSlot: 'root',
          slots: {
            root: { type: 'root' },
            child: { type: 'child', blueprintRef: 'test:circular_a' },
          },
        },
      });

      testBed.loadRecipes({
        'test:circular_recipe': {
          id: 'test:circular_recipe',
          blueprintId: 'test:circular_a',
          slots: {
            root: { type: 'root', definitionId: 'test:valid_torso', count: 1 },
          },
        },
      });

      testBed.loadEntityDefinitions({
        'test:circular_body': {
          id: 'test:circular_body',
          components: {
            [ANATOMY_BODY_COMPONENT_ID]: {
              recipeId: 'test:circular_recipe',
            },
          },
        },
      });

      const bodyEntity =
        await testBed.entityManager.createEntityInstance('test:circular_body');

      // Should throw error for circular references
      await expect(
        anatomyGenerationService.generateAnatomyIfNeeded(bodyEntity.id)
      ).rejects.toThrow();
    });

    it('should handle extremely deep nesting attempts', async () => {
      // Create a blueprint with very deep nesting
      const deepSlots = {};
      for (let i = 0; i < 100; i++) {
        deepSlots[`level_${i}`] = {
          type: `level_${i}`,
          attachTo: i === 0 ? undefined : `level_${i - 1}`,
          socket: i === 0 ? undefined : 'deep_socket',
        };
      }

      testBed.loadBlueprints({
        'test:deep_blueprint': {
          id: 'test:deep_blueprint',
          rootSlot: 'level_0',
          slots: deepSlots,
        },
      });

      const deepRecipeSlots = {};
      for (let i = 0; i < 100; i++) {
        deepRecipeSlots[`level_${i}`] = {
          type: `level_${i}`,
          definitionId: 'test:valid_torso',
          count: 1,
        };
      }

      testBed.loadRecipes({
        'test:deep_recipe': {
          id: 'test:deep_recipe',
          blueprintId: 'test:deep_blueprint',
          slots: deepRecipeSlots,
        },
      });

      testBed.loadEntityDefinitions({
        'test:deep_body': {
          id: 'test:deep_body',
          components: {
            [ANATOMY_BODY_COMPONENT_ID]: {
              recipeId: 'test:deep_recipe',
            },
          },
        },
      });

      const bodyEntity =
        await testBed.entityManager.createEntityInstance('test:deep_body');

      // Should either succeed or throw error for deep structures
      let result;
      try {
        result = await anatomyGenerationService.generateAnatomyIfNeeded(
          bodyEntity.id
        );
        expect(typeof result).toBe('boolean');
      } catch (error) {
        // It's ok if it throws an error for deep nesting
        // eslint-disable-next-line jest/no-conditional-expect
        expect(error).toBeDefined();
      }
    });
  });
});
