// tests/unit/loaders/anatomyFormattingLoader.pathResolution.test.js

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import AnatomyFormattingLoader from '../../../src/loaders/anatomyFormattingLoader.js';
import StaticConfiguration from '../../../src/configuration/staticConfiguration.js';

describe('AnatomyFormattingLoader - Path Resolution', () => {
  let loader;
  let mockPathResolver;
  let mockDataFetcher;
  let mockSchemaValidator;
  let mockDataRegistry;
  let mockLogger;
  let config;

  // Test constants
  const TEST_MOD_ID = 'anatomy';
  const TEST_CONTENT_KEY = 'anatomyFormatting';
  const TEST_DISK_FOLDER = 'anatomy-formatting';
  const TEST_REGISTRY_KEY = 'anatomyFormatting';

  beforeEach(() => {
    config = new StaticConfiguration();

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockPathResolver = {
      resolveModContentPath: jest.fn(),
    };

    mockDataFetcher = {
      fetch: jest.fn(),
    };

    mockSchemaValidator = {
      validate: jest.fn().mockReturnValue({ isValid: true }),
      isSchemaLoaded: jest.fn().mockReturnValue(true),
      getValidator: jest.fn().mockReturnValue(() => true),
    };

    mockDataRegistry = {
      store: jest.fn(),
      get: jest.fn(),
      getAll: jest.fn().mockReturnValue({}),
    };

    loader = new AnatomyFormattingLoader(
      config,
      mockPathResolver,
      mockDataFetcher,
      mockSchemaValidator,
      mockDataRegistry,
      mockLogger
    );
  });

  describe('Path Resolution for Anatomy Formatting Files', () => {
    it('should resolve paths correctly without duplicating directory structure', async () => {
      // Arrange
      const filename = 'default.json';
      const modManifest = {
        id: TEST_MOD_ID,
        content: {
          [TEST_CONTENT_KEY]: [filename],
        },
      };
      const expectedPath =
        './data/mods/anatomy/anatomy-formatting/default.json';

      mockPathResolver.resolveModContentPath.mockImplementation(
        (mod, category, file) => {
          // This should combine the base path with category and filename correctly
          return `./data/mods/${mod}/${category}/${file}`;
        }
      );

      mockDataFetcher.fetch.mockResolvedValue({
        id: 'test-formatting',
        descriptionOrder: [],
        groupedParts: [],
        pairedParts: [],
        noArticleParts: [],
        descriptorOrder: [],
        descriptorValueKeys: [],
      });

      // Act
      await loader.loadItemsForMod(
        TEST_MOD_ID,
        modManifest,
        TEST_CONTENT_KEY,
        TEST_DISK_FOLDER,
        TEST_REGISTRY_KEY
      );

      // Assert
      expect(mockPathResolver.resolveModContentPath).toHaveBeenCalledWith(
        TEST_MOD_ID,
        TEST_DISK_FOLDER,
        filename
      );
      expect(mockDataFetcher.fetch).toHaveBeenCalledWith(expectedPath);
    });

    it('should handle multiple anatomy formatting files correctly', async () => {
      // Arrange
      const filenames = ['default.json', 'example-alien.json'];
      const modManifest = {
        id: TEST_MOD_ID,
        content: {
          [TEST_CONTENT_KEY]: filenames,
        },
      };

      mockPathResolver.resolveModContentPath.mockImplementation(
        (mod, category, file) => {
          return `./data/mods/${mod}/${category}/${file}`;
        }
      );

      mockDataFetcher.fetch.mockImplementation((path) => {
        const filename = path.split('/').pop();
        const id = filename.replace('.json', '');
        return Promise.resolve({
          id: id,
          descriptionOrder: [],
          groupedParts: [],
          pairedParts: [],
          noArticleParts: [],
          descriptorOrder: [],
            descriptorValueKeys: [],
        });
      });

      // Act
      await loader.loadItemsForMod(
        TEST_MOD_ID,
        modManifest,
        TEST_CONTENT_KEY,
        TEST_DISK_FOLDER,
        TEST_REGISTRY_KEY
      );

      // Assert
      expect(mockPathResolver.resolveModContentPath).toHaveBeenCalledTimes(2);
      expect(mockPathResolver.resolveModContentPath).toHaveBeenNthCalledWith(
        1,
        TEST_MOD_ID,
        TEST_DISK_FOLDER,
        'default.json'
      );
      expect(mockPathResolver.resolveModContentPath).toHaveBeenNthCalledWith(
        2,
        TEST_MOD_ID,
        TEST_DISK_FOLDER,
        'example-alien.json'
      );

      expect(mockDataFetcher.fetch).toHaveBeenCalledWith(
        './data/mods/anatomy/anatomy-formatting/default.json'
      );
      expect(mockDataFetcher.fetch).toHaveBeenCalledWith(
        './data/mods/anatomy/anatomy-formatting/example-alien.json'
      );
    });

    it('should log the correct resolved path for debugging', async () => {
      // Arrange
      const filename = 'default.json';
      const modManifest = {
        id: TEST_MOD_ID,
        content: {
          [TEST_CONTENT_KEY]: [filename],
        },
      };
      const resolvedPath =
        './data/mods/anatomy/anatomy-formatting/default.json';

      mockPathResolver.resolveModContentPath.mockReturnValue(resolvedPath);
      mockDataFetcher.fetch.mockResolvedValue({
        id: 'test-formatting',
        descriptionOrder: [],
        groupedParts: [],
        pairedParts: [],
        noArticleParts: [],
        descriptorOrder: [],
        descriptorValueKeys: [],
      });

      // Act
      await loader.loadItemsForMod(
        TEST_MOD_ID,
        modManifest,
        TEST_CONTENT_KEY,
        TEST_DISK_FOLDER,
        TEST_REGISTRY_KEY
      );

      // Assert
      // Check that the logger was called with the correct resolved path (debug level)
      const debugCalls = mockLogger.debug.mock.calls.map((call) => call[0]);
      const pathLogCall = debugCalls.find(
        (msg) => msg.includes('Resolved path') && msg.includes(filename)
      );
      expect(pathLogCall).toContain(resolvedPath);
    });
  });

  describe('Error Handling for Path Resolution', () => {
    it('should provide clear error message when file not found due to path issues', async () => {
      // Arrange
      const filename = 'nonexistent.json';
      const modManifest = {
        id: TEST_MOD_ID,
        content: {
          [TEST_CONTENT_KEY]: [filename],
        },
      };
      const resolvedPath =
        './data/mods/anatomy/anatomy-formatting/nonexistent.json';

      mockPathResolver.resolveModContentPath.mockReturnValue(resolvedPath);
      mockDataFetcher.fetch.mockRejectedValue(
        new Error(
          `HTTP error! status: 404 (Not Found) fetching ${resolvedPath}`
        )
      );

      // Act
      const result = await loader.loadItemsForMod(
        TEST_MOD_ID,
        modManifest,
        TEST_CONTENT_KEY,
        TEST_DISK_FOLDER,
        TEST_REGISTRY_KEY
      );

      // Assert
      expect(result).toEqual({
        count: 0,
        overrides: 0,
        errors: 1,
        failures: [
          {
            file: filename,
            error: expect.objectContaining({
              message: `HTTP error! status: 404 (Not Found) fetching ${resolvedPath}`,
            }),
          },
        ],
      });

      // Verify error was logged
      const errorCalls = mockLogger.error.mock.calls.map((call) => call[0]);
      const pathErrorCall = errorCalls.find(
        (msg) => msg.includes('Error processing file') || msg.includes('404')
      );
      expect(pathErrorCall).toBeTruthy();
    });
  });

  describe('Prevention of Path Duplication Bug', () => {
    it('should not create duplicated paths when manifest contains subdirectory in filename', async () => {
      // This test ensures that the bug where 'anatomy-formatting/anatomy-formatting/default.json'
      // was created does not happen again

      // Arrange
      const problematicFilename = 'anatomy-formatting/default.json'; // This was the problematic case
      const modManifest = {
        id: TEST_MOD_ID,
        content: {
          [TEST_CONTENT_KEY]: [problematicFilename],
        },
      };

      // The path resolver should handle this correctly
      mockPathResolver.resolveModContentPath.mockImplementation(
        (mod, category, file) => {
          // This simulates what should happen - the path resolver should detect
          // that the file already contains the category folder
          if (file.startsWith(category + '/')) {
            return `./data/mods/${mod}/${file}`;
          }
          return `./data/mods/${mod}/${category}/${file}`;
        }
      );

      mockDataFetcher.fetch.mockResolvedValue({
        id: 'default',
        descriptionOrder: [],
        groupedParts: [],
        pairedParts: [],
        noArticleParts: [],
        descriptorOrder: [],
        descriptorValueKeys: [],
      });

      // Act
      await loader.loadItemsForMod(
        TEST_MOD_ID,
        modManifest,
        TEST_CONTENT_KEY,
        TEST_DISK_FOLDER,
        TEST_REGISTRY_KEY
      );

      // Assert - Should NOT create the duplicated path
      expect(mockDataFetcher.fetch).not.toHaveBeenCalledWith(
        './data/mods/anatomy/anatomy-formatting/anatomy-formatting/default.json'
      );

      // Should call with the correct path
      expect(mockDataFetcher.fetch).toHaveBeenCalledWith(
        './data/mods/anatomy/anatomy-formatting/default.json'
      );
    });

    it('should work correctly after fix with simple filenames in manifest', async () => {
      // This test verifies that the fixed manifest format works correctly

      // Arrange - Using the fixed format with just filenames
      const filenames = ['default.json', 'example-alien.json'];
      const modManifest = {
        id: TEST_MOD_ID,
        content: {
          [TEST_CONTENT_KEY]: filenames, // Fixed format - no subdirectory in filenames
        },
      };

      mockPathResolver.resolveModContentPath.mockImplementation(
        (mod, category, file) => {
          return `./data/mods/${mod}/${category}/${file}`;
        }
      );

      mockDataFetcher.fetch.mockImplementation((path) => {
        const filename = path.split('/').pop();
        const id = filename.replace('.json', '');
        return Promise.resolve({
          id: id,
          descriptionOrder: [],
          groupedParts: [],
          pairedParts: [],
          noArticleParts: [],
          descriptorOrder: [],
            descriptorValueKeys: [],
        });
      });

      // Act
      const result = await loader.loadItemsForMod(
        TEST_MOD_ID,
        modManifest,
        TEST_CONTENT_KEY,
        TEST_DISK_FOLDER,
        TEST_REGISTRY_KEY
      );

      // Assert
      expect(result.count).toBe(2);
      expect(result.errors).toBe(0);

      // Verify correct paths were used
      expect(mockDataFetcher.fetch).toHaveBeenCalledWith(
        './data/mods/anatomy/anatomy-formatting/default.json'
      );
      expect(mockDataFetcher.fetch).toHaveBeenCalledWith(
        './data/mods/anatomy/anatomy-formatting/example-alien.json'
      );
    });
  });
});
