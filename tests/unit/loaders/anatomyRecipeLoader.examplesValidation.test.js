import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import AnatomyRecipeLoader from '../../../src/loaders/anatomyRecipeLoader.js';
import {
  createMockConfiguration,
  createMockPathResolver,
  createMockDataFetcher,
  createMockSchemaValidator,
  createSimpleMockDataRegistry,
  createMockLogger,
} from '../../common/mockFactories/index.js';

jest.mock('../../../src/loaders/helpers/processAndStoreItem.js', () => ({
  processAndStoreItem: jest.fn(async (_loader, { data }) => ({
    qualifiedId: data.recipeId,
    didOverride: false,
  })),
}));

const EXAMPLE_RECIPE_PATHS = [
  'data/mods/core/recipes/examples/dragon-mixed-patterns.recipe.json',
  'data/mods/core/recipes/examples/property-filters/combined-filters.recipe.json',
  'data/mods/core/recipes/examples/property-filters/filter-by-orientation.recipe.json',
  'data/mods/core/recipes/examples/property-filters/filter-by-slottype.recipe.json',
  'data/mods/core/recipes/examples/property-filters/filter-by-socketid.recipe.json',
  'data/mods/core/recipes/examples/spider-property-filtering.recipe.json',
];

describe('AnatomyRecipeLoader example recipe validation', () => {
  let loader;

  beforeEach(() => {
    loader = new AnatomyRecipeLoader(
      createMockConfiguration(),
      createMockPathResolver(),
      createMockDataFetcher(),
      createMockSchemaValidator(),
      createSimpleMockDataRegistry(),
      createMockLogger()
    );

    jest.clearAllMocks();
  });

  it.each(EXAMPLE_RECIPE_PATHS)(
    'processes %s without validation errors',
    async (relativePath) => {
      const absolutePath = path.resolve(relativePath);
      const data = JSON.parse(readFileSync(absolutePath, 'utf8'));

      await expect(
        loader._processFetchedItem(
          'core',
          path.basename(relativePath),
          absolutePath,
          data,
          'anatomyRecipes'
        )
      ).resolves.toEqual(
        expect.objectContaining({ qualifiedId: data.recipeId, didOverride: false })
      );
    }
  );
});
