/**
 * @file badgerFolkRecipeValidation.test.js
 * @description Integration test for dredgers:badger_folk_male_standard recipe validation.
 *
 * This test ensures the recipe file loads correctly and validates its body descriptors,
 * specifically testing that "dense" is accepted as a valid composition value.
 *
 * Context: The badger_folk_male_standard.recipe.json uses "composition": "dense"
 * which requires alignment between the anatomy.recipe.schema.json and
 * the bodyDescriptorRegistry.
 */

import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { validateDescriptorValue } from '../../../../src/anatomy/registries/bodyDescriptorRegistry.js';

const RECIPE_PATH = path.resolve(
  process.cwd(),
  'data/mods/dredgers/recipes/badger_folk_male_standard.recipe.json'
);

/**
 * Helper to load the recipe file
 *
 * @returns {object} Parsed recipe JSON
 */
function loadBadgerFolkRecipe() {
  const content = fs.readFileSync(RECIPE_PATH, 'utf-8');
  return JSON.parse(content);
}

describe('dredgers mod: badger_folk_male_standard recipe', () => {
  describe('Recipe file structure', () => {
    it('should have valid recipe file that can be loaded', () => {
      expect(() => loadBadgerFolkRecipe()).not.toThrow();
    });

    it('should have correct schema reference', () => {
      const recipe = loadBadgerFolkRecipe();
      expect(recipe.$schema).toBe(
        'schema://living-narrative-engine/anatomy.recipe.schema.json'
      );
    });

    it('should have correct recipeId in dredgers namespace', () => {
      const recipe = loadBadgerFolkRecipe();
      expect(recipe.recipeId).toBe('dredgers:badger_folk_male_standard');
    });

    it('should reference anatomy-creatures:badger_folk_male blueprint', () => {
      const recipe = loadBadgerFolkRecipe();
      expect(recipe.blueprintId).toBe('anatomy-creatures:badger_folk_male');
    });
  });

  describe('Body descriptors', () => {
    it('should have bodyDescriptors section', () => {
      const recipe = loadBadgerFolkRecipe();
      expect(recipe.bodyDescriptors).toBeDefined();
      expect(typeof recipe.bodyDescriptors).toBe('object');
    });

    it('should have "dense" as composition value', () => {
      const recipe = loadBadgerFolkRecipe();
      expect(recipe.bodyDescriptors.composition).toBe('dense');
    });

    it('should have "stocky" as build value', () => {
      const recipe = loadBadgerFolkRecipe();
      expect(recipe.bodyDescriptors.build).toBe('stocky');
    });

    it('should have "short" as height value', () => {
      const recipe = loadBadgerFolkRecipe();
      expect(recipe.bodyDescriptors.height).toBe('short');
    });

    it('should have "furred" as hairDensity value', () => {
      const recipe = loadBadgerFolkRecipe();
      expect(recipe.bodyDescriptors.hairDensity).toBe('furred');
    });

    it('should have "brown" as skinColor value', () => {
      const recipe = loadBadgerFolkRecipe();
      expect(recipe.bodyDescriptors.skinColor).toBe('brown');
    });
  });

  describe('Body descriptor validation against registry', () => {
    it('should validate "dense" composition against body descriptor registry', () => {
      const recipe = loadBadgerFolkRecipe();
      const result = validateDescriptorValue(
        'composition',
        recipe.bodyDescriptors.composition
      );
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate "stocky" build against body descriptor registry', () => {
      const recipe = loadBadgerFolkRecipe();
      const result = validateDescriptorValue(
        'build',
        recipe.bodyDescriptors.build
      );
      expect(result.valid).toBe(true);
    });

    it('should validate "short" height against body descriptor registry', () => {
      const recipe = loadBadgerFolkRecipe();
      const result = validateDescriptorValue(
        'height',
        recipe.bodyDescriptors.height
      );
      expect(result.valid).toBe(true);
    });

    it('should validate "furred" hairDensity against body descriptor registry', () => {
      const recipe = loadBadgerFolkRecipe();
      const result = validateDescriptorValue(
        'hairDensity',
        recipe.bodyDescriptors.hairDensity
      );
      expect(result.valid).toBe(true);
    });

    it('should validate "brown" skinColor against body descriptor registry', () => {
      const recipe = loadBadgerFolkRecipe();
      const result = validateDescriptorValue(
        'skinColor',
        recipe.bodyDescriptors.skinColor
      );
      expect(result.valid).toBe(true);
    });

    it('should validate all body descriptors in recipe', () => {
      const recipe = loadBadgerFolkRecipe();
      const descriptors = recipe.bodyDescriptors;

      for (const [key, value] of Object.entries(descriptors)) {
        const result = validateDescriptorValue(key, value);
        expect(result.valid).toBe(true);
      }
    });
  });

  describe('Slot definitions', () => {
    it('should have slots section with required anatomy parts', () => {
      const recipe = loadBadgerFolkRecipe();
      expect(recipe.slots).toBeDefined();
      expect(recipe.slots.torso).toBeDefined();
      expect(recipe.slots.head).toBeDefined();
    });

    it('should reference badger-specific parts in anatomy-creatures namespace', () => {
      const recipe = loadBadgerFolkRecipe();
      expect(recipe.slots.torso.preferId).toBe(
        'anatomy-creatures:badger_folk_male_torso'
      );
      expect(recipe.slots.left_ear.preferId).toBe(
        'anatomy-creatures:badger_ear'
      );
      expect(recipe.slots.right_ear.preferId).toBe(
        'anatomy-creatures:badger_ear'
      );
      expect(recipe.slots.tail.preferId).toBe('anatomy-creatures:badger_tail');
    });

    it('should reference badger hands in anatomy-creatures namespace', () => {
      const recipe = loadBadgerFolkRecipe();
      expect(recipe.slots.left_hand.preferId).toBe(
        'anatomy-creatures:badger_hand_demolition_scarred'
      );
      expect(recipe.slots.right_hand.preferId).toBe(
        'anatomy-creatures:badger_hand_demolition_scarred'
      );
    });
  });

  describe('Pattern definitions', () => {
    it('should have patterns for paired body parts', () => {
      const recipe = loadBadgerFolkRecipe();
      expect(recipe.patterns).toBeDefined();
      expect(Array.isArray(recipe.patterns)).toBe(true);
      expect(recipe.patterns.length).toBeGreaterThan(0);
    });

    it('should have eye pattern using humanoid eye parts', () => {
      const recipe = loadBadgerFolkRecipe();
      const eyePattern = recipe.patterns.find(
        (p) => p.matches?.includes('left_eye') && p.matches?.includes('right_eye')
      );
      expect(eyePattern).toBeDefined();
      expect(eyePattern.partType).toBe('eye');
    });
  });
});
