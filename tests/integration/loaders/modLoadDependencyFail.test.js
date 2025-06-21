// Filename: src/tests/integration/loaders/modLoadDependencyFail.test.js

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Core services under test
import ModsLoader from '../../../src/loaders/modsLoader.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import ModDependencyError from '../../../src/errors/modDependencyError.js';

/* -------------------------------------------------------------------------- */
/* Helper factories – duplicated from modManifestLoader.harness.test.js        */
/* -------------------------------------------------------------------------- */

const createMockConfiguration = (overrides = {}) => ({
  getContentTypeSchemaId: jest.fn((t) => {
    if (t === 'goals') return 'http://example.com/schemas/goal.schema.json';
    // This map now reflects the current essential schema requirements of ModsLoader
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
/* Integration test                                                           */
/* -------------------------------------------------------------------------- */

describe('ModsLoader → ModDependencyValidator integration (missing dependency)', () => {
  // Core service mocks, used by various parts of the setup
  let validator; // ISchemaValidator instance (AjvSchemaValidator)
  let configuration; // IConfiguration mock
  let pathResolver; // IPathResolver mock, used by ModManifestLoader, not ModsLoader directly
  let fetcher; // IDataFetcher mock, used by ModManifestLoader, not ModsLoader directly
  let registry; // IDataRegistry mock
  let logger; // ILogger mock

  // Mocks for dependencies directly required by ModsLoader constructor object
  let schemaLoaderMock; // SchemaLoader class mock
  let componentLoaderMock;
  let conditionLoaderMock;
  let ruleLoaderMock;
  let macroLoaderMock;
  let actionLoaderMock;
  let eventLoaderMock;
  let entityLoaderMock; // EntityDefinitionLoader
  let entityInstanceLoaderMock;
  let gameConfigLoaderMock;
  let promptTextLoaderMock;
  let modManifestLoaderMock; // ModManifestLoader CLASS INSTANCE mock
  let validatedEventDispatcherMock;
  let modDependencyValidatorMock;
  let modVersionValidatorMock; // Function
  let modLoadOrderResolverMock;
  let worldLoaderMock;

  // The SUT
  let modsLoader;

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
    GOAL: { id: 'http://example.com/schemas/goal.schema.json' },
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

    // --- Initialize Core Mocks (some are used by helper services, not directly by ModsLoader) ---
    logger = createMockLogger();
    configuration = createMockConfiguration(); // IConfiguration mock
    pathResolver = createMockPathResolver(); // IPathResolver mock
    fetcher = createMockFetcher(
      // IDataFetcher mock
      {
        /* Mock fetcher responses if needed for ModManifestLoader setup */
      },
      []
    );
    registry = createMockRegistry(); // IDataRegistry mock
    validator = new AjvSchemaValidator(logger); // Real Ajv instance for ISchemaValidator, needs schemas

    // --- Initialize Mocks for ModsLoader's direct dependencies ---
    schemaLoaderMock = {
      loadAndCompileAllSchemas: jest.fn().mockResolvedValue(undefined),
    };
    componentLoaderMock = {
      loadItemsForMod: jest
        .fn()
        .mockResolvedValue({ count: 0, overrides: 0, errors: 0 }),
    };
    conditionLoaderMock = {
      loadItemsForMod: jest
        .fn()
        .mockResolvedValue({ count: 0, overrides: 0, errors: 0 }),
    };
    ruleLoaderMock = {
      loadItemsForMod: jest
        .fn()
        .mockResolvedValue({ count: 0, overrides: 0, errors: 0 }),
    };
    macroLoaderMock = {
      loadItemsForMod: jest
        .fn()
        .mockResolvedValue({ count: 0, overrides: 0, errors: 0 }),
    };
    actionLoaderMock = {
      loadItemsForMod: jest
        .fn()
        .mockResolvedValue({ count: 0, overrides: 0, errors: 0 }),
    };
    eventLoaderMock = {
      loadItemsForMod: jest
        .fn()
        .mockResolvedValue({ count: 0, overrides: 0, errors: 0 }),
    };
    entityLoaderMock = {
      loadItemsForMod: jest
        .fn()
        .mockResolvedValue({ count: 0, overrides: 0, errors: 0 }),
    }; // EntityDefinitionLoader
    entityInstanceLoaderMock = {
      loadItemsForMod: jest
        .fn()
        .mockResolvedValue({ count: 0, overrides: 0, errors: 0 }),
    };
    gameConfigLoaderMock = {
      loadConfig: jest.fn().mockResolvedValue({ mods: ['basegame', 'badmod'] }),
    }; // GameConfigLoader class mock
    promptTextLoaderMock = { loadPromptText: jest.fn().mockResolvedValue({}) };
    modManifestLoaderMock = {
      // ModManifestLoader CLASS INSTANCE mock
      loadRequestedManifests: jest.fn().mockResolvedValue(new Map()),
      loadManifest: jest.fn(),
    };
    validatedEventDispatcherMock = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };
    modDependencyValidatorMock = { validate: jest.fn() }; // IModDependencyValidator
    modVersionValidatorMock = jest.fn().mockImplementation(() => true); // IModVersionValidator (function)
    modLoadOrderResolverMock = {
      resolveOrder: jest.fn((m) => Array.from(m.keys())),
    }; // IModLoadOrderResolver
    worldLoaderMock = { loadWorlds: jest.fn().mockResolvedValue(undefined) }; // IWorldLoader

    // Setup for the real AjvSchemaValidator instance used in the test
    // This uses a *temporary* schemaLoader to load schema definitions into our real validator instance.
    // This is separate from schemaLoaderMock passed to ModsLoader.
    const tempSchemaLoaderForValidatorSetup = {
      loadAndCompileAllSchemas: jest.fn().mockImplementation(async () => {
        for (const schemaDef of Object.values(schemaDefs)) {
          if (!validator.isSchemaLoaded(schemaDef.id)) {
            await validator.addSchema(buildSchema(schemaDef), schemaDef.id);
          }
        }
      }),
    };
    await tempSchemaLoaderForValidatorSetup.loadAndCompileAllSchemas();

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

    // --- Instantiate SUT (ModsLoader) --- Pass a single object with all dependencies
    modsLoader = new ModsLoader({
      registry: registry, // IDataRegistry
      logger: logger, // ILogger
      schemaLoader: schemaLoaderMock, // SchemaLoader class instance
      componentLoader: componentLoaderMock,
      conditionLoader: conditionLoaderMock,
      ruleLoader: ruleLoaderMock,
      macroLoader: macroLoaderMock,
      actionLoader: actionLoaderMock,
      eventLoader: eventLoaderMock,
      entityLoader: entityLoaderMock, // EntityDefinitionLoader class instance
      entityInstanceLoader: entityInstanceLoaderMock,
      validator: validator, // ISchemaValidator (our Ajv instance)
      configuration: configuration, // IConfiguration
      gameConfigLoader: gameConfigLoaderMock, // GameConfigLoader class instance
      promptTextLoader: promptTextLoaderMock,
      modManifestLoader: modManifestLoaderMock, // ModManifestLoader class instance
      validatedEventDispatcher: validatedEventDispatcherMock,
      modDependencyValidator: modDependencyValidatorMock, // IModDependencyValidator
      modVersionValidator: modVersionValidatorMock, // IModVersionValidator (function)
      modLoadOrderResolver: modLoadOrderResolverMock, // IModLoadOrderResolver
      worldLoader: worldLoaderMock, // IWorldLoader
      contentLoadersConfig: null, // Use default
    });

    // Configure the mockModManifestLoader (which *is* a constructor dependency of ModsLoader)
    // to return our test manifests when its methods are called.
    modManifestLoaderMock.loadRequestedManifests.mockResolvedValue(
      new Map([
        ['basegame', baseManifest],
        ['badmod', badManifest],
      ])
    );

    // Configure the modDependencyValidatorMock to throw an error for this test case
    modDependencyValidatorMock.validate.mockImplementation(() => {
      throw new ModDependencyError(
        "Mod 'badmod' requires missing dependency 'MissingMod' (version: ^1.0.0)"
      );
    });
  });

  it('should throw ModDependencyError if a required mod dependency is missing', async () => {
    const loadManifestsSpy = jest.spyOn(
      modManifestLoaderMock,
      'loadRequestedManifests'
    );

    let caughtError = null;
    try {
      await modsLoader.loadWorld('TestWorld');
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

    // SchemaLoader assertion
    expect(schemaLoaderMock.loadAndCompileAllSchemas).toHaveBeenCalledTimes(1);

    // Manifest loader spy assertion
    expect(loadManifestsSpy).toHaveBeenCalledTimes(1);
    expect(loadManifestsSpy).toHaveBeenCalledWith(['basegame', 'badmod'], 'TestWorld');

    // GameConfigLoader assertion
    expect(gameConfigLoaderMock.loadConfig).toHaveBeenCalledTimes(1);

    // Assert auxiliary loaders were NOT called
    expect(ruleLoaderMock.loadItemsForMod).not.toHaveBeenCalled();
    expect(componentLoaderMock.loadItemsForMod).not.toHaveBeenCalled();
    expect(actionLoaderMock.loadItemsForMod).not.toHaveBeenCalled();
    expect(eventLoaderMock.loadItemsForMod).not.toHaveBeenCalled();
    expect(entityLoaderMock.loadItemsForMod).not.toHaveBeenCalled();
    expect(entityInstanceLoaderMock.loadItemsForMod).not.toHaveBeenCalled();

    // Logger assertions
    const errorLogCallArgs = logger.error.mock.calls.find(call => call[0].includes('CRITICAL load failure due to mod dependencies'));
    expect(errorLogCallArgs).toBeDefined();
    expect(errorLogCallArgs[0]).toMatch(
      /ModsLoader: CRITICAL load failure due to mod dependencies/
    );
    expect(errorLogCallArgs[1].error).toBeInstanceOf(ModDependencyError);
    expect(errorLogCallArgs[1].error.message).toMatch(/Mod 'badmod' requires missing dependency 'MissingMod'/);


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