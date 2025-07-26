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
        $schema: 'schema://living-narrative-engine/entity-instance.schema.json',
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
        _modId: 'core',
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
        $schema: 'schema://living-narrative-engine/entity-instance.schema.json',
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

  describe('Component Schema Not Loaded (Coverage - Lines 83-86)', () => {
    it('should skip validation and log warning when component schema is not loaded', async () => {
      // --- Arrange ---
      const modId = 'test_mod';
      const filename = 'entity-with-unloaded-schema.instance.json';
      const resolvedPath = `data/mods/test_mod/entities/instances/${filename}`;
      const registryKey = 'entityInstances';

      const testInstanceData = {
        $schema: 'schema://living-narrative-engine/entity-instance.schema.json',
        instanceId: 'test_entity_01',
        definitionId: 'test_mod:base_entity',
        componentOverrides: {
          'test_mod:unloaded_component': {
            someData: 'value',
          },
          'test_mod:loaded_component': {
            otherData: 'value2',
          },
        },
      };

      // Mock that one component schema is not loaded, the other is
      mockSchemaValidator.isSchemaLoaded
        .calledWith('test_mod:unloaded_component')
        .mockReturnValue(false);
      mockSchemaValidator.isSchemaLoaded
        .calledWith('test_mod:loaded_component')
        .mockReturnValue(true);

      // The loaded component should validate successfully
      mockSchemaValidator.validate
        .calledWith('test_mod:loaded_component', expect.any(Object))
        .mockReturnValue({
          isValid: true,
          errors: null,
        });

      // Mock that no entity with this ID already exists
      mockDataRegistry.get.mockReturnValue(undefined);

      // --- Act ---
      const result = await loader._processFetchedItem(
        modId,
        filename,
        resolvedPath,
        testInstanceData,
        registryKey
      );

      // --- Assert ---
      // Verify the warning was logged for the unloaded schema
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          `Skipping validation for component override 'test_mod:unloaded_component'`
        )
      );

      // Verify only the loaded component was validated
      expect(mockSchemaValidator.validate).toHaveBeenCalledTimes(1);
      expect(mockSchemaValidator.validate).toHaveBeenCalledWith(
        'test_mod:loaded_component',
        testInstanceData.componentOverrides['test_mod:loaded_component']
      );

      // Verify the instance was still stored successfully
      expect(mockDataRegistry.store).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        qualifiedId: 'test_mod:test_entity_01',
        didOverride: false,
      });
    });
  });

  describe('Component Validation Failures (Coverage - Lines 95-106, 115-119)', () => {
    it('should throw ValidationError when component validation fails', async () => {
      // --- Arrange ---
      const modId = 'core';
      const filename = 'entity-with-invalid-components.instance.json';
      const resolvedPath = `data/mods/core/entities/instances/${filename}`;
      const registryKey = 'entityInstances';

      const testInstanceData = {
        $schema: 'schema://living-narrative-engine/entity-instance.schema.json',
        instanceId: 'invalid_entity_01',
        definitionId: 'core:base_entity',
        componentOverrides: {
          'core:health': {
            // Invalid: missing required 'current' field
            max: 100,
          },
          'core:name': {
            // Invalid: wrong type
            name: 123,
          },
        },
      };

      const healthErrors = [
        {
          instancePath: '',
          schemaPath: '#/required',
          keyword: 'required',
          params: { missingProperty: 'current' },
          message: "must have required property 'current'",
        },
      ];

      const nameErrors = [
        {
          instancePath: '/name',
          schemaPath: '#/properties/name/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        },
      ];

      // Mock that schemas are loaded
      mockSchemaValidator.isSchemaLoaded.mockReturnValue(true);

      // Mock validation failures
      mockSchemaValidator.validate
        .calledWith('core:health', testInstanceData.componentOverrides['core:health'])
        .mockReturnValue({
          isValid: false,
          errors: healthErrors,
        });

      mockSchemaValidator.validate
        .calledWith('core:name', testInstanceData.componentOverrides['core:name'])
        .mockReturnValue({
          isValid: false,
          errors: nameErrors,
        });

      // --- Act & Assert ---
      await expect(
        loader._processFetchedItem(
          modId,
          filename,
          resolvedPath,
          testInstanceData,
          registryKey
        )
      ).rejects.toThrow(
        `Component override validation failed for instance 'invalid_entity_01' in file '${filename}' (mod: ${modId}). Invalid components: [core:health, core:name]. See previous error logs for details.`
      );

      // Verify error logging for each failed component
      expect(mockLogger.error).toHaveBeenCalledTimes(2);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `Schema validation failed for component override 'core:health'`
        ),
        expect.any(Object)
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `Schema validation failed for component override 'core:name'`
        ),
        expect.any(Object)
      );

      // Verify the entity was NOT stored
      expect(mockDataRegistry.store).not.toHaveBeenCalled();
    });

    it('should handle mixed validation results correctly', async () => {
      // --- Arrange ---
      const modId = 'mixed_mod';
      const filename = 'mixed-validation.instance.json';
      const resolvedPath = `data/mods/mixed_mod/entities/instances/${filename}`;
      const registryKey = 'entityInstances';

      const testInstanceData = {
        $schema: 'schema://living-narrative-engine/entity-instance.schema.json',
        instanceId: 'mixed_entity_01',
        definitionId: 'mixed_mod:base',
        componentOverrides: {
          'mixed_mod:valid_component': { data: 'valid' },
          'mixed_mod:invalid_component': { data: 'invalid' },
          'mixed_mod:unloaded_component': { data: 'skip' },
        },
      };

      // Setup mixed validation scenarios
      mockSchemaValidator.isSchemaLoaded
        .calledWith('mixed_mod:valid_component')
        .mockReturnValue(true);
      mockSchemaValidator.isSchemaLoaded
        .calledWith('mixed_mod:invalid_component')
        .mockReturnValue(true);
      mockSchemaValidator.isSchemaLoaded
        .calledWith('mixed_mod:unloaded_component')
        .mockReturnValue(false);

      mockSchemaValidator.validate
        .calledWith('mixed_mod:valid_component', expect.any(Object))
        .mockReturnValue({ isValid: true, errors: null });

      mockSchemaValidator.validate
        .calledWith('mixed_mod:invalid_component', expect.any(Object))
        .mockReturnValue({
          isValid: false,
          errors: [{ message: 'Invalid data format' }],
        });

      // --- Act & Assert ---
      await expect(
        loader._processFetchedItem(
          modId,
          filename,
          resolvedPath,
          testInstanceData,
          registryKey
        )
      ).rejects.toThrow(/Component override validation failed/);

      // Verify warning for unloaded schema
      expect(mockLogger.warn).toHaveBeenCalled();

      // Verify error for invalid component
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('mixed_mod:invalid_component'),
        expect.any(Object)
      );
    });
  });

  describe('No Component Overrides (Coverage - Line 165)', () => {
    it('should handle instance with no componentOverrides property', async () => {
      // --- Arrange ---
      const modId = 'core';
      const filename = 'minimal.instance.json';
      const resolvedPath = `data/mods/core/entities/instances/${filename}`;
      const registryKey = 'entityInstances';

      const testInstanceData = {
        $schema: 'schema://living-narrative-engine/entity-instance.schema.json',
        instanceId: 'minimal_01',
        definitionId: 'core:base',
        // No componentOverrides property
      };

      mockDataRegistry.get.mockReturnValue(undefined);

      // --- Act ---
      const result = await loader._processFetchedItem(
        modId,
        filename,
        resolvedPath,
        testInstanceData,
        registryKey
      );

      // --- Assert ---
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Instance 'minimal_01' in ${filename} has no component overrides. Skipping secondary validation.`
        )
      );

      expect(mockSchemaValidator.validate).not.toHaveBeenCalled();
      expect(mockDataRegistry.store).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        qualifiedId: 'core:minimal_01',
        didOverride: false,
      });
    });

    it('should handle instance with empty componentOverrides object', async () => {
      // --- Arrange ---
      const modId = 'empty_mod';
      const filename = 'empty-overrides.instance.json';
      const resolvedPath = `data/mods/empty_mod/entities/instances/${filename}`;
      const registryKey = 'entityInstances';

      const testInstanceData = {
        $schema: 'schema://living-narrative-engine/entity-instance.schema.json',
        instanceId: 'empty_01',
        definitionId: 'empty_mod:base',
        componentOverrides: {}, // Empty object
      };

      mockDataRegistry.get.mockReturnValue(undefined);

      // --- Act ---
      const result = await loader._processFetchedItem(
        modId,
        filename,
        resolvedPath,
        testInstanceData,
        registryKey
      );

      // --- Assert ---
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Instance 'empty_01' in ${filename} has no component overrides. Skipping secondary validation.`
        )
      );

      expect(mockSchemaValidator.validate).not.toHaveBeenCalled();
      expect(mockDataRegistry.store).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        qualifiedId: 'empty_mod:empty_01',
        didOverride: false,
      });
    });
  });

});
