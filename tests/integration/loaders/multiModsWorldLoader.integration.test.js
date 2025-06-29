import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  createMockLogger,
  createMockDataFetcher,
  createMockConfiguration,
  createMockPathResolver,
  createMockSchemaValidator,
} from '../../common/mockFactories/index.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import EntityDefinitionLoader from '../../../src/loaders/entityDefinitionLoader.js';
import EntityInstanceLoader from '../../../src/loaders/entityInstanceLoader.js';
import WorldLoader from '../../../src/loaders/worldLoader.js';
import ContentLoadManager from '../../../src/loaders/ContentLoadManager.js';
import { createContentLoadersConfig } from '../../../src/loaders/defaultLoaderConfig.js';

/**
 * Builds a loader environment using provided mock fetch responses.
 *
 * @param {Record<string, any>} pathToResponse - Mapping of resolved paths to
 *   JSON data returned by the mock fetcher.
 * @returns {{logger:any, registry:InMemoryDataRegistry,
 *   manager:ContentLoadManager, worldLoader:WorldLoader}} Test utilities.
 */
function buildEnv(pathToResponse) {
  const logger = createMockLogger();
  const config = createMockConfiguration();
  const resolver = createMockPathResolver();
  const fetcher = createMockDataFetcher({ pathToResponse });
  const schemaValidator = createMockSchemaValidator();
  schemaValidator.isSchemaLoaded.mockReturnValue(true);
  const registry = new InMemoryDataRegistry({ logger });
  const defLoader = new EntityDefinitionLoader(
    config,
    resolver,
    fetcher,
    schemaValidator,
    registry,
    logger
  );
  const instLoader = new EntityInstanceLoader(
    config,
    resolver,
    fetcher,
    schemaValidator,
    registry,
    logger
  );
  const worldLoader = new WorldLoader(
    config,
    resolver,
    fetcher,
    schemaValidator,
    registry,
    logger
  );
  const contentLoadersConfig = createContentLoadersConfig({
    entityDefinitions: defLoader,
    entityInstances: instLoader,
  });
  const dispatcher = { dispatch: jest.fn().mockResolvedValue() };
  const manager = new ContentLoadManager({
    logger,
    validatedEventDispatcher: dispatcher,
    contentLoadersConfig,
  });
  return { logger, registry, manager, worldLoader };
}

/** Minimal mod manifests used across tests */
const modAManifest = {
  id: 'modA',
  name: 'A',
  content: {
    entities: {
      definitions: ['hero.def.json'],
      instances: ['hero.inst.json'],
    },
    worlds: ['a.world.json'],
  },
};

const modBManifest = {
  id: 'modB',
  name: 'B',
  content: {
    entities: {
      definitions: ['villain.def.json'],
      instances: ['villain.inst.json'],
    },
    worlds: ['b.world.json'],
  },
};

describe('Multi-mod content loading and world validation', () => {
  let pathToResponse;
  let env;
  let manifests;
  const finalOrder = ['modA', 'modB'];

  beforeEach(() => {
    pathToResponse = {
      // Mod manifests
      'mods/modA/mod-manifest.json': modAManifest,
      'mods/modB/mod-manifest.json': modBManifest,
      // Definitions
      'mods/modA/entities/definitions/hero.def.json': {
        id: 'hero',
        components: {},
      },
      'mods/modB/entities/definitions/villain.def.json': {
        id: 'villain',
        components: {},
      },
      // Instances
      'mods/modA/entities/instances/hero.inst.json': {
        instanceId: 'hero_instance',
        definitionId: 'hero',
      },
      'mods/modB/entities/instances/villain.inst.json': {
        instanceId: 'villain_instance',
        definitionId: 'villain',
      },
      // Worlds
      'mods/modA/worlds/a.world.json': {
        id: 'modA:world',
        instances: [{ instanceId: 'modA:hero_instance' }],
      },
      'mods/modB/worlds/b.world.json': {
        id: 'modB:world',
        instances: [{ instanceId: 'modB:villain_instance' }],
      },
    };
    env = buildEnv(pathToResponse);
    manifests = new Map([
      ['moda', modAManifest],
      ['modb', modBManifest],
    ]);
  });

  it('aggregates definitions, instances, and worlds from all mods', async () => {
    const totals = {};
    await env.manager.loadContent(finalOrder, manifests, totals);
    await env.worldLoader.loadWorlds(finalOrder, manifests, totals);

    expect(env.registry.getAll('entityDefinitions').length).toBe(2);
    expect(env.registry.getAll('entityInstances').length).toBe(2);
    expect(env.registry.getAll('worlds').length).toBe(2);

    expect(env.registry.get('entityDefinitions', 'modA:hero')).toBeDefined();
    expect(env.registry.get('entityDefinitions', 'modB:villain')).toBeDefined();
    expect(
      env.registry.get('entityInstances', 'modA:hero_instance')
    ).toBeDefined();
    expect(
      env.registry.get('entityInstances', 'modB:villain_instance')
    ).toBeDefined();
    expect(env.registry.get('worlds', 'modA:world')).toBeDefined();
    expect(env.registry.get('worlds', 'modB:world')).toBeDefined();
  });

  it('detects duplicate instance ids and missing world references', async () => {
    // Add a duplicate instance within modA and a world referencing a missing instance in modB
    pathToResponse['mods/modA/entities/instances/dup.inst.json'] = {
      instanceId: 'hero_instance',
      definitionId: 'hero',
    };
    modAManifest.content.entities.instances.push('dup.inst.json');

    pathToResponse['mods/modB/worlds/b.world.json'] = {
      id: 'modB:world',
      instances: [{ instanceId: 'modB:missing_instance' }],
    };
    env = buildEnv(pathToResponse);
    manifests = new Map([
      ['moda', modAManifest],
      ['modb', modBManifest],
    ]);

    const totals = {};
    await env.manager.loadContent(finalOrder, manifests, totals);

    // The duplicate instance should cause an error (not a warning)
    expect(totals.entityInstances?.errors).toBe(1);

    await env.worldLoader.loadWorlds(finalOrder, manifests, totals);
    expect(totals.worlds.errors).toBe(1);
  });

  it('handles large numbers of files', async () => {
    const bigModId = 'big';
    const defFiles = [];
    const instFiles = [];
    for (let i = 0; i < 50; i++) {
      const defFile = `d${i}.json`;
      const instFile = `i${i}.json`;
      defFiles.push(defFile);
      instFiles.push(instFile);
      pathToResponse[`mods/${bigModId}/entities/definitions/${defFile}`] = {
        id: `e${i}`,
        components: {},
      };
      pathToResponse[`mods/${bigModId}/entities/instances/${instFile}`] = {
        instanceId: `e${i}_instance`,
        definitionId: `e${i}`,
      };
    }
    pathToResponse[`mods/${bigModId}/mod-manifest.json`] = {
      id: bigModId,
      name: 'big',
      content: {
        entities: { definitions: defFiles, instances: instFiles },
        worlds: [],
      },
    };
    manifests.set(
      bigModId.toLowerCase(),
      pathToResponse[`mods/${bigModId}/mod-manifest.json`]
    );
    const order = [...finalOrder, bigModId];
    env = buildEnv(pathToResponse);

    const totals = {};
    await env.manager.loadContent(order, manifests, totals);

    expect(env.registry.getAll('entityDefinitions').length).toBe(2 + 50);
    expect(env.registry.getAll('entityInstances').length).toBe(2 + 50);
  });
});
