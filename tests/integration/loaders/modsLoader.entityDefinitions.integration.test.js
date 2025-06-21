import { describe, it, expect, beforeAll } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import ModsLoader from '../../../src/loaders/modsLoader.js';
import createDefaultContentLoadersConfig from '../../../src/loaders/defaultLoaderConfig.js';
import StaticConfiguration from '../../../src/configuration/staticConfiguration.js';
import DefaultPathResolver from '../../../src/pathing/defaultPathResolver.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import WorkspaceDataFetcher from '../../../src/data/workspaceDataFetcher.js';
import EntityDefinitionLoader from '../../../src/loaders/entityDefinitionLoader.js';
import EntityInstanceLoader from '../../../src/loaders/entityInstanceLoader.js';
import ContentLoadManager from '../../../src/loaders/ContentLoadManager.js';
import ContentPhase from '../../../src/loaders/phases/contentPhase.js';
import LoaderPhase from '../../../src/loaders/phases/LoaderPhase.js';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { registerLoaders } from '../../../src/dependencyInjection/registrations/loadersRegistrations.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import {
  createMockDataFetcherForIntegration,
  createMockValidatedEventDispatcherForIntegration,
} from '../../common/mockFactories/index.js';

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

class MockManifestPhase extends LoaderPhase {
  constructor(logger) {
    super();
    this.logger = logger;
  }
  name = 'MockManifestPhase';
  async execute(context) {
    // Mock manifest phase that sets up the mod context
    const MOD_ID = 'isekai';
    const MODS_BASE_PATH = './data/mods';
    const manifestPath = path.join(MODS_BASE_PATH, MOD_ID, 'mod-manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    return {
      ...context,
      finalModOrder: ['isekai'],
      totals: { entityDefinitions: 4, entityInstances: 0 },
      manifests: new Map([[MOD_ID, manifest]]),
    };
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
    // Register all loaders and phases
    registerLoaders(container);
    // Register mock data fetcher AFTER loader registration to overwrite
    container.register(
      tokens.IDataFetcher,
      createMockDataFetcherForIntegration()
    );
    // Resolve registry from the container
    registry = container.resolve(tokens.IDataRegistry);

    // Create test phases using the container's dependencies
    const phases = [
      new MockSchemaPhase(logger),
      new MockGameConfigPhase(logger),
      new MockManifestPhase(logger),
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

    // Load the isekai mod
    const result = await modsLoader.loadMods('test-world', [MOD_ID]);

    // Verify the returned LoadReport
    expect(result).toEqual({
      finalModOrder: ['isekai'],
      totals: expect.any(Object),
      incompatibilities: 0,
    });

    // DEBUG: Log all entity_definitions in the registry after loading
    const allEntities = registry.getAll('entityDefinitions');
    console.log('DEBUG: All entity_definitions in registry:', allEntities);
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
    const files = manifest.content.entityDefinitions || [];
    for (const file of files) {
      const id = file.replace(/\.json$/, '');
      const entityId =
        {
          'hero.character.json': 'isekai:hero',
          'sidekick.character.json': 'isekai:sidekick',
          'adventurers_guild.location.json': 'isekai:adventurers_guild',
          'town.location.json': 'isekai:town',
        }[file] || `isekai:${id}`;

      const entity = registry.get('entityDefinitions', entityId);
      expect(entity).toBeDefined();
      expect(entity._sourceFile).toBe(file);
    }
  });

  it('should load entity instances if they exist', () => {
    // Check if instances directory exists
    if (fs.existsSync(INSTANCES_DIR)) {
      const files = fs
        .readdirSync(INSTANCES_DIR)
        .filter((f) => f.endsWith('.json'));
      for (const file of files) {
        const id = file.replace(/\.json$/, '');
        const fullId = `${MOD_ID}:${id}`;
        const instance = registry.get('entityInstances', fullId);
        expect(instance).toBeDefined();
        expect(instance._sourceFile).toBe(file);
      }
    } else {
      // If no instances directory, that's fine - just pass the test
      expect(true).toBe(true);
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
    const manifestFiles = new Set(manifest.content.entityDefinitions || []);

    if (fs.existsSync(DEFINITIONS_DIR)) {
      const allFiles = fs
        .readdirSync(DEFINITIONS_DIR)
        .filter((f) => f.endsWith('.json'));
      for (const file of allFiles) {
        if (!manifestFiles.has(file)) {
          const id = file.replace(/\.json$/, '');
          const fullId = `${MOD_ID}:${id}`;
          const entity = registry.get('entityDefinitions', fullId);
          expect(entity).toBeUndefined();
        }
      }
    }
  });
});

/**
 *
 * @param phases
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
