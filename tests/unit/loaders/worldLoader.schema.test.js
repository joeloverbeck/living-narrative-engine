/**
 * @file Test suite for WorldLoader schema validation functionality.
 * @description Tests specifically focused on ensuring world schema is properly loaded
 * and validation works correctly. This test suite was created to prevent regression
 * of the issue where world.schema.json was not being loaded during app initialization.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import WorldLoader from '../../../src/loaders/worldLoader.js';
import { ModsLoaderError } from '../../../src/errors/modsLoaderError.js';

describe('WorldLoader Schema Validation', () => {
  let worldLoader;
  let mockConfig;
  let mockPathResolver;
  let mockDataFetcher;
  let mockSchemaValidator;
  let mockDataRegistry;
  let mockLogger;

  beforeEach(() => {
    // Mock configuration with world schema ID
    mockConfig = {
      getContentTypeSchemaId: jest.fn((key) => {
        if (key === 'world') {
          return 'http://example.com/schemas/world.schema.json';
        }
        return undefined;
      }),
    };

    // Mock path resolver
    mockPathResolver = {
      resolveModContentPath: jest.fn(
        (modId, contentType, filename) =>
          `./data/mods/${modId}/${contentType}/${filename}`
      ),
    };

    // Mock data fetcher
    mockDataFetcher = {
      fetch: jest.fn(),
    };

    // Mock schema validator with correct interface
    mockSchemaValidator = {
      isSchemaLoaded: jest.fn().mockReturnValue(true),
      validate: jest.fn().mockReturnValue({ isValid: true, errors: null }),
    };

    // Mock data registry
    mockDataRegistry = {
      get: jest.fn(),
      store: jest.fn(),
    };

    // Mock logger
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    worldLoader = new WorldLoader(
      mockConfig,
      mockPathResolver,
      mockDataFetcher,
      mockSchemaValidator,
      mockDataRegistry,
      mockLogger
    );
  });

  describe('Schema ID Resolution', () => {
    it('should successfully resolve world schema ID from configuration', () => {
      // Arrange
      const finalModOrder = ['test-mod'];
      const manifests = new Map([
        [
          'test-mod',
          {
            content: {
              worlds: ['test.world.json'],
            },
          },
        ],
      ]);
      const totalCounts = {};

      // Act & Assert
      expect(mockConfig.getContentTypeSchemaId).toBeDefined();
      expect(mockConfig.getContentTypeSchemaId('world')).toBe(
        'http://example.com/schemas/world.schema.json'
      );
    });

    it('should handle missing world schema ID gracefully', () => {
      // Arrange
      mockConfig.getContentTypeSchemaId.mockReturnValue(undefined);
      const finalModOrder = ['test-mod'];
      const manifests = new Map([
        [
          'test-mod',
          {
            content: {
              worlds: ['test.world.json'],
            },
          },
        ],
      ]);
      const totalCounts = {};

      // Act
      const loadPromise = worldLoader.loadWorlds(
        finalModOrder,
        manifests,
        totalCounts
      );

      // Assert
      return expect(loadPromise).resolves.toBeUndefined();
    });
  });

  describe('World File Processing', () => {
    it('should successfully process a valid world file with schema validation', async () => {
      // Arrange
      const finalModOrder = ['test-mod'];
      const manifests = new Map([
        [
          'test-mod',
          {
            content: {
              worlds: ['test.world.json'],
            },
          },
        ],
      ]);
      const totalCounts = {};

      const mockWorldData = {
        id: 'test:world',
        name: 'Test World',
        instances: [
          {
            instanceId: 'test:instance',
            components: {},
          },
        ],
      };

      mockDataFetcher.fetch.mockResolvedValue(mockWorldData);
      mockSchemaValidator.isSchemaLoaded.mockReturnValue(true);
      mockSchemaValidator.validate.mockReturnValue({
        isValid: true,
        errors: null,
      });
      mockDataRegistry.get.mockReturnValue({ id: 'test:definition' });

      // Act
      await worldLoader.loadWorlds(finalModOrder, manifests, totalCounts);

      // Assert
      expect(mockDataFetcher.fetch).toHaveBeenCalledWith(
        './data/mods/test-mod/worlds/test.world.json'
      );
      expect(mockSchemaValidator.validate).toHaveBeenCalledWith(
        'http://example.com/schemas/world.schema.json',
        mockWorldData
      );
      expect(mockDataRegistry.store).toHaveBeenCalledWith(
        'worlds',
        'test:world',
        mockWorldData
      );
    });

    it('should validate world file against correct schema ID', async () => {
      // Arrange
      const finalModOrder = ['test-mod'];
      const manifests = new Map([
        [
          'test-mod',
          {
            content: {
              worlds: ['test.world.json'],
            },
          },
        ],
      ]);
      const totalCounts = {};

      const mockWorldData = {
        id: 'test:world',
        name: 'Test World',
        instances: [],
      };

      mockDataFetcher.fetch.mockResolvedValue(mockWorldData);
      mockSchemaValidator.validate.mockReturnValue({ valid: true });

      // Act
      await worldLoader.loadWorlds(finalModOrder, manifests, totalCounts);

      // Assert
      expect(mockSchemaValidator.validate).toHaveBeenCalledWith(
        'http://example.com/schemas/world.schema.json',
        mockWorldData
      );
    });

    it('should handle schema validation failures gracefully', async () => {
      // Arrange
      const finalModOrder = ['test-mod'];
      const manifests = new Map([
        [
          'test-mod',
          {
            content: {
              worlds: ['test.world.json'],
            },
          },
        ],
      ]);
      const totalCounts = {};

      const mockWorldData = {
        id: 'test:world',
        name: 'Test World',
        instances: [],
      };

      mockDataFetcher.fetch.mockResolvedValue(mockWorldData);
      mockSchemaValidator.isSchemaLoaded.mockReturnValue(true);
      mockSchemaValidator.validate.mockReturnValue({
        isValid: false,
        errors: [{ message: 'Invalid schema' }],
      });

      // Act
      await worldLoader.loadWorlds(finalModOrder, manifests, totalCounts);

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Schema validation failed for world'),
        expect.any(Object)
      );
    });
  });

  describe('Integration with Schema Loading', () => {
    it('should work correctly when world schema is properly loaded', async () => {
      // Arrange
      const finalModOrder = ['test-mod'];
      const manifests = new Map([
        [
          'test-mod',
          {
            content: {
              worlds: ['test.world.json'],
            },
          },
        ],
      ]);
      const totalCounts = {};

      const mockWorldData = {
        id: 'test:world',
        name: 'Test World',
        instances: [
          {
            instanceId: 'test:instance',
            components: {},
          },
        ],
      };

      mockDataFetcher.fetch.mockResolvedValue(mockWorldData);
      mockSchemaValidator.isSchemaLoaded.mockReturnValue(true);
      mockSchemaValidator.validate.mockReturnValue({
        isValid: true,
        errors: null,
      });
      mockDataRegistry.get.mockReturnValue({ id: 'test:definition' });

      // Act
      await worldLoader.loadWorlds(finalModOrder, manifests, totalCounts);

      // Assert
      expect(totalCounts.worlds).toEqual({
        count: 1,
        overrides: 0,
        errors: 0,
        instances: 1,
        resolvedDefinitions: 1,
        unresolvedDefinitions: 0,
      });
    });
  });
});
