import { jest, describe, beforeEach, test, expect } from '@jest/globals';

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import ModManifestLoader from '../../../src/modding/modManifestLoader.js';

// --- Reusable Mocks (similar to modManifestLoader.validation.test.js) ---
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

const mockConfiguration = {
  getContentTypeSchemaId: jest.fn((type) => {
    if (type === 'mod-manifest') {
      return 'schema://living-narrative-engine/mod-manifest.schema.json';
    }
    return undefined;
  }),
};

const mockPathResolver = {
  resolveModManifestPath: jest.fn(
    (modId) => `data/mods/${modId}/mod-manifest.json`
  ),
};

const mockDataFetcher = {
  fetch: jest.fn(),
};

const mockDataRegistry = {
  store: jest.fn(),
  get: jest.fn(), // Added for completeness, though not strictly used in this test's asserts
};

class MockSchemaValidator {
  constructor() {
    this.ajv = new Ajv({ allErrors: true, strict: false }); // strict: false to be more lenient for test focus
    addFormats(this.ajv);
    this.validators = new Map();

    // Pre-add a generic schema that should pass for the isekai manifest
    const genericModManifestSchema = {
      $id: 'schema://living-narrative-engine/mod-manifest.schema.json',
      type: 'object',
      properties: {
        $schema: { type: 'string', format: 'uri' },
        id: { type: 'string' },
        version: { type: 'string' },
        name: { type: 'string' },
        description: { type: 'string' },
        author: { type: 'string' },
        gameVersion: { type: 'string' },
        content: {
          type: 'object',
          properties: {
            actions: { type: 'array' },
            components: { type: 'array' },
            conditions: { type: 'array' },
            entityDefinitions: { type: 'array', items: { type: 'string' } },
            entityInstances: { type: 'array' },
            events: { type: 'array' },
            macros: { type: 'array' },
            rules: { type: 'array' },
            ui: { type: 'array' },
          },
          additionalProperties: true, // Allow other properties within content
        },
      },
      required: ['id', 'version', 'name', 'content'],
      additionalProperties: true, // Allow other top-level properties
    };
    this.addSchema(genericModManifestSchema);
  }

  addSchema(schemaData, schemaId) {
    const id = schemaId || schemaData.$id;
    if (this.ajv.getSchema(id)) {
      this.ajv.removeSchema(id);
    }
    try {
      this.ajv.addSchema(schemaData, id);
      this.validators.set(id, this.ajv.getSchema(id));
    } catch (e) {
      console.error(`Error adding schema ${id}:`, e);
      // Suppress error in test setup if schema is problematic but allow test to proceed
      this.validators.set(id, () => ({ isValid: true, errors: null }));
    }
  }

  getValidator(schemaId) {
    const validate = this.validators.get(schemaId);
    if (!validate) {
      // Fallback to a permissive validator if a specific one isn't found
      // This helps focus the test on loading logic rather than schema availability
      return () => ({ isValid: true, errors: null });
    }

    return (data) => {
      const isValid = validate(data);
      return {
        isValid,
        errors: isValid ? null : validate.errors,
      };
    };
  }
}
// --- End Reusable Mocks ---

// Corrected Generic Mod Manifest Content
const genericManifestContent = {
  $schema: 'schema://living-narrative-engine/mod-manifest.schema.json',
  id: 'generic-mod',
  version: '1.0.0',
  name: 'Generic Mod',
  description:
    'A generic mod for testing purposes.',
  author: 'tester',
  gameVersion: '>=0.0.1',
  content: {
    actions: [],
    components: [],
    conditions: [],
    entityDefinitions: [
      'hero.definition.json',
      'villain.definition.json',
      'location.definition.json',
    ],
    entityInstances: [],
    events: [],
    macros: [],
    rules: [],
  },
};

describe('ModManifestLoader Generic Content Validation', () => {
  let modManifestLoader;
  let schemaValidator;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mock implementations to their default for each test
    mockPathResolver.resolveModManifestPath.mockImplementation(
      (modId) => `data/mods/${modId}/mod-manifest.json`
    );
    mockDataFetcher.fetch.mockImplementation(async (path) => {
      // Default fetch mock for most tests, overridden where necessary
      if (path === 'data/mods/generic-mod/mod-manifest.json') {
        return Promise.resolve(
          JSON.parse(JSON.stringify(genericManifestContent))
        ); // Deep clone
      }
      return Promise.resolve({ id: 'other-test-mod', content: {} });
    });

    schemaValidator = new MockSchemaValidator(); // Uses the generic schema internally

    // Ensure the schema used by configuration is added to the validator
    const configuredSchemaId =
      mockConfiguration.getContentTypeSchemaId('mod-manifest');
    if (
      configuredSchemaId &&
      !schemaValidator.validators.has(configuredSchemaId)
    ) {
      // This attempts to add the schema if not already present from constructor
      // For this test, the generic one in constructor should cover it.
      schemaValidator.addSchema(
        { $id: configuredSchemaId, type: 'object', additionalProperties: true },
        configuredSchemaId
      );
    }

    modManifestLoader = new ModManifestLoader(
      mockConfiguration,
      mockPathResolver,
      mockDataFetcher,
      schemaValidator, // Use the instance of MockSchemaValidator
      mockDataRegistry,
      mockLogger
    );
  });

  test('should correctly load and parse the generic mod manifest with updated entityDefinitions', async () => {
    // Act
    const loadedManifests = await modManifestLoader.loadRequestedManifests([
      'generic-mod',
    ]);

    // Assert
    // 1. Check if the fetch was called correctly
    expect(mockDataFetcher.fetch).toHaveBeenCalledWith(
      'data/mods/generic-mod/mod-manifest.json'
    );

    // 2. Check the returned map
    expect(loadedManifests).toBeInstanceOf(Map);
    expect(loadedManifests.has('generic-mod')).toBe(true);

    // 3. Get the manifest data from the map
    const genericDataFromLoader = loadedManifests.get('generic-mod');
    expect(genericDataFromLoader).toBeDefined();
    expect(genericDataFromLoader.id).toBe('generic-mod');
    expect(genericDataFromLoader.content).toBeDefined();

    // 4. THE KEY ASSERTION: Check the entityDefinitions
    expect(genericDataFromLoader.content.entityDefinitions).toEqual([
      'hero.definition.json',
      'villain.definition.json',
      'location.definition.json',
    ]);

    // 5. Check if it was stored in the registry (optional, but good practice)
    expect(mockDataRegistry.store).toHaveBeenCalledWith(
      'mod_manifests', // Assuming this is the category used by ModManifestLoader
      'generic-mod',
      genericManifestContent // Or expect.objectContaining(genericManifestContent)
    );

    // 6. Ensure no schema validation errors were logged for this successful case
    expect(mockLogger.error).not.toHaveBeenCalledWith(
      expect.stringMatching(/MOD_MANIFEST_SCHEMA_INVALID/i),
      expect.any(String),
      expect.any(Object)
    );
    expect(mockLogger.warn).not.toHaveBeenCalledWith(
      expect.stringMatching(/MOD_MANIFEST_FETCH_FAIL/i),
      expect.any(String),
      expect.any(Object)
    );
  });

  test('should use resolved path from pathResolver for fetching', async () => {
    const specificPath = 'custom/path/to/generic-mod/mod-manifest.json';
    mockPathResolver.resolveModManifestPath.mockReturnValue(specificPath);
    mockDataFetcher.fetch.mockImplementation(async (path) => {
      // Need to re-mock for this specific path
      if (path === specificPath) {
        return Promise.resolve(
          JSON.parse(JSON.stringify(genericManifestContent))
        );
      }
      return Promise.reject(new Error(`Unexpected path: ${path}`));
    });

    await modManifestLoader.loadRequestedManifests(['generic-mod']);

    expect(mockPathResolver.resolveModManifestPath).toHaveBeenCalledWith(
      'generic-mod'
    );
    expect(mockDataFetcher.fetch).toHaveBeenCalledWith(specificPath);
  });

  test('should log an error and throw if manifest ID does not match requested ID', async () => {
    const mismatchedManifest = {
      ...genericManifestContent,
      id: 'not-generic-mod', // Mismatched ID
    };
    // Specific mock for this test case
    mockDataFetcher.fetch.mockResolvedValue(
      JSON.parse(JSON.stringify(mismatchedManifest))
    );

    await expect(
      modManifestLoader.loadRequestedManifests(['generic-mod'])
    ).rejects.toThrow(
      // Corrected error message to match actual thrown error
      "ModManifestLoader.loadRequestedManifests: manifest ID 'not-generic-mod' does not match expected mod ID 'generic-mod'."
    );

    expect(mockLogger.error).toHaveBeenCalledWith(
      'MOD_MANIFEST_ID_MISMATCH',
      // Corrected expected log message to match actual logged error
      expect.stringContaining(
        "manifest ID 'not-generic-mod' does not match expected mod ID 'generic-mod'."
      ),
      // Corrected metadata object to match what is actually logged
      { modId: 'generic-mod', path: 'data/mods/generic-mod/mod-manifest.json' }
    );
  });

  test('should log an error and throw if manifest fetch fails', async () => {
    // Specific mock for this test case
    const fetchError = new Error('Network Error');
    mockDataFetcher.fetch.mockRejectedValue(fetchError);

    // MODIFIED: Expect a throw
    await expect(
      modManifestLoader.loadRequestedManifests(['generic-mod'])
    ).rejects.toThrow(
      "ModManifestLoader.loadRequestedManifests: Critical error - could not fetch manifest for requested mod 'generic-mod'. Path: data/mods/generic-mod/mod-manifest.json. Reason: Network Error"
    );

    // MODIFIED: Expect logger.error to have been called
    expect(mockLogger.error).toHaveBeenCalledWith(
      'MOD_MANIFEST_FETCH_FAIL',
      expect.stringContaining(
        "Critical error - could not fetch manifest for requested mod 'generic-mod'"
      ),
      {
        modId: 'generic-mod',
        path: 'data/mods/generic-mod/mod-manifest.json',
        reason: 'Network Error',
      }
    );
    // Ensure no warning was logged for this case anymore
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  test('should log an error and throw if schema validation fails', async () => {
    const invalidManifest = { ...genericManifestContent, version: undefined }; // Missing required 'version'
    mockDataFetcher.fetch.mockResolvedValue(
      JSON.parse(JSON.stringify(invalidManifest))
    );

    // Make validator fail for this specific test
    const mockValidatorFn = jest.fn(() => ({
      isValid: false,
      errors: [{ message: 'Version is required' }],
    }));
    schemaValidator.getValidator = jest.fn().mockReturnValue(mockValidatorFn);

    await expect(
      modManifestLoader.loadRequestedManifests(['generic-mod'])
    ).rejects.toThrow(
      "manifest for 'generic-mod' failed schema validation. See log for Ajv error details."
    );

    expect(mockLogger.error).toHaveBeenCalledWith(
      'MOD_MANIFEST_SCHEMA_INVALID',
      expect.stringContaining(
        "manifest for 'generic-mod' failed schema validation."
      ),
      expect.objectContaining({
        modId: 'generic-mod',
        schemaId: 'schema://living-narrative-engine/mod-manifest.schema.json',
      })
    );
  });
});
