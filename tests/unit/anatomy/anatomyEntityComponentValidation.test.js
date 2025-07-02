/**
 * @file Integration tests for anatomy entity component validation
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  jest,
} from '@jest/globals';
import EntityDefinitionLoader from '../../../src/loaders/entityDefinitionLoader.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import shapeGeneralSchema from '../../../data/mods/descriptors/components/shape_general.component.json';
import partComponentSchema from '../../../data/mods/anatomy/components/part.component.json';
import nameComponentSchema from '../../../data/mods/core/components/name.component.json';
import sizeCategorySchema from '../../../data/mods/descriptors/components/size_category.component.json';

describe('Anatomy Entity Component Validation', () => {
  let loader;
  let schemaValidator;
  let dataRegistry;
  let mockLogger;
  let mockConfig;
  let mockPathResolver;
  let mockDataFetcher;
  let mockSafeEventDispatcher;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    schemaValidator = new AjvSchemaValidator({ logger: mockLogger });
    dataRegistry = new InMemoryDataRegistry(mockLogger);

    // Register component schemas
    schemaValidator.preloadSchemas([
      { schema: shapeGeneralSchema.dataSchema, id: 'descriptors:shape_general' },
      { schema: partComponentSchema.dataSchema, id: 'anatomy:part' },
      { schema: nameComponentSchema.dataSchema, id: 'core:name' },
      { schema: sizeCategorySchema.dataSchema, id: 'descriptors:size_category' },
    ]);

    // Mock configuration
    mockConfig = {
      get: (key) => {
        const config = {
          'schemas.entityDefinitions':
            'http://example.com/schemas/entity-definition.schema.json',
          'registryKeys.entityDefinitions': 'entity_definitions',
        };
        return config[key];
      },
      getModsBasePath: () => './data/mods',
      getContentTypeSchemaId: (contentType) => {
        if (contentType === 'entityDefinitions') {
          return 'http://example.com/schemas/entity-definition.schema.json';
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
      $id: 'http://example.com/schemas/entity-definition.schema.json',
      type: 'object',
      properties: {
        $schema: { type: 'string' },
        id: {
          type: 'string',
          pattern: '^[a-zA-Z][a-zA-Z0-9_]*:[a-zA-Z][a-zA-Z0-9_]*$',
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
        id: 'http://example.com/schemas/entity-definition.schema.json',
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

  describe('Human hand entity validation', () => {
    it('should validate human_hand entity with correct shape', async () => {
      const humanHandEntity = {
        $schema: 'http://example.com/schemas/entity-definition.schema.json',
        id: 'anatomy:human_hand',
        description: 'A human hand',
        components: {
          'anatomy:part': {
            subType: 'hand',
          },
          'descriptors:size_category': {
            size: 'medium',
          },
          'descriptors:shape_general': {
            shape: 'square',
          },
          'core:name': {
            text: 'hand',
          },
        },
      };

      mockDataFetcher.fetchData.mockResolvedValue(humanHandEntity);

      const result = await loader._processFetchedItem(
        'anatomy',
        'human_hand.entity.json',
        './data/mods/anatomy/entities/definitions/human_hand.entity.json',
        humanHandEntity,
        'entityDefinitions'
      );

      expect(result.qualifiedId).toBe('anatomy:human_hand');
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(mockSafeEventDispatcher.dispatch).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'ENTITY_COMPONENT_VALIDATION_FAILED' })
      );
    });

    it('should fail validation for human_hand with invalid shape', async () => {
      const humanHandEntity = {
        $schema: 'http://example.com/schemas/entity-definition.schema.json',
        id: 'anatomy:human_hand',
        description: 'A human hand',
        components: {
          'anatomy:part': {
            subType: 'hand',
          },
          'descriptors:size_category': {
            size: 'medium',
          },
          'descriptors:shape_general': {
            shape: 'normal', // Invalid shape
          },
          'core:name': {
            text: 'hand',
          },
        },
      };

      mockDataFetcher.fetchData.mockResolvedValue(humanHandEntity);

      await expect(
        loader._processFetchedItem(
          'anatomy',
          'human_hand.entity.json',
          './data/mods/anatomy/entities/definitions/human_hand.entity.json',
          humanHandEntity,
          'entityDefinitions'
        )
      ).rejects.toThrow(/Runtime component validation failed/);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('Runtime validation failed for component'),
          details: expect.objectContaining({
            raw: expect.stringContaining('descriptors:shape_general'),
          }),
        })
      );
    });
  });

  describe('Component validation error reporting', () => {
    it('should properly report validation errors with details', async () => {
      const invalidEntity = {
        $schema: 'http://example.com/schemas/entity-definition.schema.json',
        id: 'test:invalid_entity',
        description: 'Test entity with invalid components',
        components: {
          'descriptors:shape_general': {
            shape: 'invalid_shape',
          },
        },
      };

      mockDataFetcher.fetchData.mockResolvedValue(invalidEntity);

      await expect(
        loader._processFetchedItem(
          'test',
          'invalid_entity.entity.json',
          './data/mods/test/entities/definitions/invalid_entity.entity.json',
          invalidEntity,
          'entityDefinitions'
        )
      ).rejects.toThrow(/Runtime component validation failed/);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('Runtime validation failed for component'),
          details: expect.objectContaining({
            raw: expect.stringContaining('descriptors:shape_general'),
          }),
        })
      );
    });
  });
});