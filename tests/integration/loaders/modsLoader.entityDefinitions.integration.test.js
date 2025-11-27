import { describe, it, expect, beforeAll, jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import ModsLoader from '../../../src/loaders/modsLoader.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import LoaderPhase from '../../../src/loaders/phases/LoaderPhase.js';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { registerLoaders } from '../../../src/dependencyInjection/registrations/loadersRegistrations.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import {
  createMockDataFetcher,
  createMockValidatedEventDispatcherForIntegration,
} from '../../common/mockFactories/index.js';
import modManifestSchema from '../../../data/schemas/mod-manifest.schema.json';
import commonSchema from '../../../data/schemas/common.schema.json';
import entityDefinitionSchema from '../../../data/schemas/entity-definition.schema.json';
import entityInstanceSchema from '../../../data/schemas/entity-instance.schema.json';

// Mock phases for non-essential loading phases
class MockSchemaPhase extends LoaderPhase {
  constructor(logger) {
    super();
    this.logger = logger;
  }
  name = 'MockSchemaPhase';
  async execute(context) {
    // Mock schema phase that does nothing
    return context;
  }
}

class MockGameConfigPhase extends LoaderPhase {
  constructor(logger) {
    super();
    this.logger = logger;
  }
  name = 'MockGameConfigPhase';
  async execute(context) {
    // Mock game config phase that does nothing
    return context;
  }
}

class MockWorldPhase extends LoaderPhase {
  constructor(logger) {
    super();
    this.logger = logger;
  }
  name = 'MockWorldPhase';
  async execute(context) {
    // Mock world phase that does nothing
    return context;
  }
}

class MockSummaryPhase extends LoaderPhase {
  constructor(logger) {
    super();
    this.logger = logger;
  }
  name = 'MockSummaryPhase';
  async execute(context) {
    // Mock summary phase that does nothing
    return context;
  }
}

describe('Integration: Entity Definitions and Instances Loader', () => {
  let registry;
  let modsLoader;
  let logger;
  let loadResult;
  let loadedInstances;

  beforeAll(async () => {
    // Ensure logger is defined first and used everywhere
    logger = new ConsoleLogger('info');
    // Set up DI container and register all loaders as in production
    const container = new AppContainer();
    container.register(tokens.ILogger, logger);
    // Register mock validated event dispatcher
    container.register(
      tokens.IValidatedEventDispatcher,
      createMockValidatedEventDispatcherForIntegration()
    );
    // Register mock safe event dispatcher
    container.register(tokens.ISafeEventDispatcher, { dispatch: jest.fn() });
    // Register mock OperationRegistry (required by RuleLoader via loadersRegistrations)
    container.register(tokens.OperationRegistry, {
      get: jest.fn().mockReturnValue(undefined),
      has: jest.fn().mockReturnValue(false),
      register: jest.fn(),
    });
    // Register all loaders and phases
    registerLoaders(container);
    // Register mock data fetcher AFTER loader registration to overwrite
    container.register(
      tokens.IDataFetcher,
      createMockDataFetcher({ fromDisk: true })
    );
    // Register and load AjvSchemaValidator with schemas
    const schemaValidator = new AjvSchemaValidator({ logger: logger });
    await schemaValidator.addSchema(
      commonSchema,
      'schema://living-narrative-engine/common.schema.json'
    );
    await schemaValidator.addSchema(
      modManifestSchema,
      'schema://living-narrative-engine/mod-manifest.schema.json'
    );
    await schemaValidator.addSchema(
      entityDefinitionSchema,
      'schema://living-narrative-engine/entity-definition.schema.json'
    );
    await schemaValidator.addSchema(
      entityInstanceSchema,
      'schema://living-narrative-engine/entity-instance.schema.json'
    );
    container.register(tokens.ISchemaValidator, schemaValidator);
    // Resolve registry from the container
    registry = container.resolve(tokens.IDataRegistry);

    // Create test phases using the container's dependencies
    const phases = [
      new MockSchemaPhase(logger),
      new MockGameConfigPhase(logger),
      container.resolve(tokens.ManifestPhase),
      container.resolve(tokens.ContentPhase),
      new MockWorldPhase(logger),
      new MockSummaryPhase(logger),
    ];

    // Create a custom session with test phases
    const session = makeSession(phases);

    // Override the ModsLoader registration to use our custom session
    container.register(
      tokens.ModsLoader,
      new ModsLoader({
        logger,
        cache: container.resolve(tokens.ILoadCache),
        session,
        registry,
      })
    );

    modsLoader = container.resolve(tokens.ModsLoader);

    // Load the isekai mod and store data for later assertions
    loadResult = await modsLoader.loadMods('test-world', [MOD_ID]);

    // DEBUG: Log all entity_definitions in the registry after loading
    const allEntities = registry.getAll('entityDefinitions');
    console.log('DEBUG: All entity_definitions in registry:', allEntities);

    // Capture all entity instances for later assertions
    loadedInstances = registry.getAll('entityInstances');
  });

  it('loads mods successfully', () => {
    expect(loadResult).toEqual({
      finalModOrder: ['core', 'descriptors', 'anatomy', 'isekai'],
      totals: expect.any(Object),
      incompatibilities: 0,
    });
  });

  it('captures entity instances during setup', () => {
    const ids = loadedInstances.map((i) => i.instanceId);
    expect(ids).toEqual(
      expect.arrayContaining([
        'isekai:adventurers_guild_instance',
        'isekai:hero_instance',
        'isekai:ninja_instance',
        'isekai:receptionist_instance',
        'isekai:sidekick_instance',
        'isekai:town_instance',
      ])
    );
  });

  const MOD_ID = 'isekai';
  const MODS_BASE_PATH = './data/mods';
  const DEFINITIONS_DIR = path.join(
    MODS_BASE_PATH,
    MOD_ID,
    'entities/definitions'
  );
  const INSTANCES_DIR = path.join(MODS_BASE_PATH, MOD_ID, 'entities/instances');

  it('should load all entity definitions listed in the mod manifest', () => {
    const manifest = JSON.parse(
      fs.readFileSync(
        path.join(MODS_BASE_PATH, MOD_ID, 'mod-manifest.json'),
        'utf8'
      )
    );
    const files = manifest.content.entities?.definitions || [];
    for (const file of files) {
      // Read the entity definition file to get the correct id
      const filePath = path.join(DEFINITIONS_DIR, file);
      const entityData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const entityId = entityData.id;

      const entity = registry.get('entityDefinitions', entityId);
      if (!entity) {
        console.error(
          `DEBUG: Entity not found for file: ${file}, entityId: ${entityId}`
        );
        const allEntities = registry.getAll('entityDefinitions');
        console.error('DEBUG: All entityDefinitions in registry:', allEntities);
      }
      expect(entity).toBeDefined();
      if (entity && entity._sourceFile !== file) {
        console.error(
          `DEBUG: _sourceFile mismatch for entityId: ${entityId}. Expected: ${file}, Actual: ${entity._sourceFile}`
        );
      }
      expect(entity._sourceFile).toBe(file);
    }
  });

  it('should load entity instances if they exist', () => {
    expect(fs.existsSync(INSTANCES_DIR)).toBe(true);

    const files = fs
      .readdirSync(INSTANCES_DIR)
      .filter((f) => f.endsWith('.json'));

    // DEBUG: Log what files we found
    console.log('DEBUG: Found entity instance files:', files);

    // DEBUG: Log all entity instances in registry
    const allInstances = registry.getAll('entityInstances');
    console.log('DEBUG: All entity instances in registry:', allInstances);

    for (const file of files) {
      // Read the entity instance file to get the correct instanceId
      const filePath = path.join(INSTANCES_DIR, file);
      const instanceData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const instanceId = instanceData.instanceId;

      // DEBUG: Log what we're looking for
      console.log(`DEBUG: Looking for entity instance with ID: ${instanceId}`);

      const instance = registry.get('entityInstances', instanceId);
      console.log(`DEBUG: Found instance:`, instance);

      expect(instance).toBeDefined();
      expect(instance._sourceFile).toBe(file);
    }
  });

  it('should not load entity definitions that are not in the manifest', () => {
    // Check for files that exist in the directory but are not in the manifest
    const manifest = JSON.parse(
      fs.readFileSync(
        path.join(MODS_BASE_PATH, MOD_ID, 'mod-manifest.json'),
        'utf8'
      )
    );
    const manifestFiles = new Set(manifest.content.entities?.definitions || []);

    expect(fs.existsSync(DEFINITIONS_DIR)).toBe(true);
    const allFiles = fs
      .readdirSync(DEFINITIONS_DIR)
      .filter((f) => f.endsWith('.json'));
    for (const file of allFiles) {
      if (manifestFiles.has(file)) {
        continue;
      }
      const id = file.replace(/\.json$/, '');
      const fullId = `${MOD_ID}:${id}`;
      const entity = registry.get('entityDefinitions', fullId);
      expect(entity).toBeUndefined();
    }
  });
});

/**
 *
 * @param phases
 */
/**
 * Helper to create a simple loader session that executes the provided phases in
 * order.
 *
 * @param {Array<LoaderPhase>} phases - Phases to execute sequentially.
 * @returns {object} Session with a `run` method used by ModsLoader.
 */
function makeSession(phases) {
  return {
    async run(ctx) {
      let current = ctx;
      for (const phase of phases) {
        current = await phase.execute(current);
      }
      return current;
    },
  };
}
