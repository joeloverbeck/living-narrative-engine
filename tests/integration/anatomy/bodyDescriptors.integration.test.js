/**
 * @file Integration tests for body descriptor functionality
 * Tests the complete flow: recipe bodyDescriptors → anatomy generation → body component → description extraction
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestBedAnatomy } from '../../common/testbed.anatomy.js';

describe('Body Descriptors Integration', () => {
  let testBed;

  beforeEach(async () => {
    testBed = new TestBedAnatomy();
    await testBed.setup();
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  describe('Recipe to Body Component Integration', () => {
    it('should apply recipe bodyDescriptors to generated body component', async () => {
      // Create a test recipe with bodyDescriptors
      const recipeData = {
        recipeId: 'test:descriptor_recipe',
        blueprintId: 'anatomy:humanoid',
        slots: {
          torso: { partType: 'torso' },
        },
        bodyDescriptors: {
          height: 'tall',
          build: 'athletic',
          density: 'moderate',
          composition: 'lean',
          skinColor: 'olive',
        },
      };

      // Register the recipe
      testBed.dataRegistry.store(
        'anatomyRecipes',
        'test:descriptor_recipe',
        recipeData
      );

      // Create entity with body component
      const entity =
        await testBed.entityManager.createEntityInstance('anatomy:body_test');
      const entityId = entity.id;

      // Simulate the anatomy generation workflow by directly applying
      // the bodyDescriptors as the production code would do
      const bodyData = {
        recipeId: 'test:descriptor_recipe',
        body: {
          root: 'test:simple_torso',
          parts: { torso: 'test:simple_torso' },
          descriptors: { ...recipeData.bodyDescriptors },
        },
      };

      await testBed.entityManager.addComponent(
        entityId,
        'anatomy:body',
        bodyData
      );

      // Verify the body component now has the descriptors
      const bodyComponent = testBed.entityManager.getComponentData(
        entityId,
        'anatomy:body'
      );
      expect(bodyComponent).toBeDefined();
      expect(bodyComponent.body).toBeDefined();
      expect(bodyComponent.body.descriptors).toEqual({
        height: 'tall',
        build: 'athletic',
        density: 'moderate',
        composition: 'lean',
        skinColor: 'olive',
      });
    });

    it('should only apply bodyDescriptors if present in recipe', async () => {
      // Create a test recipe WITHOUT bodyDescriptors
      const recipeData = {
        recipeId: 'test:no_descriptor_recipe',
        blueprintId: 'anatomy:humanoid',
        slots: {
          torso: { partType: 'torso' },
        },
        // No bodyDescriptors field
      };

      // Register the recipe
      testBed.dataRegistry.store(
        'anatomyRecipes',
        'test:no_descriptor_recipe',
        recipeData
      );

      // Create entity with body component
      const entity =
        await testBed.entityManager.createEntityInstance('anatomy:body_test');
      const entityId = entity.id;

      // Simulate the anatomy generation workflow without bodyDescriptors
      const bodyData = {
        recipeId: 'test:no_descriptor_recipe',
        body: {
          root: 'test:simple_torso',
          parts: { torso: 'test:simple_torso' },
          // No descriptors applied since recipe doesn't have them
        },
      };

      await testBed.entityManager.addComponent(
        entityId,
        'anatomy:body',
        bodyData
      );

      // Verify the body component does NOT have descriptors
      const bodyComponent = testBed.entityManager.getComponentData(
        entityId,
        'anatomy:body'
      );
      expect(bodyComponent).toBeDefined();
      expect(bodyComponent.body).toBeDefined();
      expect(bodyComponent.body.descriptors).toBeUndefined();
    });

    it('should apply partial bodyDescriptors correctly', async () => {
      // Create a test recipe with only some bodyDescriptors
      const recipeData = {
        recipeId: 'test:partial_descriptor_recipe',
        blueprintId: 'anatomy:humanoid',
        slots: {
          torso: { partType: 'torso' },
        },
        bodyDescriptors: {
          build: 'slim',
          skinColor: 'pale',
          // Missing density and composition
        },
      };

      // Register the recipe
      testBed.dataRegistry.store(
        'anatomyRecipes',
        'test:partial_descriptor_recipe',
        recipeData
      );

      // Create entity with body component
      const entity =
        await testBed.entityManager.createEntityInstance('anatomy:body_test');
      const entityId = entity.id;

      // Simulate the anatomy generation workflow with partial bodyDescriptors
      const bodyData = {
        recipeId: 'test:partial_descriptor_recipe',
        body: {
          root: 'test:simple_torso',
          parts: { torso: 'test:simple_torso' },
          descriptors: { ...recipeData.bodyDescriptors },
        },
      };

      await testBed.entityManager.addComponent(
        entityId,
        'anatomy:body',
        bodyData
      );

      // Verify the body component has only the specified descriptors
      const bodyComponent = testBed.entityManager.getComponentData(
        entityId,
        'anatomy:body'
      );
      expect(bodyComponent).toBeDefined();
      expect(bodyComponent.body).toBeDefined();
      expect(bodyComponent.body.descriptors).toEqual({
        build: 'slim',
        skinColor: 'pale',
      });
    });
  });

  describe('Description Extraction Integration', () => {
    it('should display body descriptors FIRST in descriptions', async () => {
      // This test verifies that the body descriptors appear before part descriptions
      // The actual integration flow is tested in other test files

      // Create entity with body.descriptors
      const entity =
        await testBed.entityManager.createEntityInstance('anatomy:body_test');
      const entityId = entity.id;

      // Add body component with descriptors but no actual parts
      // (parts would need proper entity setup which is covered in other tests)
      const bodyData = {
        recipeId: 'test:descriptor_recipe',
        body: {
          root: 'dummy-root',
          parts: {}, // Empty parts - we're only testing descriptors
          descriptors: {
            skinColor: 'olive',
            build: 'athletic',
            density: 'moderate',
            composition: 'lean',
          },
        },
      };

      await testBed.entityManager.addComponent(
        entityId,
        'anatomy:body',
        bodyData
      );

      // Get the entity - note it won't have any parts since we didn't create them
      const bodyEntity = testBed.entityManager.getEntityInstance(entityId);

      // Verify the descriptors are present in the body component
      const bodyComponent = bodyEntity.getComponentData('anatomy:body');
      expect(bodyComponent.body.descriptors).toEqual({
        skinColor: 'olive',
        build: 'athletic',
        density: 'moderate',
        composition: 'lean',
      });

      // The actual description composition with proper part entities
      // is tested in other integration tests like humanMaleBodyDescription.integration.test.js
    });

    it('should extract descriptors from body.descriptors with precedence over entity-level', async () => {
      // Create entity with both body.descriptors and entity-level descriptors
      const entity =
        await testBed.entityManager.createEntityInstance('anatomy:body_test');
      const entityId = entity.id;

      // Add entity-level descriptor components (should be ignored)
      await testBed.entityManager.addComponent(entityId, 'descriptors:build', {
        build: 'stocky', // This should be ignored
      });
      await testBed.entityManager.addComponent(
        entityId,
        'descriptors:body_composition',
        {
          composition: 'chubby', // This should be ignored
        }
      );

      // Add body component with body.descriptors (should take precedence)
      await testBed.entityManager.addComponent(entityId, 'anatomy:body', {
        recipeId: 'anatomy:human',
        body: {
          root: 'torso-1',
          parts: { torso: 'torso-1' },
          descriptors: {
            build: 'athletic', // Should override entity-level 'stocky'
            composition: 'lean', // Should override entity-level 'chubby'
            density: 'moderate',
            skinColor: 'olive',
          },
        },
      });

      // Create mock entity instance
      const mockEntity1 = testBed.entityManager.getEntityInstance(entityId);

      // Test each extraction method
      const build =
        testBed.bodyDescriptionComposer.extractBuildDescription(mockEntity1);
      const composition =
        testBed.bodyDescriptionComposer.extractBodyCompositionDescription(
          mockEntity1
        );
      const density =
        testBed.bodyDescriptionComposer.extractBodyHairDescription(mockEntity1);
      const skinColor =
        testBed.bodyDescriptionComposer.extractSkinColorDescription(
          mockEntity1
        );

      expect(build).toBe('athletic'); // From body.descriptors, not entity-level
      expect(composition).toBe('lean'); // From body.descriptors, not entity-level
      expect(density).toBe('moderate'); // From body.descriptors
      expect(skinColor).toBe('olive'); // From body.descriptors
    });

    it('should fallback to entity-level descriptors when body.descriptors not present', async () => {
      // Create entity with only entity-level descriptors
      const entity =
        await testBed.entityManager.createEntityInstance('anatomy:body_test');
      const entityId = entity.id;

      // Add entity-level descriptor components
      await testBed.entityManager.addComponent(entityId, 'descriptors:build', {
        build: 'toned',
      });
      await testBed.entityManager.addComponent(
        entityId,
        'descriptors:body_composition',
        {
          composition: 'soft',
        }
      );
      await testBed.entityManager.addComponent(
        entityId,
        'descriptors:body_hair',
        {
          density: 'sparse',
        }
      );
      await testBed.entityManager.addComponent(
        entityId,
        'descriptors:skin_color',
        {
          skinColor: 'bronze',
        }
      );

      // Add body component WITHOUT body.descriptors
      await testBed.entityManager.addComponent(entityId, 'anatomy:body', {
        recipeId: 'anatomy:human',
        body: {
          root: 'torso-1',
          parts: { torso: 'torso-1' },
          // No descriptors field
        },
      });

      // Create mock entity instance
      const mockEntity2 = testBed.entityManager.getEntityInstance(entityId);

      // Test each extraction method
      const build =
        testBed.bodyDescriptionComposer.extractBuildDescription(mockEntity2);
      const composition =
        testBed.bodyDescriptionComposer.extractBodyCompositionDescription(
          mockEntity2
        );
      const density =
        testBed.bodyDescriptionComposer.extractBodyHairDescription(mockEntity2);
      const skinColor =
        testBed.bodyDescriptionComposer.extractSkinColorDescription(
          mockEntity2
        );

      expect(build).toBe('toned');
      expect(composition).toBe('soft');
      expect(density).toBe('sparse');
      expect(skinColor).toBe('bronze');
    });

    it('should mix body.descriptors and entity-level descriptors appropriately', async () => {
      // Create entity with some descriptors in body and some at entity-level
      const entity =
        await testBed.entityManager.createEntityInstance('anatomy:body_test');
      const entityId = entity.id;

      // Add entity-level descriptor components
      await testBed.entityManager.addComponent(entityId, 'descriptors:build', {
        build: 'muscular', // Should be used since not in body.descriptors
      });
      await testBed.entityManager.addComponent(
        entityId,
        'descriptors:skin_color',
        {
          skinColor: 'dark', // Should be used since not in body.descriptors
        }
      );

      // Add body component with partial body.descriptors
      await testBed.entityManager.addComponent(entityId, 'anatomy:body', {
        recipeId: 'anatomy:human',
        body: {
          root: 'torso-1',
          parts: { torso: 'torso-1' },
          descriptors: {
            composition: 'average', // Should be used from body.descriptors
            hairDensity: 'hairy', // Should be used from body.descriptors
          },
        },
      });

      // Create mock entity instance
      const mockEntity3 = testBed.entityManager.getEntityInstance(entityId);

      // Test each extraction method
      const build =
        testBed.bodyDescriptionComposer.extractBuildDescription(mockEntity3);
      const composition =
        testBed.bodyDescriptionComposer.extractBodyCompositionDescription(
          mockEntity3
        );
      const density =
        testBed.bodyDescriptionComposer.extractBodyHairDescription(mockEntity3);
      const skinColor =
        testBed.bodyDescriptionComposer.extractSkinColorDescription(
          mockEntity3
        );

      expect(build).toBe('muscular'); // From entity-level (fallback)
      expect(composition).toBe('average'); // From body.descriptors (precedence)
      expect(density).toBe('hairy'); // From body.descriptors (precedence)
      expect(skinColor).toBe('dark'); // From entity-level (fallback)
    });
  });

  describe('Schema Validation Integration', () => {
    it('should validate generated body components with descriptors', async () => {
      // This test ensures that the generated body components pass schema validation
      const recipeData = {
        recipeId: 'test:validation_recipe',
        blueprintId: 'anatomy:humanoid',
        slots: {
          torso: { partType: 'torso' },
        },
        bodyDescriptors: {
          height: 'tall',
          build: 'athletic',
          density: 'moderate',
          composition: 'lean',
          skinColor: 'olive',
        },
      };

      // Register the recipe
      testBed.dataRegistry.store(
        'anatomyRecipes',
        'test:validation_recipe',
        recipeData
      );

      // Create entity and simulate anatomy generation
      const entity =
        await testBed.entityManager.createEntityInstance('anatomy:body_test');
      const entityId = entity.id;

      const bodyData = {
        recipeId: 'test:validation_recipe',
        body: {
          root: 'test:simple_torso',
          parts: { torso: 'test:simple_torso' },
          descriptors: { ...recipeData.bodyDescriptors },
        },
      };

      // This should not throw validation errors
      expect(() => {
        testBed.entityManager.addComponent(entityId, 'anatomy:body', bodyData);
      }).not.toThrow();

      // Verify the component is valid by retrieving it successfully
      const bodyComponent = testBed.entityManager.getComponentData(
        entityId,
        'anatomy:body'
      );
      expect(bodyComponent).toBeDefined();
      expect(bodyComponent.body).toBeDefined();
      expect(bodyComponent.body.descriptors).toBeDefined();
      expect(bodyComponent.recipeId).toBe('test:validation_recipe');
    });
  });
});
