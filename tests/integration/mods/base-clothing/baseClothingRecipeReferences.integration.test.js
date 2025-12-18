/**
 * @file Integration tests for CLOLAYMIG-012: Base-clothing recipe reference updates
 * Validates that all recipe files now reference base-clothing:* entities instead of clothing:*
 * and that mod manifests have the base-clothing dependency
 * @see tickets/CLOLAYMIG-012-base-clothing-update-references.md
 */

import { describe, it, expect } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';

describe('CLOLAYMIG-012: Base-Clothing Recipe Reference Updates', () => {
  // Recipe files and their expected base-clothing entity references
  // Note: These are the current expected references - may change as recipes are updated
  const recipeConfig = {
    'data/mods/fantasy/recipes/threadscar_melissa.recipe.json': [
      'base-clothing:sleeveless_linen_tunic_charcoal',
      'base-clothing:wool_linen_trousers',
      'base-clothing:black_leather_duty_boots',
    ],
    'data/mods/fantasy/recipes/bertram_the_muddy.recipe.json': [
      'base-clothing:shale_gray_nylon_field_pants',
      'base-clothing:charcoal_wool_tshirt',
      'base-clothing:black_leather_duty_boots',
    ],
    'data/mods/fantasy/recipes/vespera_nightwhisper.recipe.json': [
      'base-clothing:cream_poets_shirt_billowing_sleeves',
      'base-clothing:black_breeches_tapered_knee',
      'base-clothing:digitigrade_foot_wraps_burgundy',
    ],
    'data/mods/patrol/recipes/dylan_crace.recipe.json': [
      'base-clothing:shale_gray_nylon_field_pants',
      'base-clothing:charcoal_wool_tshirt',
      'base-clothing:black_leather_duty_boots',
    ],
    'data/mods/patrol/recipes/len_amezua.recipe.json': [
      'base-clothing:shale_gray_nylon_field_pants',
      'base-clothing:black_leather_duty_boots',
    ],
  };

  // Entity names that should NOT have clothing: prefix anymore in recipes
  // These are base-layer items that have been migrated to base-clothing namespace
  const migratedEntityNames = [
    'shale_gray_nylon_field_pants',
    'charcoal_wool_tshirt',
    'black_leather_duty_boots',
    'cream_poets_shirt_billowing_sleeves',
    'black_breeches_tapered_knee',
    'digitigrade_foot_wraps_burgundy',
    'sleeveless_linen_tunic_charcoal',
    'wool_linen_trousers',
  ];

  describe('Recipe Reference Migration', () => {
    for (const [recipePath, expectedRefs] of Object.entries(recipeConfig)) {
      const recipeName = path.basename(recipePath);

      describe(`${recipeName}`, () => {
        it('should reference base-clothing entities with correct namespace', async () => {
          const fullPath = path.resolve(recipePath);
          const content = await fs.readFile(fullPath, 'utf8');
          const recipe = JSON.parse(content);

          const entityIds = recipe.clothingEntities.map((e) => e.entityId);

          for (const expectedRef of expectedRefs) {
            expect(entityIds).toContain(expectedRef);
          }
        });

        it('should NOT have old clothing: prefix for migrated entities', async () => {
          const fullPath = path.resolve(recipePath);
          const content = await fs.readFile(fullPath, 'utf8');
          const recipe = JSON.parse(content);

          const entityIds = recipe.clothingEntities.map((e) => e.entityId);

          for (const entityName of migratedEntityNames) {
            const oldId = `clothing:${entityName}`;
            expect(entityIds).not.toContain(oldId);
          }
        });
      });
    }
  });

  describe('Global Recipe Validation', () => {
    it('should have at least the expected base-clothing references across all recipes', async () => {
      let totalBaseClothingRefs = 0;
      const expectedTotalRefs = Object.values(recipeConfig).reduce(
        (sum, refs) => sum + refs.length,
        0
      );

      for (const recipePath of Object.keys(recipeConfig)) {
        const fullPath = path.resolve(recipePath);
        const content = await fs.readFile(fullPath, 'utf8');
        const recipe = JSON.parse(content);

        const baseClothingRefs = recipe.clothingEntities.filter((e) =>
          e.entityId.startsWith('base-clothing:')
        );
        totalBaseClothingRefs += baseClothingRefs.length;
      }

      // Should have at least the expected references (may have more as recipes are updated)
      expect(totalBaseClothingRefs).toBeGreaterThanOrEqual(expectedTotalRefs);
    });

    it('should not have clothing: prefix for any base-layer items in recipes', async () => {
      for (const recipePath of Object.keys(recipeConfig)) {
        const fullPath = path.resolve(recipePath);
        const content = await fs.readFile(fullPath, 'utf8');
        const recipe = JSON.parse(content);

        for (const entityName of migratedEntityNames) {
          const oldId = `clothing:${entityName}`;
          const hasOldRef = recipe.clothingEntities.some(
            (e) => e.entityId === oldId
          );
          expect(hasOldRef).toBe(false);
        }
      }
    });
  });

  describe('Mod Manifest Dependencies', () => {
    it('should have base-clothing dependency in fantasy mod manifest', async () => {
      const manifestPath = path.resolve('data/mods/fantasy/mod-manifest.json');
      const content = await fs.readFile(manifestPath, 'utf8');
      const manifest = JSON.parse(content);

      const dependencyIds = manifest.dependencies.map((d) => d.id);
      expect(dependencyIds).toContain('base-clothing');
    });

    it('should have base-clothing dependency in patrol mod manifest', async () => {
      const manifestPath = path.resolve('data/mods/patrol/mod-manifest.json');
      const content = await fs.readFile(manifestPath, 'utf8');
      const manifest = JSON.parse(content);

      const dependencyIds = manifest.dependencies.map((d) => d.id);
      expect(dependencyIds).toContain('base-clothing');
    });

    it('should still have clothing dependency (infrastructure) in fantasy manifest', async () => {
      const fantasyPath = path.resolve('data/mods/fantasy/mod-manifest.json');

      const fantasyContent = await fs.readFile(fantasyPath, 'utf8');

      const fantasyManifest = JSON.parse(fantasyContent);

      const fantasyDeps = fantasyManifest.dependencies.map((d) => d.id);

      // clothing mod provides infrastructure (components, actions, rules)
      // Note: patrol mod only needs base-clothing for its recipes, not full clothing infrastructure
      expect(fantasyDeps).toContain('clothing');
    });
  });

  describe('Entity Resolution Correctness', () => {
    it('should have matching base-clothing entities for all recipe references', async () => {
      const baseClothingEntitiesPath = path.resolve(
        'data/mods/base-clothing/entities/definitions'
      );
      const entityFiles = await fs.readdir(baseClothingEntitiesPath);
      const entityNames = entityFiles.map((f) => f.replace('.entity.json', ''));

      for (const entityName of migratedEntityNames) {
        expect(entityNames).toContain(entityName);
      }
    });
  });
});
