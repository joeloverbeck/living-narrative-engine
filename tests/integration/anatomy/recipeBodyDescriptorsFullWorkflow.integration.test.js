/**
 * @file Integration test for recipe bodyDescriptors through full workflow
 * @description Tests the COMPLETE flow: recipe with bodyDescriptors → AnatomyGenerationWorkflow → BodyDescriptionComposer
 * This test ensures that bodyDescriptors in recipes actually appear in generated descriptions
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';

describe('Recipe BodyDescriptors Full Workflow Integration', () => {
  let testBed;

  beforeEach(async () => {
    testBed = new AnatomyIntegrationTestBed();
    await testBed.setup();
  });

  afterEach(async () => {
    if (testBed && typeof testBed.cleanup === 'function') {
      await testBed.cleanup();
    }
  });

  describe('Full workflow from recipe to description', () => {
    it('should include skinColor and smell from recipe in generated description', async () => {
      // Create a test recipe with bodyDescriptors including skinColor and smell
      const recipeData = {
        recipeId: 'test:full_workflow_recipe',
        blueprintId: 'anatomy:human_male',
        bodyDescriptors: {
          height: 'gigantic',
          build: 'hulking',
          composition: 'lean',
          skinColor: 'fair',
          smell: 'musky',
        },
        slots: {
          torso: {
            partType: 'torso',
            preferId: 'anatomy:human_male_torso',
          },
          head: {
            partType: 'head',
            preferId: 'anatomy:humanoid_head',
          },
        },
        patterns: [
          {
            matches: ['left_arm', 'right_arm'],
            partType: 'arm',
            preferId: 'anatomy:humanoid_arm',
          },
          {
            matches: ['left_leg', 'right_leg'],
            partType: 'leg',
            preferId: 'anatomy:human_leg',
          },
        ],
      };

      // Register the recipe
      testBed.loadRecipes({
        'test:full_workflow_recipe': recipeData,
      });

      // Create an actor using the recipe
      const actorId = await testBed.createCharacterFromRecipe(
        'test:full_workflow_recipe'
      );

      // Get the entity
      const entity = testBed.entityManager.getEntityInstance(actorId);
      expect(entity).toBeDefined();

      // Verify the anatomy:body component has the bodyDescriptors
      const bodyComponent = entity.getComponentData('anatomy:body');
      expect(bodyComponent).toBeDefined();
      expect(bodyComponent.body).toBeDefined();

      // Debug: log the actual component structure
      // eslint-disable-next-line no-console
      console.log(
        'ACTUAL anatomy:body component:',
        JSON.stringify(bodyComponent, null, 2)
      );

      expect(bodyComponent.body.descriptors).toBeDefined();

      // THIS IS THE KEY ASSERTION - descriptors should be in the body component
      expect(bodyComponent.body.descriptors).toEqual({
        height: 'gigantic',
        build: 'hulking',
        composition: 'lean',
        skinColor: 'fair',
        smell: 'musky',
      });

      // Generate the description
      const description =
        await testBed.bodyDescriptionComposer.composeDescription(entity);

      // Verify all bodyDescriptors appear in the description
      expect(description).toContain('Height: gigantic');
      expect(description).toContain('Build: hulking');
      expect(description).toContain('Body composition: lean');
      expect(description).toContain('Skin color: fair'); // THIS IS THE MISSING PIECE
      expect(description).toContain('Smell: musky'); // THIS IS THE MISSING PIECE
    });

    it('should handle recipe with all supported bodyDescriptors', async () => {
      const recipeData = {
        recipeId: 'test:all_descriptors_recipe',
        blueprintId: 'anatomy:human_male',
        bodyDescriptors: {
          height: 'average',
          build: 'athletic',
          composition: 'lean',
          hairDensity: 'sparse',
          skinColor: 'bronze',
          smell: 'fresh',
        },
        slots: {
          torso: {
            partType: 'torso',
            preferId: 'anatomy:human_male_torso',
          },
        },
      };

      testBed.loadRecipes({
        'test:all_descriptors_recipe': recipeData,
      });

      const actorId = await testBed.createCharacterFromRecipe(
        'test:all_descriptors_recipe'
      );

      const entity = testBed.entityManager.getEntityInstance(actorId);
      const description =
        await testBed.bodyDescriptionComposer.composeDescription(entity);

      // All descriptors should appear
      expect(description).toContain('Height: average');
      expect(description).toContain('Build: athletic');
      expect(description).toContain('Body composition: lean');
      expect(description).toContain('Body hair: sparse');
      expect(description).toContain('Skin color: bronze');
      expect(description).toContain('Smell: fresh');
    });
  });
});
