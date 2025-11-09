import { describe, it, expect, beforeEach } from '@jest/globals';
import DefaultPathResolver from '../../../src/pathing/defaultPathResolver.js';
import StaticConfiguration from '../../../src/configuration/staticConfiguration.js';

describe('Anatomy Recipe Loading Integration', () => {
  let pathResolver;
  let config;

  beforeEach(() => {
    config = new StaticConfiguration();
    pathResolver = new DefaultPathResolver(config);
  });

  describe('Path Resolution', () => {
    it('should resolve anatomy recipe paths correctly without duplication', () => {
      const recipePath = pathResolver.resolveModContentPath(
        'anatomy',
        'recipes',
        'human_male.recipe.json'
      );

      expect(recipePath).toBe(
        './data/mods/anatomy/recipes/human_male.recipe.json'
      );
      expect(recipePath).not.toContain('anatomy/anatomy');
    });

    it('should resolve anatomy blueprint paths correctly without duplication', () => {
      const blueprintPath = pathResolver.resolveModContentPath(
        'anatomy',
        'blueprints',
        'human_female.blueprint.json'
      );

      expect(blueprintPath).toBe(
        './data/mods/anatomy/blueprints/human_female.blueprint.json'
      );
      expect(blueprintPath).not.toContain('anatomy/anatomy');
    });

    it('should handle all anatomy recipe files from manifest', () => {
      const recipeFiles = [
        'human_male.recipe.json',
        'human_female.recipe.json',
        'human_futa.recipe.json',
      ];

      recipeFiles.forEach((filename) => {
        const path = pathResolver.resolveModContentPath(
          'anatomy',
          'recipes',
          filename
        );
        expect(path).toBe(`./data/mods/anatomy/recipes/${filename}`);
        expect(path).not.toContain('anatomy/anatomy');
      });
    });

    it('should handle all anatomy blueprint files from manifest', () => {
      const blueprintFiles = [
        'human_male.blueprint.json',
        'human_female.blueprint.json',
      ];

      blueprintFiles.forEach((filename) => {
        const path = pathResolver.resolveModContentPath(
          'anatomy',
          'blueprints',
          filename
        );
        expect(path).toBe(`./data/mods/anatomy/blueprints/${filename}`);
        expect(path).not.toContain('anatomy/anatomy');
      });
    });
  });

  describe('Loader Meta Configuration', () => {
    it('should have correct diskFolder values in loader metadata', async () => {
      const { meta } = await import('../../../src/loaders/loaderMeta.js');

      expect(meta.anatomyRecipes.diskFolder).toBe('recipes');
      expect(meta.anatomyRecipes.diskFolder).not.toBe('anatomy/recipes');

      expect(meta.anatomyBlueprints.diskFolder).toBe('blueprints');
      expect(meta.anatomyBlueprints.diskFolder).not.toBe('anatomy/blueprints');
    });
  });
});
