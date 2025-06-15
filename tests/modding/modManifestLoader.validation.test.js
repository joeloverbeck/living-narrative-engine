// Filename: ModManifestLoader.validation.test.js
import { jest, describe, beforeEach, test, expect } from '@jest/globals';

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import ModManifestLoader from '../../src/modding/modManifestLoader.js'; // Adjust path as needed

// Mock dependencies required by ModManifestLoader
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

const mockConfiguration = {
  getContentTypeSchemaId: jest.fn((type) => {
    if (type === 'mod-manifest') {
      return 'http://example.com/schemas/mod.manifest.schema.json';
    }
    return undefined;
  }),
};

const mockPathResolver = {
  resolveModManifestPath: jest.fn((modId) => `mods/${modId}/mod.manifest.json`),
};

const mockDataFetcher = {
  fetch: jest.fn(),
};

const mockDataRegistry = {
  store: jest.fn(),
};

/**
 * A mock SchemaValidator that uses a real Ajv instance.
 */
class MockSchemaValidator {
  constructor() {
    this.ajv = new Ajv({ allErrors: true });
    addFormats(this.ajv); // For "uri" format validation
    this.validators = new Map();
  }

  addSchema(schemaData, schemaId) {
    const id = schemaId || schemaData.$id;
    if (this.ajv.getSchema(id)) {
      this.ajv.removeSchema(id);
    }
    this.ajv.addSchema(schemaData, id);
    this.validators.set(id, this.ajv.getSchema(id));
  }

  getValidator(schemaId) {
    const validate = this.validators.get(schemaId);
    if (!validate) return undefined;

    return (data) => {
      const isValid = validate(data);
      return {
        isValid,
        errors: isValid ? null : validate.errors,
      };
    };
  }
}

describe('ModManifestLoader Schema Validation for "$schema" property', () => {
  let schemaValidator;

  // The manifest that caused the original error
  const manifestWithSchemaProp = {
    $schema: 'http://example.com/schemas/mod.manifest.schema.json',
    id: 'core',
    version: '1.0.0',
    name: 'core',
    content: {},
  };

  // The original schema that does NOT allow the "$schema" property
  const originalSchema = {
    $id: 'http://example.com/schemas/mod.manifest.schema.json',
    type: 'object',
    additionalProperties: false,
    required: ['id', 'version', 'name'],
    properties: {
      id: { type: 'string' },
      version: { type: 'string' },
      name: { type: 'string' },
      content: { type: 'object' },
    },
  };

  // The corrected schema that explicitly allows the "$schema" property
  const correctedSchema = {
    $id: 'http://example.com/schemas/mod.manifest.schema.json',
    type: 'object',
    additionalProperties: false,
    required: ['id', 'version', 'name'],
    properties: {
      $schema: { type: 'string', format: 'uri' }, // The fix
      id: { type: 'string' },
      version: { type: 'string' },
      name: { type: 'string' },
      content: { type: 'object' },
    },
  };

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    schemaValidator = new MockSchemaValidator();
    mockDataFetcher.fetch.mockResolvedValue(manifestWithSchemaProp);
  });

  test('should FAIL validation when schema disallows "$schema" property', async () => {
    // Arrange: Use the original, flawed schema
    schemaValidator.addSchema(
      originalSchema,
      'http://example.com/schemas/mod.manifest.schema.json'
    );

    const loader = new ModManifestLoader(
      mockConfiguration,
      mockPathResolver,
      mockDataFetcher,
      schemaValidator,
      mockDataRegistry,
      mockLogger
    );

    // Act & Assert
    await expect(loader.loadRequestedManifests(['core'])).rejects.toThrow(
      "manifest for 'core' failed schema validation. See log for Ajv error details."
    );

    // Verify the logger was called with the validation failure
    expect(mockLogger.error).toHaveBeenCalledWith(
      'MOD_MANIFEST_SCHEMA_INVALID',
      expect.any(String),
      expect.objectContaining({
        modId: 'core',
        details: expect.stringContaining('must NOT have additional properties'),
      })
    );
  });

  test('should PASS validation when schema explicitly allows "$schema" property', async () => {
    // Arrange: Use the new, corrected schema
    schemaValidator.addSchema(
      correctedSchema,
      'http://example.com/schemas/mod.manifest.schema.json'
    );

    const loader = new ModManifestLoader(
      mockConfiguration,
      mockPathResolver,
      mockDataFetcher,
      schemaValidator,
      mockDataRegistry,
      mockLogger
    );

    // Act & Assert
    await expect(
      loader.loadRequestedManifests(['core'])
    ).resolves.toBeInstanceOf(Map);

    // Verify no error was logged
    expect(mockLogger.error).not.toHaveBeenCalledWith(
      'MOD_MANIFEST_SCHEMA_INVALID',
      expect.any(String),
      expect.any(Object)
    );

    // Verify the manifest was stored successfully
    expect(mockDataRegistry.store).toHaveBeenCalledWith(
      'mod_manifests',
      'core',
      manifestWithSchemaProp
    );
  });
});
