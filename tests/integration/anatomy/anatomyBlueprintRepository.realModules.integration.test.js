import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AnatomyBlueprintRepository from '../../../src/anatomy/repositories/anatomyBlueprintRepository.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import { createMockLogger } from '../../common/mockFactories/index.js';

describe('AnatomyBlueprintRepository (integration)', () => {
  let logger;
  let dataRegistry;
  let repository;

  beforeEach(() => {
    logger = createMockLogger();
    dataRegistry = new InMemoryDataRegistry({ logger });
    repository = new AnatomyBlueprintRepository({
      logger,
      dataRegistry,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getRecipe', () => {
    it('returns null and warns when recipe ID is invalid', async () => {
      const result = await repository.getRecipe('');

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Invalid recipe ID provided to getRecipe")
      );
    });

    it('returns null and logs debug when the recipe is missing', async () => {
      const result = await repository.getRecipe('missing-recipe');

      expect(result).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Recipe 'missing-recipe' not found in registry")
      );
    });

    it('logs an error when the registry throws while fetching a recipe', async () => {
      const failure = new Error('registry unavailable');
      jest.spyOn(dataRegistry, 'get').mockImplementation(() => {
        throw failure;
      });

      const result = await repository.getRecipe('failing-recipe');

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to retrieve recipe 'failing-recipe'"),
        failure
      );
    });

    it('returns the recipe when it exists in the registry', async () => {
      const storedRecipe = { id: 'existing-recipe', blueprintId: 'bp' };
      dataRegistry.store('anatomyRecipes', storedRecipe.id, storedRecipe);

      const result = await repository.getRecipe('existing-recipe');

      expect(result).toEqual(storedRecipe);
    });
  });

  describe('getBlueprint', () => {
    it('returns null and warns when blueprint ID is invalid', async () => {
      const result = await repository.getBlueprint(null);

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Invalid blueprint ID provided to getBlueprint")
      );
    });

    it('returns null and logs debug when the blueprint is missing', async () => {
      const result = await repository.getBlueprint('missing-blueprint');

      expect(result).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Blueprint 'missing-blueprint' not found in registry")
      );
    });

    it('logs an error when the registry throws while fetching a blueprint', async () => {
      const failure = new Error('blueprint registry failure');
      jest.spyOn(dataRegistry, 'get').mockImplementation(() => {
        throw failure;
      });

      const result = await repository.getBlueprint('failing-blueprint');

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to retrieve blueprint 'failing-blueprint'"),
        failure
      );
    });

    it('returns the blueprint when it exists in the registry', async () => {
      const storedBlueprint = { id: 'blueprint-1', parts: [] };
      dataRegistry.store('anatomyBlueprints', storedBlueprint.id, storedBlueprint);

      const result = await repository.getBlueprint('blueprint-1');

      expect(result).toEqual(storedBlueprint);
    });
  });

  describe('getBlueprintByRecipeId', () => {
    it('returns null and warns when recipe ID is invalid', async () => {
      const result = await repository.getBlueprintByRecipeId(undefined);

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "Invalid recipe ID provided to getBlueprintByRecipeId"
        )
      );
    });

    it('returns null when the recipe cannot be found', async () => {
      const result = await repository.getBlueprintByRecipeId('missing-recipe');

      expect(result).toBeNull();
    });

    it('warns when the recipe does not specify a blueprint', async () => {
      dataRegistry.store('anatomyRecipes', 'recipe-without-blueprint', {
        id: 'recipe-without-blueprint',
      });

      const result = await repository.getBlueprintByRecipeId(
        'recipe-without-blueprint'
      );

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "Recipe 'recipe-without-blueprint' has no blueprintId"
        )
      );
    });

    it('returns null when the associated blueprint cannot be found', async () => {
      dataRegistry.store('anatomyRecipes', 'recipe-missing-blueprint', {
        id: 'recipe-missing-blueprint',
        blueprintId: 'missing-blueprint',
      });

      const result = await repository.getBlueprintByRecipeId(
        'recipe-missing-blueprint'
      );

      expect(result).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          "Blueprint 'missing-blueprint' not found in registry"
        )
      );
    });

    it('caches blueprints after the first retrieval', async () => {
      dataRegistry.store('anatomyRecipes', 'recipe-cache', {
        id: 'recipe-cache',
        blueprintId: 'blueprint-cache',
      });
      dataRegistry.store('anatomyBlueprints', 'blueprint-cache', {
        id: 'blueprint-cache',
        parts: ['part-a'],
      });

      const getSpy = jest.spyOn(dataRegistry, 'get');

      const firstResult = await repository.getBlueprintByRecipeId('recipe-cache');
      expect(firstResult).toEqual({ id: 'blueprint-cache', parts: ['part-a'] });
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Cached blueprint for recipe 'recipe-cache'")
      );
      expect(getSpy).toHaveBeenCalledTimes(2);

      getSpy.mockClear();
      logger.debug.mockClear();

      const secondResult = await repository.getBlueprintByRecipeId('recipe-cache');
      expect(secondResult).toBe(firstResult);
      expect(getSpy).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          "Returning cached blueprint for recipe 'recipe-cache'"
        )
      );

      getSpy.mockRestore();
    });

    it('logs an error when an unexpected failure occurs retrieving the blueprint', async () => {
      const failure = new Error('unexpected failure');

      class ThrowingAnatomyBlueprintRepository extends AnatomyBlueprintRepository {
        async getRecipe() {
          throw failure;
        }
      }

      const throwingRepository = new ThrowingAnatomyBlueprintRepository({
        logger,
        dataRegistry,
      });

      const result = await throwingRepository.getBlueprintByRecipeId(
        'failing-recipe'
      );

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          "Failed to retrieve blueprint for recipe 'failing-recipe'"
        ),
        failure
      );
    });
  });

  describe('clearCache', () => {
    it('clears cached entries and logs the number of removed items', async () => {
      dataRegistry.store('anatomyRecipes', 'recipe-clear', {
        id: 'recipe-clear',
        blueprintId: 'blueprint-clear',
      });
      dataRegistry.store('anatomyBlueprints', 'blueprint-clear', {
        id: 'blueprint-clear',
      });

      await repository.getBlueprintByRecipeId('recipe-clear');
      logger.debug.mockClear();

      repository.clearCache();

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Cleared blueprint cache (1 entries)")
      );

      const getSpy = jest.spyOn(dataRegistry, 'get');
      await repository.getBlueprintByRecipeId('recipe-clear');
      expect(getSpy).toHaveBeenCalledTimes(2);
      getSpy.mockRestore();
    });
  });
});
