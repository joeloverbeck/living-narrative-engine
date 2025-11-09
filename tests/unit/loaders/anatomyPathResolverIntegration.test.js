import { jest } from '@jest/globals';
import DefaultPathResolver from '../../../src/pathing/defaultPathResolver.js';

describe('Anatomy Path Resolver Integration', () => {
  let pathResolver;
  let mockConfig;

  beforeEach(() => {
    mockConfig = {
      getBaseDataPath: jest.fn().mockReturnValue('./data'),
      getModsBasePath: jest.fn().mockReturnValue('mods'),
      getSchemaBasePath: jest.fn().mockReturnValue('schemas'),
      getContentBasePath: jest.fn().mockReturnValue('content'),
      getGameConfigFilename: jest.fn().mockReturnValue('game.json'),
      getModManifestFilename: jest.fn().mockReturnValue('mod-manifest.json'),
    };

    pathResolver = new DefaultPathResolver(mockConfig);
  });

  describe('resolveModContentPath for anatomy content', () => {
    it('should resolve anatomy recipe paths correctly', () => {
      const result = pathResolver.resolveModContentPath(
        'anatomy',
        'recipes',
        'human_male.recipe.json'
      );

      expect(result).toBe('./data/mods/anatomy/recipes/human_male.recipe.json');
    });

    it('should resolve anatomy blueprint paths correctly', () => {
      const result = pathResolver.resolveModContentPath(
        'anatomy',
        'blueprints',
        'human_female.blueprint.json'
      );

      expect(result).toBe(
        './data/mods/anatomy/blueprints/human_female.blueprint.json'
      );
    });

    it('should NOT create duplicate anatomy folders', () => {
      const recipePath = pathResolver.resolveModContentPath(
        'anatomy',
        'recipes',
        'human_female.recipe.json'
      );

      expect(recipePath).not.toContain('anatomy/anatomy');
      expect(recipePath).toBe(
        './data/mods/anatomy/recipes/human_female.recipe.json'
      );

      const blueprintPath = pathResolver.resolveModContentPath(
        'anatomy',
        'blueprints',
        'human_male.blueprint.json'
      );

      expect(blueprintPath).not.toContain('anatomy/anatomy');
      expect(blueprintPath).toBe(
        './data/mods/anatomy/blueprints/human_male.blueprint.json'
      );
    });

    it('should handle nested paths like entities correctly', () => {
      const result = pathResolver.resolveModContentPath(
        'anatomy',
        'entities/definitions',
        'human_eye_brown.entity.json'
      );

      expect(result).toBe(
        './data/mods/anatomy/entities/definitions/human_eye_brown.entity.json'
      );
    });

    it('should work correctly with different mod IDs', () => {
      const result = pathResolver.resolveModContentPath(
        'custom-anatomy-mod',
        'recipes',
        'alien.recipe.json'
      );

      expect(result).toBe(
        './data/mods/custom-anatomy-mod/recipes/alien.recipe.json'
      );
    });
  });

  describe('Path construction edge cases', () => {
    it('should handle leading/trailing slashes correctly', () => {
      mockConfig.getBaseDataPath.mockReturnValue('./data/');
      mockConfig.getModsBasePath.mockReturnValue('/mods/');

      const newPathResolver = new DefaultPathResolver(mockConfig);

      const result = newPathResolver.resolveModContentPath(
        'anatomy',
        'recipes',
        'test.recipe.json'
      );

      expect(result).not.toContain('//');
      expect(result).toBe('./data/mods/anatomy/recipes/test.recipe.json');
    });

    it('should validate empty parameters', () => {
      expect(() => {
        pathResolver.resolveModContentPath('', 'recipes', 'test.json');
      }).toThrow('Invalid or empty modId');

      expect(() => {
        pathResolver.resolveModContentPath('anatomy', '', 'test.json');
      }).toThrow('Invalid or empty registryKey');

      expect(() => {
        pathResolver.resolveModContentPath('anatomy', 'recipes', '');
      }).toThrow('Invalid or empty filename');
    });
  });
});
