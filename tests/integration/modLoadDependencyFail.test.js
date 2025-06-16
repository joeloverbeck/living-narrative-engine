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
    if (t === 'mod-manifest')
      return 'http://example.com/schemas/mod.manifest.schema.json';
    if (t === 'game') return 'http://example.com/schemas/game.schema.json';
    if (t === 'conditions') return 'http://example.com/schemas/condition.schema.json';
    if (t === 'components')
      return 'http://example.com/schemas/components.schema.json';
    // Add mappings for other types if needed by mocks/test, otherwise keep generic
    if (t === 'actions')
      return 'http://example.com/schemas/action-definition.schema.json';
    if (t === 'events')
      return 'http://example.com/schemas/event-definition.schema.json';
    if (t === 'entities')
      return 'http://example.com/schemas/entity.schema.json'; // Required for WorldLoader essentials check
    if (t === 'rules') return 'http://example.com/schemas/rule.schema.json';
    return `http://example.com/schemas/${t}.schema.json`;
  }),
  // Unused in this harness but required by ModManifestLoader interface
  getBaseDataPath: jest.fn(() => './data'),
  getSchemaFiles: jest.fn(() => [
    'mod.manifest.schema.json',
    'game.schema.json',
    'components.schema.json',
    'entity.schema.json',
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
  // Add other required resolver methods if WorldLoader uses them directly (unlikely based on code)
  resolveSchemaPath: jest.fn((filename) => `./data/schemas/${filename}`),
  resolveGameConfigPath: jest.fn(() => './data/game.json'), // Still useful for GameConfigLoader's potential *real* impl
  resolveModContentPath: jest.fn(
    (modId, typeName, filename) =>
      `./data/mods/${modId}/${typeName}/${filename}`
  ),
  ...overrides,
});

// Generic programmable fetcher
const createMockFetcher = (idToResponse = {}, errorIds = []) => ({
  fetch: jest.fn(async (path) => {
    // Make mock async to match real fetcher
    // Match manifest fetch requests
    const manifestMatch = path.match(/mods\/([^/]+)\/mod\.manifest\.json/);
    if (manifestMatch) {
      const modId = manifestMatch[1];
      if (errorIds.includes(modId)) {
        throw new Error(`Fetch failed for ${modId} manifest`);
      }
      if (idToResponse.hasOwnProperty(modId)) {
        // IMPORTANT: Return a deep copy to prevent modification bugs if the test modifies the returned object
        return JSON.parse(JSON.stringify(idToResponse[modId]));
      }
    }

    // Match schema fetch requests (return the schema objects defined in the test)
    // Use minimal schemas here, real schemas defined in test scope
    if (path.includes('/schemas/mod.manifest.schema.json')) {
      return {
        $id: 'http://example.com/schemas/mod.manifest.schema.json',
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          version: { type: 'string' },
          content: { type: 'object' },
          dependencies: { type: 'array' },
        },
        required: ['id', 'name', 'version'],
      };
    }
    if (path.includes('/schemas/game.schema.json')) {
      return {
        $id: 'http://example.com/schemas/game.schema.json',
        type: 'object',
        properties: { mods: { type: 'array', items: { type: 'string' } } },
        required: ['mods'],
      };
    }
    if (path.includes('/schemas/components.schema.json')) {
      return {
        $id: 'http://example.com/schemas/components.schema.json',
        type: 'object',
      };
    }
    // Add entity schema fetch mock
    if (path.includes('/schemas/entity.schema.json')) {
      return {
        $id: 'http://example.com/schemas/entity.schema.json',
        type: 'object',
      };
    }
    // Add other schemas handled by fetcher if validator needs them
    if (path.includes('/schemas/action-definition.schema.json')) {
      return {
        $id: 'http://example.com/schemas/action-definition.schema.json',
        type: 'object',
      };
    }
    if (path.includes('/schemas/event-definition.schema.json')) {
      return {
        $id: 'http://example.com/schemas/event-definition.schema.json',
        type: 'object',
      };
    }
    if (path.includes('/schemas/rule.schema.json')) {
      return {
        $id: 'http://example.com/schemas/rule.schema.json',
        type: 'object',
      };
    }

    // Match game dependencyInjection fetch - THIS SHOULD NOT BE HIT IN THIS TEST due to gameConfigLoader mock
    if (path.includes('/game.json')) {
      console.warn('Fetcher mock was unexpectedly asked to fetch game.json!'); // Add warning
      return { mods: ['basegame', 'badmod'] }; // Return something valid anyway
    }

    // Simulate a 404 or specific fetch error for any other path
    console.error(`Fetcher mock received unexpected path: ${path}`);
    throw new Error(`404 Not Found or invalid path: ${path}`);
  }),
});

const createMockRegistry = () => {
  const data = new Map(); // type -> Map
  const store = jest.fn((type, id, obj) => {
    if (!data.has(type)) data.set(type, new Map());
    // Store a deep copy to prevent modifications affecting the registry state unexpectedly
    data.get(type).set(id, JSON.parse(JSON.stringify(obj)));
  });
  const get = jest.fn((type, id) => {
    const typeMap = data.get(type);
    const storedObj = typeMap ? typeMap.get(id) : undefined;
    // Return a deep copy to simulate real retrieval
    return storedObj ? JSON.parse(JSON.stringify(storedObj)) : undefined;
  });
  const getAll = jest.fn((type) => {
    const typeMap = data.get(type);
    // Return deep copies
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
    setManifest: jest.fn(), // Keep if needed by other parts (unlikely here)
    getManifest: jest.fn(), // Keep if needed
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
  let logger; // Declared here
  let schemaLoader;
  let conditionLoader;
  let componentDefinitionLoader; // Variable name in test scope
  let ruleLoader;
  let actionLoader;
  let eventLoader;
  let entityLoader;
  let gameConfigLoader;
  let modManifestLoader; // The real instance will be created here
  let validatedEventDispatcher; // <<< ADDED: Declare mock validatedEventDispatcher
  let worldLoader;

  // Lean JSON schemas (just enough to satisfy the loader)
  const MOD_MANIFEST_SCHEMA_ID =
    'http://example.com/schemas/mod.manifest.schema.json';
  const GAME_SCHEMA_ID = 'http://example.com/schemas/game.schema.json';
  const CONDITION_SCHEMA_ID = 'http://example.com/schemas/condition.schema.json';
  const CONDITION_CONTAINER_SCHEMA_ID = 'http://example.com/schemas/condition-container.schema.json';
  const COMPONENTS_SCHEMA_ID =
    'http://example.com/schemas/components.schema.json';
  const ENTITY_SCHEMA_ID = 'http://example.com/schemas/entity.schema.json'; // <<< ADDED
  const ACTION_SCHEMA_ID =
    'http://example.com/schemas/action-definition.schema.json';
  const EVENT_SCHEMA_ID =
    'http://example.com/schemas/event-definition.schema.json';
  const RULE_SCHEMA_ID = 'http://example.com/schemas/rule.schema.json';

  // Define minimal schemas
  const manifestSchema = {
    $id: MOD_MANIFEST_SCHEMA_ID,
    type: 'object',
    required: ['id', 'name', 'version'],
    properties: {
      id: { type: 'string', minLength: 1 },
      name: { type: 'string', minLength: 1 },
      version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
      dependencies: {
        type: 'array',
        default: [],
        items: {
          type: 'object',
          required: ['id', 'version'],
          properties: {
            id: { type: 'string', minLength: 1 },
            version: { type: 'string', minLength: 1 },
            required: { type: 'boolean' },
          },
        },
      },
      conflicts: {
        type: 'array',
        default: [],
        items: { type: 'string', minLength: 1 },
      },
      gameVersion: { type: 'string', minLength: 1 },
      content: {
        type: 'object',
        default: {},
        additionalProperties: { type: 'array', items: { type: 'string' } },
      },
    },
    additionalProperties: false,
  };

  const gameSchema = {
    $id: GAME_SCHEMA_ID,
    type: 'object',
    required: ['mods'],
    properties: {
      mods: {
        type: 'array',
        items: { type: 'string', minLength: 1 },
        uniqueItems: true,
      },
    },
    additionalProperties: true,
  };
  const conditionSchema = {
    $id: CONDITION_SCHEMA_ID,
    type: 'object',
    additionalProperties: true,
  }
  const conditionContainerSchema = {
    $id: CONDITION_CONTAINER_SCHEMA_ID,
    type: 'object',
    additionalProperties: true,
  }
  const componentsSchema = {
    $id: COMPONENTS_SCHEMA_ID,
    type: 'object',
    additionalProperties: true,
  };
  const entitySchema = {
    $id: ENTITY_SCHEMA_ID,
    type: 'object',
    additionalProperties: true,
  }; // <<< ADDED
  const actionSchema = {
    $id: ACTION_SCHEMA_ID,
    type: 'object',
    additionalProperties: true,
  };
  const eventSchema = {
    $id: EVENT_SCHEMA_ID,
    type: 'object',
    additionalProperties: true,
  };
  const ruleSchema = {
    $id: RULE_SCHEMA_ID,
    type: 'object',
    additionalProperties: true,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    /* -------------------- Core plumbing ---------------------------------- */
    logger = createMockLogger();
    validator = new AjvSchemaValidator(logger); // Use REAL validator

    schemaLoader = {
      loadAndCompileAllSchemas: jest.fn().mockImplementation(async () => {
        // Add schemas needed by the loading process to the REAL validator
        try {
          if (!validator.isSchemaLoaded(GAME_SCHEMA_ID))
            await validator.addSchema(gameSchema, GAME_SCHEMA_ID);
          if (!validator.isSchemaLoaded(CONDITION_SCHEMA_ID))
            await validator.addSchema(conditionSchema, CONDITION_SCHEMA_ID);
          if (!validator.isSchemaLoaded(CONDITION_CONTAINER_SCHEMA_ID))
            await validator.addSchema(conditionContainerSchema, CONDITION_CONTAINER_SCHEMA_ID);
          if (!validator.isSchemaLoaded(COMPONENTS_SCHEMA_ID))
            await validator.addSchema(componentsSchema, COMPONENTS_SCHEMA_ID);
          if (!validator.isSchemaLoaded(MOD_MANIFEST_SCHEMA_ID))
            await validator.addSchema(manifestSchema, MOD_MANIFEST_SCHEMA_ID);
          if (!validator.isSchemaLoaded(ENTITY_SCHEMA_ID))
            await validator.addSchema(entitySchema, ENTITY_SCHEMA_ID);
          if (!validator.isSchemaLoaded(ACTION_SCHEMA_ID))
            await validator.addSchema(actionSchema, ACTION_SCHEMA_ID);
          if (!validator.isSchemaLoaded(EVENT_SCHEMA_ID))
            await validator.addSchema(eventSchema, EVENT_SCHEMA_ID);
          if (!validator.isSchemaLoaded(RULE_SCHEMA_ID))
            await validator.addSchema(ruleSchema, RULE_SCHEMA_ID);
          logger.debug('Mock SchemaLoader: Added schemas to REAL validator.');
        } catch (err) {
          logger.error('Error adding schema in mock SchemaLoader:', err);
          throw err; // Prevent test from continuing if schemas fail
        }
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
      dependencies: [{ id: 'MissingMod', version: '^1.0.0', required: true }], // Explicitly required
      content: {},
    };

    fetcher = createMockFetcher(
      { basegame: baseManifest, badmod: badManifest },
      []
    );
    registry = createMockRegistry();

    /* -------------------- Auxiliary loaders ------------------------------ */
    ruleLoader = { loadItemsForMod: jest.fn().mockResolvedValue(0) };
    conditionLoader = {
      loadItemsForMod: jest.fn().mockResolvedValue(0),
    };
    componentDefinitionLoader = {
      loadItemsForMod: jest.fn().mockResolvedValue(0),
    }; // Keep test variable name
    actionLoader = { loadItemsForMod: jest.fn().mockResolvedValue(0) };
    eventLoader = { loadItemsForMod: jest.fn().mockResolvedValue(0) };
    entityLoader = { loadItemsForMod: jest.fn().mockResolvedValue(0) };

    // Mock GameConfigLoader to return the *list* of mod IDs
    gameConfigLoader = {
      loadConfig: jest.fn().mockResolvedValue(['basegame', 'badmod']),
    };

    // <<< ADDED: Mock ValidatedEventDispatcher >>>
    validatedEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(), // Simple mock returning a resolved promise
    };

    /* -------------------- Real ModManifestLoader ------------------------- */
    modManifestLoader = new ModManifestLoader(
      configuration,
      pathResolver,
      fetcher,
      validator, // Pass REAL validator
      registry,
      logger
    );

    /* -------------------- System under test ------------------------------ */
    // <<< FIXED: Pass a single object with named properties >>>
    worldLoader = new WorldLoader({
      registry, // Property name matches variable name
      logger, // Property name matches variable name
      schemaLoader, // Property name matches variable name
      conditionLoader,
      componentLoader: componentDefinitionLoader, // Map test variable to constructor property 'componentLoader'
      ruleLoader, // Property name matches variable name
      actionLoader, // Property name matches variable name
      eventLoader, // Property name matches variable name
      entityLoader, // Property name matches variable name
      validator, // Property name matches variable name
      configuration, // Property name matches variable name
      gameConfigLoader, // Property name matches variable name
      promptTextLoader: { loadPromptText: jest.fn() },
      modManifestLoader, // Property name matches variable name
      validatedEventDispatcher, // <<< Pass the new mock >>>
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
    const contentFetches = fetcher.fetch.mock.calls.filter(
      ([p]) =>
        /\/mods\/[^/]+\/(actions|components|events|system-rules|items|entities|blockers|connections|locations)\//.test(
          p
        ) // Added entity types
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
    expect(entityLoader.loadItemsForMod).not.toHaveBeenCalled(); // <<< ADDED Check

    // Logger assertions
    const errorLogCallArgs = logger.error.mock.calls[0];
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(errorLogCallArgs[0]).toBe(
      'WorldLoader: CRITICAL load failure during world/mod loading sequence.'
    ); // Message
    expect(errorLogCallArgs[1]).toEqual(
      expect.objectContaining({
        // Payload object
        error: expect.any(ModDependencyError),
      })
    );
    expect(errorLogCallArgs[1].error.message).toMatch(
      /Mod 'badmod' requires missing dependency 'MissingMod'/
    ); // Check nested error

    // Registry assertions
    expect(registry.clear).toHaveBeenCalledTimes(2); // Start and catch block
    // Manifests *should* have been stored by ModManifestLoader *before* the dependency check caused the throw
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
    // Final mod order shouldn't be stored
    expect(registry.store).not.toHaveBeenCalledWith(
      'meta',
      'final_mod_order',
      expect.any(Array)
    );

    loadManifestsSpy.mockRestore();
  });
});
