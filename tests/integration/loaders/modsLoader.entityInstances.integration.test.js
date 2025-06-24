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
  createMockDataFetcher,
  createMockValidatedEventDispatcherForIntegration,
} from '../../common/mockFactories/index.js';
import ManifestPhase from '../../../src/loaders/phases/ManifestPhase.js';
import modManifestSchema from '../../../data/schemas/mod-manifest.schema.json';
import commonSchema from '../../../data/schemas/common.schema.json';
import entityDefinitionSchema from '../../../data/schemas/entity-definition.schema.json';
import entityInstanceSchema from '../../../data/schemas/entity-instance.schema.json';
import WorldInitializer from '../../../src/initializers/worldInitializer.js';
import EntityManager from '../../../src/entities/entityManager.js';
import GameDataRepository from '../../../src/data/gameDataRepository.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';
import ScopeRegistry from '../../../src/scopeDsl/scopeRegistry.js';
import {
  WORLDINIT_ENTITY_INSTANTIATED_ID,
  WORLDINIT_ENTITY_INSTANTIATION_FAILED_ID,
} from '../../../src/constants/eventIds.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';

const testLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};
const mockEventBus = {
  dispatch: () => {},
  subscribe: () => {},
  unsubscribe: () => {},
};

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
  const WORLD_FILE = path.join(
    MODS_BASE_PATH,
    MOD_ID,
    'worlds/isekai.world.json'
  );

  beforeAll(async () => {
    logger = new ConsoleLogger('info');
    container = new AppContainer();
    container.register(tokens.ILogger, logger);
    validatedEventDispatcher =
      createMockValidatedEventDispatcherForIntegration();
    container.register(
      tokens.IValidatedEventDispatcher,
      validatedEventDispatcher
    );
    registerLoaders(container);
    container.register(
      tokens.IDataFetcher,
      createMockDataFetcher({ fromDisk: true })
    );
    const schemaValidator = new AjvSchemaValidator(logger);
    await schemaValidator.addSchema(
      commonSchema,
      'http://example.com/schemas/common.schema.json'
    );
    await schemaValidator.addSchema(
      modManifestSchema,
      'http://example.com/schemas/mod-manifest.schema.json'
    );
    await schemaValidator.addSchema(
      entityDefinitionSchema,
      'http://example.com/schemas/entity-definition.schema.json'
    );
    await schemaValidator.addSchema(
      entityInstanceSchema,
      'http://example.com/schemas/entity-instance.schema.json'
    );
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

    const mockRepository = {
      getWorld: jest.fn(() => worldData),
      getEntityInstanceDefinition: jest.fn((instanceId) =>
        registry.get('entityInstances', instanceId)
      ),
      getEntityDefinition: jest.fn(
        (defId) =>
          registry.get('entityDefinitions', defId) ||
          new EntityDefinition(defId, { components: {} })
      ),
      getComponentDefinition: jest.fn(() => ({})),
      get: jest.fn().mockReturnValue({}), // For scopeRegistry.initialize
    };

    const mockValidatedEventDispatcher =
      createMockValidatedEventDispatcherForIntegration();
    const entityManager = new EntityManager({
      logger: testLogger,
      registry,
      dispatcher: mockValidatedEventDispatcher,
      validator: { validate: () => ({ isValid: true }) },
    });
    const mockWorldContext = {};
    const mockScopeRegistry = new ScopeRegistry({ logger: testLogger });

    const worldInitializer = new WorldInitializer({
      entityManager,
      worldContext: mockWorldContext,
      gameDataRepository: mockRepository,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      logger: testLogger,
      scopeRegistry: mockScopeRegistry,
    });

    const result = await worldInitializer.initializeWorldEntities(worldName);

    const expectedInstanceCount = worldData.instances.filter(
      (inst) => inst && inst.instanceId
    ).length;
    expect(result.instantiatedCount).toBe(expectedInstanceCount);
    expect(result.failedCount).toBe(0);
    expect(result.totalProcessed).toBe(worldData.instances.length);
    expect(result.entities).toBeInstanceOf(Array);
    expect(result.entities.length).toBe(expectedInstanceCount);
  });

  it('should not throw, log warning, and dispatch system error if a referenced instance definition is missing', async () => {
    const originalWorldData = JSON.parse(fs.readFileSync(WORLD_FILE, 'utf8'));
    const worldName = originalWorldData.id;
    const missingInstanceId = 'isekai:instance_with_missing_definition';

    const modifiedWorldData = JSON.parse(JSON.stringify(originalWorldData));
    modifiedWorldData.instances.push({
      instanceId: missingInstanceId,
      definitionId: 'core:character',
    });

    const mockRepository = {
      getWorld: jest.fn(() => modifiedWorldData),
      getEntityInstanceDefinition: jest.fn((instanceId) => {
        if (instanceId === missingInstanceId) {
          return undefined; // Simulate this specific instance definition is missing
        }
        return registry.get('entityInstances', instanceId);
      }),
      getEntityDefinition: jest.fn(
        (defId) =>
          registry.get('entityDefinitions', defId) ||
          new EntityDefinition(defId, { components: {} })
      ),
      getComponentDefinition: jest.fn(() => ({})),
      get: jest.fn().mockReturnValue({}), // For scopeRegistry.initialize
    };

    const localMockValidatedEventDispatcher =
      createMockValidatedEventDispatcherForIntegration();
    const warnSpy = jest.spyOn(testLogger, 'warn');
    const dispatchSpy = jest.spyOn(
      localMockValidatedEventDispatcher,
      'dispatch'
    );

    const entityManager = new EntityManager({
      logger: testLogger,
      registry,
      dispatcher: localMockValidatedEventDispatcher,
      validator: { validate: () => ({ isValid: true }) },
    });
    const mockWorldContext = {};
    const mockScopeRegistry = new ScopeRegistry({ logger: testLogger });

    const worldInitializer = new WorldInitializer({
      entityManager,
      worldContext: mockWorldContext,
      gameDataRepository: mockRepository,
      validatedEventDispatcher: localMockValidatedEventDispatcher,
      logger: testLogger,
      scopeRegistry: mockScopeRegistry,
    });

    const result = await worldInitializer.initializeWorldEntities(worldName);

    // Expected successful instances are those from the original world data that are valid
    const originalInstanceEntries =
      JSON.parse(fs.readFileSync(WORLD_FILE, 'utf8')).instances || [];
    const expectedSuccessfulInstances = originalInstanceEntries.filter(
      (inst) => inst && inst.instanceId
    ).length;

    expect(result.instantiatedCount).toBe(expectedSuccessfulInstances);
    expect(result.entities.length).toBe(expectedSuccessfulInstances);
    expect(result.failedCount).toBe(1);
    expect(result.totalProcessed).toBe(modifiedWorldData.instances.length);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        `WorldInitializer (Pass 1): Entity instance definition not found for instance ID: '${missingInstanceId}'. Referenced in world '${worldName}'. Skipping.`
      )
    );

    // Find the specific call for SYSTEM_ERROR_OCCURRED_ID
    const systemErrorCall = dispatchSpy.mock.calls.find(
      (call) => call[0] === SYSTEM_ERROR_OCCURRED_ID
    );

    expect(systemErrorCall).toBeDefined(); // Ensure the event was dispatched

    if (systemErrorCall) {
      expect(systemErrorCall[1]).toEqual(
        expect.objectContaining({
          message: `Entity instance definition not found for instance ID: '${missingInstanceId}'. Referenced in world '${worldName}'.`,
          details: expect.objectContaining({
            statusCode: 404,
            raw: `Context: WorldInitializer._instantiateEntitiesFromWorld, instanceId: ${missingInstanceId}, worldName: ${worldName}`,
            type: 'MissingResource',
            resourceType: 'EntityInstanceDefinition',
            resourceId: missingInstanceId,
          }),
        })
      );
      expect(systemErrorCall[2]).toBeUndefined(); // safeDispatchError doesn't pass a third arg by default
    }

    warnSpy.mockRestore();
    dispatchSpy.mockRestore();
  });
});

describe('Integration: EntityInstance componentOverrides are respected during world initialization', () => {
  const MODS_BASE_PATH_LOCAL = './data/mods';
  const MOD_ID_LOCAL = 'isekai';
  const WORLD_FILE_LOCAL = path.join(
    MODS_BASE_PATH_LOCAL,
    MOD_ID_LOCAL,
    'worlds/isekai.world.json'
  );

  let localContainer;
  let localRegistry;
  let localLogger;
  let localMockValidatedEventDispatcher;
  // Intentionally not using 'container' or 'registry' from outer scope due to ReferenceErrors in this nested describe.

  beforeAll(async () => {
    localLogger = new ConsoleLogger('info'); // Or use testLogger if preferred and it's in scope
    localContainer = new AppContainer();
    localContainer.register(tokens.ILogger, localLogger);

    localMockValidatedEventDispatcher =
      createMockValidatedEventDispatcherForIntegration();
    localContainer.register(
      tokens.IValidatedEventDispatcher,
      localMockValidatedEventDispatcher
    );

    registerLoaders(localContainer); // Registers ManifestPhase, ContentPhase, etc.
    localContainer.register(
      tokens.IDataFetcher,
      createMockDataFetcher({ fromDisk: true })
    );

    const schemaValidator = new AjvSchemaValidator(localLogger);
    // Add all necessary schemas (ensure these paths are correct relative to this file or adjust)
    await schemaValidator.addSchema(
      commonSchema,
      'http://example.com/schemas/common.schema.json'
    );
    await schemaValidator.addSchema(
      modManifestSchema,
      'http://example.com/schemas/mod-manifest.schema.json'
    );
    await schemaValidator.addSchema(
      entityDefinitionSchema,
      'http://example.com/schemas/entity-definition.schema.json'
    );
    await schemaValidator.addSchema(
      entityInstanceSchema,
      'http://example.com/schemas/entity-instance.schema.json'
    );
    // Add any other schemas that might be needed by the loaded content
    localContainer.register(tokens.ISchemaValidator, schemaValidator);

    localRegistry = localContainer.resolve(tokens.IDataRegistry);
    if (!localRegistry) {
      throw new Error(
        'Failed to resolve localRegistry in componentOverrides beforeAll'
      );
    }

    // Load the 'isekai' mod data into localRegistry
    // Mock phases might not be strictly necessary if we only care about specific content types
    // and their loaders (EntityDefinitionLoader, EntityInstanceLoader) work correctly.
    const phases = [
      new MockSchemaPhase(localLogger), // Assuming these mock phases are defined in the file
      new MockGameConfigPhase(localLogger),
      localContainer.resolve(tokens.ManifestPhase),
      localContainer.resolve(tokens.ContentPhase), // This phase loads entity defs/instances
      new MockWorldPhase(localLogger),
      new MockSummaryPhase(localLogger),
    ];
    const session = makeSession(phases); // makeSession must be accessible

    const modsLoaderForTest = new ModsLoader({
      logger: localLogger,
      cache: localContainer.resolve(tokens.ILoadCache),
      session,
      registry: localRegistry,
    });

    // Using a different worldId for this isolated load to avoid potential conflicts if any global state existed.
    const loadResult = await modsLoaderForTest.loadMods('test-world-co', [
      MOD_ID_LOCAL,
    ]);
    if (loadResult.incompatibilities > 0) {
      console.warn(
        'Component Overrides Test: Incompatibilities found during isolated mod load:',
        loadResult
      );
    }
    // Verify that entity instances are loaded, e.g. for 'isekai:hero_override_pos'
    // const heroOverride = localRegistry.get('entityInstances', 'isekai:hero_override_pos');
    // if (!heroOverride) {
    //   console.warn("Component Overrides Test: isekai:hero_override_pos not found in localRegistry after load. Check mod content and loader paths.");
    // }
  });

  it('should create entities with per-instance core:position from componentOverrides', async () => {
    if (!localRegistry) {
      throw new Error(
        'localRegistry is undefined in componentOverrides test. Check nested beforeAll setup.'
      );
    }
    if (!localContainer) {
      throw new Error(
        'localContainer is undefined in componentOverrides test. Check nested beforeAll setup.'
      );
    }

    const worldData = JSON.parse(fs.readFileSync(WORLD_FILE_LOCAL, 'utf8'));
    const worldName = worldData.id;

    const mockRepository = {
      getWorld: jest.fn(() => worldData),
      getEntityInstanceDefinition: jest.fn((instanceId) =>
        localRegistry.get('entityInstances', instanceId)
      ),
      getEntityDefinition: jest.fn((defId) => {
        const def = localRegistry.get('entityDefinitions', defId);
        if (def) return def;
        // Fallback for definitions not found in the 'isekai' mod but potentially referenced
        return new EntityDefinition(defId, {
          components: {
            'core:position': { locationId: 'default-definition-location' },
          },
        });
      }),
      getComponentDefinition: jest.fn(() => ({})), // Assuming component definitions are not the focus here
      get: jest.fn().mockReturnValue({}), // For scopeRegistry.initialize
    };

    // Use a fresh mock dispatcher for this test if desired, or the one from beforeAll.
    const currentTestDispatcher =
      createMockValidatedEventDispatcherForIntegration();
    const entityManager = new EntityManager({
      logger: testLogger, // Can use global testLogger or localLogger
      registry: localRegistry,
      dispatcher: currentTestDispatcher,
      validator: { validate: () => ({ isValid: true }) },
    });
    const mockWorldContext = {};
    const mockScopeRegistry = new ScopeRegistry({ logger: testLogger }); // Or localLogger

    const worldInitializer = new WorldInitializer({
      entityManager,
      worldContext: mockWorldContext,
      gameDataRepository: mockRepository,
      validatedEventDispatcher: currentTestDispatcher,
      logger: testLogger, // Or localLogger
      scopeRegistry: mockScopeRegistry,
    });

    const result = await worldInitializer.initializeWorldEntities(worldName);

    const expectedInstanceCount = worldData.instances.filter(
      (inst) => inst && inst.instanceId
    ).length;
    expect(result.instantiatedCount).toBe(expectedInstanceCount);
    expect(result.failedCount).toBe(0);
    expect(result.totalProcessed).toBe(worldData.instances.length);
    expect(result.entities.length).toBe(expectedInstanceCount);

    for (const entity of result.entities) {
      expect(entity.id).toBeDefined(); // Entity id should be defined
      const pos = entity.getComponentData('core:position');

      const sourceInstanceDef = localRegistry.get('entityInstances', entity.id); // From .instance.json
      expect(sourceInstanceDef).toBeDefined(); // Instance definition for ${entity.id} should exist in localRegistry.

      const baseEntityDef = entity.instanceData.definition; // Actual base .definition.json used by the entity instance
      expect(baseEntityDef).toBeDefined(); // Base entity definition for ${entity.definitionId} (linked to instance ${entity.id}) should exist.

      const hasOverridePosition =
        sourceInstanceDef.componentOverrides &&
        sourceInstanceDef.componentOverrides['core:position'];
      const hasBasePosition =
        baseEntityDef.components && baseEntityDef.components['core:position'];

      if (hasOverridePosition) {
        // Entity should have core:position from its instance override
        expect(pos).toBeTruthy(); // Entity ${entity.id} (Def: ${entity.definitionId}) should have core:position from override.
        if (pos) {
          // Type guard
          expect(pos.locationId).toBe(
            sourceInstanceDef.componentOverrides['core:position'].locationId
          ); // Entity ${entity.id} core:position.locationId from override should match.
        }
      } else if (hasBasePosition) {
        // Entity should have core:position from its base definition
        expect(pos).toBeTruthy(); // Entity ${entity.id} (Def: ${entity.definitionId}) should have core:position from base definition.
        if (pos) {
          // Type guard
          expect(pos.locationId).toBe(
            baseEntityDef.components['core:position'].locationId
          ); // Entity ${entity.id} core:position.locationId from base definition should match.
        }
      } else {
        // Entity is not expected to have core:position from override or base
        expect(pos).toBeUndefined(); // Entity ${entity.id} (Def: ${entity.definitionId}) should NOT have core:position if not in overrides or base definition.
      }
    }
  });
});

/**
 * Helper function to create a session object for ModsLoader.
 *
 * @param {LoaderPhase[]} phases - Array of loader phases.
 * @returns {{run: (function(object): Promise<object>)}} Session object.
 */
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
