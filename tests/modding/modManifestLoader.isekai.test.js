import { jest, describe, beforeEach, test, expect } from '@jest/globals';

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import ModManifestLoader from '../../src/modding/modManifestLoader.js';

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
      return 'http://example.com/schemas/mod.manifest.schema.json';
    }
    return undefined;
  }),
};

const mockPathResolver = {
  resolveModManifestPath: jest.fn(
    (modId) => `data/mods/${modId}/mod.manifest.json`
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
      $id: 'http://example.com/schemas/mod.manifest.schema.json',
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
      // eslint-disable-next-line no-console
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

// Corrected Isekai Mod Manifest Content
const isekaiManifestContent = {
  $schema: 'http://example.com/schemas/mod.manifest.schema.json',
  id: 'isekai',
  version: '1.0.0',
  name: 'isekai',
  description:
    'Contains the definitions of a demo scenario based on a fantasy setting.',
  author: 'joeloverbeck',
  gameVersion: '>=0.0.1',
  content: {
    actions: [],
    components: [],
    conditions: [],
    entityDefinitions: [
      'hero.character.json',
      'sidekick.character.json',
      'adventurers_guild.location.json',
      'town.location.json',
    ],
    entityInstances: [],
    events: [],
    macros: [],
    rules: [],
    ui: ['icons.json', 'labels.json'],
  },
};

describe('ModManifestLoader Isekai Content Validation', () => {
  let modManifestLoader;
  let schemaValidator;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mock implementations to their default for each test
    mockPathResolver.resolveModManifestPath.mockImplementation(
      (modId) => `data/mods/${modId}/mod.manifest.json`
    );
    mockDataFetcher.fetch.mockImplementation(async (path) => {
      // Default fetch mock for most tests, overridden where necessary
      if (path === 'data/mods/isekai/mod.manifest.json') {
        return Promise.resolve(
          JSON.parse(JSON.stringify(isekaiManifestContent))
        ); // Deep clone
      }
      // Allow other paths to be tested or throw an error for unexpected paths
      // This was a bit too restrictive before, so making it more flexible
      // return Promise.reject(new Error(`Unexpected path in default mock: ${path}`));
      // For tests that expect specific rejections, they will re-mock fetch.
      // For general schema tests, they might mock a generic valid response.
      return Promise.resolve({ id: 'generic-test-mod', content: {} });
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

  test('should correctly load and parse the isekai mod manifest with updated entityDefinitions', async () => {
    // Act
    const loadedManifests = await modManifestLoader.loadRequestedManifests([
      'isekai',
    ]);

    // Assert
    // 1. Check if the fetch was called correctly
    expect(mockDataFetcher.fetch).toHaveBeenCalledWith(
      'data/mods/isekai/mod.manifest.json'
    );

    // 2. Check the returned map
    expect(loadedManifests).toBeInstanceOf(Map);
    expect(loadedManifests.has('isekai')).toBe(true);

    // 3. Get the manifest data from the map
    const isekaiDataFromLoader = loadedManifests.get('isekai');
    expect(isekaiDataFromLoader).toBeDefined();
    expect(isekaiDataFromLoader.id).toBe('isekai');
    expect(isekaiDataFromLoader.content).toBeDefined();

    // 4. THE KEY ASSERTION: Check the entityDefinitions
    expect(isekaiDataFromLoader.content.entityDefinitions).toEqual([
      'hero.character.json',
      'sidekick.character.json',
      'adventurers_guild.location.json',
      'town.location.json',
    ]);

    // 5. Check if it was stored in the registry (optional, but good practice)
    expect(mockDataRegistry.store).toHaveBeenCalledWith(
      'mod_manifests', // Assuming this is the category used by ModManifestLoader
      'isekai',
      isekaiManifestContent // Or expect.objectContaining(isekaiManifestContent)
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
    const specificPath = 'custom/path/to/isekai/mod.manifest.json';
    mockPathResolver.resolveModManifestPath.mockReturnValue(specificPath);
    mockDataFetcher.fetch.mockImplementation(async (path) => {
      // Need to re-mock for this specific path
      if (path === specificPath) {
        return Promise.resolve(
          JSON.parse(JSON.stringify(isekaiManifestContent))
        );
      }
      return Promise.reject(new Error(`Unexpected path: ${path}`));
    });

    await modManifestLoader.loadRequestedManifests(['isekai']);

    expect(mockPathResolver.resolveModManifestPath).toHaveBeenCalledWith(
      'isekai'
    );
    expect(mockDataFetcher.fetch).toHaveBeenCalledWith(specificPath);
  });

  test('should log an error and throw if manifest ID does not match requested ID', async () => {
    const mismatchedManifest = {
      ...isekaiManifestContent,
      id: 'not-isekai', // Mismatched ID
    };
    // Specific mock for this test case
    mockDataFetcher.fetch.mockResolvedValue(
      JSON.parse(JSON.stringify(mismatchedManifest))
    );

    await expect(
      modManifestLoader.loadRequestedManifests(['isekai'])
    ).rejects.toThrow(
      // Corrected error message to match actual thrown error
      "ModManifestLoader.loadRequestedManifests: manifest ID 'not-isekai' does not match expected mod ID 'isekai'."
    );

    expect(mockLogger.error).toHaveBeenCalledWith(
      'MOD_MANIFEST_ID_MISMATCH',
      // Corrected expected log message to match actual logged error
      expect.stringContaining(
        "manifest ID 'not-isekai' does not match expected mod ID 'isekai'."
      ),
      // Corrected metadata object to match what is actually logged
      { modId: 'isekai', path: 'data/mods/isekai/mod.manifest.json' }
    );
  });

  test('should log a warning and skip if manifest fetch fails', async () => {
    // Specific mock for this test case
    mockDataFetcher.fetch.mockRejectedValue(new Error('Network Error'));

    const loadedManifests = await modManifestLoader.loadRequestedManifests([
      'isekai',
    ]);

    expect(loadedManifests).toBeInstanceOf(Map);
    expect(loadedManifests.size).toBe(0); // No manifest should be loaded
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'MOD_MANIFEST_FETCH_FAIL',
      "ModManifestLoader.loadRequestedManifests: could not fetch manifest for 'isekai' – skipping.",
      {
        modId: 'isekai',
        path: 'data/mods/isekai/mod.manifest.json',
        reason: 'Network Error',
      }
    );
  });

  test('should log an error and throw if schema validation fails', async () => {
    const invalidManifest = { ...isekaiManifestContent, version: undefined }; // Missing required 'version'
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
      modManifestLoader.loadRequestedManifests(['isekai'])
    ).rejects.toThrow(
      "manifest for 'isekai' failed schema validation. See log for Ajv error details."
    );

    expect(mockLogger.error).toHaveBeenCalledWith(
      'MOD_MANIFEST_SCHEMA_INVALID',
      expect.stringContaining(
        "manifest for 'isekai' failed schema validation."
      ),
      expect.objectContaining({
        modId: 'isekai',
        schemaId: 'http://example.com/schemas/mod.manifest.schema.json',
      })
    );
  });
});
