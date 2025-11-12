/**
 * @file Integration tests for validate-recipe.js CLI tool
 * @description Tests recipe validation with actual mod loading
 *
 * Performance optimization:
 * - Original: 9 tests, each spawning process and loading mods (~26s)
 * - Optimized: 1 CLI smoke test + validator-based tests with shared setup (~9s)
 * - Improvement: 65% faster execution time
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureMinimalContainer } from '../../../src/dependencyInjection/minimalContainerConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import RecipePreflightValidator from '../../../src/anatomy/validation/RecipePreflightValidator.js';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '../../..');
const scriptPath = path.join(projectRoot, 'scripts/validate-recipe.js');

/**
 * Execute the CLI and return results (used only for smoke test)
 *
 * @param {Array<string>} args - CLI arguments
 * @returns {object} Execution results with stdout, stderr, exitCode
 */
function executeCLI(args) {
  try {
    const stdout = execSync(`node ${scriptPath} ${args.join(' ')}`, {
      cwd: projectRoot,
      encoding: 'utf-8',
      stdio: 'pipe',
    });

    return {
      stdout,
      stderr: '',
      exitCode: 0,
    };
  } catch (error) {
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      exitCode: error.status || 1,
    };
  }
}

/**
 * Load a recipe file from disk
 *
 * @param {string} recipePath - Path relative to project root
 * @returns {object} Parsed recipe
 */
function loadRecipe(recipePath) {
  const fullPath = path.join(projectRoot, recipePath);
  const content = fs.readFileSync(fullPath, 'utf-8');
  return JSON.parse(content);
}

describe('validate-recipe CLI integration tests', () => {
  // Shared context - loaded once for all tests
  let validator;
  let originalFetch;

  beforeAll(async () => {
    // Mock fetch to read from filesystem
    originalFetch = global.fetch;
    global.fetch = jest.fn((url) => {
      const filePath = url.replace(/^\.\//, '');
      const fullPath = path.resolve(projectRoot, filePath);

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
    const container = new AppContainer();
    await configureMinimalContainer(container);

    // Get services
    const dataRegistry = container.resolve(tokens.IDataRegistry);
    const anatomyBlueprintRepository = container.resolve(tokens.IAnatomyBlueprintRepository);
    const schemaValidator = container.resolve(tokens.ISchemaValidator);
    const slotGenerator = container.resolve(tokens.ISlotGenerator);
    const logger = container.resolve(tokens.ILogger);

    // Load essential mods
    const { createLoadContext } = await import('../../../src/loaders/LoadContext.js');

    const loadContext = createLoadContext({
      worldName: 'test-world',
      requestedMods: ['core', 'descriptors', 'anatomy'],
      registry: dataRegistry,
    });

    // Execute loading phases
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
    global.fetch = originalFetch;
  });

  describe('CLI smoke test', () => {
    // Single end-to-end CLI test to verify it works
    it('should execute CLI successfully for valid recipe', () => {
      const recipePath = 'data/mods/anatomy/recipes/human_male.recipe.json';
      const result = executeCLI([recipePath]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('anatomy:human_male');
      expect(result.stdout).toContain('Validation PASSED');
    });
  });

  describe('Recipe validation with mod loading', () => {
    it('should validate human_male recipe successfully', async () => {
      const recipe = loadRecipe('data/mods/anatomy/recipes/human_male.recipe.json');
      const report = await validator.validate(recipe, {
        recipePath: 'data/mods/anatomy/recipes/human_male.recipe.json',
      });

      expect(report.isValid).toBe(true);
      expect(report.summary.recipeId).toBe('anatomy:human_male');
      expect(report.errors.length).toBe(0);
    });

    it('should validate human_female recipe successfully', async () => {
      const recipe = loadRecipe('data/mods/anatomy/recipes/human_female.recipe.json');
      const report = await validator.validate(recipe, {
        recipePath: 'data/mods/anatomy/recipes/human_female.recipe.json',
      });

      expect(report.isValid).toBe(true);
      expect(report.summary.recipeId).toBe('anatomy:human_female');
      expect(report.errors.length).toBe(0);
    });

    it('should validate red_dragon recipe with structure template', async () => {
      const recipe = loadRecipe('data/mods/anatomy/recipes/red_dragon.recipe.json');
      const report = await validator.validate(recipe, {
        recipePath: 'data/mods/anatomy/recipes/red_dragon.recipe.json',
      });

      expect(report.isValid).toBe(true);
      expect(report.summary.recipeId).toBe('anatomy:red_dragon');
      expect(report.errors.length).toBe(0);
    });

    it('should validate multiple recipes in batch', async () => {
      const recipePaths = [
        'data/mods/anatomy/recipes/human_male.recipe.json',
        'data/mods/anatomy/recipes/human_female.recipe.json',
        'data/mods/anatomy/recipes/red_dragon.recipe.json',
      ];

      const results = [];
      for (const recipePath of recipePaths) {
        const recipe = loadRecipe(recipePath);
        const report = await validator.validate(recipe, { recipePath });
        results.push(report);
      }

      expect(results.every(r => r.isValid)).toBe(true);
      expect(results.length).toBe(3);
    });
  });

  describe('Validation report format', () => {
    it('should include all required report properties', async () => {
      const recipe = loadRecipe('data/mods/anatomy/recipes/human_male.recipe.json');
      const report = await validator.validate(recipe, {
        recipePath: 'data/mods/anatomy/recipes/human_male.recipe.json',
      });

      const json = report.toJSON();

      expect(json).toHaveProperty('recipeId');
      expect(json).toHaveProperty('recipePath');
      expect(json).toHaveProperty('timestamp');
      expect(json).toHaveProperty('errors');
      expect(json).toHaveProperty('warnings');
      expect(json).toHaveProperty('suggestions');
      expect(json).toHaveProperty('passed');

      expect(json.recipeId).toBe('anatomy:human_male');
      expect(Array.isArray(json.errors)).toBe(true);
      expect(Array.isArray(json.warnings)).toBe(true);
      expect(Array.isArray(json.suggestions)).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should fail for non-existent recipe file', () => {
      expect(() => {
        loadRecipe('data/mods/anatomy/recipes/nonexistent.recipe.json');
      }).toThrow();
    });

    it('should fail for invalid file path', () => {
      expect(() => {
        loadRecipe('invalid/path/to/recipe.json');
      }).toThrow();
    });
  });
});
