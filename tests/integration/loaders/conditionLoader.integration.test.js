/**
 * @file Integration tests for ConditionLoader to cover interactions with manifest processing,
 * schema validation, and registry storage.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ConditionLoader from '../../../src/loaders/conditionLoader.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import { DuplicateContentError } from '../../../src/errors/duplicateContentError.js';

const CONDITION_SCHEMA_ID =
  'schema://living-narrative-engine/condition.schema.json';

/**
 * @class TestConfiguration
 * @description Minimal configuration service mirroring the required interface.
 */
class TestConfiguration {
  /**
   * @description Creates a new test configuration instance.
   * @param {string} [schemaId] - Schema identifier for conditions.
   */
  constructor(schemaId = CONDITION_SCHEMA_ID) {
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
    return contentType === 'conditions' ? this._schemaId : null;
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
 * @description Instantiates a fully wired ConditionLoader with deterministic collaborators.
 * @param {Map<string, any>} fileMap - Map of resolved paths to condition payloads.
 * @param {{schemaValidator?: StrictSchemaValidator}} [options] - Optional overrides.
 * @returns {{
 *   loader: ConditionLoader,
 *   registry: InMemoryDataRegistry,
 *   logger: ReturnType<typeof createTestLogger>,
 *   pathResolver: TestPathResolver,
 *   dataFetcher: MapDataFetcher,
 *   schemaValidator: StrictSchemaValidator,
 *   config: TestConfiguration
 * }} Loader and dependencies.
 */
function createConditionLoader(fileMap, { schemaValidator } = {}) {
  const logger = createTestLogger();
  const registry = new InMemoryDataRegistry({ logger });
  const config = new TestConfiguration();
  const pathResolver = new TestPathResolver();
  const dataFetcher = new MapDataFetcher(fileMap);
  const effectiveSchemaValidator =
    schemaValidator ||
    new StrictSchemaValidator({
      [CONDITION_SCHEMA_ID]: () => ({ isValid: true, errors: null }),
    });

  const loader = new ConditionLoader(
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

describe('ConditionLoader integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads condition definitions and stores them with metadata', async () => {
    const fileMap = new Map([
      [
        '/virtual-mods/modAlpha/conditions/is-clear.condition.json',
        {
          $schema: CONDITION_SCHEMA_ID,
          id: 'modAlpha:is-clear',
          description: 'Checks if the weather is clear.',
          logic: {
            '===': [{ var: 'weather' }, 'clear'],
          },
        },
      ],
      [
        '/virtual-mods/modAlpha/conditions/has-energy.condition.json',
        {
          id: 'modAlpha:has-energy',
          description: 'Ensures the actor has energy remaining.',
          logic: {
            '>': [{ var: 'energy' }, 0],
          },
        },
      ],
    ]);

    const schemaValidator = new StrictSchemaValidator({
      [CONDITION_SCHEMA_ID]: (data) => ({
        isValid:
          typeof data === 'object' &&
          data !== null &&
          typeof data.logic === 'object' &&
          data.logic !== null,
        errors: null,
      }),
    });

    const { loader, registry, logger, schemaValidator: validator } =
      createConditionLoader(fileMap, { schemaValidator });

    const manifest = {
      content: {
        conditions: [
          'is-clear.condition.json',
          '   has-energy.condition.json   ',
          null,
          '',
        ],
      },
    };

    const result = await loader.loadItemsForMod(
      'modAlpha',
      manifest,
      'conditions',
      'conditions',
      'conditions'
    );

    expect(result).toEqual({ count: 2, overrides: 0, errors: 0, failures: [] });
    expect(validator.isSchemaLoaded).toHaveBeenCalledWith(CONDITION_SCHEMA_ID);
    expect(validator.validate).toHaveBeenCalledTimes(2);

    const storedClear = registry.get('conditions', 'modAlpha:is-clear');
    expect(storedClear).toMatchObject({
      id: 'is-clear',
      _modId: 'modAlpha',
      _sourceFile: 'is-clear.condition.json',
      _fullId: 'modAlpha:is-clear',
      description: 'Checks if the weather is clear.',
      logic: { '===': [{ var: 'weather' }, 'clear'] },
    });

    const storedEnergy = registry.get('conditions', 'modAlpha:has-energy');
    expect(storedEnergy).toMatchObject({
      id: 'has-energy',
      _modId: 'modAlpha',
      _sourceFile: 'has-energy.condition.json',
      _fullId: 'modAlpha:has-energy',
      description: 'Ensures the actor has energy remaining.',
      logic: { '>': [{ var: 'energy' }, 0] },
    });

    expect(registry.getAll('conditions')).toHaveLength(2);

    expect(logger.warn).toHaveBeenCalledWith(
      "Mod 'modAlpha': Invalid non-string entry found in 'conditions' list:",
      null
    );
    expect(logger.warn).toHaveBeenCalledWith(
      "Mod 'modAlpha': Empty string filename found in 'conditions' list after trimming. Skipping."
    );
  });

  it('records duplicate condition definitions as failures', async () => {
    const fileMap = new Map([
      [
        '/virtual-mods/modAlpha/conditions/original.condition.json',
        {
          id: 'modAlpha:shared-condition',
          description: 'Original version of the shared condition.',
          logic: { var: 'actor' },
        },
      ],
      [
        '/virtual-mods/modAlpha/conditions/duplicate.condition.json',
        {
          id: 'modAlpha:shared-condition',
          description: 'Duplicate attempting to override.',
          logic: { var: 'target' },
        },
      ],
    ]);

    const { loader, registry, schemaValidator } = createConditionLoader(fileMap);

    const manifest = {
      content: {
        conditions: [
          'original.condition.json',
          'duplicate.condition.json',
        ],
      },
    };

    const result = await loader.loadItemsForMod(
      'modAlpha',
      manifest,
      'conditions',
      'conditions',
      'conditions'
    );

    expect(result.count).toBe(1);
    expect(result.errors).toBe(1);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toMatchObject({ file: 'duplicate.condition.json' });
    expect(result.failures[0].error).toBeInstanceOf(DuplicateContentError);

    expect(registry.getAll('conditions')).toHaveLength(1);
    const stored = registry.get('conditions', 'modAlpha:shared-condition');
    expect(stored).toMatchObject({
      _sourceFile: 'original.condition.json',
      logic: { var: 'actor' },
    });

    expect(schemaValidator.validate).toHaveBeenCalledTimes(2);
  });
});
