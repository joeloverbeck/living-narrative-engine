import { describe, it, expect, beforeAll, jest } from '@jest/globals';
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
import ManifestPhase from '../../../src/loaders/phases/ManifestPhase.js';
import modManifestSchema from '../../../data/schemas/mod-manifest.schema.json';
import commonSchema from '../../../data/schemas/common.schema.json';
import entityDefinitionSchema from '../../../data/schemas/entity-definition.schema.json';
import entityInstanceSchema from '../../../data/schemas/entity-instance.schema.json';
import WorldInitializer from '../../../src/initializers/worldInitializer.js';

// Mock phases for non-essential loading phases
class MockSchemaPhase extends LoaderPhase {
  constructor(logger) {
    super();
    this.logger = logger;
  }
  name = 'MockSchemaPhase';
  async execute(context) {
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
    return context;
  }
}

describe('Integration: Entity Instances Loader and World Initialization', () => {
  let registry;
  let modsLoader;
  let logger;
  let container;
  let validatedEventDispatcher;

  const MOD_ID = 'isekai';
  const MODS_BASE_PATH = './data/mods';
  const INSTANCES_DIR = path.join(MODS_BASE_PATH, MOD_ID, 'entities/instances');
  const WORLD_FILE = path.join(MODS_BASE_PATH, MOD_ID, 'worlds/isekai.world.json');

  beforeAll(async () => {
    logger = new ConsoleLogger('info');
    container = new AppContainer();
    container.register(tokens.ILogger, logger);
    validatedEventDispatcher = createMockValidatedEventDispatcherForIntegration();
    container.register(tokens.IValidatedEventDispatcher, validatedEventDispatcher);
    registerLoaders(container);
    container.register(tokens.IDataFetcher, createMockDataFetcherForIntegration());
    const schemaValidator = new AjvSchemaValidator(logger);
    await schemaValidator.addSchema(commonSchema, 'http://example.com/schemas/common.schema.json');
    await schemaValidator.addSchema(modManifestSchema, 'http://example.com/schemas/mod-manifest.schema.json');
    await schemaValidator.addSchema(entityDefinitionSchema, 'http://example.com/schemas/entity-definition.schema.json');
    await schemaValidator.addSchema(entityInstanceSchema, 'http://example.com/schemas/entity-instance.schema.json');
    container.register(tokens.ISchemaValidator, schemaValidator);
    registry = container.resolve(tokens.IDataRegistry);
    
    const phases = [
      new MockSchemaPhase(logger),
      new MockGameConfigPhase(logger),
      container.resolve(tokens.ManifestPhase),
      container.resolve(tokens.ContentPhase),
      new MockWorldPhase(logger),
      new MockSummaryPhase(logger),
    ];
    const session = makeSession(phases);
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
    const result = await modsLoader.loadMods('test-world', [MOD_ID]);
    expect(result).toEqual({
      finalModOrder: expect.arrayContaining(['core', 'isekai']),
      totals: expect.any(Object),
      incompatibilities: 0,
    });
  });

  it('should load all entity instances listed in the mod manifest and make them retrievable', () => {
    const manifest = JSON.parse(
      fs.readFileSync(
        path.join(MODS_BASE_PATH, MOD_ID, 'mod-manifest.json'),
        'utf8'
      )
    );
    const files = manifest.content.entities?.instances || [];
    
    for (const file of files) {
      const filePath = path.join(INSTANCES_DIR, file);
      const instanceData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const instanceId = instanceData.instanceId;
      
      const instance = registry.get('entityInstances', instanceId);
      
      expect(instance).toBeDefined();
      expect(instance.instanceId).toBe(instanceId);
    }
  });

  it('should allow WorldInitializer to instantiate all world instances when all are present', async () => {
    const worldData = JSON.parse(fs.readFileSync(WORLD_FILE, 'utf8'));
    const worldName = worldData.id;
    
    // Create a mock repository with the required methods
    const mockRepository = {
      getWorld: jest.fn(() => worldData),
      getEntityInstanceDefinition: jest.fn((instanceId) => registry.get('entityInstances', instanceId)),
      getEntityDefinition: jest.fn(() => ({})),
      getComponentDefinition: jest.fn(() => ({})),
    };
    
    const worldInitializer = new WorldInitializer({
      entityManager: { createEntityInstance: jest.fn(() => ({ id: 'dummy', definitionId: 'dummyDef' })) },
      worldContext: {},
      gameDataRepository: mockRepository,
      validatedEventDispatcher,
      logger,
      spatialIndexManager: { addEntity: jest.fn() },
    });
    const result = await worldInitializer.initializeWorldEntities(worldName);
    expect(result).toBe(true);
  });

  it('should throw and dispatch error if a referenced instance is missing', async () => {
    // Clone world data and remove one instance from registry
    const worldData = JSON.parse(fs.readFileSync(WORLD_FILE, 'utf8'));
    const worldName = worldData.id;
    const missingInstanceId = worldData.instances[0].instanceId;
    
    // Create a mock repository that returns undefined for the missing instance
    const mockRepository = {
      getWorld: jest.fn(() => worldData),
      getEntityInstanceDefinition: jest.fn((instanceId) => 
        instanceId === missingInstanceId ? undefined : registry.get('entityInstances', instanceId)
      ),
      getEntityDefinition: jest.fn(() => ({})),
      getComponentDefinition: jest.fn(() => ({})),
    };
    
    const worldInitializer = new WorldInitializer({
      entityManager: { createEntityInstance: jest.fn(() => ({ id: 'dummy', definitionId: 'dummyDef' })) },
      worldContext: {},
      gameDataRepository: mockRepository,
      validatedEventDispatcher,
      logger,
      spatialIndexManager: { addEntity: jest.fn() },
    });
    await expect(worldInitializer.initializeWorldEntities(worldName)).rejects.toThrow(
      /not found/i
    );
  });
});

function makeSession(phases) {
  return {
    async run(ctx) {
      let context = ctx;
      for (const phase of phases) {
        context = await phase.execute(context);
      }
      return context;
    },
  };
} 