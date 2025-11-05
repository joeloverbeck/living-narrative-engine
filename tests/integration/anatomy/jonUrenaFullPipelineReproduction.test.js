/**
 * @file Test to reproduce Jon Ureña issue using full data loading pipeline
 * @description This test defines the Jon Ureña recipe inline and tests the full pipeline
 * to validate bodyDescriptors transfer and description generation
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestBedAnatomy } from '../../common/testbed.anatomy.js';

describe('Jon Ureña Full Pipeline - Height Descriptor Issue', () => {
  let testBed;
  let jonUrenaRecipe;

  beforeEach(async () => {
    testBed = new TestBedAnatomy();
    await testBed.setup();

    // Define the Jon Ureña recipe inline for consistent testing
    jonUrenaRecipe = {
      recipeId: 'test:jon_urena_pipeline',
      blueprintId: 'anatomy:humanoid', // Use test-compatible blueprint
      bodyDescriptors: {
        height: 'tall',
        build: 'stocky',
        hairDensity: 'hairy', // maps to "Body hair" in description
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
      'Jon Ureña recipe bodyDescriptors:',
      jonUrenaRecipe.bodyDescriptors
    );
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  it('should preserve height descriptor through the full pipeline', async () => {
    // Verify the recipe has expected descriptors
    expect(jonUrenaRecipe.bodyDescriptors.height).toBe('tall');
    expect(jonUrenaRecipe.bodyDescriptors.build).toBe('stocky');
    expect(jonUrenaRecipe.bodyDescriptors.hairDensity).toBe('hairy');
    expect(jonUrenaRecipe.bodyDescriptors.skinColor).toBe('olive');

    // Register the recipe
    testBed.dataRegistry.store(
      'anatomyRecipes',
      jonUrenaRecipe.recipeId,
      jonUrenaRecipe
    );

    console.log(
      'Registered recipe with bodyDescriptors:',
      jonUrenaRecipe.bodyDescriptors
    );

    // Create an entity
    const entity =
      await testBed.entityManager.createEntityInstance('anatomy:body_test');

    // Add the anatomy:body component
    await testBed.entityManager.addComponent(entity.id, 'anatomy:body', {
      blueprintId: jonUrenaRecipe.blueprintId,
      recipeId: jonUrenaRecipe.recipeId,
    });

    console.log('Created entity:', entity.id);

    // Trigger anatomy generation through the full pipeline
    const result =
      await testBed.anatomyGenerationService.generateAnatomyIfNeeded(entity.id);
    console.log('Anatomy generation result:', result);

    // Wait for async completion
    await new Promise((resolve) => setTimeout(resolve, 100));

    // NOW CHECK: Was the height descriptor properly transferred?
    const anatomyBodyComponent = entity.getComponentData('anatomy:body');

    console.log('Final anatomy body component:');
    console.log(JSON.stringify(anatomyBodyComponent, null, 2));

    // This is the critical test - are the bodyDescriptors from the recipe
    // properly transferred to body.descriptors in the component?
    expect(anatomyBodyComponent).toBeDefined();
    expect(anatomyBodyComponent.body).toBeDefined();
    expect(anatomyBodyComponent.body.descriptors).toBeDefined();

    console.log(
      'Body descriptors in final component:',
      anatomyBodyComponent.body.descriptors
    );

    // Check each descriptor from the recipe
    expect(anatomyBodyComponent.body.descriptors.height).toBe('tall');
    expect(anatomyBodyComponent.body.descriptors.build).toBe('stocky');
    expect(anatomyBodyComponent.body.descriptors.hairDensity).toBe('hairy');
    expect(anatomyBodyComponent.body.descriptors.skinColor).toBe('olive');

    // Now test description generation
    await testBed.anatomyDescriptionService.generateBodyDescription(entity);

    const descriptionComponent = entity.getComponentData('core:description');
    console.log('Generated description:', descriptionComponent?.text);

    expect(descriptionComponent).toBeDefined();
    expect(descriptionComponent.text).toBeDefined();

    const lines = descriptionComponent.text
      .split('\n')
      .filter((line) => line.trim());
    console.log('Description lines:');
    lines.forEach((line, index) => {
      console.log(`  ${index + 1}: ${line}`);
    });

    // ALL descriptors should be present in the final description
    expect(descriptionComponent.text).toContain('Height: tall');
    expect(descriptionComponent.text).toContain('Build: stocky');
    expect(descriptionComponent.text).toContain('Body hair: hairy');
    expect(descriptionComponent.text).toContain('Skin color: olive');
  });

  it('should debug the anatomy generation workflow step by step', async () => {
    console.log('=== DEBUGGING ANATOMY GENERATION WORKFLOW ===');

    // Register the recipe
    testBed.dataRegistry.store(
      'anatomyRecipes',
      jonUrenaRecipe.recipeId,
      jonUrenaRecipe
    );

    console.log(
      'Step 1: Recipe registered with bodyDescriptors:',
      jonUrenaRecipe.bodyDescriptors
    );

    // Create entity
    const entity =
      await testBed.entityManager.createEntityInstance('anatomy:body_test');

    console.log('Step 2: Entity created:', entity.id);

    // Add initial anatomy:body component
    await testBed.entityManager.addComponent(entity.id, 'anatomy:body', {
      blueprintId: jonUrenaRecipe.blueprintId,
      recipeId: jonUrenaRecipe.recipeId,
    });

    const initialComponent = entity.getComponentData('anatomy:body');
    console.log('Step 3: Initial anatomy:body component:', initialComponent);

    // Trigger anatomy generation through the service
    console.log('Step 4: Triggering anatomy generation...');

    const generationResult =
      await testBed.anatomyGenerationService.generateAnatomyIfNeeded(entity.id);
    console.log('Generation result:', generationResult);

    // Check the component after generation
    const afterGenerationComponent = entity.getComponentData('anatomy:body');
    console.log('Step 5: Component after anatomy generation:');
    console.log(JSON.stringify(afterGenerationComponent, null, 2));

    // Verify descriptors were transferred
    expect(afterGenerationComponent.body.descriptors).toBeDefined();
    expect(afterGenerationComponent.body.descriptors.height).toBe('tall');
    expect(afterGenerationComponent.body.descriptors.build).toBe('stocky');
    expect(afterGenerationComponent.body.descriptors.hairDensity).toBe('hairy');

    // Test the BodyDescriptionComposer directly
    console.log('Step 6: Testing BodyDescriptionComposer directly...');
    const composer = testBed.bodyDescriptionComposer;

    const heightExtraction = composer.extractHeightDescription(entity);
    const buildExtraction = composer.extractBuildDescription(entity);
    const bodyHairExtraction = composer.extractBodyHairDescription(entity);
    const bodyLevelDescriptors = composer.extractBodyLevelDescriptors(entity);

    console.log('Height extraction result:', heightExtraction);
    console.log('Build extraction result:', buildExtraction);
    console.log('Body hair extraction result:', bodyHairExtraction);
    console.log('Body level descriptors result:', bodyLevelDescriptors);

    // Verify individual extractions work
    expect(heightExtraction).toBe('tall');
    expect(buildExtraction).toBe('stocky');
    expect(bodyHairExtraction).toBe('hairy');
    expect(bodyLevelDescriptors.height).toBe('Height: tall');
    expect(bodyLevelDescriptors.build).toBe('Build: stocky');
    expect(bodyLevelDescriptors.body_hair).toBe('Body hair: hairy');

    const finalDescription = await composer.composeDescription(entity);
    console.log('Final composed description:', finalDescription);

    // Verify final description contains all descriptors
    expect(finalDescription).toContain('Height: tall');
    expect(finalDescription).toContain('Build: stocky');
    expect(finalDescription).toContain('Body hair: hairy');
  });
});
