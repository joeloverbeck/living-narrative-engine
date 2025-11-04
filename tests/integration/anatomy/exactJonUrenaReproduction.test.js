/**
 * @file Test to reproduce the exact issue with Jon Ureña height descriptor
 * @description This test uses a defined Jon Ureña recipe to identify
 * where the height descriptor is getting lost in the anatomy generation pipeline
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestBedAnatomy } from '../../common/testbed.anatomy.js';

describe('Exact Jon Ureña Recipe - Height Descriptor Issue', () => {
  let testBed;
  let jonUrenaRecipe;

  beforeEach(async () => {
    testBed = new TestBedAnatomy();
    await testBed.setup();

    // Define the Jon Ureña recipe inline for consistent testing
    jonUrenaRecipe = {
      recipeId: 'test:jon_urena',
      blueprintId: 'anatomy:humanoid', // Use test-compatible blueprint
      bodyDescriptors: {
        height: 'tall',
        build: 'stocky',
        density: 'hairy', // maps to "Body hair" in description
        skinColor: 'olive',
      },
      slots: {
        // Simple slots that work with anatomy:humanoid blueprint
        torso: {
          partType: 'torso',
          preferId: 'test:simple_torso',
        },
      },
      patterns: [],
      clothingEntities: [],
    };

    console.log(
      'Defined Jon Ureña recipe:',
      JSON.stringify(jonUrenaRecipe, null, 2)
    );
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  it('should reproduce the height descriptor issue with the exact Jon Ureña recipe', async () => {
    // First, verify the recipe has the height descriptor
    expect(jonUrenaRecipe.bodyDescriptors).toBeDefined();
    expect(jonUrenaRecipe.bodyDescriptors.height).toBe('tall');

    console.log('Recipe bodyDescriptors:', jonUrenaRecipe.bodyDescriptors);
    console.log('Recipe uses blueprint:', jonUrenaRecipe.blueprintId);

    // Register the recipe in the test bed
    testBed.dataRegistry.store(
      'anatomyRecipes',
      jonUrenaRecipe.recipeId,
      jonUrenaRecipe
    );

    // Create an entity with anatomy:body component that uses this recipe
    const entity =
      await testBed.entityManager.createEntityInstance('anatomy:body_test');

    // Add the anatomy:body component
    await testBed.entityManager.addComponent(entity.id, 'anatomy:body', {
      blueprintId: jonUrenaRecipe.blueprintId,
      recipeId: jonUrenaRecipe.recipeId,
    });

    console.log('Created entity:', entity.id);
    console.log('Entity uses blueprint:', jonUrenaRecipe.blueprintId);

    // Manually trigger anatomy generation
    const anatomyGenerated =
      await testBed.anatomyGenerationService.generateAnatomyIfNeeded(entity.id);
    console.log('Anatomy generation result:', anatomyGenerated);

    // Wait for any async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Check the anatomy:body component to see if descriptors were applied
    const anatomyBodyComponent = entity.getComponentData('anatomy:body');
    console.log(
      'Final Anatomy Body Component:',
      JSON.stringify(anatomyBodyComponent, null, 2)
    );

    // Verify the body descriptors were stored correctly (this is the crucial test)
    expect(anatomyBodyComponent).toBeDefined();
    expect(anatomyBodyComponent.body).toBeDefined();
    expect(anatomyBodyComponent.body.descriptors).toBeDefined();

    console.log(
      'Body descriptors applied:',
      anatomyBodyComponent.body.descriptors
    );

    // Check if all expected descriptors are there
    expect(anatomyBodyComponent.body.descriptors.height).toBe('tall');
    expect(anatomyBodyComponent.body.descriptors.build).toBe('stocky');
    expect(anatomyBodyComponent.body.descriptors.hairDensity).toBe('hairy');
    expect(anatomyBodyComponent.body.descriptors.skinColor).toBe('olive');

    // Generate description to test the full pipeline
    await testBed.anatomyDescriptionService.generateBodyDescription(entity);

    // Now check the description generation
    const descriptionComponent = entity.getComponentData('core:description');
    console.log('Generated Description Component:', descriptionComponent);

    if (descriptionComponent?.text) {
      console.log('Generated Description Text:');
      console.log(descriptionComponent.text);

      const lines = descriptionComponent.text
        .split('\n')
        .filter((line) => line.trim());
      console.log('Description Lines:');
      lines.forEach((line, index) => {
        console.log(`  ${index + 1}: ${line}`);
      });

      // Check if all descriptors are present in the description
      expect(descriptionComponent.text).toContain('Height: tall');
      expect(descriptionComponent.text).toContain('Build: stocky');
      expect(descriptionComponent.text).toContain('Hair density: hairy');
      expect(descriptionComponent.text).toContain('Skin color: olive');
    } else {
      fail('No description was generated');
    }
  });

  it('should test the body descriptor extraction process step by step', async () => {
    // Register the recipe
    testBed.dataRegistry.store(
      'anatomyRecipes',
      jonUrenaRecipe.recipeId,
      jonUrenaRecipe
    );

    // Create entity
    const entity =
      await testBed.entityManager.createEntityInstance('anatomy:body_test');

    // Add the anatomy:body component
    await testBed.entityManager.addComponent(entity.id, 'anatomy:body', {
      blueprintId: jonUrenaRecipe.blueprintId,
      recipeId: jonUrenaRecipe.recipeId,
    });

    // Manually trigger anatomy generation
    await testBed.anatomyGenerationService.generateAnatomyIfNeeded(entity.id);

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Check the component first
    const anatomyBodyComponent = entity.getComponentData('anatomy:body');
    console.log(
      'Component descriptors:',
      anatomyBodyComponent?.body?.descriptors
    );

    // Verify descriptors were applied from recipe
    expect(anatomyBodyComponent.body.descriptors).toBeDefined();
    expect(anatomyBodyComponent.body.descriptors.height).toBe('tall');
    expect(anatomyBodyComponent.body.descriptors.build).toBe('stocky');

    // Test the body description composer directly
    const bodyDescriptionComposer = testBed.bodyDescriptionComposer;

    // Test each extraction method with the recipe data
    console.log('Testing individual extraction methods:');

    const heightDescription =
      bodyDescriptionComposer.extractHeightDescription(entity);
    console.log('  extractHeightDescription():', heightDescription);

    const buildDescription =
      bodyDescriptionComposer.extractBuildDescription(entity);
    console.log('  extractBuildDescription():', buildDescription);

    const bodyHairDescription =
      bodyDescriptionComposer.extractBodyHairDescription(entity);
    console.log('  extractBodyHairDescription():', bodyHairDescription);

    const bodyLevelDescriptors =
      bodyDescriptionComposer.extractBodyLevelDescriptors(entity);
    console.log('  extractBodyLevelDescriptors():', bodyLevelDescriptors);

    // Test the full composition
    const composedDescription =
      await bodyDescriptionComposer.composeDescription(entity);
    console.log('Final composed description:');
    console.log(composedDescription);

    // Assertions based on the recipe values
    expect(heightDescription).toBe('tall');
    expect(buildDescription).toBe('stocky');
    expect(bodyHairDescription).toBe('hairy');
    expect(bodyLevelDescriptors.height).toBe('Height: tall');
    expect(bodyLevelDescriptors.build).toBe('Build: stocky');
    expect(bodyLevelDescriptors.body_hair).toBe('Hair density: hairy');
    expect(composedDescription).toContain('Height: tall');
    expect(composedDescription).toContain('Build: stocky');
    expect(composedDescription).toContain('Hair density: hairy');
  });
});
