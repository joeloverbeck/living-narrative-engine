/**
 * @file Integration tests for LookupLoader to cover interactions with manifest processing,
 * schema validation, and registry storage.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import LookupLoader from '../../../src/loaders/lookupLoader.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import { DuplicateContentError } from '../../../src/errors/duplicateContentError.js';

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
 * @class StrictSchemaValidator
 * @description Minimal schema validator that enforces schema availability and tracks validation calls.
 */
class StrictSchemaValidator {
  /**
   * @description Creates a new strict validator.
   * @param {Record<string, (data: any) => {isValid: boolean, errors: any[]|null}>} validatorMap - Schema handlers.
   */
  constructor(validatorMap = {}) {
    this._validators = new Map();
    Object.entries(validatorMap).forEach(([schemaId, impl]) => {
      this._validators.set(schemaId, impl);
    });

    this.isSchemaLoaded = jest.fn((schemaId) => this._validators.has(schemaId));
    this.getValidator = jest.fn((schemaId) => this._validators.get(schemaId));
    this.validate = jest.fn((schemaId, data) => {
      const validator = this._validators.get(schemaId);
      if (!validator) {
        return {
          isValid: false,
          errors: [{ message: `Validator missing for ${schemaId}` }],
        };
      }
      return validator(data);
    });
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
 * @param {{schemaValidator?: StrictSchemaValidator}} [options] - Optional overrides.
 * @returns {{
 *   loader: LookupLoader,
 *   registry: InMemoryDataRegistry,
 *   logger: ReturnType<typeof createTestLogger>,
 *   pathResolver: TestPathResolver,
 *   dataFetcher: MapDataFetcher,
 *   schemaValidator: StrictSchemaValidator,
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
    new StrictSchemaValidator({
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

describe('LookupLoader integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads lookup definitions and stores them with metadata', async () => {
    const fileMap = new Map([
      [
        '/virtual-mods/music/lookups/mood_descriptors.lookup.json',
        {
          $schema: LOOKUP_SCHEMA_ID,
          id: 'music:mood_descriptors',
          description:
            'Maps musical mood names to descriptive adjectives and nouns',
          dataSchema: {
            type: 'object',
            properties: {
              adj: { type: 'string' },
              adjectives: { type: 'string' },
              noun: { type: 'string' },
            },
            required: ['adj', 'adjectives', 'noun'],
          },
          entries: {
            cheerful: {
              adj: 'bright',
              adjectives: 'bright, skipping',
              noun: 'bouncy',
            },
            solemn: {
              adj: 'grave',
              adjectives: 'measured, weighty',
              noun: 'grave',
            },
          },
        },
      ],
      [
        '/virtual-mods/music/lookups/difficulty_levels.lookup.json',
        {
          id: 'music:difficulty_levels',
          description: 'Skill level descriptions',
          dataSchema: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              description: { type: 'string' },
            },
          },
          entries: {
            novice: { label: 'Novice', description: 'Just starting out' },
            expert: { label: 'Expert', description: 'Highly skilled' },
          },
        },
      ],
    ]);

    const schemaValidator = new StrictSchemaValidator({
      [LOOKUP_SCHEMA_ID]: (data) => ({
        isValid:
          typeof data === 'object' &&
          data !== null &&
          typeof data.entries === 'object' &&
          data.entries !== null &&
          typeof data.dataSchema === 'object' &&
          data.dataSchema !== null,
        errors: null,
      }),
    });

    const {
      loader,
      registry,
      logger,
      schemaValidator: validator,
    } = createLookupLoader(fileMap, { schemaValidator });

    const manifest = {
      content: {
        lookups: [
          'mood_descriptors.lookup.json',
          '   difficulty_levels.lookup.json   ',
          null,
          '',
        ],
      },
    };

    const result = await loader.loadItemsForMod(
      'music',
      manifest,
      'lookups',
      'lookups',
      'lookups'
    );

    expect(result).toEqual({ count: 2, overrides: 0, errors: 0, failures: [] });
    expect(validator.isSchemaLoaded).toHaveBeenCalledWith(LOOKUP_SCHEMA_ID);
    expect(validator.validate).toHaveBeenCalledTimes(2);

    const storedMoods = registry.get('lookups', 'music:mood_descriptors');
    expect(storedMoods).toMatchObject({
      id: 'mood_descriptors',
      _modId: 'music',
      _sourceFile: 'mood_descriptors.lookup.json',
      _fullId: 'music:mood_descriptors',
      description:
        'Maps musical mood names to descriptive adjectives and nouns',
      entries: {
        cheerful: {
          adj: 'bright',
          adjectives: 'bright, skipping',
          noun: 'bouncy',
        },
        solemn: {
          adj: 'grave',
          adjectives: 'measured, weighty',
          noun: 'grave',
        },
      },
    });

    const storedDifficulty = registry.get('lookups', 'music:difficulty_levels');
    expect(storedDifficulty).toMatchObject({
      id: 'difficulty_levels',
      _modId: 'music',
      _sourceFile: 'difficulty_levels.lookup.json',
      _fullId: 'music:difficulty_levels',
      description: 'Skill level descriptions',
      entries: {
        novice: { label: 'Novice', description: 'Just starting out' },
        expert: { label: 'Expert', description: 'Highly skilled' },
      },
    });

    expect(registry.getAll('lookups')).toHaveLength(2);

    expect(logger.warn).toHaveBeenCalledWith(
      "Mod 'music': Invalid non-string entry found in 'lookups' list:",
      null
    );
    expect(logger.warn).toHaveBeenCalledWith(
      "Mod 'music': Empty string filename found in 'lookups' list after trimming. Skipping."
    );
  });

  it('records duplicate lookup definitions as failures', async () => {
    const fileMap = new Map([
      [
        '/virtual-mods/modAlpha/lookups/original.lookup.json',
        {
          id: 'modAlpha:shared_lookup',
          description: 'Original version of the shared lookup.',
          dataSchema: { type: 'object' },
          entries: { key1: { value: 1 } },
        },
      ],
      [
        '/virtual-mods/modAlpha/lookups/duplicate.lookup.json',
        {
          id: 'modAlpha:shared_lookup',
          description: 'Duplicate attempting to override.',
          dataSchema: { type: 'object' },
          entries: { key2: { value: 2 } },
        },
      ],
    ]);

    const { loader, registry, schemaValidator } = createLookupLoader(fileMap);

    const manifest = {
      content: {
        lookups: ['original.lookup.json', 'duplicate.lookup.json'],
      },
    };

    const result = await loader.loadItemsForMod(
      'modAlpha',
      manifest,
      'lookups',
      'lookups',
      'lookups'
    );

    expect(result.count).toBe(1);
    expect(result.errors).toBe(1);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toMatchObject({
      file: 'duplicate.lookup.json',
    });
    expect(result.failures[0].error).toBeInstanceOf(DuplicateContentError);

    expect(registry.getAll('lookups')).toHaveLength(1);
    const stored = registry.get('lookups', 'modAlpha:shared_lookup');
    expect(stored).toMatchObject({
      _sourceFile: 'original.lookup.json',
      entries: { key1: { value: 1 } },
    });

    expect(schemaValidator.validate).toHaveBeenCalledTimes(2);
  });

  describe('prototype gate validation', () => {
    it('validates gates in emotion_prototypes and warns on invalid thresholds', async () => {
      const fileMap = new Map([
        [
          '/virtual-mods/test_mod/lookups/emotion_prototypes.lookup.json',
          {
            $schema: LOOKUP_SCHEMA_ID,
            id: 'test_mod:emotion_prototypes',
            description: 'Test emotion prototypes with invalid gates',
            dataSchema: {
              type: 'object',
              properties: {
                weights: { type: 'object' },
                gates: { type: 'array', items: { type: 'string' } },
              },
            },
            entries: {
              valid_emotion: {
                weights: { valence: 0.5 },
                gates: ['valence >= 0.20', 'self_control >= 0.25'],
              },
              invalid_negative_affect: {
                weights: { valence: 0.3 },
                gates: ['self_control <= -0.10'],
              },
              invalid_exceeds_max: {
                weights: { arousal: 0.8 },
                gates: ['affective_empathy >= 1.5'],
              },
            },
          },
        ],
      ]);

      const { loader, registry, logger } = createLookupLoader(fileMap);

      const manifest = {
        content: {
          lookups: ['emotion_prototypes.lookup.json'],
        },
      };

      const result = await loader.loadItemsForMod(
        'test_mod',
        manifest,
        'lookups',
        'lookups',
        'lookups'
      );

      // Lookup should still load successfully (graceful degradation)
      expect(result).toEqual({
        count: 1,
        overrides: 0,
        errors: 0,
        failures: [],
      });

      // Verify the lookup was stored
      const stored = registry.get('lookups', 'test_mod:emotion_prototypes');
      expect(stored).toBeDefined();
      expect(stored.entries.valid_emotion).toBeDefined();
      expect(stored.entries.invalid_negative_affect).toBeDefined();
      expect(stored.entries.invalid_exceeds_max).toBeDefined();

      // Verify warnings were emitted for invalid gates
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('invalid_negative_affect')
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('self_control <= -0.10')
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('below minimum 0')
      );

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('invalid_exceeds_max')
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('affective_empathy >= 1.5')
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('exceeds maximum 1')
      );
    });

    it('validates gates in sexual_prototypes lookups', async () => {
      const fileMap = new Map([
        [
          '/virtual-mods/adult_mod/lookups/sexual_prototypes.lookup.json',
          {
            $schema: LOOKUP_SCHEMA_ID,
            id: 'adult_mod:sexual_prototypes',
            description: 'Test sexual prototypes with invalid gates',
            dataSchema: {
              type: 'object',
              properties: {
                weights: { type: 'object' },
                gates: { type: 'array', items: { type: 'string' } },
              },
            },
            entries: {
              valid_prototype: {
                weights: { sexual_arousal: 0.7 },
                gates: ['sexual_arousal >= 0.30'],
              },
              invalid_negative_sexual: {
                weights: { sex_excitation: 0.5 },
                gates: ['sexual_arousal >= -0.20'],
              },
            },
          },
        ],
      ]);

      const { loader, logger } = createLookupLoader(fileMap);

      const manifest = {
        content: {
          lookups: ['sexual_prototypes.lookup.json'],
        },
      };

      await loader.loadItemsForMod(
        'adult_mod',
        manifest,
        'lookups',
        'lookups',
        'lookups'
      );

      // Should warn about invalid sexual axis gate
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('invalid_negative_sexual')
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('sexual_arousal >= -0.20')
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('below minimum 0')
      );
    });

    it('does not warn for valid mood axis gates with negative values', async () => {
      const fileMap = new Map([
        [
          '/virtual-mods/emotions/lookups/emotion_prototypes.lookup.json',
          {
            $schema: LOOKUP_SCHEMA_ID,
            id: 'emotions:emotion_prototypes',
            description: 'Emotion prototypes with valid negative mood gates',
            dataSchema: {
              type: 'object',
              properties: {
                weights: { type: 'object' },
                gates: { type: 'array', items: { type: 'string' } },
              },
            },
            entries: {
              sad_emotion: {
                weights: { valence: -0.8 },
                gates: ['valence <= -0.30', 'threat <= 0.50'],
              },
              anxious_emotion: {
                weights: { threat: 0.9 },
                gates: ['threat >= 0.40', 'self_evaluation <= -0.20'],
              },
            },
          },
        ],
      ]);

      const { loader, logger } = createLookupLoader(fileMap);

      const manifest = {
        content: {
          lookups: ['emotion_prototypes.lookup.json'],
        },
      };

      await loader.loadItemsForMod(
        'emotions',
        manifest,
        'lookups',
        'lookups',
        'lookups'
      );

      // Should NOT warn about valid mood gates with negative values
      // Only check warn calls that match gate validation patterns
      const gateWarnings = logger.warn.mock.calls.filter(
        (call) =>
          call[0] &&
          typeof call[0] === 'string' &&
          call[0].includes('Invalid gate threshold')
      );
      expect(gateWarnings).toHaveLength(0);
    });

    it('does not validate gates for non-prototype lookups', async () => {
      const fileMap = new Map([
        [
          '/virtual-mods/other/lookups/regular_lookup.lookup.json',
          {
            $schema: LOOKUP_SCHEMA_ID,
            id: 'other:regular_lookup',
            description: 'Regular lookup without gate validation',
            dataSchema: { type: 'object' },
            entries: {
              some_entry: {
                gates: ['self_control <= -0.10'],
              },
            },
          },
        ],
      ]);

      const { loader, logger } = createLookupLoader(fileMap);

      const manifest = {
        content: {
          lookups: ['regular_lookup.lookup.json'],
        },
      };

      await loader.loadItemsForMod(
        'other',
        manifest,
        'lookups',
        'lookups',
        'lookups'
      );

      // Should NOT warn - this is not a prototype lookup
      const gateWarnings = logger.warn.mock.calls.filter(
        (call) =>
          call[0] &&
          typeof call[0] === 'string' &&
          call[0].includes('Invalid gate threshold')
      );
      expect(gateWarnings).toHaveLength(0);
    });
  });
});
