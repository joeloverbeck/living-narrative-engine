/**
 * @file Reproduction test for beaver_tail entity validation warning
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import EntityDefinitionLoader from '../../../src/loaders/entityDefinitionLoader.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';

describe('EntityDefinitionLoader Beaver Tail Reproduction', () => {
  let loader;
  let schemaValidator;
  let dataRegistry;
  let mockLogger;
  let mockConfig;
  let mockPathResolver;
  let mockDataFetcher;
  let mockSafeEventDispatcher;

  beforeEach(() => {
    // Create a mock logger that adheres to the ILogger interface
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    schemaValidator = new AjvSchemaValidator({ logger: mockLogger });
    dataRegistry = new InMemoryDataRegistry(mockLogger);

    // Register ONLY existing schemas (simulate descriptors:shape missing)
    // We register a dummy schema for 'descriptors:shape_general' to show it exists but isn't used
    const shapeGeneralSchema = {
      type: 'object',
      properties: {
        shape: { type: 'string' }
      },
      additionalProperties: false
    };

    schemaValidator.preloadSchemas([
      { schema: shapeGeneralSchema, id: 'descriptors:shape_general' }
    ]);

    // Mock configuration
    mockConfig = {
      get: (key) => {
        const config = {
          'schemas.entityDefinitions':
            'schema://living-narrative-engine/entity-definition.schema.json',
          'registryKeys.entityDefinitions': 'entity_definitions',
        };
        return config[key];
      },
      getModsBasePath: () => './data/mods',
      getContentTypeSchemaId: (contentType) => {
        if (contentType === 'entityDefinitions') {
          return 'schema://living-narrative-engine/entity-definition.schema.json';
        }
        return null;
      },
    };

    // Mock path resolver
    mockPathResolver = {
      resolveModPath: (modId, relativePath) => `./${relativePath}`,
      resolveModContentPath: (modId, contentType, filename) =>
        `./data/mods/${modId}/${contentType}/${filename}`,
    };

    // Mock data fetcher
    mockDataFetcher = {
      fetchData: jest.fn(),
      fetch: jest.fn(),
    };

    // Mock safe event dispatcher
    mockSafeEventDispatcher = {
      dispatch: jest.fn(),
    };

    // Register entity definition schema
    const entityDefinitionSchema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      $id: 'schema://living-narrative-engine/entity-definition.schema.json',
      type: 'object',
      properties: {
        $schema: { type: 'string' },
        id: {
          type: 'string',
          pattern: '^[a-zA-Z0-9_:-]+$',
        },
        description: { type: 'string' },
        components: { type: 'object', minProperties: 1 },
      },
      required: ['id', 'components'],
      additionalProperties: false,
    };
    schemaValidator.preloadSchemas([
      {
        schema: entityDefinitionSchema,
        id: 'schema://living-narrative-engine/entity-definition.schema.json',
      },
    ]);

    loader = new EntityDefinitionLoader(
      mockConfig,
      mockPathResolver,
      mockDataFetcher,
      schemaValidator,
      dataRegistry,
      mockLogger,
      mockSafeEventDispatcher
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should NOT log warning when loading beaver_tail with correct descriptors:shape_general schema', async () => {
    // FIX: Use descriptors:shape_general instead of descriptors:shape
    const beaverTailData = {
      "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
      "id": "anatomy-creatures:beaver_tail",
      "description": "Beaver tail - flat, paddle-shaped, hairless, used for communication and balance",
      "components": {
        "anatomy:part": {
          "subType": "tail",
          "hit_probability_weight": 5,
          "health_calculation_weight": 3
        },
        "anatomy:part_health": {
          "currentHealth": 15,
          "maxHealth": 15,
          "state": "healthy"
        },
        "core:name": {
          "text": "flat beaver tail"
        },
        "core:weight": {
          "weight": 1.5
        },
        "descriptors:flexibility": {
          "flexibility": "rigid"
        },
        "descriptors:length_category": {
          "length": "medium"
        },
        "descriptors:texture": {
          "texture": "leathery"
        },
        // CORRECTED COMPONENT ID
        "descriptors:shape_general": {
          "shape": "paddle-shaped"
        }
      }
    };

    // We only mock fetching this specific file
    mockDataFetcher.fetch.mockResolvedValue(beaverTailData);

    const manifest = {
      content: {
        entities: ['beaver_tail.entity.json'],
      },
    };

    await loader.loadItemsForMod(
      'anatomy-creatures',
      manifest,
      'entities', 
      'entities/definitions', 
      'entityDefinitions' 
    );

    // Assert that the warning for descriptors:shape (which doesn't exist anymore) is NOT logged
    expect(mockLogger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining("Skipping validation for component 'descriptors:shape' in entity 'anatomy-creatures:beaver_tail'")
    );

    // Assert that the warning for descriptors:shape_general (which exists and has a schema) is NOT logged
    expect(mockLogger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining("Skipping validation for component 'descriptors:shape_general'")
    );

    // Verify that other warnings (for missing schemas like anatomy:part) ARE still logged (sanity check)
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Skipping validation for component 'anatomy:part'")
    );
  });
});