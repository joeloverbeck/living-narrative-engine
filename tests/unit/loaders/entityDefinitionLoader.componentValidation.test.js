/**
 * @file Test suite for EntityDefinitionLoader component validation functionality.
 * Tests the validation of entity components against their schemas during entity loading.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mock } from 'jest-mock-extended';

// Mock processAndStoreItem at module level
jest.mock('../../../src/loaders/helpers/processAndStoreItem.js', () => ({
  processAndStoreItem: jest.fn(),
}));

import { processAndStoreItem } from '../../../src/loaders/helpers/processAndStoreItem.js';
import EntityDefinitionLoader from '../../../src/loaders/entityDefinitionLoader.js';

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../../src/interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../../../src/interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../../../src/interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../../../src/interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../../../src/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../../src/interfaces/coreServices.js').ILogger} ILogger */

describe('EntityDefinitionLoader - Component Validation', () => {
  /** @type {EntityDefinitionLoader} */
  let loader;

  // --- Mocks ---
  /** @type {jest.Mocked<IConfiguration>} */
  let mockConfig;
  /** @type {jest.Mocked<IPathResolver>} */
  let mockPathResolver;
  /** @type {jest.Mocked<IDataFetcher>} */
  let mockDataFetcher;
  /** @type {jest.Mocked<ISchemaValidator>} */
  let mockSchemaValidator;
  /** @type {jest.Mocked<IDataRegistry>} */
  let mockDataRegistry;
  /** @type {jest.Mocked<ILogger>} */
  let mockLogger;

  beforeEach(() => {
    // Create mock instances for all dependencies
    mockConfig = mock();
    mockPathResolver = mock();
    mockDataFetcher = mock();
    mockSchemaValidator = mock({
      isSchemaLoaded: jest.fn(),
      validate: jest.fn(),
    });
    mockDataRegistry = mock();
    mockLogger = mock({
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    });

    // Set up data registry mock to return component schemas
    mockDataRegistry.tryGetData
      .mockReturnValue(undefined)
      .mockImplementation((registryPath) => {
        if (registryPath === 'components.descriptors:firmness') {
          return {
            dataSchema: {
              type: 'object',
              properties: {
                firmness: {
                  type: 'string',
                  enum: ['soft', 'pliant', 'firm', 'hard', 'rigid'],
                },
              },
              required: ['firmness'],
              additionalProperties: false,
            },
          };
        }
        if (registryPath === 'components.core:name') {
          return {
            dataSchema: {
              type: 'object',
              properties: {
                text: { type: 'string' },
              },
              required: ['text'],
              additionalProperties: false,
            },
          };
        }
        return undefined;
      });

    // Configure processAndStoreItem mock
    processAndStoreItem.mockImplementation(async (loader, options) => ({
      qualifiedId: options.data.id,
      didOverride: undefined,
    }));

    loader = new EntityDefinitionLoader(
      mockConfig,
      mockPathResolver,
      mockDataFetcher,
      mockSchemaValidator,
      mockDataRegistry,
      mockLogger
    );

    // Mock primary schema validation to always pass
    loader._validateAgainstPrimarySchema = jest.fn().mockResolvedValue();
  });

  describe('Component Validation with Enum Values', () => {
    it('should validate entity with correct enum value for firmness component', async () => {
      const entityData = {
        id: 'test:entity',
        description: 'Test entity',
        components: {
          'descriptors:firmness': {
            firmness: 'firm', // Valid enum value
          },
          'core:name': {
            text: 'Test Entity',
          },
        },
      };

      // Mock schema loaded check
      mockSchemaValidator.isSchemaLoaded.mockReturnValue(true);

      // Mock schema validation to pass for valid values
      mockSchemaValidator.validate.mockImplementation((schemaId) => {
        if (schemaId === 'descriptors:firmness') {
          return { isValid: true };
        }
        if (schemaId === 'core:name') {
          return { isValid: true };
        }
        return { isValid: false };
      });

      // Test should not throw
      await expect(
        loader._processFetchedItem(
          'test',
          'test-entity.entity.json',
          './data/mods/test/entities/definitions/test-entity.entity.json',
          entityData,
          'entity_definitions'
        )
      ).resolves.toBeTruthy();

      // Verify no error logs
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should fail validation with invalid enum value for firmness component', async () => {
      const entityData = {
        id: 'test:invalid_entity',
        description: 'Test entity with invalid firmness',
        components: {
          'descriptors:firmness': {
            firmness: 'full', // Invalid enum value
          },
          'core:name': {
            text: 'Test Entity',
          },
        },
      };

      // Mock schema loaded check
      mockSchemaValidator.isSchemaLoaded.mockReturnValue(true);

      // Mock schema validation
      mockSchemaValidator.validate.mockImplementation((schemaId) => {
        if (schemaId === 'descriptors:firmness') {
          return {
            isValid: false,
            errors: [
              {
                instancePath: '/firmness',
                schemaPath: '#/properties/firmness/enum',
                keyword: 'enum',
                params: {
                  allowedValues: ['soft', 'pliant', 'firm', 'hard', 'rigid'],
                },
                message: 'must be equal to one of the allowed values',
                data: 'full',
              },
            ],
          };
        }
        if (schemaId === 'core:name') {
          return { isValid: true };
        }
        return { isValid: false };
      });

      // Test should throw with specific error message
      await expect(
        loader._processFetchedItem(
          'test',
          'test-invalid-entity.entity.json',
          './data/mods/test/entities/definitions/test-invalid-entity.entity.json',
          entityData,
          'entity_definitions'
        )
      ).rejects.toThrow(
        "Runtime component validation failed for entity 'test:invalid_entity' in file 'test-invalid-entity.entity.json' (mod: test). Invalid components: [descriptors:firmness]. See previous logs for details."
      );

      // Verify error logging
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Runtime validation failed for component'),
        expect.objectContaining({
          modId: 'test',
          filename: 'test-invalid-entity.entity.json',
          entityId: 'test:invalid_entity',
          componentId: 'descriptors:firmness',
        })
      );
    });

    it('should validate all enum values for firmness component', async () => {
      const validFirmnessValues = ['soft', 'pliant', 'firm', 'hard', 'rigid'];

      for (const firmnessValue of validFirmnessValues) {
        const entityData = {
          id: `test:entity_${firmnessValue}`,
          description: `Test entity with ${firmnessValue} firmness`,
          components: {
            'descriptors:firmness': {
              firmness: firmnessValue,
            },
          },
        };

        // Mock schema loaded check
        mockSchemaValidator.isSchemaLoaded.mockReturnValue(true);

        // Mock schema validation to pass for all valid values
        mockSchemaValidator.validate.mockImplementation((schemaId) => {
          if (schemaId === 'descriptors:firmness') {
            return { isValid: true };
          }
          return { isValid: false };
        });

        await expect(
          loader._processFetchedItem(
            'test',
            `test-entity-${firmnessValue}.entity.json`,
            `./data/mods/test/entities/definitions/test-entity-${firmnessValue}.entity.json`,
            entityData,
            'entity_definitions'
          )
        ).resolves.toBeTruthy();
      }
    });

    it('should provide detailed error information for validation failures', async () => {
      const entityData = {
        id: 'test:detailed_error_entity',
        description: 'Test entity for detailed error reporting',
        components: {
          'descriptors:firmness': {
            firmness: 'very-soft', // Invalid value
          },
        },
      };

      const expectedErrors = [
        {
          instancePath: '/firmness',
          schemaPath: '#/properties/firmness/enum',
          keyword: 'enum',
          params: {
            allowedValues: ['soft', 'pliant', 'firm', 'hard', 'rigid'],
          },
          message: 'must be equal to one of the allowed values',
          schema: ['soft', 'pliant', 'firm', 'hard', 'rigid'],
          data: 'very-soft',
        },
      ];

      // Mock schema loaded check
      mockSchemaValidator.isSchemaLoaded.mockReturnValue(true);

      mockSchemaValidator.validate.mockImplementation((schemaId) => {
        if (schemaId === 'descriptors:firmness') {
          return {
            isValid: false,
            errors: expectedErrors,
          };
        }
        return { isValid: true };
      });

      await expect(
        loader._processFetchedItem(
          'test',
          'detailed-error.entity.json',
          './data/mods/test/entities/definitions/detailed-error.entity.json',
          entityData,
          'entity_definitions'
        )
      ).rejects.toThrow();

      // Verify detailed error logging includes JSON stringified errors
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Runtime validation failed'),
        expect.objectContaining({
          errors: expectedErrors,
        })
      );
    });

    it('should handle multiple component validation failures', async () => {
      const entityData = {
        id: 'test:multi_failure_entity',
        description: 'Test entity with multiple failures',
        components: {
          'descriptors:firmness': {
            firmness: 'invalid-firm', // Invalid
          },
          'core:name': {
            text: 123, // Wrong type
          },
        },
      };

      // Mock schema loaded check
      mockSchemaValidator.isSchemaLoaded.mockReturnValue(true);

      mockSchemaValidator.validate.mockImplementation((schemaId) => {
        if (schemaId === 'descriptors:firmness') {
          return {
            isValid: false,
            errors: [
              {
                message: 'must be equal to one of the allowed values',
                instancePath: '/firmness',
              },
            ],
          };
        }
        if (schemaId === 'core:name') {
          return {
            isValid: false,
            errors: [
              {
                message: 'must be string',
                instancePath: '/text',
              },
            ],
          };
        }
        return { isValid: false };
      });

      await expect(
        loader._processFetchedItem(
          'test',
          'multi-failure.entity.json',
          './data/mods/test/entities/definitions/multi-failure.entity.json',
          entityData,
          'entity_definitions'
        )
      ).rejects.toThrow(
        'Invalid components: [descriptors:firmness, core:name]'
      );

      // Verify both component errors are logged
      expect(mockLogger.error).toHaveBeenCalledTimes(3); // 2 component errors + 1 summary
    });
  });

  describe('Component Schema Retrieval', () => {
    it('should skip validation when component schema is not found', async () => {
      const entityData = {
        id: 'test:no_schema_entity',
        description: 'Test entity with unregistered component',
        components: {
          'unknown:component': {
            someData: 'value',
          },
        },
      };

      // Mock schema loaded check - return false for unknown component
      mockSchemaValidator.isSchemaLoaded.mockImplementation((schemaId) => {
        return schemaId !== 'unknown:component';
      });

      // Mock registry to return undefined for unknown component
      mockDataRegistry.tryGetData.mockImplementation((registryPath) => {
        if (registryPath === 'components.unknown:component') {
          return undefined;
        }
        return undefined;
      });

      // Should not throw, but should log a warning
      await expect(
        loader._processFetchedItem(
          'test',
          'no-schema.entity.json',
          './data/mods/test/entities/definitions/no-schema.entity.json',
          entityData,
          'entity_definitions'
        )
      ).resolves.toBeTruthy();

      // Check that the warning was called for the unknown component
      const warnCalls = mockLogger.warn.mock.calls;
      const hasExpectedWarning = warnCalls.some(
        (call) =>
          call[0] &&
          call[0].includes(
            "Skipping validation for component 'unknown:component'"
          )
      );
      expect(hasExpectedWarning).toBe(true);
    });
  });
});
