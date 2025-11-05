/**
 * @file Diagnostic script to debug body descriptor issues in anatomy recipes
 * @description This script generates anatomy from a specified recipe and provides detailed logging
 * of how bodyDescriptors flow through the system
 */

/* eslint-disable no-console */

import { container } from '../src/dependencyInjection/container.js';
import { tokens } from '../src/dependencyInjection/tokens.js';

/**
 * Diagnose body descriptor issues for a specific recipe
 *
 * @param {string} recipeId - The recipe ID to diagnose (e.g., "p_erotica_duchess:bogdana_avalune_recipe")
 */
async function diagnoseRecipe(recipeId) {
  console.log('='.repeat(80));
  console.log('BODY DESCRIPTOR DIAGNOSTIC TOOL');
  console.log('='.repeat(80));
  console.log(`\nDiagnosing recipe: ${recipeId}\n`);

  try {
    // Resolve services from container
    const entityManager = container.resolve(tokens.IEntityManager);
    const dataRegistry = container.resolve(tokens.IDataRegistry);
    const anatomyGenerationService = container.resolve(
      tokens.IAnatomyGenerationService
    );
    const bodyDescriptionComposer = container.resolve(
      tokens.IBodyDescriptionComposer
    );

    // Step 1: Check if recipe exists
    console.log('STEP 1: Loading recipe');
    console.log('-'.repeat(80));
    const recipe = dataRegistry.get('anatomyRecipes', recipeId);

    if (!recipe) {
      console.error(`❌ Recipe '${recipeId}' not found in registry`);
      console.log('\nAvailable recipes:');
      const allRecipes = dataRegistry.getAll('anatomyRecipes') || {};
      Object.keys(allRecipes).forEach((id) => console.log(`  - ${id}`));
      return;
    }

    console.log(`✓ Recipe found`);
    console.log(`  Blueprint ID: ${recipe.blueprintId}`);
    console.log(`  Has bodyDescriptors: ${!!recipe.bodyDescriptors}`);

    if (recipe.bodyDescriptors) {
      console.log('  bodyDescriptors:');
      console.log(JSON.stringify(recipe.bodyDescriptors, null, 4));
    }

    // Step 2: Create test actor
    console.log('\nSTEP 2: Creating test actor');
    console.log('-'.repeat(80));
    const actorId = await entityManager.createEntityInstance('core:actor', {
      skipValidation: false,
      generateId: true,
    });
    console.log(`✓ Created actor: ${actorId}`);

    // Step 3: Add anatomy:body component with recipe
    console.log('\nSTEP 3: Adding anatomy:body component');
    console.log('-'.repeat(80));
    await entityManager.addComponent(actorId, 'anatomy:body', {
      recipeId,
    });
    console.log(`✓ Added anatomy:body component with recipeId: ${recipeId}`);

    // Step 4: Generate anatomy
    console.log('\nSTEP 4: Generating anatomy');
    console.log('-'.repeat(80));
    const generated = await anatomyGenerationService.generateAnatomyIfNeeded(
      actorId
    );
    console.log(
      `${generated ? '✓' : '⚠'} Anatomy generation ${generated ? 'completed' : 'skipped'}`
    );

    // Step 5: Inspect anatomy:body component
    console.log('\nSTEP 5: Inspecting anatomy:body component');
    console.log('-'.repeat(80));
    const entity = entityManager.getEntityInstance(actorId);
    const anatomyBodyComponent = entity.getComponentData('anatomy:body');

    console.log('anatomy:body component structure:');
    console.log(JSON.stringify(anatomyBodyComponent, null, 2));

    if (anatomyBodyComponent?.body) {
      console.log('\nBody structure analysis:');
      console.log(`  Has root: ${!!anatomyBodyComponent.body.root}`);
      console.log(`  Has parts: ${!!anatomyBodyComponent.body.parts}`);
      console.log(`  Has descriptors: ${!!anatomyBodyComponent.body.descriptors}`);

      if (anatomyBodyComponent.body.descriptors) {
        console.log('\n  Descriptors found:');
        Object.entries(anatomyBodyComponent.body.descriptors).forEach(
          ([key, value]) => {
            console.log(`    ${key}: ${value}`);
          }
        );

        // Check for specific descriptors
        console.log('\n  Checking critical descriptors:');
        const criticalDescriptors = [
          'height',
          'build',
          'composition',
          'skinColor',
          'smell',
        ];
        criticalDescriptors.forEach((descriptor) => {
          const hasIt = descriptor in anatomyBodyComponent.body.descriptors;
          const value = anatomyBodyComponent.body.descriptors[descriptor];
          console.log(
            `    ${descriptor}: ${hasIt ? `✓ (${value})` : '❌ MISSING'}`
          );
        });
      } else {
        console.log('  ❌ No descriptors object found in body');
      }
    } else {
      console.log('  ❌ No body object found in component');
    }

    // Step 6: Generate description
    console.log('\nSTEP 6: Generating description');
    console.log('-'.repeat(80));
    const description =
      await bodyDescriptionComposer.composeDescription(entity);

    console.log('Generated description:');
    console.log(description);

    // Step 7: Analyze description for missing descriptors
    console.log('\nSTEP 7: Analyzing description');
    console.log('-'.repeat(80));

    const expectedDescriptors = recipe.bodyDescriptors || {};
    console.log('Checking if bodyDescriptors appear in description:');

    Object.entries(expectedDescriptors).forEach(([key, value]) => {
      // Check for various formatting patterns
      const patterns = [
        new RegExp(`${key}.*${value}`, 'i'),
        new RegExp(`${value}`, 'i'),
        // Convert camelCase to Title Case for checking
        new RegExp(
          `${key.replace(/([A-Z])/g, ' $1').trim()}.*${value}`,
          'i'
        ),
      ];

      const found = patterns.some((pattern) => pattern.test(description));
      const label = key
        .replace(/([A-Z])/g, ' $1')
        .trim()
        .replace(/^./, (str) => str.toUpperCase());

      console.log(
        `  ${label}: ${value} - ${found ? '✓ Found' : '❌ NOT FOUND'}`
      );
    });

    console.log('\n' + '='.repeat(80));
    console.log('DIAGNOSIS COMPLETE');
    console.log('='.repeat(80));
  } catch (error) {
    console.error('\n❌ ERROR during diagnosis:');
    console.error(error);
    console.error('\nStack trace:');
    console.error(error.stack);
  }
}

// Run the diagnostic
const recipeId =
  process.argv[2] || 'p_erotica_duchess:bogdana_avalune_recipe';
diagnoseRecipe(recipeId).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
