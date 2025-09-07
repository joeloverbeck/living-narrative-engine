/**
 * @file Integration tests for EntityInstanceLoader validation and loading behavior
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { mock } from 'jest-mock-extended';
import { EntityInstanceLoader } from '../../../src/loaders/entityInstanceLoader.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';

describe('EntityInstanceLoader', () => {
  let loader;
  let mockConfig;
  let mockPathResolver;
  let mockDataFetcher;
  let mockSchemaValidator;
  let dataRegistry;
  let mockLogger;

  const PRIMARY_SCHEMA_ID =
    'schema://living-narrative-engine/entity-instance.schema.json';

  beforeEach(() => {
    // Create a real data registry for testing
    dataRegistry = new InMemoryDataRegistry();

    // Create mock instances using jest-mock-extended
    mockConfig = mock();
    mockPathResolver = mock();
    mockDataFetcher = mock();
    mockSchemaValidator = mock();
    mockLogger = mock({
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    });

    // Configure mocks
    mockConfig.getContentTypeSchemaId
      .calledWith('entityInstances')
      .mockReturnValue(PRIMARY_SCHEMA_ID); // Return full schema ID

    mockConfig.get.mockImplementation((key) => {
      if (key === 'schemas.entityInstances.primaryId') {
        return PRIMARY_SCHEMA_ID;
      }
      if (key === 'loader.showLoadingProgress') {
        return false;
      }
      if (key === 'validation.skipIfSchemaNotLoaded') {
        return false; // Don't skip validation
      }
      return null;
    });

    mockConfig.getModsBasePath.mockReturnValue('./data/mods');

    mockPathResolver.resolveModContentPath.mockImplementation(
      (modId, diskFolder, filename) =>
        `./data/mods/${modId}/${diskFolder}/${filename}`
    );

    // Create the loader instance
    loader = new EntityInstanceLoader(
      mockConfig,
      mockPathResolver,
      mockDataFetcher,
      mockSchemaValidator,
      dataRegistry,
      mockLogger
    );
  });

  describe('Schema Validation', () => {
    it('should reject entity instance with missing instanceId', async () => {
      const invalidInstance = {
        $schema: 'schema://living-narrative-engine/entity-instance.schema.json',
        definitionId: 'test:some_entity',
        componentOverrides: {
          'core:name': { text: 'Test Entity' },
        },
      };

      mockDataFetcher.fetch.mockResolvedValue(invalidInstance);

      // Mock schema validation
      mockSchemaValidator.isSchemaLoaded
        .calledWith(PRIMARY_SCHEMA_ID)
        .mockReturnValue(true);

      mockSchemaValidator.validate
        .calledWith(PRIMARY_SCHEMA_ID, invalidInstance)
        .mockReturnValue({
          isValid: false,
          errors: [
            {
              instancePath: '',
              schemaPath: '#/required',
              keyword: 'required',
              params: { missingProperty: 'instanceId' },
              message: "must have required property 'instanceId'",
            },
          ],
        });

      const manifest = {
        id: 'test-mod',
        content: {
          entities: {
            instances: ['invalid-instance.entity.json'],
          },
        },
      };

      const result = await loader.loadItemsForMod(
        manifest.id,
        manifest,
        'entities.instances',
        'entities/instances',
        'entityInstances'
      );

      expect(result.errors).toBe(1);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0]).toHaveProperty('error');
      // The error comes from schema validation, not parseAndValidateId
      expect(result.failures[0].error.message).toContain(
        "Missing required property 'instanceId'"
      );
      expect(
        dataRegistry.get('entityInstances', 'test:invalid_instance')
      ).toBeUndefined();
    });

    it('should reject entity instance with missing definitionId', async () => {
      const invalidInstance = {
        $schema: 'schema://living-narrative-engine/entity-instance.schema.json',
        instanceId: 'test-mod:my_instance', // Properly namespaced
        // Missing definitionId
        componentOverrides: {
          'core:name': { text: 'Test Instance' },
        },
      };

      mockDataFetcher.fetch.mockResolvedValue(invalidInstance);

      // Mock schema validation to fail for missing definitionId
      mockSchemaValidator.isSchemaLoaded
        .calledWith(PRIMARY_SCHEMA_ID)
        .mockReturnValue(true);

      // When validation fails, it returns false and errors
      mockSchemaValidator.validate
        .calledWith(PRIMARY_SCHEMA_ID, invalidInstance)
        .mockReturnValue({
          isValid: false,
          errors: [
            {
              instancePath: '',
              schemaPath: '#/required',
              keyword: 'required',
              params: { missingProperty: 'definitionId' },
              message: "must have required property 'definitionId'",
            },
          ],
        });

      const manifest = {
        id: 'test-mod',
        content: {
          entities: {
            instances: ['invalid-instance.entity.json'],
          },
        },
      };

      const result = await loader.loadItemsForMod(
        manifest.id,
        manifest,
        'entities.instances',
        'entities/instances',
        'entityInstances'
      );

      expect(result.errors).toBe(1);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0]).toHaveProperty('error');
      // The actual error message contains the full validation error details
      expect(result.failures[0].error.message).toContain(
        "Missing required property 'definitionId'"
      );
    });

    it('should reject entity instance with invalid additional properties', async () => {
      const invalidInstance = {
        $schema: 'schema://living-narrative-engine/entity-instance.schema.json',
        instanceId: 'test:my_instance',
        definitionId: 'test:some_entity',
        id: 'should-not-be-here', // This is not allowed in instances
        components: {
          // Should be componentOverrides
          'core:name': { text: 'Test' },
        },
      };

      mockDataFetcher.fetch.mockResolvedValue(invalidInstance);

      // Mock schema validation
      mockSchemaValidator.isSchemaLoaded
        .calledWith(PRIMARY_SCHEMA_ID)
        .mockReturnValue(true);

      // When validation fails, it returns false and errors
      mockSchemaValidator.validate
        .calledWith(PRIMARY_SCHEMA_ID, invalidInstance)
        .mockReturnValue({
          isValid: false,
          errors: [
            {
              instancePath: '',
              schemaPath: '#/additionalProperties',
              keyword: 'additionalProperties',
              params: { additionalProperty: 'id' },
              message: 'must NOT have additional properties',
            },
            {
              instancePath: '',
              schemaPath: '#/additionalProperties',
              keyword: 'additionalProperties',
              params: { additionalProperty: 'components' },
              message: 'must NOT have additional properties',
            },
          ],
        });

      const manifest = {
        id: 'test-mod',
        content: {
          entities: {
            instances: ['invalid-instance.entity.json'],
          },
        },
      };

      const result = await loader.loadItemsForMod(
        manifest.id,
        manifest,
        'entities.instances',
        'entities/instances',
        'entityInstances'
      );

      expect(result.errors).toBe(1);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0]).toHaveProperty('error');
      // The actual error message contains validation details
      expect(result.failures[0].error.message).toContain(
        'Unexpected property'
      );
    });

    it('should accept valid entity instance', async () => {
      const validInstance = {
        $schema: 'schema://living-narrative-engine/entity-instance.schema.json',
        instanceId: 'test-mod:my_character', // Properly namespaced
        definitionId: 'test:character_template',
        componentOverrides: {
          'core:name': { text: 'My Character' },
          'core:location': { locationInstanceId: 'test-location' },
        },
      };

      mockDataFetcher.fetch.mockResolvedValue(validInstance);

      // Mock schema validation
      mockSchemaValidator.isSchemaLoaded
        .calledWith(PRIMARY_SCHEMA_ID)
        .mockReturnValue(true);

      mockSchemaValidator.validate
        .calledWith(PRIMARY_SCHEMA_ID, validInstance)
        .mockReturnValue({ isValid: true, errors: null });

      const manifest = {
        id: 'test-mod',
        content: {
          entities: {
            instances: ['valid-instance.entity.json'],
          },
        },
      };

      const result = await loader.loadItemsForMod(
        manifest.id,
        manifest,
        'entities.instances',
        'entities/instances',
        'entityInstances'
      );

      expect(result.errors).toBe(0);
      expect(result.count).toBe(1);
      expect(
        dataRegistry.get('entityInstances', 'test-mod:my_character')
      ).toBeDefined();
    });
  });

  describe('Error Messages', () => {
    it('should provide clear error message for entity definition used as instance', async () => {
      // This mimics the jacqueline_rouxel.entity.json issue
      const entityDefinition = {
        $schema:
          'schema://living-narrative-engine/entity-definition.schema.json',
        id: 'test:some_entity',
        description: 'An entity definition mistakenly used as instance',
        components: {
          'core:name': { text: 'Test Entity' },
          'core:description': { description: 'Test description' },
        },
      };

      mockDataFetcher.fetch.mockResolvedValue(entityDefinition);

      // Mock schema validation
      mockSchemaValidator.isSchemaLoaded
        .calledWith(PRIMARY_SCHEMA_ID)
        .mockReturnValue(true);

      mockSchemaValidator.validate
        .calledWith(PRIMARY_SCHEMA_ID, entityDefinition)
        .mockReturnValue({
          isValid: false,
          errors: [
            {
              instancePath: '',
              schemaPath: '#/required',
              keyword: 'required',
              params: { missingProperty: 'instanceId' },
              message: "must have required property 'instanceId'",
            },
            {
              instancePath: '',
              schemaPath: '#/required',
              keyword: 'required',
              params: { missingProperty: 'definitionId' },
              message: "must have required property 'definitionId'",
            },
            {
              instancePath: '',
              schemaPath: '#/additionalProperties',
              keyword: 'additionalProperties',
              params: { additionalProperty: 'id' },
              message: 'must NOT have additional properties',
            },
            {
              instancePath: '',
              schemaPath: '#/additionalProperties',
              keyword: 'additionalProperties',
              params: { additionalProperty: 'components' },
              message: 'must NOT have additional properties',
            },
          ],
        });

      const manifest = {
        id: 'test-mod',
        content: {
          entities: {
            instances: ['wrong-file.entity.json'],
          },
        },
      };

      const result = await loader.loadItemsForMod(
        manifest.id,
        manifest,
        'entities.instances',
        'entities/instances',
        'entityInstances'
      );

      expect(result.errors).toBe(1);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0]).toHaveProperty('error');
      const errorMessage = result.failures[0].error.message;
      // The error message should mention the missing required fields and additional properties
      expect(errorMessage).toMatch(
        /instanceId|definitionId|additional properties/
      );

      // Verify it logs helpful information
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('File Processing', () => {
    it('should handle empty instances array gracefully', async () => {
      const manifest = {
        id: 'test-mod',
        content: {
          entities: {
            instances: [],
          },
        },
      };

      const result = await loader.loadItemsForMod(
        manifest.id,
        manifest,
        'entities.instances',
        'entities/instances',
        'entityInstances'
      );

      expect(result.errors).toBe(0);
      expect(result.count).toBe(0);
      expect(mockDataFetcher.fetch).not.toHaveBeenCalled();
    });

    it('should continue processing other files when one fails', async () => {
      const validInstance = {
        $schema: 'schema://living-narrative-engine/entity-instance.schema.json',
        instanceId: 'test-mod:valid_instance', // Properly namespaced
        definitionId: 'test:some_entity',
      };

      const invalidInstance = {
        $schema: 'schema://living-narrative-engine/entity-instance.schema.json',
        // Missing instanceId will cause it to fail
        definitionId: 'test:some_entity',
      };

      mockDataFetcher.fetch
        .mockResolvedValueOnce(invalidInstance)
        .mockResolvedValueOnce(validInstance);

      // Mock schema validation for both calls
      mockSchemaValidator.isSchemaLoaded
        .calledWith(PRIMARY_SCHEMA_ID)
        .mockReturnValue(true);

      // First call for invalid instance - validation passes (schema check)
      // but parseAndValidateId will fail due to missing instanceId
      mockSchemaValidator.validate
        .calledWith(PRIMARY_SCHEMA_ID, invalidInstance)
        .mockReturnValue({
          isValid: false,
          errors: [
            {
              message: "must have required property 'instanceId'",
              instancePath: '',
              schemaPath: '#/required',
              keyword: 'required',
              params: { missingProperty: 'instanceId' },
            },
          ],
        });

      // Second call for valid instance
      mockSchemaValidator.validate
        .calledWith(PRIMARY_SCHEMA_ID, validInstance)
        .mockReturnValue({ isValid: true, errors: null });

      const manifest = {
        id: 'test-mod',
        content: {
          entities: {
            instances: ['invalid.entity.json', 'valid.entity.json'],
          },
        },
      };

      const result = await loader.loadItemsForMod(
        manifest.id,
        manifest,
        'entities.instances',
        'entities/instances',
        'entityInstances'
      );

      expect(result.errors).toBe(1);
      expect(result.count).toBe(1);
      expect(
        dataRegistry.get('entityInstances', 'test-mod:valid_instance')
      ).toBeDefined();
    });
  });
});
