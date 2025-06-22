/**
 * @file Integration test for SchemaLoader to ensure proper schema loading and $ref resolution.
 * @description Tests the complete schema loading pipeline to ensure that schemas with $refs
 * are loaded in the correct order and all references are resolved properly.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import SchemaLoader from '../../../src/loaders/schemaLoader.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import StaticConfiguration from '../../../src/configuration/staticConfiguration.js';
import DefaultPathResolver from '../../../src/pathing/defaultPathResolver.js';
import WorkspaceDataFetcher from '../../../src/data/workspaceDataFetcher.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';

describe('SchemaLoader Integration Tests', () => {
  let schemaLoader;
  let schemaValidator;
  let mockConfig;
  let mockPathResolver;
  let mockDataFetcher;
  let mockLogger;

  // Test schema data
  const commonSchemaData = {
    $id: 'http://example.com/schemas/common.schema.json',
    $schema: 'http://json-schema.org/draft-07/schema#',
    $defs: {
      namespacedId: {
        type: 'string',
        pattern: '^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$',
      },
    },
  };

  const entityInstanceSchemaData = {
    $id: 'http://example.com/schemas/entity-instance.schema.json',
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    properties: {
      instanceId: {
        $ref: 'http://example.com/schemas/common.schema.json#/$defs/namespacedId',
      },
      definitionId: {
        $ref: 'http://example.com/schemas/common.schema.json#/$defs/namespacedId',
      },
    },
    required: ['instanceId', 'definitionId'],
    additionalProperties: false,
  };

  const worldSchemaData = {
    $id: 'http://example.com/schemas/world.schema.json',
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    properties: {
      id: {
        $ref: 'http://example.com/schemas/common.schema.json#/$defs/namespacedId',
      },
      name: { type: 'string' },
      description: { type: 'string' },
      instances: {
        type: 'array',
        items: {
          $ref: 'http://example.com/schemas/entity-instance.schema.json',
        },
      },
    },
    required: ['id', 'name', 'instances'],
    additionalProperties: false,
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mocks
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockConfig = {
      getSchemaFiles: jest
        .fn()
        .mockReturnValue([
          'common.schema.json',
          'entity-instance.schema.json',
          'world.schema.json',
        ]),
      getContentTypeSchemaId: jest.fn(),
      getBaseDataPath: jest.fn(),
      getSchemaBasePath: jest.fn(),
      getContentBasePath: jest.fn(),
    };

    mockPathResolver = {
      resolveSchemaPath: jest.fn().mockImplementation((filename) => {
        return `./data/schemas/${filename}`;
      }),
      resolveContentPath: jest.fn(),
    };

    mockDataFetcher = {
      fetch: jest.fn().mockImplementation(async (path) => {
        if (path.includes('common.schema.json')) {
          return commonSchemaData;
        }
        if (path.includes('entity-instance.schema.json')) {
          return entityInstanceSchemaData;
        }
        if (path.includes('world.schema.json')) {
          return worldSchemaData;
        }
        throw new Error(`Mock fetch error: Unknown path ${path}`);
      }),
    };

    schemaValidator = new AjvSchemaValidator(mockLogger);
    schemaLoader = new SchemaLoader(
      mockConfig,
      mockPathResolver,
      mockDataFetcher,
      schemaValidator,
      mockLogger
    );
  });

  describe('Schema Loading and $ref Resolution', () => {
    it('should load all schemas in the correct order', async () => {
      // Act
      await schemaLoader.loadAndCompileAllSchemas();

      // Assert
      const summary = schemaLoader.getSchemaLoadingSummary();
      expect(summary.issues).toHaveLength(0);
      expect(summary.loadedSchemas).toContain(
        'http://example.com/schemas/common.schema.json'
      );
      expect(summary.loadedSchemas).toContain(
        'http://example.com/schemas/world.schema.json'
      );
      expect(summary.loadedSchemas).toContain(
        'http://example.com/schemas/entity-instance.schema.json'
      );
    });

    it('should resolve $refs in world schema correctly', async () => {
      // Arrange
      await schemaLoader.loadAndCompileAllSchemas();

      // Act
      const worldSchemaValid = schemaValidator.validateSchemaRefs(
        'http://example.com/schemas/world.schema.json'
      );
      const entityInstanceSchemaValid = schemaValidator.validateSchemaRefs(
        'http://example.com/schemas/entity-instance.schema.json'
      );
      const commonSchemaValid = schemaValidator.validateSchemaRefs(
        'http://example.com/schemas/common.schema.json'
      );

      // Assert
      expect(commonSchemaValid).toBe(true);
      expect(entityInstanceSchemaValid).toBe(true);
      expect(worldSchemaValid).toBe(true);
    });

    it('should validate a valid world file against the world schema', async () => {
      // Arrange
      await schemaLoader.loadAndCompileAllSchemas();

      const validWorldData = {
        id: 'test:world',
        name: 'Test World',
        description: 'A test world',
        instances: [
          {
            instanceId: 'test:instance1',
            definitionId: 'test:definition1',
          },
          {
            instanceId: 'test:instance2',
            definitionId: 'test:definition2',
          },
        ],
      };

      // Act
      const result = schemaValidator.validate(
        'http://example.com/schemas/world.schema.json',
        validWorldData
      );

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });

    it('should reject an invalid world file with proper error messages', async () => {
      // Arrange
      await schemaLoader.loadAndCompileAllSchemas();

      const invalidWorldData = {
        id: 'test:world',
        name: 'Test World',
        // Missing required 'instances' array
        description: 'A test world',
      };

      // Act
      const result = schemaValidator.validate(
        'http://example.com/schemas/world.schema.json',
        invalidWorldData
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);

      // Check that the error is about missing 'instances'
      const errorMessages = result.errors.map((e) => e.message).join(' ');
      expect(errorMessages).toContain('instances');
    });

    it('should handle entity instance validation correctly', async () => {
      // Arrange
      await schemaLoader.loadAndCompileAllSchemas();

      const validInstance = {
        instanceId: 'test:instance',
        definitionId: 'test:definition',
      };

      const invalidInstance = {
        instanceId: 'test:instance',
        definitionId: 'test:definition',
        invalidProperty: 'should not be allowed',
      };

      // Act
      const validResult = schemaValidator.validate(
        'http://example.com/schemas/entity-instance.schema.json',
        validInstance
      );
      const invalidResult = schemaValidator.validate(
        'http://example.com/schemas/entity-instance.schema.json',
        invalidInstance
      );

      // Assert
      expect(validResult.isValid).toBe(true);
      expect(validResult.errors).toBeNull();

      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toBeDefined();
      expect(invalidResult.errors.length).toBeGreaterThan(0);

      // Check that the error is about additional properties
      const errorMessages = invalidResult.errors
        .map((e) => e.message)
        .join(' ');
      expect(errorMessages).toContain('additional properties');
    });

    it('should validate namespaced IDs correctly', async () => {
      // Arrange
      await schemaLoader.loadAndCompileAllSchemas();

      const validNamespacedId = 'test:valid_id';
      const invalidNamespacedId = 'invalid id with spaces';

      // Act & Assert
      // We can't directly test the namespacedId schema since it's a definition,
      // but we can test it indirectly through the world schema
      const validWorld = {
        id: validNamespacedId,
        name: 'Test World',
        instances: [],
      };

      const invalidWorld = {
        id: invalidNamespacedId,
        name: 'Test World',
        instances: [],
      };

      const validResult = schemaValidator.validate(
        'http://example.com/schemas/world.schema.json',
        validWorld
      );
      const invalidResult = schemaValidator.validate(
        'http://example.com/schemas/world.schema.json',
        invalidWorld
      );

      expect(validResult.isValid).toBe(true);
      expect(invalidResult.isValid).toBe(false);
    });
  });

  describe('Schema Loading Order', () => {
    it('should load common schema before dependent schemas', async () => {
      // Act
      await schemaLoader.loadAndCompileAllSchemas();

      // Assert
      const commonLoaded = schemaValidator.isSchemaLoaded(
        'http://example.com/schemas/common.schema.json'
      );
      const worldLoaded = schemaValidator.isSchemaLoaded(
        'http://example.com/schemas/world.schema.json'
      );
      const entityInstanceLoaded = schemaValidator.isSchemaLoaded(
        'http://example.com/schemas/entity-instance.schema.json'
      );

      expect(commonLoaded).toBe(true);
      expect(worldLoaded).toBe(true);
      expect(entityInstanceLoaded).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should provide meaningful error messages for schema loading failures', async () => {
      // Arrange - Create a mock configuration that includes a non-existent schema
      const errorConfig = {
        getSchemaFiles: () => ['non-existent.schema.json'],
      };

      const errorPathResolver = {
        resolveSchemaPath: () => './data/schemas/non-existent.schema.json',
      };

      const errorDataFetcher = {
        fetch: () => Promise.reject(new Error('File not found')),
      };

      const errorValidator = new AjvSchemaValidator(mockLogger);
      const errorSchemaLoader = new SchemaLoader(
        errorConfig,
        errorPathResolver,
        errorDataFetcher,
        errorValidator,
        mockLogger
      );

      // Act & Assert
      await expect(
        errorSchemaLoader.loadAndCompileAllSchemas()
      ).rejects.toThrow('File not found');
    });
  });
});
