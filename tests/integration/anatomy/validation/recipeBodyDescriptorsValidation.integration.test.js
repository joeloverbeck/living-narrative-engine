/**
 * @file Integration test for recipe bodyDescriptors validation
 * Tests that the validator catches invalid bodyDescriptor values before runtime
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import RecipeValidationRunner from '../../../../src/anatomy/validation/RecipeValidationRunner.js';
import EntityMatcherService from '../../../../src/anatomy/services/entityMatcherService.js';
import AppContainer from '../../../../src/dependencyInjection/appContainer.js';
import { configureMinimalContainer } from '../../../../src/dependencyInjection/minimalContainerConfig.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';

describe('Recipe Body Descriptors Validation - Integration', () => {
  let validator;
  let dataRegistry;

  beforeAll(async () => {
    // Create and configure container
    const container = new AppContainer();
    await configureMinimalContainer(container);

    // Override data fetchers for Node environment
    const NodeDataFetcher = (await import('../../../../scripts/utils/nodeDataFetcher.js')).default;
    const NodeTextDataFetcher = (await import('../../../../scripts/utils/nodeTextDataFetcher.js')).default;
    container.register(tokens.IDataFetcher, () => new NodeDataFetcher());
    container.register(tokens.ITextDataFetcher, () => new NodeTextDataFetcher());

    // Resolve core services
    dataRegistry = container.resolve(tokens.IDataRegistry);
    const anatomyBlueprintRepository = container.resolve(tokens.IAnatomyBlueprintRepository);
    const schemaValidator = container.resolve(tokens.ISchemaValidator);
    const slotGenerator = container.resolve(tokens.ISlotGenerator);

    // Load essential mods
    const { createLoadContext } = await import('../../../../src/loaders/LoadContext.js');
    let context = createLoadContext({
      worldName: 'test-world',
      requestedMods: ['core', 'descriptors', 'anatomy', 'fantasy'],
      registry: dataRegistry,
    });

    // Execute load phases
    const schemaPhase = container.resolve(tokens.SchemaPhase);
    const manifestPhase = container.resolve(tokens.ManifestPhase);
    const contentPhase = container.resolve(tokens.ContentPhase);

    context = await schemaPhase.execute(context);
    context = await manifestPhase.execute(context);
    context = await contentPhase.execute(context);

    // Context is used implicitly through the dataRegistry which is populated by the phases
    // Suppress unused variable warning
    void context;

    const mockLogger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    };

    const entityMatcherService = new EntityMatcherService({
      logger: mockLogger,
      dataRegistry,
    });

    // Create validator
    validator = new RecipeValidationRunner({
      dataRegistry,
      anatomyBlueprintRepository,
      schemaValidator,
      slotGenerator,
      entityMatcherService,
      logger: mockLogger,
    });
  });

  it('should detect invalid hairDensity value in vespera_nightwhisper recipe', async () => {
    // Load the actual recipe that was failing
    const recipePath = path.resolve(
      process.cwd(),
      'data/mods/fantasy/recipes/vespera_nightwhisper.recipe.json'
    );
    const recipeContent = await fs.readFile(recipePath, 'utf-8');
    const recipe = JSON.parse(recipeContent);

    // Ensure the hairDensity value is intentionally invalid to verify validation behavior
    if (recipe.bodyDescriptors?.hairDensity !== 'fluffy') {
      recipe.bodyDescriptors = {
        ...recipe.bodyDescriptors,
        hairDensity: 'fluffy',
      };
    }

    // Validate the recipe
    const report = await validator.validate(recipe, { recipePath });

    // Should fail validation
    expect(report.isValid).toBe(false);

    // Should have error about invalid hairDensity value
    const hairDensityError = report.errors.find(
      (e) => e.type === 'INVALID_BODY_DESCRIPTOR_VALUE' && e.field === 'hairDensity'
    );

    expect(hairDensityError).toBeDefined();
    expect(hairDensityError.value).toBe('fluffy');
    expect(hairDensityError.message).toContain("Invalid value 'fluffy'");
    expect(hairDensityError.allowedValues).toEqual([
      'hairless',
      'sparse',
      'light',
      'moderate',
      'hairy',
      'very-hairy',
      'furred',
    ]);
    expect(hairDensityError.fix).toContain('hairless, sparse, light, moderate, hairy, very-hairy, furred');
  });

  it('should pass validation when recipe has valid bodyDescriptors', async () => {
    // Create a valid recipe with correct descriptor values
    const validRecipe = {
      $schema: 'schema://living-narrative-engine/anatomy.recipe.schema.json',
      recipeId: 'test:valid_recipe',
      blueprintId: 'anatomy:cat_girl',
      bodyDescriptors: {
        height: 'average',
        build: 'athletic',
        composition: 'lean',
        skinColor: 'pale-cream',
        hairDensity: 'moderate', // Valid value
      },
      slots: {},
      patterns: [],
    };

    const report = await validator.validate(validRecipe);

    // Should pass validation
    expect(report.isValid).toBe(true);
    const bodyDescriptorsCheck = report.passed.find((p) => p.check === 'body_descriptors');
    expect(bodyDescriptorsCheck).toBeDefined();
    expect(bodyDescriptorsCheck.message).toContain('5 body descriptor(s) valid');
  });

  it('should provide helpful error messages for multiple invalid descriptors', async () => {
    const invalidRecipe = {
      $schema: 'schema://living-narrative-engine/anatomy.recipe.schema.json',
      recipeId: 'test:invalid_recipe',
      blueprintId: 'anatomy:cat_girl',
      bodyDescriptors: {
        height: 'super-tall', // Invalid - not in enum
        build: 'athletic', // Valid
        hairDensity: 'fluffy', // Invalid - not in enum
        unknownField: 'test', // Invalid - unknown field
      },
      slots: {},
      patterns: [],
    };

    const report = await validator.validate(invalidRecipe);

    // Should fail validation
    expect(report.isValid).toBe(false);

    // Should have multiple errors
    expect(report.errors.length).toBeGreaterThanOrEqual(3);

    // Check for height error
    const heightError = report.errors.find(
      (e) => e.type === 'INVALID_BODY_DESCRIPTOR_VALUE' && e.field === 'height'
    );
    expect(heightError).toBeDefined();
    expect(heightError.value).toBe('super-tall');
    expect(heightError.allowedValues).toContain('average');

    // Check for hairDensity error
    const hairDensityError = report.errors.find(
      (e) => e.type === 'INVALID_BODY_DESCRIPTOR_VALUE' && e.field === 'hairDensity'
    );
    expect(hairDensityError).toBeDefined();
    expect(hairDensityError.value).toBe('fluffy');

    // Check for unknown field error
    const unknownError = report.errors.find((e) => e.type === 'UNKNOWN_BODY_DESCRIPTOR');
    expect(unknownError).toBeDefined();
    expect(unknownError.field).toBe('unknownField');
  });

  it('should validate all anatomy:body descriptor fields according to schema', async () => {
    // Get the anatomy:body component to verify we're checking against the real schema
    const anatomyBodyComponent = dataRegistry.get('components', 'anatomy:body');
    expect(anatomyBodyComponent).toBeDefined();

    const descriptorsSchema =
      anatomyBodyComponent.dataSchema?.properties?.body?.properties?.descriptors;
    expect(descriptorsSchema).toBeDefined();
    expect(descriptorsSchema.properties).toBeDefined();

    // Verify expected fields exist in schema
    const expectedFields = ['height', 'build', 'hairDensity', 'composition', 'skinColor'];
    for (const field of expectedFields) {
      expect(descriptorsSchema.properties[field]).toBeDefined();
    }

    // Create recipe with all valid values
    const allDescriptorsRecipe = {
      recipeId: 'test:all_descriptors',
      blueprintId: 'anatomy:cat_girl',
      bodyDescriptors: {
        height: 'average',
        build: 'athletic',
        hairDensity: 'moderate',
        composition: 'lean',
        skinColor: 'pale',
        smell: 'floral',
      },
      slots: {},
      patterns: [],
    };

    const report = await validator.validate(allDescriptorsRecipe);

    // Should pass with all valid descriptors
    expect(report.isValid).toBe(true);
    const bodyDescriptorsCheck = report.passed.find((p) => p.check === 'body_descriptors');
    expect(bodyDescriptorsCheck).toBeDefined();
  });
});
