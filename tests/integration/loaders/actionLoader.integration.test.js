/**
 * @file Integration tests for ActionLoader covering manifest processing,
 * registry interactions, and visual customization logging without mocking core
 * collaborators.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ActionLoader from '../../../src/loaders/actionLoader.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import { DuplicateContentError } from '../../../src/errors/duplicateContentError.js';

const ACTION_SCHEMA_ID = 'schema://living-narrative-engine/action.schema.json';

/**
 * @class TestConfiguration
 * @description Minimal configuration service providing loader settings.
 */
class TestConfiguration {
  /**
   * @description Returns the base directory for resolving mod content.
   * @returns {string} Virtual mods directory.
   */
  getModsBasePath() {
    return '/virtual-mods';
  }

  /**
   * @description Resolves the schema id for the supplied content type.
   * @param {string} contentType - Manifest content key.
   * @returns {string|null} Schema identifier for the requested type.
   */
  getContentTypeSchemaId(contentType) {
    return contentType === 'actions' ? ACTION_SCHEMA_ID : null;
  }
}

/**
 * @class TestPathResolver
 * @description Deterministically resolves manifest filenames to virtual paths.
 */
class TestPathResolver {
  /**
   * @description Resolves a manifest reference into a fetchable path.
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
   * @description Fetches the JSON payload for a registered path.
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
 * @description Minimal schema validator tracking validation interactions.
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
 * @class NamespacedDataRegistry
 * @description Extends the in-memory registry to support `type.modId` lookups.
 */
class NamespacedDataRegistry extends InMemoryDataRegistry {
  /**
   * @inheritdoc
   */
  getAll(type) {
    if (typeof type === 'string' && type.includes('.')) {
      const [category, modId] = type.split('.', 2);
      const entries = super.getAll(category);
      if (!modId) {
        return entries;
      }

      const filtered = entries.filter(
        (entry) => entry && entry._modId === modId
      );
      return filtered.length > 0 ? filtered : undefined;
    }

    return super.getAll(type);
  }
}

/**
 * @description Instantiates a fully wired ActionLoader with deterministic collaborators.
 * @param {Map<string, any>} fileMap - Map of resolved paths to action payloads.
 * @param {{schemaValidator?: StrictSchemaValidator}} [options] - Optional overrides.
 * @returns {{
 *   loader: ActionLoader,
 *   registry: InMemoryDataRegistry,
 *   logger: ReturnType<typeof createTestLogger>,
 *   pathResolver: TestPathResolver,
 *   dataFetcher: MapDataFetcher,
 *   schemaValidator: StrictSchemaValidator,
 *   config: TestConfiguration
 * }} Loader and dependencies.
 */
function createActionLoader(fileMap, { schemaValidator } = {}) {
  const logger = createTestLogger();
  const registry = new NamespacedDataRegistry({ logger });
  const config = new TestConfiguration();
  const pathResolver = new TestPathResolver();
  const dataFetcher = new MapDataFetcher(fileMap);
  const effectiveSchemaValidator =
    schemaValidator ||
    new StrictSchemaValidator({
      [ACTION_SCHEMA_ID]: () => ({ isValid: true, errors: null }),
    });

  const loader = new ActionLoader(
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

describe('ActionLoader integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads actions with visual properties and logs customization metrics', async () => {
    const fileMap = new Map([
      [
        '/virtual-mods/modAlpha/actions/wave.action.json',
        {
          id: 'modAlpha:wave',
          type: 'gesture',
          description: 'Wave enthusiastically to greet nearby characters.',
          steps: ['raise_hand', 'sway'],
          visual: {
            backgroundColor: '#112233',
            textColor: '#fefefe',
          },
        },
      ],
      [
        '/virtual-mods/modAlpha/actions/inspect.action.json',
        {
          id: 'modAlpha:inspect',
          type: 'interaction',
          description: 'Inspect a nearby object for clues.',
          steps: ['approach', 'examine'],
        },
      ],
    ]);

    const schemaValidator = new StrictSchemaValidator({
      [ACTION_SCHEMA_ID]: (data) => ({
        isValid:
          typeof data === 'object' &&
          data !== null &&
          typeof data.id === 'string' &&
          data.id.includes(':'),
        errors: null,
      }),
    });

    const {
      loader,
      registry,
      logger,
      schemaValidator: validator,
    } = createActionLoader(fileMap, { schemaValidator });

    const manifest = {
      content: {
        actions: ['wave.action.json', 'inspect.action.json'],
      },
    };

    const result = await loader.loadItemsForMod(
      'modAlpha',
      manifest,
      'actions',
      'actions',
      'actions'
    );

    expect(result).toEqual({ count: 2, overrides: 0, errors: 0, failures: [] });

    expect(validator.isSchemaLoaded).toHaveBeenCalledWith(ACTION_SCHEMA_ID);
    expect(validator.validate).toHaveBeenCalledTimes(2);

    const storedWave = registry.get('actions', 'modAlpha:wave');
    expect(storedWave).toMatchObject({
      id: 'modAlpha:wave',
      _modId: 'modAlpha',
      _sourceFile: 'wave.action.json',
      _fullId: 'modAlpha:wave',
      type: 'gesture',
      visual: {
        backgroundColor: '#112233',
        textColor: '#fefefe',
      },
    });

    const storedInspect = registry.get('actions', 'modAlpha:inspect');
    expect(storedInspect).toMatchObject({
      id: 'modAlpha:inspect',
      _modId: 'modAlpha',
      _sourceFile: 'inspect.action.json',
      _fullId: 'modAlpha:inspect',
      type: 'interaction',
    });

    expect(registry.getAll('actions')).toHaveLength(2);

    expect(logger.debug).toHaveBeenCalledWith(
      'Action modAlpha:wave loaded with visual properties:',
      {
        backgroundColor: '#112233',
        textColor: '#fefefe',
      }
    );

    const visualDebugMessages = logger.debug.mock.calls.filter(
      ([message]) =>
        typeof message === 'string' &&
        message.startsWith('Action ') &&
        message.includes('loaded with visual properties')
    );
    expect(
      visualDebugMessages.some(
        ([message]) =>
          message === 'Action modAlpha:inspect loaded with visual properties:'
      )
    ).toBe(false);

    expect(logger.info).toHaveBeenCalledWith(
      "1 action(s) from mod 'modAlpha' have visual customization properties."
    );
  });

  it('records duplicate action definitions as failures without logging visual summary', async () => {
    const fileMap = new Map([
      [
        '/virtual-mods/modAlpha/actions/original.action.json',
        {
          id: 'modAlpha:shared_action',
          type: 'interaction',
          description: 'Original version of the action.',
          steps: ['prepare', 'execute'],
        },
      ],
      [
        '/virtual-mods/modAlpha/actions/duplicate.action.json',
        {
          id: 'modAlpha:shared_action',
          type: 'interaction',
          description: 'Duplicate entry attempting to override the original.',
          steps: ['prepare', 'execute'],
        },
      ],
    ]);

    const { loader, registry, logger, schemaValidator } =
      createActionLoader(fileMap);

    const manifest = {
      content: {
        actions: ['original.action.json', 'duplicate.action.json'],
      },
    };

    const result = await loader.loadItemsForMod(
      'modAlpha',
      manifest,
      'actions',
      'actions',
      'actions'
    );

    expect(result.count).toBe(1);
    expect(result.overrides).toBe(0);
    expect(result.errors).toBe(1);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toMatchObject({ file: 'duplicate.action.json' });
    expect(result.failures[0].error).toBeInstanceOf(DuplicateContentError);

    const stored = registry.get('actions', 'modAlpha:shared_action');
    expect(stored).toMatchObject({
      _sourceFile: 'original.action.json',
      description: 'Original version of the action.',
    });

    expect(schemaValidator.validate).toHaveBeenCalledTimes(2);
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('returns zero counts and no visual summary when manifest lacks valid action files', async () => {
    const fileMap = new Map();
    const { loader, logger, schemaValidator, registry } =
      createActionLoader(fileMap);

    const manifest = {
      content: {
        actions: ['   ', null, 42],
      },
    };

    const result = await loader.loadItemsForMod(
      'modBeta',
      manifest,
      'actions',
      'actions',
      'actions'
    );

    expect(result).toEqual({ count: 0, overrides: 0, errors: 0, failures: [] });
    expect(schemaValidator.validate).not.toHaveBeenCalled();
    expect(registry.getAll('actions')).toHaveLength(0);

    expect(logger.warn).toHaveBeenCalledWith(
      "Mod 'modBeta': Empty string filename found in 'actions' list after trimming. Skipping."
    );
    expect(logger.warn).toHaveBeenCalledWith(
      "Mod 'modBeta': Invalid non-string entry found in 'actions' list:",
      null
    );
    expect(logger.warn).toHaveBeenCalledWith(
      "Mod 'modBeta': Invalid non-string entry found in 'actions' list:",
      42
    );

    expect(logger.info).not.toHaveBeenCalled();
  });
});
