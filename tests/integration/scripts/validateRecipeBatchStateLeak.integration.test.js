/**
 * @file Integration tests for batch recipe validation state leakage bug
 * @description Tests that validating recipes from different mods with different
 * blueprint types (composed vs structure-template) in the same batch works correctly.
 *
 * Bug reproduction:
 * When validating recipes in batch, the AnatomyBlueprintRepository singleton's cache
 * persists between validations. If recipe A uses blueprint type X and recipe B uses
 * blueprint type Y, cached data from A can corrupt validation of B.
 *
 * @see https://github.com/joeloverbeck/living-narrative-engine/issues/TBD
 */

import {
  describe,
  it,
  expect,
  jest,
  beforeAll,
  afterAll,
  beforeEach,
} from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '../../..');

const chalkStub = {
  blue: (text) => text,
  red: (text) => text,
  yellow: (text) => text,
  green: (text) => text,
  bold: (text) => text,
};

jest.mock('chalk', () => ({
  __esModule: true,
  default: chalkStub,
}));

describe('validate-recipe batch state leakage bug', () => {
  let originalFetch;
  let cachedContext;
  let loadRecipeFile;

  beforeAll(async () => {
    // Set up fetch mock first - this is needed for context creation
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
        return Promise.reject(
          new Error(`Failed to load ${url}: ${error.message}`)
        );
      }
    });

    // Import the validation functions
    const validateRecipeModule = await import(
      '../../../scripts/validate-recipe-v2.js'
    );
    loadRecipeFile = validateRecipeModule.loadRecipeFile;

    // Create validation context ONCE for all tests
    // This is the key optimization - context creation is expensive (~350ms)
    // but can be safely reused since schemas and registry are immutable
    cachedContext = await validateRecipeModule.createValidationContext({
      verbose: false,
      recipePaths: [],
      inferredMods: ['anatomy', 'anatomy-creatures'],
      runtimeOverrides: {},
    });
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    // Clear blueprint cache BEFORE each test to prevent state leakage
    // between recipes using different blueprint types (composed vs structure-template)
    // This is the same clearing that happens in validate-recipe-v2.js line 230
    cachedContext.anatomyBlueprintRepository?.clearCache?.();
  });

  /**
   * Helper to run validation using cached context
   * This is much faster than runValidation() which creates a new context each time
   *
   * @param {string[]} recipePaths - Recipe paths relative to project root
   * @returns {Promise<{exitCode: number, results: Array}>}
   */
  async function validateBatch(recipePaths) {
    const results = [];

    for (const recipePath of recipePaths) {
      try {
        // Clear blueprint cache before each recipe validation
        cachedContext.anatomyBlueprintRepository?.clearCache?.();

        // Load and validate recipe
        const recipeData = await loadRecipeFile(recipePath);
        const report = await cachedContext.validator.validate(recipeData, {
          recipePath,
          failFast: false,
        });
        results.push(report);
      } catch (error) {
        results.push({
          recipePath,
          isValid: false,
          errors: [{ type: 'LOAD_ERROR', message: error.message }],
        });
      }
    }

    return {
      exitCode: results.every((r) => r?.isValid) ? 0 : 1,
      results,
    };
  }

  describe('Individual recipe validation (baseline)', () => {
    it('should validate human_male recipe individually', async () => {
      const result = await validateBatch([
        'data/mods/anatomy/recipes/human_male.recipe.json',
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.results[0]?.isValid).toBe(true);
    });

    it('should validate human_female recipe individually', async () => {
      const result = await validateBatch([
        'data/mods/anatomy/recipes/human_female.recipe.json',
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.results[0]?.isValid).toBe(true);
    });

    it('should validate red_dragon recipe individually', async () => {
      const result = await validateBatch([
        'data/mods/anatomy-creatures/recipes/red_dragon.recipe.json',
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.results[0]?.isValid).toBe(true);
    });
  });

  describe('Mixed-mod batch validation (regression)', () => {
    it('should validate mixed human and creature recipes in batch', async () => {
      // This is the critical test - validates that batch validation
      // doesn't leak state between different blueprint types
      const result = await validateBatch([
        'data/mods/anatomy/recipes/human_male.recipe.json',
        'data/mods/anatomy-creatures/recipes/red_dragon.recipe.json',
      ]);

      // Extract individual results for detailed assertion
      const humanResult = result.results[0];
      const dragonResult = result.results[1];

      // Both should pass individually, and both should pass in batch
      expect(humanResult?.isValid).toBe(true);
      expect(dragonResult?.isValid).toBe(true);
      expect(result.exitCode).toBe(0);
    });

    it('should validate creature then human recipes in batch (order reversed)', async () => {
      // Test the opposite order to catch order-dependent bugs
      const result = await validateBatch([
        'data/mods/anatomy-creatures/recipes/red_dragon.recipe.json',
        'data/mods/anatomy/recipes/human_male.recipe.json',
      ]);

      const dragonResult = result.results[0];
      const humanResult = result.results[1];

      expect(dragonResult?.isValid).toBe(true);
      expect(humanResult?.isValid).toBe(true);
      expect(result.exitCode).toBe(0);
    });

    it('should validate three recipes from mixed mods in batch', async () => {
      const result = await validateBatch([
        'data/mods/anatomy/recipes/human_male.recipe.json',
        'data/mods/anatomy/recipes/human_female.recipe.json',
        'data/mods/anatomy-creatures/recipes/red_dragon.recipe.json',
      ]);

      // All three should pass
      expect(result.results).toHaveLength(3);
      expect(result.results.every((r) => r?.isValid)).toBe(true);
      expect(result.exitCode).toBe(0);
    });
  });

  describe('State isolation verification', () => {
    it('should not have SOCKET_NOT_FOUND_ON_PARENT errors in batch', async () => {
      const result = await validateBatch([
        'data/mods/anatomy/recipes/human_male.recipe.json',
        'data/mods/anatomy-creatures/recipes/red_dragon.recipe.json',
      ]);

      // Check that no SOCKET_NOT_FOUND_ON_PARENT errors exist
      const allErrors = result.results.flatMap((r) => r?.errors || []);
      const socketErrors = allErrors.filter(
        (e) => e?.type === 'SOCKET_NOT_FOUND_ON_PARENT'
      );

      expect(socketErrors).toHaveLength(0);
      if (socketErrors.length > 0) {
        // Helpful error message for debugging
        console.error(
          'Socket errors found (state leakage bug):',
          JSON.stringify(socketErrors, null, 2)
        );
      }
    });
  });
});
