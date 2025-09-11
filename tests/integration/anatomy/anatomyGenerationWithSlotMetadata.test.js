/**
 * @file Integration test for anatomy generation with slot metadata component
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';

describe('Anatomy Generation with Slot Metadata', () => {
  let testBed;

  beforeEach(async () => {
    testBed = new AnatomyIntegrationTestBed();
    await testBed.setup();
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  /**
   * Helper to create an actor with generated anatomy
   *
   * @param {string} recipeId - The anatomy recipe ID to use for generation
   * @returns {Promise<{actor: object, actorId: string}>} Actor object and ID
   */
  async function createActorWithGeneratedAnatomy(recipeId) {
    const actor = await testBed.createActor({ recipeId });
    const actorId = actor.id;

    // Generate anatomy
    await testBed.anatomyGenerationService.generateAnatomyIfNeeded(actorId);

    return { actor, actorId };
  }

  describe('Slot metadata component creation', () => {
    it('should create clothing:slot_metadata component during anatomy generation', async () => {
      // Create an actor with generated anatomy
      const { actorId } = await createActorWithGeneratedAnatomy(
        'anatomy:human_female_balanced'
      );

      // Verify the entity has the slot metadata component
      const entity = testBed.entityManager.getEntityInstance(actorId);
      expect(entity.hasComponent('clothing:slot_metadata')).toBe(true);

      // Get the component data
      const slotMetadata = entity.getComponentData('clothing:slot_metadata');
      expect(slotMetadata).toBeDefined();
      expect(slotMetadata.slotMappings).toBeDefined();
    });

    it('should populate slot metadata with correct socket mappings from blueprint', async () => {
      // Create an entity with female anatomy
      const { actorId } = await createActorWithGeneratedAnatomy(
        'anatomy:human_female_balanced'
      );

      // Get the slot metadata
      const slotMetadata = testBed.entityManager.getComponentData(
        actorId,
        'clothing:slot_metadata'
      );

      // Verify torso_upper mapping exists and has correct sockets
      expect(slotMetadata.slotMappings.torso_upper).toBeDefined();
      expect(slotMetadata.slotMappings.torso_upper.coveredSockets).toContain(
        'left_breast'
      );
      expect(slotMetadata.slotMappings.torso_upper.coveredSockets).toContain(
        'right_breast'
      );
      expect(slotMetadata.slotMappings.torso_upper.coveredSockets).toContain(
        'left_chest'
      );
      expect(slotMetadata.slotMappings.torso_upper.coveredSockets).toContain(
        'right_chest'
      );
      expect(slotMetadata.slotMappings.torso_upper.coveredSockets).toContain(
        'chest_center'
      );

      // Verify torso_lower mapping for female-specific sockets
      expect(slotMetadata.slotMappings.torso_lower).toBeDefined();
      expect(slotMetadata.slotMappings.torso_lower.coveredSockets).toContain(
        'vagina'
      );
      expect(slotMetadata.slotMappings.torso_lower.coveredSockets).toContain(
        'pubic_hair'
      );
      expect(slotMetadata.slotMappings.torso_lower.coveredSockets).toContain(
        'left_hip'
      );
      expect(slotMetadata.slotMappings.torso_lower.coveredSockets).toContain(
        'right_hip'
      );
      // Verify ass-related sockets are covered by torso_lower
      expect(slotMetadata.slotMappings.torso_lower.coveredSockets).toContain(
        'asshole'
      );
      expect(slotMetadata.slotMappings.torso_lower.coveredSockets).toContain(
        'left_ass'
      );
      expect(slotMetadata.slotMappings.torso_lower.coveredSockets).toContain(
        'right_ass'
      );
    });

    it('should include allowed layers in slot metadata', async () => {
      const { actorId } = await createActorWithGeneratedAnatomy(
        'anatomy:human_female_balanced'
      );

      const slotMetadata = testBed.entityManager.getComponentData(
        actorId,
        'clothing:slot_metadata'
      );

      // Check allowed layers for torso_upper
      expect(slotMetadata.slotMappings.torso_upper.allowedLayers).toBeDefined();
      expect(slotMetadata.slotMappings.torso_upper.allowedLayers).toContain(
        'underwear'
      );
      expect(slotMetadata.slotMappings.torso_upper.allowedLayers).toContain(
        'base'
      );
      expect(slotMetadata.slotMappings.torso_upper.allowedLayers).toContain(
        'outer'
      );
      expect(slotMetadata.slotMappings.torso_upper.allowedLayers).toContain(
        'armor'
      );
    });

    it('should create different slot metadata for male anatomy', async () => {
      // Create an entity with male anatomy
      const { actorId } = await createActorWithGeneratedAnatomy(
        'anatomy:human_male_balanced'
      );

      const slotMetadata = testBed.entityManager.getComponentData(
        actorId,
        'clothing:slot_metadata'
      );

      // Verify male-specific mappings
      expect(slotMetadata.slotMappings.torso_lower).toBeDefined();
      expect(slotMetadata.slotMappings.torso_lower.coveredSockets).toContain(
        'penis'
      );
      expect(slotMetadata.slotMappings.torso_lower.coveredSockets).toContain(
        'left_testicle'
      );
      expect(slotMetadata.slotMappings.torso_lower.coveredSockets).toContain(
        'right_testicle'
      );
      // Verify ass-related sockets are also covered for males
      expect(slotMetadata.slotMappings.torso_lower.coveredSockets).toContain(
        'asshole'
      );
      expect(slotMetadata.slotMappings.torso_lower.coveredSockets).toContain(
        'left_ass'
      );
      expect(slotMetadata.slotMappings.torso_lower.coveredSockets).toContain(
        'right_ass'
      );
    });

    it('should only include slots with anatomySockets in metadata', async () => {
      const { actorId } = await createActorWithGeneratedAnatomy(
        'anatomy:human_female_balanced'
      );

      const slotMetadata = testBed.entityManager.getComponentData(
        actorId,
        'clothing:slot_metadata'
      );

      // Slots that only have blueprintSlots (like full_body, legs) should not be included
      // because they don't directly map to anatomy sockets for coverage
      expect(slotMetadata.slotMappings.full_body).toBeUndefined();
      expect(slotMetadata.slotMappings.legs).toBeUndefined();

      // But slots with anatomySockets should be included
      expect(slotMetadata.slotMappings.torso_upper).toBeDefined();
      expect(slotMetadata.slotMappings.torso_lower).toBeDefined();
      expect(slotMetadata.slotMappings.back_accessory).toBeDefined();
    });

    it('should handle anatomy without clothing slot mappings', async () => {
      // Create a test entity definition for the root
      const testRootDef = {
        id: 'test:simple_torso',
        description: 'Simple test torso without clothing mappings',
        components: {
          'anatomy:part': {
            subType: 'torso',
          },
          'core:name': {
            text: 'simple torso',
          },
        },
      };

      // Load the test entity definition
      testBed.loadEntityDefinitions({
        'test:simple_torso': testRootDef,
      });

      // Create a test blueprint without clothingSlotMappings
      const testBlueprint = {
        id: 'test:no_clothing_slots',
        root: 'test:simple_torso',
        slots: {},
      };

      // Register the test blueprint
      testBed.registry.store(
        'anatomyBlueprints',
        testBlueprint.id,
        testBlueprint
      );

      // Create a test recipe
      const testRecipe = {
        id: 'test:no_clothing_recipe',
        recipeId: 'test:no_clothing_recipe',
        blueprintId: testBlueprint.id,
        slots: {
          torso: {
            partType: 'torso',
            preferId: 'test:simple_torso',
          },
        },
        patterns: [],
      };

      testBed.registry.store('anatomyRecipes', testRecipe.id, testRecipe);

      // Create entity with this anatomy - note we use createActor, not createEntityInstance
      const { actorId } = await createActorWithGeneratedAnatomy(testRecipe.id);

      // Entity should not have slot metadata component if blueprint has no mappings
      const entity = testBed.entityManager.getEntityInstance(actorId);
      expect(entity.hasComponent('clothing:slot_metadata')).toBe(false);
    });
  });

  describe('Integration with isSocketCoveredOperator', () => {
    it('should work with isSocketCoveredOperator after generation', async () => {
      // Create entity with anatomy
      const { actorId } = await createActorWithGeneratedAnatomy(
        'anatomy:human_female_balanced'
      );

      // Add equipment component
      await testBed.entityManager.addComponent(actorId, 'clothing:equipment', {
        equipped: {
          torso_upper: {
            base: 'some_shirt_id',
          },
        },
      });

      // Get the isSocketCoveredOperator from the logic registry
      const logicRegistry = testBed.container.get('ILogicRegistry');
      const isSocketCoveredOp =
        logicRegistry.getCustomOperator('isSocketCovered');

      // Test that covered sockets return true
      const context = { entity: actorId };
      expect(
        isSocketCoveredOp.evaluate(['entity', 'left_breast'], context)
      ).toBe(true);
      expect(
        isSocketCoveredOp.evaluate(['entity', 'right_breast'], context)
      ).toBe(true);
      expect(
        isSocketCoveredOp.evaluate(['entity', 'chest_center'], context)
      ).toBe(true);

      // Test that uncovered sockets return false
      expect(isSocketCoveredOp.evaluate(['entity', 'vagina'], context)).toBe(
        false
      );
    });

    it('should handle cache correctly across multiple checks', async () => {
      const { actorId } = await createActorWithGeneratedAnatomy(
        'anatomy:human_female_balanced'
      );

      const logicRegistry = testBed.container.get('ILogicRegistry');
      const isSocketCoveredOp =
        logicRegistry.getCustomOperator('isSocketCovered');
      const context = { entity: actorId };

      // First check should populate cache
      expect(
        isSocketCoveredOp.evaluate(['entity', 'left_breast'], context)
      ).toBe(false);

      // Second check should use cache (we can't directly test this, but it should be faster)
      expect(
        isSocketCoveredOp.evaluate(['entity', 'left_breast'], context)
      ).toBe(false);

      // Clear cache and check again
      isSocketCoveredOp.clearCache(actorId);
      expect(
        isSocketCoveredOp.evaluate(['entity', 'left_breast'], context)
      ).toBe(false);
    });
  });

  describe('Regression tests', () => {
    it('should generate back_accessory with "accessory" layer without validation errors', async () => {
      // This is a regression test for the schema mismatch issue where
      // blueprint data contained "accessory" but schema expected "accessories"
      const { actorId } = await createActorWithGeneratedAnatomy(
        'anatomy:human_female_balanced'
      );

      // Verify entity has the slot metadata component
      const entity = testBed.entityManager.getEntityInstance(actorId);
      expect(entity.hasComponent('clothing:slot_metadata')).toBe(true);

      // Get the component data
      const slotMetadata = entity.getComponentData('clothing:slot_metadata');
      expect(slotMetadata).toBeDefined();
      expect(slotMetadata.slotMappings).toBeDefined();

      // Verify back_accessory slot exists and has correct accessory layer
      expect(slotMetadata.slotMappings.back_accessory).toBeDefined();
      expect(slotMetadata.slotMappings.back_accessory.allowedLayers).toContain(
        'accessory'
      );
      expect(slotMetadata.slotMappings.back_accessory.allowedLayers).toContain(
        'armor'
      );

      // Verify covered sockets
      expect(slotMetadata.slotMappings.back_accessory.coveredSockets).toContain(
        'upper_back'
      );
      expect(slotMetadata.slotMappings.back_accessory.coveredSockets).toContain(
        'lower_back'
      );
    });
  });
});
