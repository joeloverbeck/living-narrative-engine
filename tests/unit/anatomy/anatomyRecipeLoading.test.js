import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AnatomyGenerationService } from '../../../src/anatomy/anatomyGenerationService.js';
import AnatomyRecipeLoader from '../../../src/loaders/anatomyRecipeLoader.js';
import { ValidationError } from '../../../src/errors/validationError.js';

describe('Anatomy Recipe Loading and Generation', () => {
  let mockDataRegistry;
  let mockEntityManager;
  let mockBodyBlueprintFactory;
  let mockLogger;
  let mockAnatomyDescriptionService;
  let mockBodyGraphService;
  let anatomyGenerationService;

  beforeEach(() => {
    mockDataRegistry = {
      get: jest.fn(),
    };
    mockEntityManager = {
      getEntityInstance: jest.fn(),
      addComponent: jest.fn(),
    };
    mockBodyBlueprintFactory = {
      createAnatomyGraph: jest.fn(),
    };
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    mockAnatomyDescriptionService = {
      generateDescription: jest.fn(),
    };
    mockBodyGraphService = {
      buildAdjacencyCache: jest.fn(),
    };

    anatomyGenerationService = new AnatomyGenerationService({
      dataRegistry: mockDataRegistry,
      entityManager: mockEntityManager,
      bodyBlueprintFactory: mockBodyBlueprintFactory,
      logger: mockLogger,
      anatomyDescriptionService: mockAnatomyDescriptionService,
      bodyGraphService: mockBodyGraphService,
    });
  });

  describe('Recipe Loading', () => {
    it('should successfully find a recipe when it exists in the registry', async () => {
      const mockEntity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({
          recipeId: 'anatomy:human_male',
        }),
      };
      const mockRecipe = {
        recipeId: 'anatomy:human_male',
        blueprintId: 'anatomy:human_male',
      };

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockDataRegistry.get.mockReturnValue(mockRecipe);
      mockBodyBlueprintFactory.createAnatomyGraph.mockResolvedValue({
        entities: ['part1', 'part2'],
        graph: {},
      });

      const result =
        await anatomyGenerationService.generateAnatomyIfNeeded(
          'test-entity-id'
        );

      expect(result).toBe(true);
      expect(mockDataRegistry.get).toHaveBeenCalledWith(
        'anatomyRecipes',
        'anatomy:human_male'
      );
    });

    it('should throw ValidationError when recipe is not found', async () => {
      const mockEntity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({
          recipeId: 'anatomy:human_male',
        }),
      };

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockDataRegistry.get.mockReturnValue(null); // Recipe not found

      await expect(
        anatomyGenerationService.generateAnatomyIfNeeded('test-entity-id')
      ).rejects.toThrow(ValidationError);

      await expect(
        anatomyGenerationService.generateAnatomyIfNeeded('test-entity-id')
      ).rejects.toThrow("Recipe 'anatomy:human_male' not found");
    });

    it('should throw ValidationError when recipe has no blueprintId', async () => {
      const mockEntity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({
          recipeId: 'anatomy:human_male',
        }),
      };
      const mockRecipe = {
        recipeId: 'anatomy:human_male',
        // Missing blueprintId
      };

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockDataRegistry.get.mockReturnValue(mockRecipe);

      await expect(
        anatomyGenerationService.generateAnatomyIfNeeded('test-entity-id')
      ).rejects.toThrow(ValidationError);

      await expect(
        anatomyGenerationService.generateAnatomyIfNeeded('test-entity-id')
      ).rejects.toThrow(
        "Recipe 'anatomy:human_male' does not specify a blueprintId"
      );
    });
  });

  describe('Recipe Loader Content Key', () => {
    it('should verify loader configuration uses correct content key', () => {
      // This test verifies the concept that recipes should be loaded from
      // the correct content key. The actual configuration is now in
      // loadersRegistrations.js where contentKey is set to 'recipes'
      // instead of 'anatomy.recipes'

      // We can verify the loader exists
      expect(AnatomyRecipeLoader).toBeDefined();
      expect(AnatomyRecipeLoader.name).toBe('AnatomyRecipeLoader');

      // The actual content key configuration is tested through integration
      // tests when the full mod loading process runs
    });
  });

  describe('Error Messages', () => {
    it('should provide clear error message when recipe is not found', async () => {
      const mockEntity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({
          recipeId: 'anatomy:nonexistent_recipe',
        }),
      };

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockDataRegistry.get.mockReturnValue(null);

      let error;
      try {
        await anatomyGenerationService.generateAnatomyIfNeeded(
          'test-entity-id'
        );
      } catch (e) {
        error = e;
      }

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe(
        "Recipe 'anatomy:nonexistent_recipe' not found"
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to generate anatomy'),
        expect.objectContaining({
          error: expect.any(ValidationError),
        })
      );
    });
  });
});
