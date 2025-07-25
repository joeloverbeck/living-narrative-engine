/**
 * @file Unit tests for EntityDefinitionLoader component validation logic
 * @see src/loaders/entityDefinitionLoader.js
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mock } from 'jest-mock-extended';
import EntityDefinitionLoader from '../../../src/loaders/entityDefinitionLoader.js';
import { ValidationError } from '../../../src/errors/validationError.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../../src/interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../../../src/interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../../../src/interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../../../src/interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../../../src/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../src/interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

describe('EntityDefinitionLoader Component Validation Unit Tests', () => {
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
  /** @type {jest.Mocked<ISafeEventDispatcher>} */
  let mockSafeEventDispatcher;

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

    mockSafeEventDispatcher = mock({
      dispatch: jest.fn(),
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
      mockLogger,
      mockSafeEventDispatcher
    );
  });

  describe('#validateEntityComponents - Schema Not Loaded Warning (Lines 111-114)', () => {
    it('should log warning and skip validation when component schema is not loaded', async () => {
      // --- Arrange ---
      const modId = 'core';
      const filename = 'test.definition.json';
      const resolvedPath = `data/mods/core/entities/definitions/${filename}`;
      const registryKey = 'entityDefinitions';

      const testEntityData = {
        $schema:
          'schema://living-narrative-engine/entity-definition.schema.json',
        id: 'test_entity',
        description: 'A test entity with unknown component',
        components: {
          'unknown:component': { someData: 'value' },
          'core:name': { name: 'Test Entity' },
        },
      };

      mockDataRegistry.get.mockReturnValue(undefined);

      // Schema not loaded for the first component, loaded for the second
      mockSchemaValidator.isSchemaLoaded
        .calledWith('unknown:component')
        .mockReturnValue(false);
      mockSchemaValidator.isSchemaLoaded
        .calledWith('core:name')
        .mockReturnValue(true);

      // Only the second component should be validated
      mockSchemaValidator.validate
        .calledWith('core:name', testEntityData.components['core:name'])
        .mockReturnValue({
          isValid: true,
          errors: null,
        });

      // --- Act ---
      const result = await loader._processFetchedItem(
        modId,
        filename,
        resolvedPath,
        testEntityData,
        registryKey
      );

      // --- Assert ---
      expect(result).toEqual({
        qualifiedId: 'core:test_entity',
        didOverride: false,
      });

      // Verify warning was logged for schema not loaded (line 111-113)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "EntityLoader [core]: Skipping validation for component 'unknown:component' in entity 'test_entity' (file: test.definition.json). Schema not loaded."
      );

      // Verify only the second component was validated
      expect(mockSchemaValidator.validate).toHaveBeenCalledTimes(1);
      expect(mockSchemaValidator.validate).toHaveBeenCalledWith(
        'core:name',
        testEntityData.components['core:name']
      );

      // Verify no error events were dispatched
      expect(mockSafeEventDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should handle all components having unloaded schemas', async () => {
      // --- Arrange ---
      const modId = 'test';
      const filename = 'all_unknown.definition.json';
      const resolvedPath = `data/mods/test/entities/definitions/${filename}`;
      const registryKey = 'entityDefinitions';

      const testEntityData = {
        $schema:
          'schema://living-narrative-engine/entity-definition.schema.json',
        id: 'all_unknown_entity',
        description: 'Entity with all unknown components',
        components: {
          'unknown1:component': { data: 'value1' },
          'unknown2:component': { data: 'value2' },
        },
      };

      mockDataRegistry.get.mockReturnValue(undefined);

      // All schemas not loaded
      mockSchemaValidator.isSchemaLoaded.mockReturnValue(false);

      // --- Act ---
      const result = await loader._processFetchedItem(
        modId,
        filename,
        resolvedPath,
        testEntityData,
        registryKey
      );

      // --- Assert ---
      expect(result).toEqual({
        qualifiedId: 'test:all_unknown_entity',
        didOverride: false,
      });

      // Verify warnings were logged for both components
      expect(mockLogger.warn).toHaveBeenCalledTimes(2);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "EntityLoader [test]: Skipping validation for component 'unknown1:component' in entity 'all_unknown_entity' (file: all_unknown.definition.json). Schema not loaded."
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "EntityLoader [test]: Skipping validation for component 'unknown2:component' in entity 'all_unknown_entity' (file: all_unknown.definition.json). Schema not loaded."
      );

      // No validations should have been performed
      expect(mockSchemaValidator.validate).not.toHaveBeenCalled();
      expect(mockSafeEventDispatcher.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('#validateEntityComponents - Component Validation Failures (Lines 121-140)', () => {
    it('should dispatch error event when single component validation fails', async () => {
      // --- Arrange ---
      const modId = 'core';
      const filename = 'invalid_component.definition.json';
      const resolvedPath = `data/mods/core/entities/definitions/${filename}`;
      const registryKey = 'entityDefinitions';

      const mockValidationErrors = [
        {
          instancePath: '/name',
          schemaPath: '#/properties/name/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        },
      ];

      const testEntityData = {
        $schema:
          'schema://living-narrative-engine/entity-definition.schema.json',
        id: 'invalid_entity',
        description: 'Entity with invalid component',
        components: {
          'core:name': { name: 123 }, // Invalid - should be string
        },
      };

      mockDataRegistry.get.mockReturnValue(undefined);
      mockSchemaValidator.isSchemaLoaded.mockReturnValue(true);
      mockSchemaValidator.validate.mockReturnValue({
        isValid: false,
        errors: mockValidationErrors,
      });

      // --- Act & Assert ---
      await expect(
        loader._processFetchedItem(
          modId,
          filename,
          resolvedPath,
          testEntityData,
          registryKey
        )
      ).rejects.toThrow(ValidationError);

      // Verify error event was dispatched (lines 127-139)
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message:
            "EntityLoader [core]: Runtime validation failed for component 'core:name' in entity 'invalid_entity' (file: invalid_component.definition.json)",
          details: {
            raw: JSON.stringify({
              modId,
              filename,
              entityId: 'invalid_entity',
              componentId: 'core:name',
              errors: mockValidationErrors,
              validationDetails: JSON.stringify(mockValidationErrors, null, 2),
            }),
          },
        }
      );

      // Verify item was NOT stored due to validation failure
      expect(mockDataRegistry.store).not.toHaveBeenCalled();
    });

    it('should format validation error details correctly in event payload', async () => {
      // --- Arrange ---
      const modId = 'anatomy';
      const filename = 'complex_error.definition.json';
      const resolvedPath = `data/mods/anatomy/entities/definitions/${filename}`;
      const registryKey = 'entityDefinitions';

      const complexValidationErrors = [
        {
          instancePath: '/sockets/0',
          schemaPath: '#/properties/sockets/items/properties/orientation/enum',
          keyword: 'enum',
          params: { allowedValues: ['left', 'right', 'upper', 'lower'] },
          message: 'must be equal to one of the allowed values',
        },
        {
          instancePath: '/sockets/0/id',
          schemaPath: '#/properties/sockets/items/properties/id/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        },
      ];

      const testEntityData = {
        $schema:
          'schema://living-narrative-engine/entity-definition.schema.json',
        id: 'complex_entity',
        description: 'Entity with complex validation errors',
        components: {
          'anatomy:sockets': {
            sockets: [
              {
                id: 123, // Invalid - should be string
                orientation: 'invalid-orientation', // Invalid enum value
              },
            ],
          },
        },
      };

      mockDataRegistry.get.mockReturnValue(undefined);
      mockSchemaValidator.isSchemaLoaded.mockReturnValue(true);
      mockSchemaValidator.validate.mockReturnValue({
        isValid: false,
        errors: complexValidationErrors,
      });

      // --- Act & Assert ---
      await expect(
        loader._processFetchedItem(
          modId,
          filename,
          resolvedPath,
          testEntityData,
          registryKey
        )
      ).rejects.toThrow(ValidationError);

      // Verify complex error details are properly formatted
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          details: {
            raw: expect.stringContaining('"componentId":"anatomy:sockets"'),
          },
        })
      );

      // Verify the raw field contains valid JSON with all error details
      const dispatchCall = mockSafeEventDispatcher.dispatch.mock.calls[0];
      const rawData = JSON.parse(dispatchCall[1].details.raw);
      expect(rawData.errors).toEqual(complexValidationErrors);
      expect(rawData.componentId).toBe('anatomy:sockets');
      expect(rawData.entityId).toBe('complex_entity');
    });
  });

  describe('#validateEntityComponents - Multiple Component Failures (Lines 152-168)', () => {
    it('should collect all validation failures and throw comprehensive error', async () => {
      // --- Arrange ---
      const modId = 'test';
      const filename = 'multi_fail.definition.json';
      const resolvedPath = `data/mods/test/entities/definitions/${filename}`;
      const registryKey = 'entityDefinitions';

      const testEntityData = {
        $schema:
          'schema://living-narrative-engine/entity-definition.schema.json',
        id: 'multi_fail_entity',
        description: 'Entity with multiple failing components',
        components: {
          'core:name': { name: 123 }, // Invalid - should be string
          'core:health': { max: 'invalid' }, // Invalid - should be number
          'core:actor': { validField: true }, // Valid component
        },
      };

      mockDataRegistry.get.mockReturnValue(undefined);
      mockSchemaValidator.isSchemaLoaded.mockReturnValue(true);

      // Mock validation results - two failures, one success
      mockSchemaValidator.validate
        .calledWith('core:name', testEntityData.components['core:name'])
        .mockReturnValue({
          isValid: false,
          errors: [{ message: 'name must be string' }],
        });

      mockSchemaValidator.validate
        .calledWith('core:health', testEntityData.components['core:health'])
        .mockReturnValue({
          isValid: false,
          errors: [{ message: 'max must be number' }],
        });

      mockSchemaValidator.validate
        .calledWith('core:actor', testEntityData.components['core:actor'])
        .mockReturnValue({
          isValid: true,
          errors: null,
        });

      // --- Act & Assert ---
      await expect(
        loader._processFetchedItem(
          modId,
          filename,
          resolvedPath,
          testEntityData,
          registryKey
        )
      ).rejects.toThrow(ValidationError);

      // Verify multiple individual error events were dispatched
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledTimes(3); // 2 individual + 1 comprehensive

      // Check individual error events (lines 127-139)
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining("component 'core:name'"),
        })
      );

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining("component 'core:health'"),
        })
      );

      // Check comprehensive error event (lines 157-167)
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message:
            "Runtime component validation failed for entity 'multi_fail_entity' in file 'multi_fail.definition.json' (mod: test). Invalid components: [core:name, core:health]. See previous logs for details.",
          details: {
            raw: JSON.stringify({
              modId,
              filename,
              entityId: 'multi_fail_entity',
              failedComponentIds: 'core:name, core:health',
            }),
          },
        }
      );

      // Verify item was NOT stored due to validation failures
      expect(mockDataRegistry.store).not.toHaveBeenCalled();
    });

    it('should handle case where all components fail validation', async () => {
      // --- Arrange ---
      const modId = 'test';
      const filename = 'all_fail.definition.json';
      const resolvedPath = `data/mods/test/entities/definitions/${filename}`;
      const registryKey = 'entityDefinitions';

      const testEntityData = {
        $schema:
          'schema://living-narrative-engine/entity-definition.schema.json',
        id: 'all_fail_entity',
        description: 'Entity where all components fail validation',
        components: {
          'comp1:test': { invalid: 'data1' },
          'comp2:test': { invalid: 'data2' },
          'comp3:test': { invalid: 'data3' },
        },
      };

      mockDataRegistry.get.mockReturnValue(undefined);
      mockSchemaValidator.isSchemaLoaded.mockReturnValue(true);

      // All components fail validation
      mockSchemaValidator.validate.mockReturnValue({
        isValid: false,
        errors: [{ message: 'validation failed' }],
      });

      // --- Act & Assert ---
      await expect(
        loader._processFetchedItem(
          modId,
          filename,
          resolvedPath,
          testEntityData,
          registryKey
        )
      ).rejects.toThrow(
        "Runtime component validation failed for entity 'all_fail_entity' in file 'all_fail.definition.json' (mod: test). Invalid components: [comp1:test, comp2:test, comp3:test]. See previous logs for details."
      );

      // Verify all components were processed (3 individual + 1 comprehensive = 4 total)
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledTimes(4);

      // Verify comprehensive error lists all failed components
      const comprehensiveCall = mockSafeEventDispatcher.dispatch.mock.calls[3];
      const rawData = JSON.parse(comprehensiveCall[1].details.raw);
      expect(rawData.failedComponentIds).toBe(
        'comp1:test, comp2:test, comp3:test'
      );
    });
  });

  describe('Empty/Missing Components Handling (Line 212)', () => {
    it('should log debug message and skip validation for entity with no components', async () => {
      // --- Arrange ---
      const modId = 'core';
      const filename = 'no_components.definition.json';
      const resolvedPath = `data/mods/core/entities/definitions/${filename}`;
      const registryKey = 'entityDefinitions';

      const testEntityData = {
        $schema:
          'schema://living-narrative-engine/entity-definition.schema.json',
        id: 'no_components_entity',
        description: 'Entity with no components',
        // No components field
      };

      mockDataRegistry.get.mockReturnValue(undefined);

      // --- Act ---
      const result = await loader._processFetchedItem(
        modId,
        filename,
        resolvedPath,
        testEntityData,
        registryKey
      );

      // --- Assert ---
      expect(result).toEqual({
        qualifiedId: 'core:no_components_entity',
        didOverride: false,
      });

      // Verify debug message was logged (line 212-214)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "EntityLoader [core]: Entity 'no_components_entity' in no_components.definition.json has no components or an empty/invalid components map. Skipping runtime component validation."
      );

      // No schema validation should have occurred
      expect(mockSchemaValidator.isSchemaLoaded).not.toHaveBeenCalled();
      expect(mockSchemaValidator.validate).not.toHaveBeenCalled();
      expect(mockSafeEventDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should handle entity with empty components object', async () => {
      // --- Arrange ---
      const modId = 'core';
      const filename = 'empty_components.definition.json';
      const resolvedPath = `data/mods/core/entities/definitions/${filename}`;
      const registryKey = 'entityDefinitions';

      const testEntityData = {
        $schema:
          'schema://living-narrative-engine/entity-definition.schema.json',
        id: 'empty_components_entity',
        description: 'Entity with empty components object',
        components: {}, // Empty object
      };

      mockDataRegistry.get.mockReturnValue(undefined);

      // --- Act ---
      const result = await loader._processFetchedItem(
        modId,
        filename,
        resolvedPath,
        testEntityData,
        registryKey
      );

      // --- Assert ---
      expect(result).toEqual({
        qualifiedId: 'core:empty_components_entity',
        didOverride: false,
      });

      // Verify debug message was logged
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "EntityLoader [core]: Entity 'empty_components_entity' in empty_components.definition.json has no components or an empty/invalid components map. Skipping runtime component validation."
      );

      // No validation should have occurred
      expect(mockSchemaValidator.isSchemaLoaded).not.toHaveBeenCalled();
      expect(mockSchemaValidator.validate).not.toHaveBeenCalled();
    });

    it('should handle entity with non-object components field', async () => {
      // --- Arrange ---
      const modId = 'core';
      const filename = 'invalid_components.definition.json';
      const resolvedPath = `data/mods/core/entities/definitions/${filename}`;
      const registryKey = 'entityDefinitions';

      const testEntityData = {
        $schema:
          'schema://living-narrative-engine/entity-definition.schema.json',
        id: 'invalid_components_entity',
        description: 'Entity with invalid components field',
        components: 'not an object', // Invalid type
      };

      mockDataRegistry.get.mockReturnValue(undefined);

      // --- Act ---
      const result = await loader._processFetchedItem(
        modId,
        filename,
        resolvedPath,
        testEntityData,
        registryKey
      );

      // --- Assert ---
      expect(result).toEqual({
        qualifiedId: 'core:invalid_components_entity',
        didOverride: false,
      });

      // Verify debug message was logged
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "EntityLoader [core]: Entity 'invalid_components_entity' in invalid_components.definition.json has no components or an empty/invalid components map. Skipping runtime component validation."
      );

      // No validation should have occurred
      expect(mockSchemaValidator.isSchemaLoaded).not.toHaveBeenCalled();
      expect(mockSchemaValidator.validate).not.toHaveBeenCalled();
    });
  });
});
