// Filename: src/tests/integration/modLoadDependencyFail.test.js

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Core services under test
import WorldLoader from '../../src/loaders/worldLoader.js';
import ModManifestLoader from '../../src/modding/modManifestLoader.js';
import AjvSchemaValidator from '../../src/validation/ajvSchemaValidator.js';
import ModDependencyError from '../../src/errors/modDependencyError.js';

/* -------------------------------------------------------------------------- */
/* Helper factories – duplicated from modManifestLoader.harness.test.js        */
/* -------------------------------------------------------------------------- */

const createMockConfiguration = (overrides = {}) => ({
  getContentTypeSchemaId: jest.fn((t) => {
    // This map now reflects the current essential schema requirements of WorldLoader
    const schemaMap = {
      'mod-manifest': 'http://example.com/schemas/mod.manifest.schema.json',
      game: 'http://example.com/schemas/game.schema.json',
      conditions: 'http://example.com/schemas/condition.schema.json',
      components: 'http://example.com/schemas/component.schema.json',
      actions: 'http://example.com/schemas/action.schema.json',
      events: 'http://example.com/schemas/event.schema.json',
      entityDefinitions:
        'http://example.com/schemas/entity-definition.schema.json', // <<< CORRECTED
      entityInstances: 'http://example.com/schemas/entity-instance.schema.json', // <<< CORRECTED
      rules: 'http://example.com/schemas/rule.schema.json',
    };
    return schemaMap[t] || `http://example.com/schemas/${t}.schema.json`;
  }),
  // Unused in this harness but required by ModManifestLoader interface
  getBaseDataPath: jest.fn(() => './data'),
  getSchemaFiles: jest.fn(() => [
    'mod.manifest.schema.json',
    'game.schema.json',
    'component.schema.json',
    'entity-definition.schema.json', // <<< CORRECTED
    'entity-instance.schema.json',
  ]), // Basic schemas for test
  getSchemaBasePath: jest.fn(() => 'schemas'),
  getContentBasePath: jest.fn((typeName) => typeName),
  getGameConfigFilename: jest.fn(() => 'game.json'),
  getModsBasePath: jest.fn(() => 'mods'),
  getModManifestFilename: jest.fn(() => 'mod.manifest.json'),
  ...overrides,
});

const createMockPathResolver = (overrides = {}) => ({
  resolveModManifestPath: jest.fn(
    (id) => `./data/mods/${id}/mod.manifest.json`
  ),
  resolveSchemaPath: jest.fn((filename) => `./data/schemas/${filename}`),
  resolveGameConfigPath: jest.fn(() => './data/game.json'),
  resolveModContentPath: jest.fn(
    (modId, typeName, filename) =>
      `./data/mods/${modId}/${typeName}/${filename}`
  ),
  ...overrides,
});

// Generic programmable fetcher
const createMockFetcher = (idToResponse = {}, errorIds = []) => ({
  fetch: jest.fn(async (path) => {
    // Match manifest fetch requests
    const manifestMatch = path.match(/mods\/([^/]+)\/mod\.manifest\.json/);
    if (manifestMatch) {
      const modId = manifestMatch[1];
      if (errorIds.includes(modId)) {
        throw new Error(`Fetch failed for ${modId} manifest`);
      }
      if (Object.prototype.hasOwnProperty.call(idToResponse, modId)) {
        return JSON.parse(JSON.stringify(idToResponse[modId]));
      }
    }

    // Match schema fetch requests
    const schemaMatch = path.match(/\/schemas\/([^/]+)/);
    if (schemaMatch) {
      const schemaIdMap = {
        'mod.manifest.schema.json':
          'http://example.com/schemas/mod.manifest.schema.json',
        'game.schema.json': 'http://example.com/schemas/game.schema.json',
        'component.schema.json':
          'http://example.com/schemas/component.schema.json',
        'entity-definition.schema.json':
          'http://example.com/schemas/entity-definition.schema.json',
        'entity-instance.schema.json':
          'http://example.com/schemas/entity-instance.schema.json',
        'action.schema.json': 'http://example.com/schemas/action.schema.json',
        'event.schema.json': 'http://example.com/schemas/event.schema.json',
        'rule.schema.json': 'http://example.com/schemas/rule.schema.json',
        'condition.schema.json':
          'http://example.com/schemas/condition.schema.json',
      };
      const schemaId = Object.values(schemaIdMap).find((id) =>
        path.includes(id.split('/').pop())
      );
      if (schemaId) {
        return { $id: schemaId, type: 'object', properties: {}, required: [] };
      }
    }

    if (path.includes('/game.json')) {
      console.warn('Fetcher mock was unexpectedly asked to fetch game.json!');
      return { mods: ['basegame', 'badmod'] };
    }

    console.error(`Fetcher mock received unexpected path: ${path}`);
    throw new Error(`404 Not Found or invalid path: ${path}`);
  }),
});

const createMockRegistry = () => {
  const data = new Map(); // type -> Map
  const store = jest.fn((type, id, obj) => {
    if (!data.has(type)) data.set(type, new Map());
    data.get(type).set(id, JSON.parse(JSON.stringify(obj)));
  });
  const get = jest.fn((type, id) => {
    const typeMap = data.get(type);
    const storedObj = typeMap ? typeMap.get(id) : undefined;
    return storedObj ? JSON.parse(JSON.stringify(storedObj)) : undefined;
  });
  const getAll = jest.fn((type) => {
    const typeMap = data.get(type);
    return typeMap
      ? Array.from(typeMap.values()).map((obj) =>
          JSON.parse(JSON.stringify(obj))
        )
      : [];
  });

  return {
    clear: jest.fn(() => data.clear()),
    store,
    get,
    getAll,
    setManifest: jest.fn(),
    getManifest: jest.fn(),
  };
};

const createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

/* -------------------------------------------------------------------------- */
/* Integration test                                                           */
/* -------------------------------------------------------------------------- */

describe('WorldLoader → ModDependencyValidator integration (missing dependency)', () => {
  let validator;
  let configuration;
  let pathResolver;
  let fetcher;
  let registry;
  let logger;
  let schemaLoader;
  let conditionLoader;
  let componentDefinitionLoader;
  let ruleLoader;
  let actionLoader;
  let eventLoader;
  let entityLoader;
  let entityInstanceLoader;
  let gameConfigLoader;
  let modManifestLoader;
  let validatedEventDispatcher;
  let modDependencyValidator;
  let modVersionValidator;
  let modLoadOrderResolver;
  let worldLoader;

  const schemaDefs = {
    MOD_MANIFEST: {
      id: 'http://example.com/schemas/mod.manifest.schema.json',
      required: ['id', 'name', 'version'],
      props: { id: { type: 'string' } },
    },
    GAME: {
      id: 'http://example.com/schemas/game.schema.json',
      required: ['mods'],
      props: { mods: { type: 'array' } },
    },
    CONDITION: { id: 'http://example.com/schemas/condition.schema.json' },
    COMPONENT: { id: 'http://example.com/schemas/component.schema.json' },
    ENTITY_DEFINITION: {
      id: 'http://example.com/schemas/entity-definition.schema.json',
    },
    ENTITY_INSTANCE: {
      id: 'http://example.com/schemas/entity-instance.schema.json',
    },
    ACTION: { id: 'http://example.com/schemas/action.schema.json' },
    EVENT: { id: 'http://example.com/schemas/event.schema.json' },
    RULE: { id: 'http://example.com/schemas/rule.schema.json' },
  };

  const buildSchema = ({ id, required = [], props = {} }) => ({
    $id: id,
    type: 'object',
    required: required,
    properties: props,
    additionalProperties: true,
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    if (modDependencyValidator) modDependencyValidator.validate.mockReset();
    if (modVersionValidator) modVersionValidator.mockReset();
    if (modLoadOrderResolver) modLoadOrderResolver.resolveOrder.mockReset();

    /* -------------------- Core plumbing ---------------------------------- */
    logger = createMockLogger();
    validator = new AjvSchemaValidator(logger);

    schemaLoader = {
      loadAndCompileAllSchemas: jest.fn().mockImplementation(async () => {
        for (const schemaDef of Object.values(schemaDefs)) {
          if (!validator.isSchemaLoaded(schemaDef.id)) {
            await validator.addSchema(buildSchema(schemaDef), schemaDef.id);
          }
        }
        logger.debug('Mock SchemaLoader: Added schemas to REAL validator.');
      }),
    };
    configuration = createMockConfiguration();
    pathResolver = createMockPathResolver();

    /* -------------------- Fixture manifests ------------------------------ */
    const baseManifest = {
      id: 'basegame',
      name: 'Base Game',
      version: '1.0.0',
      content: {},
    };
    const badManifest = {
      id: 'badmod',
      name: 'Bad Mod',
      version: '0.1.0',
      dependencies: [{ id: 'MissingMod', version: '^1.0.0', required: true }],
      content: {},
    };

    fetcher = createMockFetcher(
      { basegame: baseManifest, badmod: badManifest },
      []
    );
    registry = createMockRegistry();

    /* -------------------- Auxiliary loaders ------------------------------ */
    ruleLoader = { loadItemsForMod: jest.fn().mockResolvedValue({ count: 0 }) };
    conditionLoader = {
      loadItemsForMod: jest.fn().mockResolvedValue({ count: 0 }),
    };
    componentDefinitionLoader = {
      loadItemsForMod: jest.fn().mockResolvedValue({ count: 0 }),
    };
    actionLoader = {
      loadItemsForMod: jest.fn().mockResolvedValue({ count: 0 }),
    };
    eventLoader = {
      loadItemsForMod: jest.fn().mockResolvedValue({ count: 0 }),
    };
    entityLoader = {
      loadItemsForMod: jest.fn().mockResolvedValue({ count: 0 }),
    };
    entityInstanceLoader = {
      loadItemsForMod: jest.fn().mockResolvedValue({ count: 0 }),
    };

    gameConfigLoader = {
      loadConfig: jest.fn().mockResolvedValue(['basegame', 'badmod']),
    };

    validatedEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(),
    };

    modDependencyValidator = {
      validate: jest.fn(() => {
        throw new ModDependencyError(
          "Mod 'badmod' requires missing dependency 'MissingMod'"
        );
      }),
    };
    modVersionValidator = jest.fn();
    modLoadOrderResolver = {
      resolveOrder: jest.fn(() => ['basegame', 'badmod']),
    };

    /* -------------------- Real ModManifestLoader ------------------------- */
    modManifestLoader = new ModManifestLoader(
      configuration,
      pathResolver,
      fetcher,
      validator,
      registry,
      logger
    );

    /* -------------------- System under test ------------------------------ */
    worldLoader = new WorldLoader({
      registry,
      logger,
      schemaLoader,
      conditionLoader,
      componentLoader: componentDefinitionLoader,
      ruleLoader,
      actionLoader,
      eventLoader,
      entityLoader,
      entityInstanceLoader,
      validator,
      configuration,
      gameConfigLoader,
      promptTextLoader: { loadPromptText: jest.fn() },
      modManifestLoader,
      validatedEventDispatcher,
      modDependencyValidator,
      modVersionValidator,
      modLoadOrderResolver,
      contentLoadersConfig: null,
    });
  });

  it('rejects with ModDependencyError and fetches only mod manifests (no content)', async () => {
    const loadManifestsSpy = jest.spyOn(
      modManifestLoader,
      'loadRequestedManifests'
    );

    let caughtError = null;
    try {
      await worldLoader.loadWorld('TestWorld');
    } catch (error) {
      caughtError = error;
    }

    // --- Assert Error ---
    expect(caughtError).toBeInstanceOf(ModDependencyError);
    // Check the specific message from ModDependencyValidator is present in the error
    expect(caughtError.message).toMatch(
      /Mod 'badmod' requires missing dependency 'MissingMod'/
    );

    // --- Assert side effects (mocks and spies) ---

    // Fetcher assertions
    expect(fetcher.fetch).toHaveBeenCalledWith(
      './data/mods/basegame/mod.manifest.json'
    );
    expect(fetcher.fetch).toHaveBeenCalledWith(
      './data/mods/badmod/mod.manifest.json'
    );

    // Check that NO content files were fetched
    const contentFetches = fetcher.fetch.mock.calls.filter(([p]) =>
      /\/mods\/[^/]+\/(actions|components|events|rules|entityDefinitions|entityInstances)\//.test(
        p
      )
    );
    expect(contentFetches).toHaveLength(0);

    // Total fetch count should be just the 2 manifests
    expect(fetcher.fetch).toHaveBeenCalledTimes(2);

    // SchemaLoader assertion
    expect(schemaLoader.loadAndCompileAllSchemas).toHaveBeenCalledTimes(1);

    // Manifest loader spy assertion
    expect(loadManifestsSpy).toHaveBeenCalledTimes(1);
    expect(loadManifestsSpy).toHaveBeenCalledWith(['basegame', 'badmod']);

    // GameConfigLoader assertion
    expect(gameConfigLoader.loadConfig).toHaveBeenCalledTimes(1);

    // Assert auxiliary loaders were NOT called
    expect(ruleLoader.loadItemsForMod).not.toHaveBeenCalled();
    expect(componentDefinitionLoader.loadItemsForMod).not.toHaveBeenCalled();
    expect(actionLoader.loadItemsForMod).not.toHaveBeenCalled();
    expect(eventLoader.loadItemsForMod).not.toHaveBeenCalled();
    expect(entityLoader.loadItemsForMod).not.toHaveBeenCalled();
    expect(entityInstanceLoader.loadItemsForMod).not.toHaveBeenCalled();

    // Logger assertions
    const errorLogCallArgs = logger.error.mock.calls[0];
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(errorLogCallArgs[0]).toBe(
      'WorldLoader: CRITICAL load failure during world/mod loading sequence.'
    );
    expect(errorLogCallArgs[1]).toEqual(
      expect.objectContaining({
        error: expect.any(ModDependencyError),
      })
    );
    expect(errorLogCallArgs[1].error.message).toMatch(
      /Mod 'badmod' requires missing dependency 'MissingMod'/
    );

    // Registry assertions
    expect(registry.clear).toHaveBeenCalledTimes(2);
    expect(registry.store).toHaveBeenCalledWith(
      'mod_manifests',
      'basegame',
      expect.objectContaining({ id: 'basegame' })
    );
    expect(registry.store).toHaveBeenCalledWith(
      'mod_manifests',
      'badmod',
      expect.objectContaining({ id: 'badmod' })
    );
    expect(registry.store).not.toHaveBeenCalledWith(
      'meta',
      'final_mod_order',
      expect.any(Array)
    );

    loadManifestsSpy.mockRestore();
  });
});
