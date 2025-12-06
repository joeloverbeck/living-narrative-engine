import { describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import createClothingStepResolver from '../../../src/scopeDsl/nodes/clothingStepResolver.js';
import ScopeDslErrorHandler from '../../../src/scopeDsl/core/scopeDslErrorHandler.js';
import { ErrorCodes } from '../../../src/scopeDsl/constants/errorCodes.js';
import EntityManager from '../../../src/entities/entityManager.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import { GameDataRepository } from '../../../src/data/gameDataRepository.js';
import EventBus from '../../../src/events/eventBus.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';

/**
 * Helper to create a minimal schema validator that satisfies the interfaces used by
 * EntityManager and ValidatedEventDispatcher. The implementation mirrors the light-weight
 * validator stubs used in other integration suites to avoid mocking the modules under test.
 *
 * @returns {{ validate: () => boolean, addSchema: () => Promise<boolean>, removeSchema: () => boolean,
 *   getValidator: () => () => boolean, isSchemaLoaded: () => boolean }}
 */
function createSchemaValidator() {
  return {
    validate: () => true,
    addSchema: async () => true,
    removeSchema: () => true,
    getValidator: () => () => true,
    isSchemaLoaded: () => true,
  };
}

describe('clothingStepResolver integration error coverage', () => {
  /** @type {ReturnType<typeof createSchemaValidator>} */
  let schemaValidator;
  /** @type {import('../../../src/interfaces/coreServices.js').ILogger} */
  let logger;
  /** @type {InMemoryDataRegistry} */
  let registry;
  /** @type {EntityManager} */
  let entityManager;
  /** @type {ScopeDslErrorHandler} */
  let errorHandler;
  /** @type {ReturnType<typeof createClothingStepResolver>} */
  let resolver;
  /** @type {{ getComponentData: (entityId: string, componentId: string) => any }} */
  let entitiesGateway;
  /** @type {ReturnType<typeof createClothingStepResolver>} */
  let resolverWithoutHandler;

  const richActorId = 'actor-rich';
  const emptyActorId = 'actor-empty';
  const failingActorId = 'actor-error';

  beforeEach(async () => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    schemaValidator = createSchemaValidator();
    registry = new InMemoryDataRegistry({ logger });

    const eventBus = new EventBus({ logger });
    const gameDataRepository = new GameDataRepository(registry, logger);
    const validatedEventDispatcher = new ValidatedEventDispatcher({
      eventBus,
      gameDataRepository,
      schemaValidator,
      logger,
    });
    const safeEventDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher,
      logger,
    });

    entityManager = new EntityManager({
      registry,
      validator: schemaValidator,
      logger,
      dispatcher: safeEventDispatcher,
    });

    const definition = new EntityDefinition('test:actor', {
      components: {
        'clothing:equipment': {
          slots: {},
        },
      },
    });
    registry.store('entityDefinitions', 'test:actor', definition);

    await entityManager.createEntityInstance('test:actor', {
      instanceId: richActorId,
      componentOverrides: {
        'clothing:equipment': {
          equipped: {
            torso_upper: { outer: 'coat_wool', base: 'shirt_flannel' },
            torso_lower: { base: 'pants_denim' },
          },
        },
      },
    });

    await entityManager.createEntityInstance('test:actor', {
      instanceId: emptyActorId,
      componentOverrides: {
        'clothing:equipment': {},
      },
    });

    await entityManager.createEntityInstance('test:actor', {
      instanceId: failingActorId,
      componentOverrides: {
        'clothing:equipment': {
          equipped: {
            torso_upper: { outer: 'jacket_vinyl' },
          },
        },
      },
    });

    entitiesGateway = {
      getComponentData(entityId, componentId) {
        if (entityId === failingActorId) {
          throw new Error('Simulated component gateway failure');
        }
        const entity = entityManager.getEntityInstance(entityId);
        return entity?.getComponentData(componentId) ?? null;
      },
    };

    errorHandler = new ScopeDslErrorHandler({ logger });
    resolver = createClothingStepResolver({ entitiesGateway, errorHandler });
    resolverWithoutHandler = createClothingStepResolver({ entitiesGateway });
  });

  afterEach(() => {
    errorHandler.clearErrorBuffer();
  });

  const createContext = (ids) => ({
    dispatcher: {
      resolve: () => new Set(ids),
    },
  });

  it('resolves clothing access objects with real entity data', () => {
    const node = {
      type: 'Step',
      field: 'topmost_clothing',
      parent: { type: 'Source' },
    };
    const ctx = createContext([richActorId, 42, null]);

    const result = resolver.resolve(node, ctx);
    expect(result.size).toBe(1);

    const clothingAccess = [...result][0];
    expect(clothingAccess).toMatchObject({
      __clothingSlotAccess: true,
      __isClothingAccessObject: true,
      supportsPriorityCalculation: true,
      mode: 'topmost',
      entityId: richActorId,
    });
    expect(clothingAccess.equipped.torso_upper.outer).toBe('coat_wool');
  });

  it('returns fallback access object when equipment is missing', () => {
    const node = {
      type: 'Step',
      field: 'outer_clothing',
      parent: { type: 'Source' },
    };
    const ctx = createContext([emptyActorId]);

    const result = resolver.resolve(node, ctx);
    expect(result.size).toBe(1);

    const clothingAccess = [...result][0];
    expect(clothingAccess).toEqual({
      __clothingSlotAccess: true,
      equipped: {},
      mode: 'outer',
      type: 'clothing_slot_access',
      __isClothingAccessObject: true,
      supportsPriorityCalculation: true,
      entityId: emptyActorId,
    });
  });

  it('routes invalid entity IDs and clothing fields through ScopeDslErrorHandler', () => {
    const validNode = {
      type: 'Step',
      field: 'topmost_clothing',
      parent: { type: 'Source' },
    };
    const invalidFieldNode = {
      type: 'Step',
      field: 'non_existent_clothing_layer',
      parent: { type: 'Source' },
    };

    expect(() => resolver.resolve(validNode, createContext(['']))).toThrow(
      `[${ErrorCodes.INVALID_ENTITY_ID}]`
    );

    expect(() =>
      resolver.resolve(invalidFieldNode, createContext([richActorId]))
    ).toThrow(`[${ErrorCodes.INVALID_ENTITY_ID}]`);

    const bufferedCodes = errorHandler
      .getErrorBuffer()
      .map((entry) => entry.code);
    expect(bufferedCodes).toEqual([
      ErrorCodes.INVALID_ENTITY_ID,
      ErrorCodes.INVALID_ENTITY_ID,
    ]);
  });

  it('handles component gateway failures and parent resolution errors', () => {
    const node = {
      type: 'Step',
      field: 'topmost_clothing',
      parent: { type: 'Source' },
    };

    expect(() =>
      resolver.resolve(node, createContext([failingActorId]))
    ).toThrow(`[${ErrorCodes.COMPONENT_RESOLUTION_FAILED}]`);

    const failingContext = {
      dispatcher: {
        resolve() {
          throw new Error('Downstream scope dispatcher failure');
        },
      },
    };

    expect(() => resolver.resolve(node, failingContext)).toThrow(
      `[${ErrorCodes.STEP_RESOLUTION_FAILED}]`
    );
  });

  it('detects invalid node structures and missing dispatcher context', () => {
    const validNode = {
      type: 'Step',
      field: 'topmost_clothing',
      parent: { type: 'Source' },
    };

    expect(() => resolver.resolve(null, createContext([richActorId]))).toThrow(
      `[${ErrorCodes.INVALID_NODE_STRUCTURE}]`
    );

    expect(() => resolver.resolve(validNode, { dispatcher: null })).toThrow(
      `[${ErrorCodes.MISSING_DISPATCHER}]`
    );
  });
  it('evaluates compatibility using canResolve', () => {
    expect(
      resolver.canResolve({ type: 'Step', field: 'topmost_clothing' })
    ).toBe(true);
    expect(resolver.canResolve({ type: 'Step' })).toBe(false);
    expect(
      resolver.canResolve({ type: 'Source', field: 'topmost_clothing' })
    ).toBe(false);
  });

  it('silently returns when no error handler is provided', () => {
    const baseNode = {
      type: 'Step',
      field: 'topmost_clothing',
      parent: { type: 'Source' },
    };

    expect(
      resolverWithoutHandler.resolve(baseNode, createContext(['']))
    ).toEqual(new Set());

    const invalidFieldNode = {
      type: 'Step',
      field: 'non_existent_clothing_layer',
      parent: { type: 'Source' },
    };
    expect(
      resolverWithoutHandler.resolve(
        invalidFieldNode,
        createContext([richActorId])
      )
    ).toEqual(new Set());

    expect(
      resolverWithoutHandler.resolve(baseNode, createContext([failingActorId]))
    ).toEqual(new Set());

    expect(
      resolverWithoutHandler.resolve(null, createContext([richActorId]))
    ).toEqual(new Set());

    expect(
      resolverWithoutHandler.resolve(baseNode, { dispatcher: null })
    ).toEqual(new Set());

    const failingContext = {
      dispatcher: {
        resolve() {
          throw new Error('Downstream scope dispatcher failure');
        },
      },
    };
    expect(resolverWithoutHandler.resolve(baseNode, failingContext)).toEqual(
      new Set()
    );
  });
});
