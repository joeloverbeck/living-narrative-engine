/**
 * @file Integration test for centaur warrior recipe validation
 * Tests that the centaur_warrior recipe validates without false positive warnings
 * after blueprint processing improvements
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import AppContainer from '../../../../src/dependencyInjection/appContainer.js';
import { configureMinimalContainer } from '../../../../src/dependencyInjection/minimalContainerConfig.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import RecipePreflightValidator from '../../../../src/anatomy/validation/RecipePreflightValidator.js';
import fs from 'fs';
import path from 'path';

describe('Centaur Warrior Recipe Validation', () => {
  let container;
  let validator;
  let dataRegistry;
  let originalFetch;

  beforeAll(async () => {
    // Mock fetch to read from filesystem for schema loading
    originalFetch = global.fetch;
    global.fetch = jest.fn((url) => {
      // Convert URL to file path
      const filePath = url.replace(/^\.\//, '');
      const fullPath = path.resolve(process.cwd(), filePath);

      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(JSON.parse(content)),
        });
      } catch (error) {
        return Promise.reject(new Error(`Failed to load ${url}: ${error.message}`));
      }
    });

    // Create and configure container
    container = new AppContainer();
    await configureMinimalContainer(container);

    // Get services
    dataRegistry = container.resolve(tokens.IDataRegistry);
    const anatomyBlueprintRepository = container.resolve(
      tokens.IAnatomyBlueprintRepository
    );
    const schemaValidator = container.resolve(tokens.ISchemaValidator);
    const slotGenerator = container.resolve(tokens.ISlotGenerator);
    const logger = container.resolve(tokens.ILogger);

    // Load essential mods
    const { createLoadContext } = await import(
      '../../../../src/loaders/LoadContext.js'
    );

    const loadContext = createLoadContext({
      worldName: 'test-world',
      requestedMods: ['core', 'descriptors', 'anatomy'],
      registry: dataRegistry,
    });

    // Execute phases
    const schemaPhase = container.resolve(tokens.SchemaPhase);
    const manifestPhase = container.resolve(tokens.ManifestPhase);
    const contentPhase = container.resolve(tokens.ContentPhase);

    let context = await schemaPhase.execute(loadContext);
    context = await manifestPhase.execute(context);
    await contentPhase.execute(context);

    // Create validator
    validator = new RecipePreflightValidator({
      dataRegistry,
      anatomyBlueprintRepository,
      schemaValidator,
      slotGenerator,
      logger,
    });
  });

  afterAll(() => {
    // Restore original fetch
    global.fetch = originalFetch;
  });

  it('should validate centaur_warrior recipe without false positive warnings', async () => {
    // Get the actual centaur_warrior recipe from loaded mods
    const recipe = dataRegistry.get('anatomyRecipes', 'anatomy:centaur_warrior');

    expect(recipe).toBeDefined();
    expect(recipe.recipeId).toBe('anatomy:centaur_warrior');
    expect(recipe.blueprintId).toBe('anatomy:centaur_warrior');

    // Validate the recipe
    const report = await validator.validate(recipe, {
      recipePath: 'data/mods/anatomy/recipes/centaur_warrior.recipe.json',
    });

    // Should pass validation
    expect(report.isValid).toBe(true);

    // Should have no errors
    expect(report.errors).toHaveLength(0);

    // Should have no warnings about pattern matching
    const patternWarnings = report.warnings.filter(
      (w) => w.type === 'NO_MATCHING_SLOTS'
    );
    expect(patternWarnings).toHaveLength(0);

    // Should pass pattern matching check
    const patternCheck = report.passed.find(
      (p) => p.check === 'pattern_matching'
    );
    expect(patternCheck).toBeDefined();
    expect(patternCheck.message).toContain('pattern(s) have matching slots');
  });

  it('should correctly match arm pattern against additionalSlots', async () => {
    const recipe = dataRegistry.get('anatomyRecipes', 'anatomy:centaur_warrior');

    // Get the blueprint
    const blueprint = dataRegistry.get(
      'anatomyBlueprints',
      'anatomy:centaur_warrior'
    );

    expect(blueprint).toBeDefined();
    expect(blueprint.additionalSlots).toBeDefined();
    expect(blueprint.additionalSlots.arm_left).toBeDefined();
    expect(blueprint.additionalSlots.arm_right).toBeDefined();

    // Validate - the arm pattern should match after processing
    const report = await validator.validate(recipe);

    // Find the arm pattern in the recipe
    const armPattern = recipe.patterns.find(
      (p) => p.matchesAll && p.matchesAll.slotType === 'arm'
    );
    expect(armPattern).toBeDefined();

    // Should not warn about arm pattern
    const armWarnings = report.warnings.filter(
      (w) =>
        w.type === 'NO_MATCHING_SLOTS' &&
        w.pattern?.matchesAll?.slotType === 'arm'
    );
    expect(armWarnings).toHaveLength(0);
  });

  it('should correctly match leg patterns against generated slots with orientation', async () => {
    const recipe = dataRegistry.get('anatomyRecipes', 'anatomy:centaur_warrior');

    // Get the structure template to verify it generates leg slots
    const template = dataRegistry.get(
      'anatomyStructureTemplates',
      'anatomy:structure_centauroid'
    );

    expect(template).toBeDefined();
    expect(template.topology.limbSets).toBeDefined();

    const legLimbSet = template.topology.limbSets.find(
      (ls) => ls.type === 'leg'
    );
    expect(legLimbSet).toBeDefined();
    expect(legLimbSet.count).toBe(4);
    expect(legLimbSet.arrangement).toBe('quadrupedal');

    // Validate - leg patterns should match generated slots
    const report = await validator.validate(recipe);

    // Find the leg patterns
    const legFrontPattern = recipe.patterns.find(
      (p) =>
        p.matchesAll &&
        p.matchesAll.slotType === 'leg' &&
        p.matchesAll.orientation === '*_front'
    );
    const legRearPattern = recipe.patterns.find(
      (p) =>
        p.matchesAll &&
        p.matchesAll.slotType === 'leg' &&
        p.matchesAll.orientation === '*_rear'
    );

    expect(legFrontPattern).toBeDefined();
    expect(legRearPattern).toBeDefined();

    // Should not warn about leg patterns
    const legWarnings = report.warnings.filter(
      (w) =>
        w.type === 'NO_MATCHING_SLOTS' &&
        w.pattern?.matchesAll?.slotType === 'leg'
    );
    expect(legWarnings).toHaveLength(0);
  });

  it('should have only descriptor coverage suggestions, no critical warnings', async () => {
    const recipe = dataRegistry.get('anatomyRecipes', 'anatomy:centaur_warrior');

    const report = await validator.validate(recipe);

    // May have suggestions for descriptor coverage
    const suggestions = report.suggestions;
    expect(Array.isArray(suggestions)).toBe(true);

    // But should have no pattern matching warnings
    const criticalWarnings = report.warnings.filter(
      (w) => w.type === 'NO_MATCHING_SLOTS' || w.severity === 'error'
    );
    expect(criticalWarnings).toHaveLength(0);
  });

  it('should process blueprint slots correctly for pattern resolution', async () => {
    const recipe = dataRegistry.get('anatomyRecipes', 'anatomy:centaur_warrior');

    // This test verifies that the validator processes the blueprint
    // the same way runtime does, ensuring consistency

    const report = await validator.validate(recipe);

    // Check that all pattern checks passed
    const allPatternsPassed = report.passed.some(
      (p) =>
        p.check === 'pattern_matching' &&
        p.message.includes('pattern(s) have matching slots')
    );

    expect(allPatternsPassed).toBe(true);

    // Verify the report structure
    expect(report).toHaveProperty('recipeId', 'anatomy:centaur_warrior');
    expect(report).toHaveProperty('isValid', true);
    expect(report.errors).toHaveLength(0);
  });
});
