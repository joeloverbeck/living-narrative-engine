// tests/unit/loaders/anatomyLoaders.test.js

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import AnatomyRecipeLoader from '../../../src/loaders/anatomyRecipeLoader.js';
import AnatomyBlueprintLoader from '../../../src/loaders/anatomyBlueprintLoader.js';
import AnatomyPartLoader from '../../../src/loaders/anatomyPartLoader.js';
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
      resolveModContentPath: jest.fn((modId, category, filename) => 
        `mods/${modId}/${category}/${filename}`
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
      // anatomy.part.schema.json removed - parts are now entity definitions
    });

    it('should return correct schema IDs for anatomy content types', () => {
      expect(config.getContentTypeSchemaId('anatomyRecipes'))
        .toBe('http://example.com/schemas/anatomy.recipe.schema.json');
      
      expect(config.getContentTypeSchemaId('anatomyBlueprints'))
        .toBe('http://example.com/schemas/anatomy.blueprint.schema.json');
      
      // anatomyParts no longer has a schema - they use entity-definition.schema.json
      expect(config.getContentTypeSchemaId('anatomyParts'))
        .toBeUndefined();
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
      expect(primarySchemaId).toBe('http://example.com/schemas/anatomy.recipe.schema.json');
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
      expect(primarySchemaId).toBe('http://example.com/schemas/anatomy.blueprint.schema.json');
    });
  });

  describe('AnatomyPartLoader', () => {
    it('should initialize with schema warning since parts are now entity definitions', () => {
      const loader = new AnatomyPartLoader(
        config,
        mockPathResolver,
        mockDataFetcher,
        mockSchemaValidator,
        mockDataRegistry,
        mockLogger
      );

      // Should warn about missing schema since anatomyParts are now entity definitions
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Primary schema ID for content type')
      );
    });

    it('should not have a primary schema ID', () => {
      const loader = new AnatomyPartLoader(
        config,
        mockPathResolver,
        mockDataFetcher,
        mockSchemaValidator,
        mockDataRegistry,
        mockLogger
      );

      const primarySchemaId = loader._primarySchemaId;
      expect(primarySchemaId).toBeNull();
    });
  });

});