/**
 * @file Integration tests for LookupLoader inline schema validation.
 * @description Tests that lookup entries are validated against their inline dataSchema
 * and that invalid entries cause load failures.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import LookupLoader from '../../../src/loaders/lookupLoader.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';

const LOOKUP_SCHEMA_ID = 'schema://living-narrative-engine/lookup.schema.json';

/**
 * @class TestConfiguration
 * @description Minimal configuration service mirroring the required interface.
 */
class TestConfiguration {
  /**
   * @description Creates a new test configuration instance.
   * @param {string} [schemaId] - Schema identifier for lookups.
   */
  constructor(schemaId = LOOKUP_SCHEMA_ID) {
    this._schemaId = schemaId;
  }

  /**
   * @description Returns the base path used for resolving mod content.
   * @returns {string} Virtual base path for test mods.
   */
  getModsBasePath() {
    return '/virtual-mods';
  }

  /**
   * @description Retrieves the schema id for the provided content type.
   * @param {string} contentType - Manifest content type key.
   * @returns {string|null} Schema identifier for the content type.
   */
  getContentTypeSchemaId(contentType) {
    return contentType === 'lookups' ? this._schemaId : null;
  }
}

/**
 * @class TestPathResolver
 * @description Resolves mod content paths into deterministic virtual locations.
 */
class TestPathResolver {
  /**
   * @description Resolves the virtual path to a manifest referenced file.
   * @param {string} modId - Mod identifier.
   * @param {string} diskFolder - Manifest folder segment.
   * @param {string} filename - Referenced filename.
   * @returns {string} Resolved path used by the fetcher.
   */
  resolveModContentPath(modId, diskFolder, filename) {
    return `/virtual-mods/${modId}/${diskFolder}/${filename}`;
  }
}

/**
 * @class MapDataFetcher
 * @description Supplies JSON payloads from an in-memory map keyed by path.
 */
class MapDataFetcher {
  /**
   * @description Creates a new fetcher bound to the provided map.
   * @param {Map<string, any>} fileMap - Mapping of resolved paths to JSON data.
   */
  constructor(fileMap) {
    this._fileMap = fileMap;
  }

  /**
   * @description Fetches the JSON payload for a previously registered path.
   * @param {string} path - Resolved path provided by the path resolver.
   * @returns {Promise<any>} Deep clone of the registered payload.
   */
  async fetch(path) {
    if (!this._fileMap.has(path)) {
      throw new Error(`Missing fixture for path: ${path}`);
    }

    const value = this._fileMap.get(path);
    if (typeof value === 'object' && value !== null) {
      return JSON.parse(JSON.stringify(value));
    }

    return value;
  }
}

/**
 * @class MockSchemaValidatorWithEntryValidation
 * @description Schema validator that supports inline dataSchema registration and entry validation.
 * Implements the interface expected by registerSchema in schemaUtils.js:
 * - isSchemaLoaded(schemaId)
 * - removeSchema(schemaId)
 * - addSchema(schema, schemaId)
 * - validate(schemaId, data)
 *
 * Note: Uses a separate _overrideValidators map for test-configured validators
 * that persist through removeSchema calls.
 */
class MockSchemaValidatorWithEntryValidation {
  /**
   * @description Creates a new mock schema validator with configurable entry validation.
   * @param {Record<string, (data: any) => {isValid: boolean, errors: string[]|null}>} validatorMap - Schema handlers.
   */
  constructor(validatorMap = {}) {
    this._validators = new Map();
    this._registeredSchemas = new Map();
    // Override validators persist through removeSchema calls
    this._overrideValidators = new Map();

    Object.entries(validatorMap).forEach(([schemaId, impl]) => {
      this._validators.set(schemaId, impl);
    });

    // isSchemaLoaded - checks if schema has been added (not overrides)
    this.isSchemaLoaded = jest.fn(
      (schemaId) => this._registeredSchemas.has(schemaId)
    );

    // getValidator - retrieves the validator function
    this.getValidator = jest.fn((schemaId) =>
      this._overrideValidators.get(schemaId) || this._validators.get(schemaId)
    );

    // isSchemaRegistered - alias for tracking registered schemas
    this.isSchemaRegistered = jest.fn(
      (schemaId) => this._registeredSchemas.has(schemaId)
    );

    // removeSchema - required by schemaUtils.registerSchema before re-registering
    // Does NOT remove override validators to allow test configuration before loading
    this.removeSchema = jest.fn((schemaId) => {
      this._validators.delete(schemaId);
      this._registeredSchemas.delete(schemaId);
    });

    // addSchema - the actual method called by schemaUtils.registerSchema
    this.addSchema = jest.fn((schema, schemaId) => {
      this._registeredSchemas.set(schemaId, schema);
      // Only create a pass-through validator if no override and no existing validator
      if (
        !this._overrideValidators.has(schemaId) &&
        !this._validators.has(schemaId)
      ) {
        this._validators.set(schemaId, () => ({ isValid: true, errors: null }));
      }
      return Promise.resolve(true);
    });

    // registerSchema - kept for backward compatibility with test assertions
    this.registerSchema = this.addSchema;

    this.validate = jest.fn((schemaId, data) => {
      // Check override validators first, then regular validators
      const validator =
        this._overrideValidators.get(schemaId) ||
        this._validators.get(schemaId);
      if (!validator) {
        return {
          isValid: false,
          errors: [`Validator missing for ${schemaId}`],
        };
      }
      return validator(data);
    });
  }

  /**
   * @description Configure a specific entry validator for testing validation failures.
   * Uses override map that persists through removeSchema calls.
   * @param {string} schemaId - Schema ID to configure.
   * @param {(data: any) => {isValid: boolean, errors: string[]|null}} validator - Validator function.
   */
  setEntryValidator(schemaId, validator) {
    this._overrideValidators.set(schemaId, validator);
  }
}

/**
 * @description Creates a Jest logger implementation used by integration tests.
 * @returns {{error: jest.Mock, warn: jest.Mock, info: jest.Mock, debug: jest.Mock}} Logger spies.
 */
function createTestLogger() {
  return {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
}

/**
 * @description Instantiates a fully wired LookupLoader with deterministic collaborators.
 * @param {Map<string, any>} fileMap - Map of resolved paths to lookup payloads.
 * @param {{schemaValidator?: MockSchemaValidatorWithEntryValidation}} [options] - Optional overrides.
 * @returns {{
 *   loader: LookupLoader,
 *   registry: InMemoryDataRegistry,
 *   logger: ReturnType<typeof createTestLogger>,
 *   pathResolver: TestPathResolver,
 *   dataFetcher: MapDataFetcher,
 *   schemaValidator: MockSchemaValidatorWithEntryValidation,
 *   config: TestConfiguration
 * }} Loader and dependencies.
 */
function createLookupLoader(fileMap, { schemaValidator } = {}) {
  const logger = createTestLogger();
  const registry = new InMemoryDataRegistry({ logger });
  const config = new TestConfiguration();
  const pathResolver = new TestPathResolver();
  const dataFetcher = new MapDataFetcher(fileMap);
  const effectiveSchemaValidator =
    schemaValidator ||
    new MockSchemaValidatorWithEntryValidation({
      [LOOKUP_SCHEMA_ID]: () => ({ isValid: true, errors: null }),
    });

  const loader = new LookupLoader(
    config,
    pathResolver,
    dataFetcher,
    effectiveSchemaValidator,
    registry,
    logger
  );

  return {
    loader,
    registry,
    logger,
    pathResolver,
    dataFetcher,
    schemaValidator: effectiveSchemaValidator,
    config,
  };
}

describe('LookupLoader inline schema validation integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('inline dataSchema registration', () => {
    it('should register inline dataSchema when present in lookup', async () => {
      const fileMap = new Map([
        [
          '/virtual-mods/test/lookups/my_lookup.lookup.json',
          {
            $schema: LOOKUP_SCHEMA_ID,
            id: 'test:my_lookup',
            description: 'Test lookup with inline schema',
            dataSchema: {
              type: 'object',
              properties: {
                value: { type: 'number' },
              },
              required: ['value'],
            },
            entries: {
              entry1: { value: 42 },
            },
          },
        ],
      ]);

      const { loader, schemaValidator } = createLookupLoader(fileMap);

      const manifest = {
        content: {
          lookups: ['my_lookup.lookup.json'],
        },
      };

      await loader.loadItemsForMod(
        'test',
        manifest,
        'lookups',
        'lookups',
        'lookups'
      );

      // Should have registered the entry schema
      // addSchema is called with (schema, schemaId) - schema first
      expect(schemaValidator.registerSchema).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'object',
          properties: {
            value: { type: 'number' },
          },
        }),
        'test:my_lookup:entry'
      );
    });

    it('should not register schema when dataSchema is absent', async () => {
      const fileMap = new Map([
        [
          '/virtual-mods/test/lookups/simple_lookup.lookup.json',
          {
            $schema: LOOKUP_SCHEMA_ID,
            id: 'test:simple_lookup',
            description: 'Simple lookup without schema',
            entries: {
              entry1: { value: 'anything' },
            },
          },
        ],
      ]);

      const { loader, schemaValidator } = createLookupLoader(fileMap);

      const manifest = {
        content: {
          lookups: ['simple_lookup.lookup.json'],
        },
      };

      await loader.loadItemsForMod(
        'test',
        manifest,
        'lookups',
        'lookups',
        'lookups'
      );

      // Should NOT have registered any entry schema
      const entrySchemaRegistrations =
        schemaValidator.registerSchema.mock.calls.filter((call) =>
          call[0].endsWith(':entry')
        );
      expect(entrySchemaRegistrations).toHaveLength(0);
    });
  });

  describe('entry validation against inline schema', () => {
    it('should validate each entry against registered schema', async () => {
      const fileMap = new Map([
        [
          '/virtual-mods/test/lookups/validated_lookup.lookup.json',
          {
            $schema: LOOKUP_SCHEMA_ID,
            id: 'test:validated_lookup',
            description: 'Lookup with validated entries',
            dataSchema: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                count: { type: 'integer' },
              },
              required: ['name'],
            },
            entries: {
              entry1: { name: 'first', count: 1 },
              entry2: { name: 'second', count: 2 },
              entry3: { name: 'third' },
            },
          },
        ],
      ]);

      const { loader, schemaValidator } = createLookupLoader(fileMap);

      const manifest = {
        content: {
          lookups: ['validated_lookup.lookup.json'],
        },
      };

      await loader.loadItemsForMod(
        'test',
        manifest,
        'lookups',
        'lookups',
        'lookups'
      );

      // Should validate each of the 3 entries against the entry schema
      const entryValidationCalls = schemaValidator.validate.mock.calls.filter(
        (call) => call[0] === 'test:validated_lookup:entry'
      );
      expect(entryValidationCalls).toHaveLength(3);
    });

    it('should throw error when entry fails schema validation', async () => {
      const fileMap = new Map([
        [
          '/virtual-mods/test/lookups/invalid_lookup.lookup.json',
          {
            $schema: LOOKUP_SCHEMA_ID,
            id: 'test:invalid_lookup',
            description: 'Lookup with invalid entry',
            dataSchema: {
              type: 'object',
              properties: {
                weights: {
                  type: 'object',
                  properties: {
                    valence: { type: 'number' },
                  },
                  additionalProperties: false,
                },
              },
              required: ['weights'],
            },
            entries: {
              valid_entry: { weights: { valence: 0.5 } },
              invalid_entry: { weights: { valence: 0.5, unknown_axis: 0.3 } },
            },
          },
        ],
      ]);

      const schemaValidator = new MockSchemaValidatorWithEntryValidation({
        [LOOKUP_SCHEMA_ID]: () => ({ isValid: true, errors: null }),
      });

      // Configure entry validator to fail on entries with unknown_axis
      schemaValidator.setEntryValidator(
        'test:invalid_lookup:entry',
        (data) => {
          if (
            data.weights &&
            Object.prototype.hasOwnProperty.call(data.weights, 'unknown_axis')
          ) {
            return {
              isValid: false,
              errors: ['additionalProperties: unknown_axis is not allowed'],
            };
          }
          return { isValid: true, errors: null };
        }
      );

      const { loader, logger } = createLookupLoader(fileMap, { schemaValidator });

      const manifest = {
        content: {
          lookups: ['invalid_lookup.lookup.json'],
        },
      };

      const result = await loader.loadItemsForMod(
        'test',
        manifest,
        'lookups',
        'lookups',
        'lookups'
      );

      // Should have failed with 1 error
      expect(result.errors).toBe(1);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0].file).toBe('invalid_lookup.lookup.json');

      // Should have logged the error
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("'invalid_entry' failed schema validation")
      );
    });

    it('should include validation error details in thrown error', async () => {
      const fileMap = new Map([
        [
          '/virtual-mods/test/lookups/error_details.lookup.json',
          {
            $schema: LOOKUP_SCHEMA_ID,
            id: 'test:error_details',
            description: 'Test error message details',
            dataSchema: {
              type: 'object',
              properties: {
                required_field: { type: 'string' },
              },
              required: ['required_field'],
            },
            entries: {
              missing_required: { optional_field: 'value' },
            },
          },
        ],
      ]);

      const schemaValidator = new MockSchemaValidatorWithEntryValidation({
        [LOOKUP_SCHEMA_ID]: () => ({ isValid: true, errors: null }),
      });

      schemaValidator.setEntryValidator('test:error_details:entry', () => ({
        isValid: false,
        errors: ["required property 'required_field' is missing"],
      }));

      const { loader, logger } = createLookupLoader(fileMap, { schemaValidator });

      const manifest = {
        content: {
          lookups: ['error_details.lookup.json'],
        },
      };

      const result = await loader.loadItemsForMod(
        'test',
        manifest,
        'lookups',
        'lookups',
        'lookups'
      );

      expect(result.errors).toBe(1);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("required property 'required_field' is missing")
      );
    });
  });

  describe('prototype lookup weight validation', () => {
    it('should validate emotion prototype weights against schema', async () => {
      const fileMap = new Map([
        [
          '/virtual-mods/test/lookups/emotion_prototypes.lookup.json',
          {
            $schema: LOOKUP_SCHEMA_ID,
            id: 'test:emotion_prototypes',
            description: 'Emotion prototype test',
            dataSchema: {
              type: 'object',
              properties: {
                weights: {
                  type: 'object',
                  properties: {
                    valence: { type: 'number', minimum: -1, maximum: 1 },
                    arousal: { type: 'number', minimum: -1, maximum: 1 },
                  },
                  additionalProperties: false,
                },
              },
              required: ['weights'],
            },
            entries: {
              joy: { weights: { valence: 0.9, arousal: 0.5 } },
            },
          },
        ],
      ]);

      const { loader, schemaValidator, registry } = createLookupLoader(fileMap);

      const manifest = {
        content: {
          lookups: ['emotion_prototypes.lookup.json'],
        },
      };

      const result = await loader.loadItemsForMod(
        'test',
        manifest,
        'lookups',
        'lookups',
        'lookups'
      );

      expect(result.count).toBe(1);
      expect(result.errors).toBe(0);

      // Verify entry was validated
      expect(schemaValidator.validate).toHaveBeenCalledWith(
        'test:emotion_prototypes:entry',
        { weights: { valence: 0.9, arousal: 0.5 } }
      );

      // Verify lookup was stored
      const stored = registry.get('lookups', 'test:emotion_prototypes');
      expect(stored).toBeDefined();
    });

    it('should reject emotion prototype with undeclared axis', async () => {
      const fileMap = new Map([
        [
          '/virtual-mods/test/lookups/emotion_prototypes.lookup.json',
          {
            $schema: LOOKUP_SCHEMA_ID,
            id: 'test:emotion_prototypes',
            description: 'Emotion prototype with undeclared axis',
            dataSchema: {
              type: 'object',
              properties: {
                weights: {
                  type: 'object',
                  properties: {
                    valence: { type: 'number' },
                  },
                  additionalProperties: false,
                },
              },
              required: ['weights'],
            },
            entries: {
              custom_emotion: { weights: { valence: 0.5, undeclared_axis: 0.3 } },
            },
          },
        ],
      ]);

      const schemaValidator = new MockSchemaValidatorWithEntryValidation({
        [LOOKUP_SCHEMA_ID]: () => ({ isValid: true, errors: null }),
      });

      schemaValidator.setEntryValidator(
        'test:emotion_prototypes:entry',
        (data) => {
          if (
            data.weights &&
            Object.prototype.hasOwnProperty.call(data.weights, 'undeclared_axis')
          ) {
            return {
              isValid: false,
              errors: ['additionalProperties: undeclared_axis is not allowed'],
            };
          }
          return { isValid: true, errors: null };
        }
      );

      const { loader, registry } = createLookupLoader(fileMap, { schemaValidator });

      const manifest = {
        content: {
          lookups: ['emotion_prototypes.lookup.json'],
        },
      };

      const result = await loader.loadItemsForMod(
        'test',
        manifest,
        'lookups',
        'lookups',
        'lookups'
      );

      expect(result.errors).toBe(1);
      expect(result.failures[0].file).toBe('emotion_prototypes.lookup.json');

      // Verify lookup was NOT stored (registry returns undefined for missing entries)
      const stored = registry.get('lookups', 'test:emotion_prototypes');
      expect(stored).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle lookup with empty entries object', async () => {
      const fileMap = new Map([
        [
          '/virtual-mods/test/lookups/empty_entries.lookup.json',
          {
            $schema: LOOKUP_SCHEMA_ID,
            id: 'test:empty_entries',
            description: 'Lookup with no entries',
            dataSchema: {
              type: 'object',
              properties: { value: { type: 'string' } },
            },
            entries: {},
          },
        ],
      ]);

      const { loader, schemaValidator, registry } = createLookupLoader(fileMap);

      const manifest = {
        content: {
          lookups: ['empty_entries.lookup.json'],
        },
      };

      const result = await loader.loadItemsForMod(
        'test',
        manifest,
        'lookups',
        'lookups',
        'lookups'
      );

      expect(result.count).toBe(1);
      expect(result.errors).toBe(0);

      // Schema should be registered (addSchema takes schema first, then schemaId)
      expect(schemaValidator.registerSchema).toHaveBeenCalledWith(
        expect.any(Object),
        'test:empty_entries:entry'
      );

      // No entry validation calls (no entries to validate)
      const entryValidationCalls = schemaValidator.validate.mock.calls.filter(
        (call) => call[0] === 'test:empty_entries:entry'
      );
      expect(entryValidationCalls).toHaveLength(0);

      // Lookup should still be stored
      const stored = registry.get('lookups', 'test:empty_entries');
      expect(stored).toBeDefined();
    });

    it('should derive schema ID from filename when id not in data', async () => {
      const fileMap = new Map([
        [
          '/virtual-mods/mymod/lookups/derived_name.lookup.json',
          {
            $schema: LOOKUP_SCHEMA_ID,
            description: 'Lookup without explicit id',
            dataSchema: {
              type: 'object',
              properties: { value: { type: 'string' } },
            },
            entries: {
              entry1: { value: 'test' },
            },
          },
        ],
      ]);

      const { loader, schemaValidator } = createLookupLoader(fileMap);

      const manifest = {
        content: {
          lookups: ['derived_name.lookup.json'],
        },
      };

      await loader.loadItemsForMod(
        'mymod',
        manifest,
        'lookups',
        'lookups',
        'lookups'
      );

      // Should use filename-derived ID: mymod:derived_name:entry
      // addSchema takes (schema, schemaId) - schema first
      expect(schemaValidator.registerSchema).toHaveBeenCalledWith(
        expect.any(Object),
        'mymod:derived_name:entry'
      );
    });

    it('should handle validation errors array being undefined', async () => {
      const fileMap = new Map([
        [
          '/virtual-mods/test/lookups/undefined_errors.lookup.json',
          {
            $schema: LOOKUP_SCHEMA_ID,
            id: 'test:undefined_errors',
            description: 'Test undefined errors handling',
            dataSchema: {
              type: 'object',
              properties: { value: { type: 'string' } },
            },
            entries: {
              bad_entry: { value: 123 },
            },
          },
        ],
      ]);

      const schemaValidator = new MockSchemaValidatorWithEntryValidation({
        [LOOKUP_SCHEMA_ID]: () => ({ isValid: true, errors: null }),
      });

      schemaValidator.setEntryValidator('test:undefined_errors:entry', () => ({
        isValid: false,
        errors: undefined,
      }));

      const { loader, logger } = createLookupLoader(fileMap, { schemaValidator });

      const manifest = {
        content: {
          lookups: ['undefined_errors.lookup.json'],
        },
      };

      const result = await loader.loadItemsForMod(
        'test',
        manifest,
        'lookups',
        'lookups',
        'lookups'
      );

      expect(result.errors).toBe(1);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Unknown validation error')
      );
    });
  });

  describe('stores lookup after successful validation', () => {
    it('should store lookup in registry after all entries validate', async () => {
      const fileMap = new Map([
        [
          '/virtual-mods/test/lookups/stored_lookup.lookup.json',
          {
            $schema: LOOKUP_SCHEMA_ID,
            id: 'test:stored_lookup',
            description: 'Lookup that should be stored',
            dataSchema: {
              type: 'object',
              properties: { value: { type: 'number' } },
            },
            entries: {
              entry1: { value: 1 },
              entry2: { value: 2 },
            },
          },
        ],
      ]);

      const { loader, registry } = createLookupLoader(fileMap);

      const manifest = {
        content: {
          lookups: ['stored_lookup.lookup.json'],
        },
      };

      const result = await loader.loadItemsForMod(
        'test',
        manifest,
        'lookups',
        'lookups',
        'lookups'
      );

      expect(result.count).toBe(1);
      expect(result.errors).toBe(0);

      const stored = registry.get('lookups', 'test:stored_lookup');
      expect(stored).toBeDefined();
      expect(stored.entries.entry1).toEqual({ value: 1 });
      expect(stored.entries.entry2).toEqual({ value: 2 });
    });

    it('should not store lookup when validation fails', async () => {
      const fileMap = new Map([
        [
          '/virtual-mods/test/lookups/not_stored.lookup.json',
          {
            $schema: LOOKUP_SCHEMA_ID,
            id: 'test:not_stored',
            description: 'Lookup that should not be stored',
            dataSchema: {
              type: 'object',
              properties: { value: { type: 'number' } },
            },
            entries: {
              bad_entry: { value: 'not a number' },
            },
          },
        ],
      ]);

      const schemaValidator = new MockSchemaValidatorWithEntryValidation({
        [LOOKUP_SCHEMA_ID]: () => ({ isValid: true, errors: null }),
      });

      schemaValidator.setEntryValidator('test:not_stored:entry', () => ({
        isValid: false,
        errors: ['type: expected number, got string'],
      }));

      const { loader, registry } = createLookupLoader(fileMap, { schemaValidator });

      const manifest = {
        content: {
          lookups: ['not_stored.lookup.json'],
        },
      };

      const result = await loader.loadItemsForMod(
        'test',
        manifest,
        'lookups',
        'lookups',
        'lookups'
      );

      expect(result.errors).toBe(1);

      // Registry should NOT have the lookup stored (registry returns undefined for missing entries)
      const stored = registry.get('lookups', 'test:not_stored');
      expect(stored).toBeUndefined();
    });
  });
});
