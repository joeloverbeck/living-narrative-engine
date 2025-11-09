import { jest } from '@jest/globals';
import AnatomyRecipeLoader from '../../../src/loaders/anatomyRecipeLoader.js';
import AnatomyBlueprintLoader from '../../../src/loaders/anatomyBlueprintLoader.js';

describe('Anatomy Loader Path Resolution', () => {
  let mockPathResolver;
  let mockDataFetcher;
  let mockSchemaValidator;
  let mockDataRegistry;
  let mockLogger;
  let mockConfig;

  beforeEach(() => {
    mockPathResolver = {
      resolveModContentPath: jest.fn(),
    };

    mockDataFetcher = {
      fetch: jest.fn(),
    };

    mockSchemaValidator = {
      validateAgainstSchema: jest.fn().mockReturnValue({
        isValid: true,
        errors: [],
      }),
      validate: jest.fn().mockReturnValue({ isValid: true }),
      getValidator: jest.fn().mockReturnValue(() => true),
      isSchemaLoaded: jest.fn().mockReturnValue(true),
    };

    mockDataRegistry = {
      set: jest.fn().mockReturnValue(true),
      store: jest.fn().mockReturnValue(true),
      get: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockConfig = {
      getConfigForLoader: jest.fn().mockReturnValue({
        primarySchemaId: 'anatomy.recipe.schema.json',
      }),
      getModsBasePath: jest.fn().mockReturnValue('mods'),
      getContentTypeSchemaId: jest
        .fn()
        .mockReturnValue('anatomy.recipe.schema.json'),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('AnatomyRecipeLoader', () => {
    let loader;

    beforeEach(() => {
      loader = new AnatomyRecipeLoader(
        mockConfig,
        mockPathResolver,
        mockDataFetcher,
        mockSchemaValidator,
        mockDataRegistry,
        mockLogger
      );
    });

    it('should resolve paths correctly for anatomy recipes', async () => {
      const manifest = {
        id: 'anatomy',
        version: '1.0.0',
        content: {
          recipes: ['human_male.recipe.json', 'human_female.recipe.json'],
        },
      };

      const mockRecipeData = {
        $schema: 'schema://living-narrative-engine/anatomy.recipe.schema.json',
        recipeId: 'anatomy:human_male',
        blueprintId: 'anatomy:human_male',
        slots: {},
      };

      mockDataFetcher.fetch.mockResolvedValue(mockRecipeData);
      mockDataRegistry.set.mockReturnValue(true);

      await loader.loadItemsForMod(
        'anatomy',
        manifest,
        'recipes',
        'recipes',
        'anatomyRecipes'
      );

      expect(mockPathResolver.resolveModContentPath).toHaveBeenCalledWith(
        'anatomy',
        'recipes',
        'human_male.recipe.json'
      );
      expect(mockPathResolver.resolveModContentPath).toHaveBeenCalledWith(
        'anatomy',
        'recipes',
        'human_female.recipe.json'
      );

      expect(mockPathResolver.resolveModContentPath).not.toHaveBeenCalledWith(
        'anatomy',
        'anatomy/recipes',
        expect.any(String)
      );
    });

    it('should fetch files from correct paths', async () => {
      const manifest = {
        id: 'anatomy',
        version: '1.0.0',
        content: {
          recipes: ['human_female.recipe.json'],
        },
      };

      const mockRecipeData = {
        $schema: 'schema://living-narrative-engine/anatomy.recipe.schema.json',
        recipeId: 'anatomy:human_female',
        blueprintId: 'anatomy:human_female',
        slots: {},
      };

      mockPathResolver.resolveModContentPath.mockReturnValue(
        './data/mods/anatomy/recipes/human_female.recipe.json'
      );
      mockDataFetcher.fetch.mockResolvedValue(mockRecipeData);
      mockDataRegistry.set.mockReturnValue(true);

      await loader.loadItemsForMod(
        'anatomy',
        manifest,
        'recipes',
        'recipes',
        'anatomyRecipes'
      );

      expect(mockDataFetcher.fetch).toHaveBeenCalledWith(
        './data/mods/anatomy/recipes/human_female.recipe.json'
      );

      expect(mockDataFetcher.fetch).not.toHaveBeenCalledWith(
        expect.stringContaining('anatomy/anatomy/recipes')
      );
    });

    it('should handle missing recipe files gracefully', async () => {
      const manifest = {
        id: 'anatomy',
        version: '1.0.0',
        content: {
          recipes: ['nonexistent.recipe.json'],
        },
      };

      mockPathResolver.resolveModContentPath.mockReturnValue(
        './data/mods/anatomy/recipes/nonexistent.recipe.json'
      );
      mockDataFetcher.fetch.mockRejectedValue(
        new Error('HTTP error! status: 404')
      );

      const result = await loader.loadItemsForMod(
        'anatomy',
        manifest,
        'recipes',
        'recipes',
        'anatomyRecipes'
      );

      expect(result.errors).toBe(1);
      expect(result.count).toBe(0);
    });
  });

  describe('AnatomyBlueprintLoader', () => {
    let loader;

    beforeEach(() => {
      loader = new AnatomyBlueprintLoader(
        mockConfig,
        mockPathResolver,
        mockDataFetcher,
        mockSchemaValidator,
        mockDataRegistry,
        mockLogger
      );
    });

    it('should resolve paths correctly for anatomy blueprints', async () => {
      const manifest = {
        id: 'anatomy',
        version: '1.0.0',
        content: {
          blueprints: [
            'human_male.blueprint.json',
            'human_female.blueprint.json',
          ],
        },
      };

      const mockBlueprintData = {
        $schema:
          'schema://living-narrative-engine/anatomy.blueprint.schema.json',
        blueprintId: 'anatomy:human_male',
        slots: {},
      };

      mockDataFetcher.fetch.mockResolvedValue(mockBlueprintData);
      mockDataRegistry.set.mockReturnValue(true);

      await loader.loadItemsForMod(
        'anatomy',
        manifest,
        'blueprints',
        'blueprints',
        'anatomyBlueprints'
      );

      expect(mockPathResolver.resolveModContentPath).toHaveBeenCalledWith(
        'anatomy',
        'blueprints',
        'human_male.blueprint.json'
      );
      expect(mockPathResolver.resolveModContentPath).toHaveBeenCalledWith(
        'anatomy',
        'blueprints',
        'human_female.blueprint.json'
      );

      expect(mockPathResolver.resolveModContentPath).not.toHaveBeenCalledWith(
        'anatomy',
        'anatomy/blueprints',
        expect.any(String)
      );
    });

    it('should fetch files from correct paths', async () => {
      const manifest = {
        id: 'anatomy',
        version: '1.0.0',
        content: {
          blueprints: ['human_female.blueprint.json'],
        },
      };

      const mockBlueprintData = {
        $schema:
          'schema://living-narrative-engine/anatomy.blueprint.schema.json',
        blueprintId: 'anatomy:human_female',
        slots: {},
      };

      mockPathResolver.resolveModContentPath.mockReturnValue(
        './data/mods/anatomy/blueprints/human_female.blueprint.json'
      );
      mockDataFetcher.fetch.mockResolvedValue(mockBlueprintData);
      mockDataRegistry.set.mockReturnValue(true);

      await loader.loadItemsForMod(
        'anatomy',
        manifest,
        'blueprints',
        'blueprints',
        'anatomyBlueprints'
      );

      expect(mockDataFetcher.fetch).toHaveBeenCalledWith(
        './data/mods/anatomy/blueprints/human_female.blueprint.json'
      );

      expect(mockDataFetcher.fetch).not.toHaveBeenCalledWith(
        expect.stringContaining('anatomy/anatomy/blueprints')
      );
    });
  });

  describe('Path Resolution Integration', () => {
    it('should generate correct paths for various mod IDs', async () => {
      const recipeLoader = new AnatomyRecipeLoader(
        mockConfig,
        mockPathResolver,
        mockDataFetcher,
        mockSchemaValidator,
        mockDataRegistry,
        mockLogger
      );

      const manifest = {
        id: 'custom-mod',
        version: '1.0.0',
        content: {
          recipes: ['test.recipe.json'],
        },
      };

      const mockRecipeData = {
        $schema: 'schema://living-narrative-engine/anatomy.recipe.schema.json',
        recipeId: 'custom-mod:test',
        blueprintId: 'custom-mod:test',
        slots: {},
      };

      mockDataFetcher.fetch.mockResolvedValue(mockRecipeData);
      mockDataRegistry.set.mockReturnValue(true);

      await recipeLoader.loadItemsForMod(
        'custom-mod',
        manifest,
        'recipes',
        'recipes',
        'anatomyRecipes'
      );

      expect(mockPathResolver.resolveModContentPath).toHaveBeenCalledWith(
        'custom-mod',
        'recipes',
        'test.recipe.json'
      );
    });
  });
});
