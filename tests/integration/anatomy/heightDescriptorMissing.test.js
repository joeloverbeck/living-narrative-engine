/**
 * @file Test to reproduce the missing height descriptor issue with Jon Ureña recipe
 * @description This test specifically focuses on the height descriptor that's missing
 * from the composed description despite being present in bodyDescriptors
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestBedAnatomy } from '../../common/testbed.anatomy.js';

describe('Height Descriptor Missing Issue', () => {
  let testBed;
  let jonUrenaLikeRecipe;

  beforeEach(async () => {
    testBed = new TestBedAnatomy();
    await testBed.setup();

    // Create a recipe that mimics Jon Ureña's recipe structure with height descriptor
    jonUrenaLikeRecipe = {
      $schema: 'http://example.com/schemas/anatomy.recipe.schema.json',
      recipeId: 'test:height_descriptor_test_recipe',
      blueprintId: 'anatomy:humanoid', // Use simple test blueprint
      bodyDescriptors: {
        build: 'stocky',
        hairDensity: 'hairy',
        height: 'tall', // This is the key descriptor that should appear but doesn't
      },
      slots: {},
      patterns: [],
      clothingEntities: [],
    };

    console.log(
      'Using height-focused recipe for testing:',
      JSON.stringify(jonUrenaLikeRecipe, null, 2)
    );
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  it('should reproduce the missing height descriptor issue', async () => {
    // Register the recipe in the test bed
    testBed.dataRegistry.store(
      'anatomyRecipes',
      jonUrenaLikeRecipe.recipeId,
      jonUrenaLikeRecipe
    );

    console.log('Recipe bodyDescriptors:', jonUrenaLikeRecipe.bodyDescriptors);

    // Create an entity with anatomy:body component that uses this recipe
    const entity =
      await testBed.entityManager.createEntityInstance('anatomy:body_test');

    // Add the anatomy:body component manually to trigger the workflow
    await testBed.entityManager.addComponent(entity.id, 'anatomy:body', {
      blueprintId: jonUrenaLikeRecipe.blueprintId,
      recipeId: jonUrenaLikeRecipe.recipeId,
    });

    console.log('Created entity:', entity.id);

    // Manually trigger anatomy generation
    const anatomyGenerated =
      await testBed.anatomyGenerationService.generateAnatomyIfNeeded(entity.id);
    console.log('Anatomy generation result:', anatomyGenerated);

    // Wait for any async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Check the anatomy:body component to see if descriptors were applied
    const anatomyBodyComponent = entity.getComponentData('anatomy:body');
    console.log(
      'Anatomy Body Component:',
      JSON.stringify(anatomyBodyComponent, null, 2)
    );

    // Verify all the body descriptors were stored correctly in the component
    expect(anatomyBodyComponent).toBeDefined();
    expect(anatomyBodyComponent.body).toBeDefined();
    expect(anatomyBodyComponent.body.descriptors).toBeDefined();
    expect(anatomyBodyComponent.body.descriptors.build).toBe('stocky');
    expect(anatomyBodyComponent.body.descriptors.hairDensity).toBe('hairy');
    expect(anatomyBodyComponent.body.descriptors.height).toBe('tall'); // This should be present

    console.log(
      'Body descriptors in component:',
      anatomyBodyComponent.body.descriptors
    );

    // Now check the description generation
    const descriptionComponent = entity.getComponentData('core:description');
    console.log('Generated Description Component:', descriptionComponent);
    console.log('Generated Description Text:', descriptionComponent?.text);

    if (descriptionComponent?.text) {
      console.log('Description Lines:');
      const lines = descriptionComponent.text
        .split('\n')
        .filter((line) => line.trim());
      lines.forEach((line, index) => {
        console.log(`  ${index + 1}: ${line}`);
      });

      // Check if body-level descriptors are present in the description
      const hasHeightDescriptor =
        descriptionComponent.text.includes('Height: tall');
      const hasBuildDescriptor =
        descriptionComponent.text.includes('Build: stocky');
      const hasBodyHairDescriptor =
        descriptionComponent.text.includes('Body hair: hairy');

      console.log('Has Height descriptor in description?', hasHeightDescriptor);
      console.log('Has Build descriptor in description?', hasBuildDescriptor);
      console.log(
        'Has Body hair descriptor in description?',
        hasBodyHairDescriptor
      );

      // These should ALL be present - this test should currently FAIL for height
      expect(hasHeightDescriptor).toBe(true); // This is the failing assertion
      expect(hasBuildDescriptor).toBe(true);
      expect(hasBodyHairDescriptor).toBe(true);
    } else {
      throw new Error('No description was generated for the entity');
    }
  });

  it('should show individual extraction methods for height descriptor', async () => {
    // Register the recipe
    testBed.dataRegistry.store(
      'anatomyRecipes',
      jonUrenaLikeRecipe.recipeId,
      jonUrenaLikeRecipe
    );

    // Create entity
    const entity =
      await testBed.entityManager.createEntityInstance('anatomy:body_test');

    // Add the anatomy:body component
    await testBed.entityManager.addComponent(entity.id, 'anatomy:body', {
      blueprintId: jonUrenaLikeRecipe.blueprintId,
      recipeId: jonUrenaLikeRecipe.recipeId,
    });

    // Manually trigger anatomy generation
    await testBed.anatomyGenerationService.generateAnatomyIfNeeded(entity.id);

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Test the body description composer directly
    const bodyDescriptionComposer = testBed.bodyDescriptionComposer;

    // Test each extraction method individually - focus on height
    const heightDescription =
      bodyDescriptionComposer.extractHeightDescription(entity);
    const buildDescription =
      bodyDescriptionComposer.extractBuildDescription(entity);
    const bodyHairDescription =
      bodyDescriptionComposer.extractBodyHairDescription(entity);
    const bodyLevelDescriptors =
      bodyDescriptionComposer.extractBodyLevelDescriptors(entity);

    console.log('Individual Extraction Results:');
    console.log('  heightDescription:', heightDescription);
    console.log('  buildDescription:', buildDescription);
    console.log('  bodyHairDescription:', bodyHairDescription);
    console.log('  bodyLevelDescriptors:', bodyLevelDescriptors);

    // Test the full composition
    const composedDescription =
      await bodyDescriptionComposer.composeDescription(entity);
    console.log('Composed Description:', composedDescription);

    // Verify extraction works at each step
    expect(heightDescription).toBe('tall'); // This should work
    expect(buildDescription).toBe('stocky');
    expect(bodyHairDescription).toBe('hairy');

    // Check if height descriptor is properly formatted in the descriptors object
    expect(bodyLevelDescriptors.height).toBe('Height: tall'); // This is where the issue might be
    expect(bodyLevelDescriptors.build).toBe('Build: stocky');
    expect(bodyLevelDescriptors.body_hair).toBe('Body hair: hairy');

    // The composed description should include ALL of these
    expect(composedDescription).toContain('Height: tall'); // This is the failing assertion
    expect(composedDescription).toContain('Build: stocky');
    expect(composedDescription).toContain('Body hair: hairy');
  });
});
