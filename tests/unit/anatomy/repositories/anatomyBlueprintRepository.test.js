/**
 * @file Unit tests for AnatomyBlueprintRepository
 * @see src/anatomy/repositories/anatomyBlueprintRepository.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import AnatomyBlueprintRepository from '../../../../src/anatomy/repositories/anatomyBlueprintRepository.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';

describe('AnatomyBlueprintRepository', () => {
  let repository;
  let mockLogger;
  let mockDataRegistry;

  beforeEach(() => {
    mockLogger = createMockLogger();

    // Create mock data registry
    mockDataRegistry = {
      get: jest.fn(),
    };

    repository = new AnatomyBlueprintRepository({
      logger: mockLogger,
      dataRegistry: mockDataRegistry,
    });
  });

  describe('constructor', () => {
    it('should initialize with required dependencies', () => {
      expect(repository).toBeDefined();
    });

    it('should throw error if logger is missing', () => {
      expect(() => {
        new AnatomyBlueprintRepository({
          dataRegistry: mockDataRegistry,
        });
      }).toThrow();
    });

    it('should throw error if dataRegistry is missing', () => {
      expect(() => {
        new AnatomyBlueprintRepository({
          logger: mockLogger,
        });
      }).toThrow();
    });
  });

  describe('getRecipe', () => {
    it('should retrieve a recipe by ID', async () => {
      const testRecipe = {
        id: 'test:humanoid_recipe',
        blueprintId: 'test:humanoid_blueprint',
      };

      mockDataRegistry.get.mockReturnValue(testRecipe);

      const result = await repository.getRecipe('test:humanoid_recipe');

      expect(mockDataRegistry.get).toHaveBeenCalledWith(
        'anatomyRecipes',
        'test:humanoid_recipe'
      );
      expect(result).toEqual(testRecipe);
    });

    it('should return null if recipe not found', async () => {
      mockDataRegistry.get.mockReturnValue(null);

      const result = await repository.getRecipe('nonexistent:recipe');

      expect(result).toBeNull();
    });

    it('should handle invalid recipe ID', async () => {
      const result = await repository.getRecipe(null);
      expect(result).toBeNull();

      const result2 = await repository.getRecipe('');
      expect(result2).toBeNull();

      const result3 = await repository.getRecipe(123);
      expect(result3).toBeNull();
    });

    it('should handle dataRegistry errors', async () => {
      mockDataRegistry.get.mockImplementation(() => {
        throw new Error('Registry error');
      });

      const result = await repository.getRecipe('test:recipe');

      expect(result).toBeNull();
    });
  });

  describe('getBlueprint', () => {
    it('should retrieve a blueprint by ID', async () => {
      const testBlueprint = {
        id: 'test:humanoid_blueprint',
        root: { type: 'test:torso' },
        slots: {},
      };

      mockDataRegistry.get.mockReturnValue(testBlueprint);

      const result = await repository.getBlueprint('test:humanoid_blueprint');

      expect(mockDataRegistry.get).toHaveBeenCalledWith(
        'anatomyBlueprints',
        'test:humanoid_blueprint'
      );
      expect(result).toEqual(testBlueprint);
    });

    it('should return null if blueprint not found', async () => {
      mockDataRegistry.get.mockReturnValue(null);

      const result = await repository.getBlueprint('nonexistent:blueprint');

      expect(result).toBeNull();
    });

    it('should handle invalid blueprint ID', async () => {
      const result = await repository.getBlueprint(null);
      expect(result).toBeNull();

      const result2 = await repository.getBlueprint('');
      expect(result2).toBeNull();

      const result3 = await repository.getBlueprint(123);
      expect(result3).toBeNull();
    });

    it('should handle dataRegistry errors', async () => {
      mockDataRegistry.get.mockImplementation(() => {
        throw new Error('Registry error');
      });

      const result = await repository.getBlueprint('test:blueprint');

      expect(result).toBeNull();
    });
  });

  describe('getBlueprintByRecipeId', () => {
    const testRecipe = {
      id: 'test:humanoid_recipe',
      blueprintId: 'test:humanoid_blueprint',
    };

    const testBlueprint = {
      id: 'test:humanoid_blueprint',
      root: { type: 'test:torso' },
      slots: {},
    };

    beforeEach(() => {
      // Reset the mock to return different values for different calls
      mockDataRegistry.get.mockImplementation((category, id) => {
        if (category === 'anatomyRecipes' && id === 'test:humanoid_recipe') {
          return testRecipe;
        }
        if (
          category === 'anatomyBlueprints' &&
          id === 'test:humanoid_blueprint'
        ) {
          return testBlueprint;
        }
        return null;
      });
    });

    it('should retrieve blueprint using recipe ID', async () => {
      const result = await repository.getBlueprintByRecipeId(
        'test:humanoid_recipe'
      );

      expect(mockDataRegistry.get).toHaveBeenCalledWith(
        'anatomyRecipes',
        'test:humanoid_recipe'
      );
      expect(mockDataRegistry.get).toHaveBeenCalledWith(
        'anatomyBlueprints',
        'test:humanoid_blueprint'
      );
      expect(result).toEqual(testBlueprint);
    });

    it('should cache blueprint result', async () => {
      // First call
      const result1 = await repository.getBlueprintByRecipeId(
        'test:humanoid_recipe'
      );
      expect(result1).toEqual(testBlueprint);

      // Reset mock call count
      mockDataRegistry.get.mockClear();

      // Second call should use cache
      const result2 = await repository.getBlueprintByRecipeId(
        'test:humanoid_recipe'
      );
      expect(result2).toEqual(testBlueprint);

      // Should not call dataRegistry again since it's cached
      expect(mockDataRegistry.get).not.toHaveBeenCalled();
    });

    it('should return null if recipe not found', async () => {
      mockDataRegistry.get.mockReturnValue(null);

      const result =
        await repository.getBlueprintByRecipeId('nonexistent:recipe');

      expect(result).toBeNull();
    });

    it('should return null if recipe has no blueprintId', async () => {
      const recipeWithoutBlueprint = { id: 'test:recipe' };

      mockDataRegistry.get.mockImplementation((category) => {
        if (category === 'anatomyRecipes') {
          return recipeWithoutBlueprint;
        }
        return null;
      });

      const result = await repository.getBlueprintByRecipeId('test:recipe');

      expect(result).toBeNull();
    });

    it('should return null if blueprint not found', async () => {
      mockDataRegistry.get.mockImplementation((category, lookupId) => {
        if (
          category === 'anatomyRecipes' &&
          lookupId === 'test:humanoid_recipe'
        ) {
          return testRecipe;
        }
        return null; // Blueprint not found
      });

      const result = await repository.getBlueprintByRecipeId(
        'test:humanoid_recipe'
      );

      expect(result).toBeNull();
    });

    it('should handle invalid recipe ID', async () => {
      const result = await repository.getBlueprintByRecipeId(null);
      expect(result).toBeNull();

      const result2 = await repository.getBlueprintByRecipeId('');
      expect(result2).toBeNull();

      const result3 = await repository.getBlueprintByRecipeId(123);
      expect(result3).toBeNull();
    });

    it('should handle errors in recipe lookup', async () => {
      mockDataRegistry.get.mockImplementation((category) => {
        if (category === 'anatomyRecipes') {
          throw new Error('Recipe lookup error');
        }
        return null;
      });

      const result = await repository.getBlueprintByRecipeId('test:recipe');

      expect(result).toBeNull();
    });

    it('should handle errors in blueprint lookup', async () => {
      mockDataRegistry.get.mockImplementation((category) => {
        if (category === 'anatomyRecipes') {
          return testRecipe;
        }
        if (category === 'anatomyBlueprints') {
          throw new Error('Blueprint lookup error');
        }
        return null;
      });

      const result = await repository.getBlueprintByRecipeId(
        'test:humanoid_recipe'
      );

      expect(result).toBeNull();
    });

    it('should log and return null when unexpected error occurs', async () => {
      const error = new Error('Unexpected failure');
      jest.spyOn(repository, 'getRecipe').mockRejectedValue(error);

      const result = await repository.getBlueprintByRecipeId(
        'test:humanoid_recipe'
      );

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          "Failed to retrieve blueprint for recipe 'test:humanoid_recipe'"
        ),
        error
      );
    });
  });

  describe('clearCache', () => {
    it('should clear blueprint cache', async () => {
      const testRecipe = {
        id: 'test:humanoid_recipe',
        blueprintId: 'test:humanoid_blueprint',
      };

      const testBlueprint = {
        id: 'test:humanoid_blueprint',
        root: { type: 'test:torso' },
      };

      mockDataRegistry.get.mockImplementation((category) => {
        if (category === 'anatomyRecipes') {
          return testRecipe;
        }
        if (category === 'anatomyBlueprints') {
          return testBlueprint;
        }
        return null;
      });

      // Populate cache
      await repository.getBlueprintByRecipeId('test:humanoid_recipe');

      // Clear mock to verify cache usage
      mockDataRegistry.get.mockClear();

      // Verify cache is working (no calls to dataRegistry)
      const cachedResult = await repository.getBlueprintByRecipeId(
        'test:humanoid_recipe'
      );
      expect(cachedResult).toEqual(testBlueprint);
      expect(mockDataRegistry.get).not.toHaveBeenCalled();

      // Clear cache
      repository.clearCache();

      // Verify cache is cleared (calls dataRegistry again)
      await repository.getBlueprintByRecipeId('test:humanoid_recipe');
      expect(mockDataRegistry.get).toHaveBeenCalled();
    });
  });

  describe('getBlueprint - Wizard ID mismatch scenario', () => {
    it('should return null when trying to get blueprint by non-namespaced ID when registry stores by full ID', async () => {
      // This reproduces the wizard bug where getAll returns blueprints with
      // id="giant_spider" but registry stores them as "anatomy:giant_spider"
      mockDataRegistry.get.mockImplementation((category, id) => {
        // Simulate registry storing by full ID only
        if (category === 'anatomyBlueprints' && id === 'anatomy:human_female') {
          return {
            id: 'anatomy:human_female',
            root: 'anatomy:torso',
            slots: {},
          };
        }
        // Non-namespaced ID returns null
        if (category === 'anatomyBlueprints' && id === 'human_female') {
          return null;
        }
        return null;
      });

      // This is what the wizard does - tries to get by non-namespaced ID
      const result = await repository.getBlueprint('human_female');
      expect(result).toBeNull();

      // But the full ID works
      const result2 = await repository.getBlueprint('anatomy:human_female');
      expect(result2).not.toBeNull();
      expect(result2.id).toBe('anatomy:human_female');
    });
  });
});
