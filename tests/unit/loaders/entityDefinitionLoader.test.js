/**
 * @file Test suite for EntityDefinitionLoader.
 * @see tests/loaders/entityDefinitionLoader.test.js
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mock } from 'jest-mock-extended';
import EntityDefinitionLoader from '../../../src/loaders/entityDefinitionLoader.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../../src/interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../../../src/interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../../../src/interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../../../src/interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../../../src/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../../src/interfaces/coreServices.js').ILogger} ILogger */

describe('EntityDefinitionLoader', () => {
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
    // Create mock instances for all dependencies using jest-mock-extended
    mockConfig = mock();
    mockPathResolver = mock();
    mockDataFetcher = mock();
    mockSchemaValidator = mock();
    mockDataRegistry = mock();
    mockLogger = mock({
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    });

    // Default mock for store to return false (no override)
    mockDataRegistry.store.mockReturnValue(false);

    // The BaseManifestItemLoader constructor checks for a primary schema ID.
    // We must configure the mock to return a valid ID.
    mockConfig.getContentTypeSchemaId
      .calledWith('entityDefinitions')
      .mockReturnValue('entity-definition-schema');

    // Instantiate the loader with the mocked dependencies
    loader = new EntityDefinitionLoader(
      mockConfig,
      mockPathResolver,
      mockDataFetcher,
      mockSchemaValidator,
      mockDataRegistry,
      mockLogger
    );
  });

  describe('_processFetchedItem (Happy Path - TEST-DEF-01)', () => {
    it('should correctly process, validate, and store a valid entity definition', async () => {
      // --- Arrange ---
      const modId = 'core';
      const filename = 'goblin.definition.json';
      const resolvedPath = `data/mods/core/entities/definitions/${filename}`;
      const registryKey = 'entityDefinitions';

      const testEntityData = {
        $schema: 'http://example.com/schemas/entity-definition.schema.json',
        id: 'goblin',
        description: 'A standard goblin warrior, weak but numerous.',
        components: {
          'core:name': { name: 'Goblin' },
          'core:health': { max: 15, current: 15 },
          'core:actor': {},
        },
      };

      const expectedStoredData = new EntityDefinition('core:goblin', testEntityData);

      mockDataRegistry.get.mockReturnValue(undefined);
      mockSchemaValidator.isSchemaLoaded.mockReturnValue(true);
      mockSchemaValidator.validate.mockReturnValue({
        isValid: true,
        errors: null,
      });

      // --- Act ---
      const promise = loader._processFetchedItem(
        modId,
        filename,
        resolvedPath,
        testEntityData,
        registryKey
      );

      // --- Assert ---
      await expect(promise).resolves.not.toThrow();

      const result = await promise;

      expect(result).toEqual({
        qualifiedId: 'core:goblin',
        didOverride: false,
      });

      expect(mockSchemaValidator.validate).toHaveBeenCalledTimes(3);
      expect(mockSchemaValidator.validate).toHaveBeenCalledWith(
        'core:name',
        testEntityData.components['core:name']
      );
      expect(mockSchemaValidator.validate).toHaveBeenCalledWith(
        'core:health',
        testEntityData.components['core:health']
      );
      expect(mockSchemaValidator.validate).toHaveBeenCalledWith(
        'core:actor',
        testEntityData.components['core:actor']
      );

      expect(mockDataRegistry.store).toHaveBeenCalledTimes(1);
      expect(mockDataRegistry.store).toHaveBeenCalledWith(
        'entityDefinitions',
        'core:goblin',
        expect.objectContaining({
          id: 'goblin',
          description: 'A standard goblin warrior, weak but numerous.',
          components: expect.objectContaining({
            'core:name': expect.any(Object),
            'core:health': expect.any(Object),
            'core:actor': expect.any(Object),
          }),
          _fullId: 'core:goblin',
          _sourceFile: filename,
          _modId: modId,
        })
      );

      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe('_processFileWrapper (Failure Scenarios - TEST-DEF-02)', () => {
    it('should throw an error and not store data if the definition fails primary schema validation', async () => {
      // --- Arrange ---
      const modId = 'core';
      const filename = 'invalid-goblin.definition.json';
      const resolvedPath = `data/mods/core/entities/definitions/${filename}`;
      const diskFolder = 'entities/definitions';
      const registryKey = 'entityDefinitions';
      const primarySchemaId = 'entity-definition-schema';

      const invalidEntityData = {
        $schema: 'http://example.com/schemas/entity-definition.schema.json',
        id: 'core:invalid-goblin',
        description: 'An invalid goblin missing its components.',
      };

      const mockValidationErrors = [
        {
          instancePath: '',
          schemaPath: '#/required',
          keyword: 'required',
          params: { missingProperty: 'components' },
          message: "must have required property 'components'",
        },
      ];

      mockPathResolver.resolveModContentPath.mockReturnValue(resolvedPath);
      mockDataFetcher.fetch.mockResolvedValue(invalidEntityData);

      // Correctly mock the full validation flow.
      // 1. The validator must report the schema as LOADED to proceed.
      mockSchemaValidator.isSchemaLoaded
        .calledWith(primarySchemaId)
        .mockReturnValue(true);

      // 2. The validator must return an INVALID result for that schema.
      mockSchemaValidator.validate
        .calledWith(primarySchemaId, invalidEntityData)
        .mockReturnValue({
          isValid: false,
          errors: mockValidationErrors,
        });

      // --- Act & Assert ---
      // The call should now be rejected because `validateAgainstSchema` will throw an error.
      await expect(
        loader._processFileWrapper(modId, filename, diskFolder, registryKey)
      ).rejects.toThrow(
        /Primary schema validation failed for 'invalid-goblin.definition.json'/
      );

      // The test verifies that DataRegistry.store is never called.
      expect(mockDataRegistry.store).not.toHaveBeenCalled();

      // FIX: Verify the error was logged correctly. The implementation logs twice:
      // once in the `validateAgainstSchema` helper, and once in the `_processFileWrapper` catch block.
      expect(mockLogger.error).toHaveBeenCalledTimes(2);

      // Check the more specific error log from `validateAgainstSchema`
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `Primary schema validation failed for '${filename}'`
        ),
        expect.objectContaining({
          schemaId: primarySchemaId,
          validationErrors: mockValidationErrors,
        })
      );

      // Check the more generic error log from `_processFileWrapper`
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error processing file:',
        expect.objectContaining({
          modId,
          filename,
          path: resolvedPath,
          error: expect.stringMatching(
            /Primary schema validation failed for 'invalid-goblin.definition.json'/
          ),
        }),
        expect.any(Error)
      );
    });
  });
});
