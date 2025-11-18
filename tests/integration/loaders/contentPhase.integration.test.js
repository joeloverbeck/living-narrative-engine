import { describe, it, expect, beforeEach } from '@jest/globals';
import { jest } from '@jest/globals';
import ContentPhase from '../../../src/loaders/phases/contentPhase.js';
import ContentLoadManager from '../../../src/loaders/ContentLoadManager.js';
import LoadResultAggregator from '../../../src/loaders/LoadResultAggregator.js';
import { createContentLoadersConfig } from '../../../src/loaders/defaultLoaderConfig.js';
import EntityDefinitionLoader from '../../../src/loaders/entityDefinitionLoader.js';
import EntityInstanceLoader from '../../../src/loaders/entityInstanceLoader.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import {
  createMockLogger,
  createMockConfiguration,
  createMockPathResolver,
  createMockDataFetcher,
  createMockSchemaValidator,
} from '../../common/mockFactories/index.js';
import {
  ModsLoaderErrorCode,
  ModsLoaderPhaseError,
} from '../../../src/errors/modsLoaderPhaseError.js';

/**
 *
 * @param pathToResponse
 * @param ManagerClass
 */
function buildContentPhaseEnv(pathToResponse, ManagerClass = ContentLoadManager) {
  const logger = createMockLogger();
  const configuration = createMockConfiguration();
  const pathResolver = createMockPathResolver();
  const dataFetcher = createMockDataFetcher({ pathToResponse });
  const schemaValidator = createMockSchemaValidator();
  schemaValidator.isSchemaLoaded.mockReturnValue(true);
  const registry = new InMemoryDataRegistry({ logger });

  const definitionLoader = new EntityDefinitionLoader(
    configuration,
    pathResolver,
    dataFetcher,
    schemaValidator,
    registry,
    logger
  );

  const instanceLoader = new EntityInstanceLoader(
    configuration,
    pathResolver,
    dataFetcher,
    schemaValidator,
    registry,
    logger
  );

  const contentLoadersConfig = createContentLoadersConfig({
    entityDefinitions: definitionLoader,
    entityInstances: instanceLoader,
  });

  const dispatcher = { dispatch: jest.fn().mockResolvedValue() };
  const manager = new ManagerClass({
    logger,
    validatedEventDispatcher: dispatcher,
    contentLoadersConfig,
    aggregatorFactory: (counts) => new LoadResultAggregator(counts),
  });

  const phase = new ContentPhase({ manager, logger });

  return {
    phase,
    manager,
    registry,
    logger,
  };
}

const modAManifest = {
  id: 'modA',
  name: 'Mod A',
  content: {
    entities: {
      definitions: ['hero.def.json'],
      instances: ['hero.inst.json'],
    },
  },
};

const modBManifest = {
  id: 'modB',
  name: 'Mod B',
  content: {
    entities: {
      definitions: ['villain.def.json'],
      instances: ['villain.inst.json'],
    },
  },
};

describe('ContentPhase integration', () => {
  let manifests;
  let finalOrder;
  let pathToResponse;

  beforeEach(() => {
    finalOrder = Object.freeze(['modA', 'modB']);
    manifests = Object.freeze(
      new Map([
        ['moda', modAManifest],
        ['modb', modBManifest],
      ])
    );

    pathToResponse = {
      'mods/modA/entities/definitions/hero.def.json': {
        id: 'hero',
        components: {},
      },
      'mods/modA/entities/instances/hero.inst.json': {
        instanceId: 'hero_instance',
        definitionId: 'hero',
      },
      'mods/modB/entities/definitions/villain.def.json': {
        id: 'villain',
        components: {},
      },
      'mods/modB/entities/instances/villain.inst.json': {
        instanceId: 'villain_instance',
        definitionId: 'villain',
      },
    };
  });

  it('loads mod content through ContentLoadManager and returns an immutable context snapshot', async () => {
    const { phase, registry } = buildContentPhaseEnv(pathToResponse);

    const initialTotals = Object.freeze({
      entityDefinitions: { count: 0, overrides: 0, errors: 0 },
      entityInstances: { count: 0, overrides: 0, errors: 0 },
    });

    const ctx = Object.freeze({
      worldName: 'integrationWorld',
      requestedMods: finalOrder,
      finalModOrder: finalOrder,
      manifests,
      totals: initialTotals,
      registry,
    });

    const result = await phase.execute(ctx);

    expect(Object.isFrozen(result)).toBe(true);
    expect(result.totals).not.toBe(initialTotals);
    expect(result.totals).toEqual({
      entityDefinitions: { count: 2, overrides: 0, errors: 0, failures: [] },
      entityInstances: { count: 2, overrides: 0, errors: 0, failures: [] },
    });
    expect(result.manifests).toBe(manifests);
    expect(result.finalModOrder).toBe(finalOrder);

    expect(ctx.totals).toBe(initialTotals);
    expect(registry.getAll('entityDefinitions')).toHaveLength(2);
    expect(registry.getAll('entityInstances')).toHaveLength(2);
    expect(() => {
      result.totals.extra = 'allowed mutation';
    }).not.toThrow();
  });

  it('wraps loader failures in ModsLoaderPhaseError when the manager throws', async () => {
    class ExplodingContentLoadManager extends ContentLoadManager {
      async loadContent(...args) {
        await super.loadContent(...args);
        throw new Error('content explosion');
      }
    }

    const { phase } = buildContentPhaseEnv(pathToResponse, ExplodingContentLoadManager);

    const ctx = Object.freeze({
      worldName: 'integrationWorld',
      requestedMods: finalOrder,
      finalModOrder: finalOrder,
      manifests,
      totals: Object.freeze({}),
    });

    await expect(
      phase.execute(ctx).catch((error) => {
        expect(error).toBeInstanceOf(ModsLoaderPhaseError);
        throw error;
      })
    ).rejects.toMatchObject({
      code: ModsLoaderErrorCode.CONTENT,
      phase: 'ContentPhase',
      cause: expect.any(Error),
    });
  });
});
