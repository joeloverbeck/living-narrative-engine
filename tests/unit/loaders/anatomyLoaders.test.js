// tests/unit/loaders/anatomyLoaders.test.js

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import AnatomyRecipeLoader from '../../../src/loaders/anatomyRecipeLoader.js';
import AnatomyBlueprintLoader from '../../../src/loaders/anatomyBlueprintLoader.js';
import StaticConfiguration from '../../../src/configuration/staticConfiguration.js';

describe('Anatomy Loaders Configuration', () => {
  let config;
  let mockPathResolver;
  let mockDataFetcher;
  let mockSchemaValidator;
  let mockDataRegistry;
  let mockLogger;

  beforeEach(() => {
    // Use real configuration to test actual values
    config = new StaticConfiguration();

    // Mock dependencies
    mockPathResolver = {
      resolveModContentPath: jest.fn(
        (modId, category, filename) => `mods/${modId}/${category}/${filename}`
      ),
    };

    mockDataFetcher = {
      fetch: jest.fn().mockResolvedValue({
        recipeId: 'test:recipe',
        slots: {},
      }),
    };

    mockSchemaValidator = {
      validate: jest.fn().mockReturnValue({ isValid: true }),
      isSchemaLoaded: jest.fn().mockReturnValue(true),
      getValidator: jest.fn().mockReturnValue(() => true),
      addSchema: jest.fn(),
      removeSchema: jest.fn(),
    };

    mockDataRegistry = {
      store: jest.fn(),
      get: jest.fn(),
      getAll: jest.fn().mockReturnValue({}),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  });

  describe('Schema Configuration', () => {
    it('should include anatomy schemas in getSchemaFiles()', () => {
      const schemaFiles = config.getSchemaFiles();

      expect(schemaFiles).toContain('anatomy.recipe.schema.json');
      expect(schemaFiles).toContain('anatomy.blueprint.schema.json');
    });

    it('should return correct schema IDs for anatomy content types', () => {
      expect(config.getContentTypeSchemaId('anatomyRecipes')).toBe(
        'schema://living-narrative-engine/anatomy.recipe.schema.json'
      );

      expect(config.getContentTypeSchemaId('anatomyBlueprints')).toBe(
        'schema://living-narrative-engine/anatomy.blueprint.schema.json'
      );
    });
  });

  describe('AnatomyRecipeLoader', () => {
    it('should initialize without schema warnings', () => {
      const loader = new AnatomyRecipeLoader(
        config,
        mockPathResolver,
        mockDataFetcher,
        mockSchemaValidator,
        mockDataRegistry,
        mockLogger
      );

      // Should not have warned about missing schema
      expect(mockLogger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('Primary schema ID for content type')
      );
    });

    it('should have correct primary schema ID', () => {
      const loader = new AnatomyRecipeLoader(
        config,
        mockPathResolver,
        mockDataFetcher,
        mockSchemaValidator,
        mockDataRegistry,
        mockLogger
      );

      // Access the private field via reflection for testing
      const primarySchemaId = loader._primarySchemaId;
      expect(primarySchemaId).toBe(
        'schema://living-narrative-engine/anatomy.recipe.schema.json'
      );
    });
  });

  describe('AnatomyBlueprintLoader', () => {
    it('should initialize without schema warnings', () => {
      const loader = new AnatomyBlueprintLoader(
        config,
        mockPathResolver,
        mockDataFetcher,
        mockSchemaValidator,
        mockDataRegistry,
        mockLogger
      );

      expect(mockLogger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('Primary schema ID for content type')
      );
    });

    it('should have correct primary schema ID', () => {
      const loader = new AnatomyBlueprintLoader(
        config,
        mockPathResolver,
        mockDataFetcher,
        mockSchemaValidator,
        mockDataRegistry,
        mockLogger
      );

      const primarySchemaId = loader._primarySchemaId;
      expect(primarySchemaId).toBe(
        'schema://living-narrative-engine/anatomy.blueprint.schema.json'
      );
    });
  });
});
