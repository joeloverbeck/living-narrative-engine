/**
 * @file Unit tests for entity definition loader component validation
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
import socketsComponentSchema from '../../../data/mods/anatomy/components/sockets.component.json';
import partComponentSchema from '../../../data/mods/anatomy/components/part.component.json';
import nameComponentSchema from '../../../data/mods/core/components/name.component.json';

describe('EntityDefinitionLoader Component Validation', () => {
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

    // Register component schemas
    schemaValidator.preloadSchemas([
      { schema: socketsComponentSchema.dataSchema, id: 'anatomy:sockets' },
      { schema: partComponentSchema.dataSchema, id: 'anatomy:part' },
      { schema: nameComponentSchema.dataSchema, id: 'core:name' },
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

  it('should successfully load entity with socket without orientation', async () => {
    const entityData = {
      $schema: 'schema://living-narrative-engine/entity-definition.schema.json',
      id: 'anatomy:test_torso',
      components: {
        'anatomy:part': {
          subType: 'torso',
        },
        'anatomy:sockets': {
          sockets: [
            {
              id: 'special_socket',
              allowedTypes: ['special_part'],
              nameTpl: '{{type}}',
            },
          ],
        },
        'core:name': {
          text: 'Test Torso',
        },
      },
    };

    mockDataFetcher.fetch.mockResolvedValue(entityData);

    const manifest = {
      content: {
        entities: ['test_torso.entity.json'],
      },
    };

    const results = await loader.loadItemsForMod(
      'anatomy',
      manifest,
      'entities', // contentKey
      'entities/definitions', // diskFolder
      'entityDefinitions' // registryKey
    );

    expect(results.count).toBe(1);
    expect(results.errors).toBe(0);
    expect(results.overrides).toBe(0);

    // Verify entity was stored in registry
    const storedEntity = dataRegistry.get(
      'entityDefinitions',
      'anatomy:test_torso'
    );
    expect(storedEntity).toBeDefined();
    expect(storedEntity.id).toBe('anatomy:test_torso');
  });

  it('should fail to load entity with invalid orientation in socket', async () => {
    const entityData = {
      $schema: 'schema://living-narrative-engine/entity-definition.schema.json',
      id: 'anatomy:invalid_torso',
      components: {
        'anatomy:part': {
          subType: 'torso',
        },
        'anatomy:sockets': {
          sockets: [
            {
              id: 'invalid_socket',
              orientation: 'lower-front', // Invalid compound orientation
              allowedTypes: ['special_part'],
            },
          ],
        },
        'core:name': {
          text: 'Invalid Torso',
        },
      },
    };

    mockDataFetcher.fetch.mockResolvedValue(entityData);

    const manifest = {
      content: {
        entities: ['invalid_torso.entity.json'],
      },
    };

    const results = await loader.loadItemsForMod(
      'anatomy',
      manifest,
      'entities', // contentKey
      'entities/definitions', // diskFolder
      'entityDefinitions' // registryKey
    );

    expect(results.count).toBe(0);
    expect(results.errors).toBe(1);
    expect(results.failures).toBeDefined();
    expect(results.failures[0].error.message).toContain(
      'Runtime component validation failed'
    );

    // Verify entity was NOT stored in registry due to validation failure
    const storedEntity = dataRegistry.get(
      'entityDefinitions',
      'anatomy:invalid_torso'
    );
    expect(storedEntity).toBeUndefined();
  });

  it('should successfully load entity with valid orientation in socket', async () => {
    const entityData = {
      $schema: 'schema://living-narrative-engine/entity-definition.schema.json',
      id: 'anatomy:valid_torso',
      components: {
        'anatomy:part': {
          subType: 'torso',
        },
        'anatomy:sockets': {
          sockets: [
            {
              id: 'left_shoulder',
              orientation: 'left',
              allowedTypes: ['arm'],
              nameTpl: '{{orientation}} {{type}}',
            },
            {
              id: 'neck',
              orientation: 'upper',
              allowedTypes: ['head', 'neck'],
            },
          ],
        },
        'core:name': {
          text: 'Valid Torso',
        },
      },
    };

    mockDataFetcher.fetch.mockResolvedValue(entityData);

    const manifest = {
      content: {
        entities: ['valid_torso.entity.json'],
      },
    };

    const results = await loader.loadItemsForMod(
      'anatomy',
      manifest,
      'entities', // contentKey
      'entities/definitions', // diskFolder
      'entityDefinitions' // registryKey
    );

    expect(results.count).toBe(1);
    expect(results.errors).toBe(0);
    expect(results.overrides).toBe(0);

    // Verify entity was stored in registry
    const storedEntity = dataRegistry.get(
      'entityDefinitions',
      'anatomy:valid_torso'
    );
    expect(storedEntity).toBeDefined();
    expect(storedEntity.id).toBe('anatomy:valid_torso');
  });

  it('should handle mixed socket orientations correctly', async () => {
    const entityData = {
      $schema: 'schema://living-narrative-engine/entity-definition.schema.json',
      id: 'anatomy:mixed_torso',
      components: {
        'anatomy:part': {
          subType: 'torso',
        },
        'anatomy:sockets': {
          sockets: [
            {
              id: 'left_arm',
              orientation: 'left',
              allowedTypes: ['arm'],
            },
            {
              id: 'right_arm',
              orientation: 'right',
              allowedTypes: ['arm'],
            },
            {
              id: 'special_port',
              allowedTypes: ['device'],
              // No orientation - should be valid
            },
          ],
        },
        'core:name': {
          text: 'Mixed Torso',
        },
      },
    };

    mockDataFetcher.fetch.mockResolvedValue(entityData);

    const manifest = {
      content: {
        entities: ['mixed_torso.entity.json'],
      },
    };

    const results = await loader.loadItemsForMod(
      'anatomy',
      manifest,
      'entities', // contentKey
      'entities/definitions', // diskFolder
      'entityDefinitions' // registryKey
    );

    expect(results.count).toBe(1);
    expect(results.errors).toBe(0);
    expect(results.overrides).toBe(0);
  });

  it('should fail when entity is missing required id field', async () => {
    const entityData = {
      $schema: 'schema://living-narrative-engine/entity-definition.schema.json',
      // Missing required 'id' field
      components: {
        'core:name': {
          text: 'No ID Entity',
        },
      },
    };

    mockDataFetcher.fetch.mockResolvedValue(entityData);

    const manifest = {
      content: {
        entities: ['no_id.entity.json'],
      },
    };

    const results = await loader.loadItemsForMod(
      'anatomy',
      manifest,
      'entities', // contentKey
      'entities/definitions', // diskFolder
      'entityDefinitions' // registryKey
    );

    expect(results.count).toBe(0);
    expect(results.errors).toBe(1);
    expect(results.failures).toBeDefined();
    expect(results.failures[0].error.message).toContain(
      "must have required property 'id'"
    );
  });
});
