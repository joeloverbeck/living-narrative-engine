import { jest, describe, beforeEach, test, expect } from '@jest/globals';
import EntityDefinitionLoader from '../../../src/loaders/entityDefinitionLoader.js';

describe('EntityDefinitionLoader Schema Retrieval', () => {
  let mockConfig;
  let mockPathResolver;
  let mockDataFetcher;
  let mockSchemaValidator;
  let mockDataRegistry;
  let mockLogger;

  const ENTITY_DEFINITION_SCHEMA_ID =
    'http://example.com/schemas/entity-definition.schema.json';
  const EXPECTED_CONTENT_TYPE_KEY = 'entityDefinitions';

  beforeEach(() => {
    mockConfig = {
      getContentTypeSchemaId: jest.fn(),
      getModsBasePath: jest.fn(() => 'mods'), // Required by BaseManifestItemLoader constructor
    };
    mockPathResolver = {
      resolveModContentPath: jest.fn(), // Required by BaseManifestItemLoader
    };
    mockDataFetcher = {
      fetch: jest.fn(), // Required by BaseManifestItemLoader
    };
    mockSchemaValidator = {
      validate: jest.fn(), // Required by BaseManifestItemLoader
      getValidator: jest.fn(), // Required by BaseManifestItemLoader
      isSchemaLoaded: jest.fn(), // Required by BaseManifestItemLoader
    };
    mockDataRegistry = {
      store: jest.fn(), // Required by BaseManifestItemLoader
      get: jest.fn(), // Required by BaseManifestItemLoader
    };
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    };
  });

  test('should correctly retrieve and set _primarySchemaId when config provides it for "entityDefinitions"', () => {
    let capturedContentType = null; // Variable to capture the argument

    mockConfig.getContentTypeSchemaId.mockImplementation((contentType) => {
      capturedContentType = contentType; // Capture the argument
      if (contentType === EXPECTED_CONTENT_TYPE_KEY) {
        return ENTITY_DEFINITION_SCHEMA_ID;
      }
      return null;
    });

    const loader = new EntityDefinitionLoader(
      mockConfig,
      mockPathResolver,
      mockDataFetcher,
      mockSchemaValidator,
      mockDataRegistry,
      mockLogger
    );

    // New assertion to check what contentType was actually passed
    expect(capturedContentType).toBe(EXPECTED_CONTENT_TYPE_KEY);

    // Accessing protected member for testing purposes
    expect(loader._primarySchemaId).toBe(ENTITY_DEFINITION_SCHEMA_ID);
    expect(mockConfig.getContentTypeSchemaId).toHaveBeenCalledWith(
      EXPECTED_CONTENT_TYPE_KEY
    );
    expect(mockLogger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining(
        "Primary schema ID for content type \\'entityDefinitions\\' not found"
      )
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        "Primary schema ID for content type '" +
          EXPECTED_CONTENT_TYPE_KEY +
          "' found: '" +
          ENTITY_DEFINITION_SCHEMA_ID +
          "'"
      )
    );
  });

  test('should set _primarySchemaId to null and log a warning if config does not provide it for "entityDefinitions"', () => {
    mockConfig.getContentTypeSchemaId.mockImplementation((contentType) => {
      if (contentType === EXPECTED_CONTENT_TYPE_KEY) {
        return null; // Simulate schema ID not found
      }
      return 'http://example.com/schemas/some.other.schema.json';
    });

    const loader = new EntityDefinitionLoader(
      mockConfig,
      mockPathResolver,
      mockDataFetcher,
      mockSchemaValidator,
      mockDataRegistry,
      mockLogger
    );

    expect(loader._primarySchemaId).toBeNull();
    expect(mockConfig.getContentTypeSchemaId).toHaveBeenCalledWith(
      EXPECTED_CONTENT_TYPE_KEY
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      "EntityDefinitionLoader: Primary schema ID for content type '" +
        EXPECTED_CONTENT_TYPE_KEY +
        "' not found in configuration. Primary validation might be skipped."
    );
  });

  test('should set _primarySchemaId to null and log a warning if config returns undefined for "entityDefinitions"', () => {
    mockConfig.getContentTypeSchemaId.mockImplementation((contentType) => {
      if (contentType === EXPECTED_CONTENT_TYPE_KEY) {
        return undefined; // Simulate schema ID not found
      }
      return 'http://example.com/schemas/some.other.schema.json';
    });

    const loader = new EntityDefinitionLoader(
      mockConfig,
      mockPathResolver,
      mockDataFetcher,
      mockSchemaValidator,
      mockDataRegistry,
      mockLogger
    );

    expect(loader._primarySchemaId).toBeNull();
    expect(mockConfig.getContentTypeSchemaId).toHaveBeenCalledWith(
      EXPECTED_CONTENT_TYPE_KEY
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      "EntityDefinitionLoader: Primary schema ID for content type '" +
        EXPECTED_CONTENT_TYPE_KEY +
        "' not found in configuration. Primary validation might be skipped."
    );
  });
});
