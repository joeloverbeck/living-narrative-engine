/**
 * @file Integration tests for socket extractor namespace resolution
 * @description Tests that entity resolution correctly selects entities with sockets
 *              when multiple candidates exist across different namespaces.
 *
 * Bug: After migrating creature anatomy files from anatomy/ to anatomy-creatures/,
 * recipes like cat_girl.recipe.json fail validation with "Socket 'X' not found on parent slot 'head'"
 *
 * Root cause: resolveEntityId() prefers entities from the same namespace as the blueprint,
 * causing anatomy-creatures:kraken_head (no sockets) to be selected over anatomy:humanoid_head
 * (has all sockets) when validating anatomy-creatures blueprints.
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureMinimalContainer } from '../../../src/dependencyInjection/minimalContainerConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '../../..');

/**
 * Load a recipe file from disk
 * @param {string} recipePath - Path relative to project root
 * @returns {object} Parsed recipe
 */
function loadRecipe(recipePath) {
  const fullPath = path.join(projectRoot, recipePath);
  const content = fs.readFileSync(fullPath, 'utf-8');
  return JSON.parse(content);
}

describe('Socket Extractor Namespace Resolution', () => {
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
        return Promise.reject(
          new Error(`Failed to load ${url}: ${error.message}`)
        );
      }
    });

    // Create and configure container
    const container = new AppContainer();
    await configureMinimalContainer(container);

    // Get services needed for mod loading
    const dataRegistry = container.resolve(tokens.IDataRegistry);

    // Load essential mods
    const { createLoadContext } = await import(
      '../../../src/loaders/LoadContext.js'
    );

    const loadContext = createLoadContext({
      worldName: 'test-world',
      requestedMods: ['core', 'descriptors', 'anatomy', 'anatomy-creatures'],
      registry: dataRegistry,
    });

    // Execute loading phases
    const schemaPhase = container.resolve(tokens.SchemaPhase);
    const manifestPhase = container.resolve(tokens.ManifestPhase);
    const contentPhase = container.resolve(tokens.ContentPhase);

    let context = await schemaPhase.execute(loadContext);
    context = await manifestPhase.execute(context);
    await contentPhase.execute(context);

    // Create validator using DI container
    validator = container.resolve(tokens.IRecipeValidationRunner);
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe('Cross-namespace entity resolution', () => {
    it('should validate cat_girl recipe successfully (anatomy-creatures namespace)', async () => {
      // This test validates the bug fix:
      // cat_girl.blueprint uses anatomy-creatures namespace but needs humanoid_head sockets
      // from anatomy namespace. Before fix: selects kraken_head (no sockets) → fails
      // After fix: selects humanoid_head (has sockets) → passes
      const recipe = loadRecipe(
        'data/mods/anatomy-creatures/recipes/cat_girl.recipe.json'
      );
      const report = await validator.validate(recipe, {
        recipePath: 'data/mods/anatomy-creatures/recipes/cat_girl.recipe.json',
      });

      // The bug causes these specific socket errors:
      // "Socket 'left_ear' not found on parent slot 'head'"
      // "Socket 'right_ear' not found on parent slot 'head'"
      // etc.
      const socketErrors = report.errors.filter(
        (e) =>
          e.message?.includes('not found on parent slot') ||
          e.type === 'SOCKET_NOT_FOUND_ON_PARENT'
      );

      expect(socketErrors).toHaveLength(0);
      expect(report.isValid).toBe(true);
      expect(report.summary.recipeId).toBe('anatomy-creatures:cat_girl_standard');
    });

    it('should validate human_female recipe successfully (anatomy namespace baseline)', async () => {
      // This test should always pass - it's the baseline that works
      // because it's in anatomy namespace and prefers anatomy:humanoid_head
      const recipe = loadRecipe(
        'data/mods/anatomy/recipes/human_female.recipe.json'
      );
      const report = await validator.validate(recipe, {
        recipePath: 'data/mods/anatomy/recipes/human_female.recipe.json',
      });

      expect(report.isValid).toBe(true);
      expect(report.errors.length).toBe(0);
    });

    it('should prefer entities with sockets over entities without sockets', async () => {
      // Both cat_girl and human_female need head entities with sockets
      // They should both resolve to humanoid_head (which has sockets)
      // rather than kraken_head (which has no sockets)
      const catGirlRecipe = loadRecipe(
        'data/mods/anatomy-creatures/recipes/cat_girl.recipe.json'
      );
      const humanFemaleRecipe = loadRecipe(
        'data/mods/anatomy/recipes/human_female.recipe.json'
      );

      const catGirlReport = await validator.validate(catGirlRecipe, {
        recipePath: 'data/mods/anatomy-creatures/recipes/cat_girl.recipe.json',
      });
      const humanFemaleReport = await validator.validate(humanFemaleRecipe, {
        recipePath: 'data/mods/anatomy/recipes/human_female.recipe.json',
      });

      // Both should pass - the key insight is that cat_girl should NOT have
      // socket errors even though it's in a different namespace
      expect(catGirlReport.isValid).toBe(true);
      expect(humanFemaleReport.isValid).toBe(true);

      // Neither should have socket-related errors
      const catGirlSocketErrors = catGirlReport.errors.filter(
        (e) =>
          e.message?.includes('Socket') ||
          e.type?.includes('SOCKET')
      );
      const humanFemaleSocketErrors = humanFemaleReport.errors.filter(
        (e) =>
          e.message?.includes('Socket') ||
          e.type?.includes('SOCKET')
      );

      expect(catGirlSocketErrors).toHaveLength(0);
      expect(humanFemaleSocketErrors).toHaveLength(0);
    });
  });

  describe('Entity resolution for slots with child sockets', () => {
    it('should resolve head entity with required child sockets for left_ear slot', async () => {
      // cat_girl blueprint has a slot "left_ear" with socket: "left_ear" and parent: "head"
      // This requires the head entity to have a "left_ear" socket
      // humanoid_head has it, kraken_head does not
      const recipe = loadRecipe(
        'data/mods/anatomy-creatures/recipes/cat_girl.recipe.json'
      );
      const report = await validator.validate(recipe, {
        recipePath: 'data/mods/anatomy-creatures/recipes/cat_girl.recipe.json',
      });

      // After fix, should not have left_ear socket errors
      const leftEarErrors = report.errors.filter(
        (e) => e.message?.includes('left_ear') && e.message?.includes('Socket')
      );

      expect(leftEarErrors).toHaveLength(0);
    });

    it('should resolve head entity with required child sockets for eye slots', async () => {
      // Similar test for eye sockets
      const recipe = loadRecipe(
        'data/mods/anatomy-creatures/recipes/cat_girl.recipe.json'
      );
      const report = await validator.validate(recipe, {
        recipePath: 'data/mods/anatomy-creatures/recipes/cat_girl.recipe.json',
      });

      // After fix, should not have eye socket errors
      const eyeErrors = report.errors.filter(
        (e) =>
          (e.message?.includes('left_eye') || e.message?.includes('right_eye')) &&
          e.message?.includes('Socket')
      );

      expect(eyeErrors).toHaveLength(0);
    });
  });
});
