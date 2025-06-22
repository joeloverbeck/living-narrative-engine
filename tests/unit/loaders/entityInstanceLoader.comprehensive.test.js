// src/loaders/entityInstanceLoader.test.js

/**
 * @file Test suite for EntityInstanceLoader.
 * @see src/loaders/entityInstanceLoader.js
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mock } from 'jest-mock-extended';

// SUT (System Under Test)
import EntityInstanceLoader from '../../../src/loaders/entityInstanceLoader.js';

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../../src/interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../../../src/interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../../../src/interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../../../src/interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../../../src/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../../src/interfaces/coreServices.js').ILogger} ILogger */

describe('EntityInstanceLoader', () => {
  /** @type {EntityInstanceLoader} */
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
    // We must configure the mock to return the schema ID for this content type.
    mockConfig.getContentTypeSchemaId
      .calledWith('entityInstances')
      .mockReturnValue('entity-instance.schema.json');

    // Instantiate the loader with the mocked dependencies
    loader = new EntityInstanceLoader(
      mockConfig,
      mockPathResolver,
      mockDataFetcher,
      mockSchemaValidator,
      mockDataRegistry,
      mockLogger
    );
  });

  describe('_processFetchedItem (Happy Path - TEST-INST-01)', () => {
    it('should correctly process, validate, and store a valid entity instance', async () => {
      // --- Arrange ---
      const modId = 'core';
      const filename = 'core_goblin-sentry.instance.json';
      const resolvedPath = `data/mods/core/entities/instances/${filename}`;
      const registryKey = 'entityInstances';

      const testInstanceData = {
        $schema: 'http://example.com/schemas/entity-instance.schema.json',
        instanceId: 'goblin_sentry_01',
        definitionId: 'core:goblin',
        componentOverrides: {
          'core:name': {
            name: 'Goblin Sentry',
          },
          'core:health': {
            max: 25,
            current: 25,
          },
        },
      };

      // _storeItemInRegistry adds these properties before storing.
      const expectedStoredData = {
        ...testInstanceData,
        id: 'core:goblin_sentry_01',
        _fullId: 'core:goblin_sentry_01',
        _modId: "core",
        _sourceFile: filename,
      };

      // Mock that no entity with this ID already exists.
      mockDataRegistry.get.mockReturnValue(undefined);

      // Mock that component schemas are loaded and valid.
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
        testInstanceData,
        registryKey
      );

      // --- Assert ---
      // 1. Verify the method executes without throwing errors.
      await expect(promise).resolves.not.toThrow();

      const result = await promise;

      // 4. Assert the method returns the correct qualifiedId and didOverride status.
      expect(result).toEqual({
        qualifiedId: 'core:goblin_sentry_01',
        didOverride: false,
      });

      // Assert secondary validation was performed on component overrides.
      expect(mockSchemaValidator.validate).toHaveBeenCalledTimes(2);
      expect(mockSchemaValidator.validate).toHaveBeenCalledWith(
        'core:name',
        testInstanceData.componentOverrides['core:name']
      );
      expect(mockSchemaValidator.validate).toHaveBeenCalledWith(
        'core:health',
        testInstanceData.componentOverrides['core:health']
      );

      // 3. Assert IDataRegistry.store() was called once with the correct category, ID, and data.
      expect(mockDataRegistry.store).toHaveBeenCalledTimes(1);
      expect(mockDataRegistry.store).toHaveBeenCalledWith(
        'entityInstances', // The category for instances
        'core:goblin_sentry_01',
        expectedStoredData
      );

      // Also verify the check for existing items was made.
      // expect(mockDataRegistry.get).toHaveBeenCalledTimes(1);
      // expect(mockDataRegistry.get).toHaveBeenCalledWith(
      //   'entity_instances',
      //   'core:goblin_sentry_01'
      // );

      // 2. The test confirms no error is thrown (covered by the first assertion).
      // Also, confirm no error or warning logs were made.
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe('_processFileWrapper (Failure Scenarios - TEST-INST-02)', () => {
    it('should throw an error and not store data if the instance fails primary schema validation', async () => {
      // --- Arrange ---
      const modId = 'core';
      const filename = 'invalid-sentry.instance.json';
      const resolvedPath = `data/mods/core/entities/instances/${filename}`;
      const diskFolder = 'entities/instances';
      const registryKey = 'entityInstances';
      const primarySchemaId = 'entity-instance.schema.json';

      // Invalid data: missing the required 'definitionId' property.
      const invalidInstanceData = {
        $schema: 'http://example.com/schemas/entity-instance.schema.json',
        instanceId: 'core:invalid_sentry_01',
        componentOverrides: {},
      };

      const mockValidationErrors = [
        {
          instancePath: '',
          schemaPath: '#/required',
          keyword: 'required',
          params: { missingProperty: 'definitionId' },
          message: "must have required property 'definitionId'",
        },
      ];

      // Mock the file loading process to return the invalid data.
      mockPathResolver.resolveModContentPath.mockReturnValue(resolvedPath);
      mockDataFetcher.fetch.mockResolvedValue(invalidInstanceData);

      // Mock the validation flow to simulate failure.
      // 1. The validator must report the schema as LOADED to proceed.
      mockSchemaValidator.isSchemaLoaded
        .calledWith(primarySchemaId)
        .mockReturnValue(true);

      // 2. The validator must return an INVALID result for the primary schema check.
      mockSchemaValidator.validate
        .calledWith(primarySchemaId, invalidInstanceData)
        .mockReturnValue({
          isValid: false,
          errors: mockValidationErrors,
        });

      // --- Act & Assert ---
      // 1. Assert that the method throws an Error related to schema validation.
      await expect(
        loader._processFileWrapper(modId, filename, diskFolder, registryKey)
      ).rejects.toThrow(/Primary schema validation failed/);

      // 2. Assert that IDataRegistry.store() was not called.
      expect(mockDataRegistry.store).not.toHaveBeenCalled();

      // Verify the error was logged correctly. The implementation logs twice:
      // once in the `validateAgainstSchema` helper, and once in the `_processFileWrapper` catch block.
      expect(mockLogger.error).toHaveBeenCalledTimes(2);

      // Check the specific error log from `validateAgainstSchema`
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `Primary schema validation failed for '${filename}'`
        ),
        expect.objectContaining({
          schemaId: primarySchemaId,
          validationErrors: mockValidationErrors,
        })
      );
    });
  });
});
