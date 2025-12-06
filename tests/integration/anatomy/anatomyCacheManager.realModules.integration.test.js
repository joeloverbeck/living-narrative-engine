import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { AnatomyCacheManager } from '../../../src/anatomy/anatomyCacheManager.js';
import EntityManager from '../../../src/entities/entityManager.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { ANATOMY_CONSTANTS } from '../../../src/anatomy/constants/anatomyConstants.js';
import {
  createMockLogger,
  createMockSchemaValidator,
  createMockValidatedEventDispatcherForIntegration,
} from '../../common/mockFactories/index.js';

const registerComponentDefinition = (
  registry,
  id,
  dataSchema = { type: 'object' }
) => {
  registry.store('components', id, { id, dataSchema });
};

const registerEntityDefinition = (registry, id, components) => {
  const definition = new EntityDefinition(id, {
    description: `${id} definition`,
    components,
  });
  registry.store('entityDefinitions', id, definition);
};

const BASE_COMPONENT_SCHEMAS = {
  'core:name': {
    type: 'object',
    properties: { text: { type: 'string' } },
    required: ['text'],
  },
  'anatomy:body': {
    type: 'object',
    properties: {
      recipeId: { type: ['string', 'null'] },
      body: { type: ['object', 'null'] },
      structure: { type: ['object', 'null'] },
    },
  },
  'anatomy:part': {
    type: 'object',
    properties: { subType: { type: 'string' } },
    required: ['subType'],
  },
  'anatomy:joint': {
    type: 'object',
    properties: {
      parentId: { type: ['string', 'null'] },
      socketId: { type: ['string', 'null'] },
      parentEntityId: { type: ['string', 'null'] },
      childSocketId: { type: ['string', 'null'] },
    },
  },
};

const registerBaseDefinitions = (registry) => {
  Object.entries(BASE_COMPONENT_SCHEMAS).forEach(([id, schema]) =>
    registerComponentDefinition(registry, id, schema)
  );

  registerEntityDefinition(registry, 'core:actor', {
    'core:name': { text: 'Actor Template' },
    'anatomy:body': { recipeId: 'test:humanoid', body: null, structure: null },
  });
};

const createPartDefinition = (registry, id, subType) => {
  registerEntityDefinition(registry, id, {
    'core:name': { text: subType },
    'anatomy:part': { subType },
  });
};

const createSimpleAnatomy = async (
  registry,
  entityManager,
  actorId,
  parts = {}
) => {
  const partIds = {
    torso: parts.torso ?? `${actorId}-torso`,
    arm: parts.arm ?? `${actorId}-arm`,
    hand: parts.hand ?? `${actorId}-hand`,
  };

  createPartDefinition(registry, 'test:torso', 'torso');
  createPartDefinition(registry, 'test:arm', 'arm');
  createPartDefinition(registry, 'test:hand', 'hand');

  await entityManager.createEntityInstance('core:actor', {
    instanceId: actorId,
    componentOverrides: {
      'core:name': { text: 'Integrated Actor' },
      'anatomy:body': {
        recipeId: 'test:humanoid',
        body: { root: partIds.torso },
        structure: {
          rootPartId: partIds.torso,
          parts: {
            [partIds.torso]: {
              id: partIds.torso,
              children: [partIds.arm],
            },
            [partIds.arm]: {
              id: partIds.arm,
              children: [partIds.hand],
            },
            [partIds.hand]: {
              id: partIds.hand,
              children: [],
            },
          },
        },
      },
    },
  });

  await entityManager.createEntityInstance('test:torso', {
    instanceId: partIds.torso,
  });
  await entityManager.createEntityInstance('test:arm', {
    instanceId: partIds.arm,
  });
  await entityManager.createEntityInstance('test:hand', {
    instanceId: partIds.hand,
  });

  await entityManager.addComponent(partIds.torso, 'anatomy:joint', {
    parentId: actorId,
    socketId: 'core',
  });
  await entityManager.addComponent(partIds.arm, 'anatomy:joint', {
    parentId: partIds.torso,
    socketId: 'arm-socket',
  });
  await entityManager.addComponent(partIds.hand, 'anatomy:joint', {
    parentId: partIds.arm,
    socketId: 'hand-socket',
  });

  return partIds;
};

const createDeepChain = async (registry, entityManager, actorId, depth) => {
  const partIds = [];
  for (let i = 0; i < depth; i += 1) {
    const id = `${actorId}-segment-${i}`;
    createPartDefinition(registry, id, 'segment');
    await entityManager.createEntityInstance(id, { instanceId: id });
    partIds.push(id);
  }

  await entityManager.createEntityInstance('core:actor', {
    instanceId: actorId,
    componentOverrides: {
      'anatomy:body': {
        recipeId: 'test:humanoid',
        body: { root: partIds[0] },
        structure: {
          rootPartId: partIds[0],
          parts: partIds.reduce((acc, current, index) => {
            const next = partIds[index + 1];
            acc[current] = {
              id: current,
              children: next ? [next] : [],
            };
            return acc;
          }, {}),
        },
      },
    },
  });

  await entityManager.addComponent(partIds[0], 'anatomy:joint', {
    parentId: actorId,
    socketId: 'root',
  });

  for (let i = 1; i < partIds.length; i += 1) {
    await entityManager.addComponent(partIds[i], 'anatomy:joint', {
      parentId: partIds[i - 1],
      socketId: `segment-${i}`,
    });
  }

  return partIds;
};

const getOriginalGetter = (entityManager, method) =>
  entityManager[method].bind(entityManager);

describe('AnatomyCacheManager integration with real EntityManager', () => {
  /** @type {ReturnType<typeof createMockLogger>} */
  let logger;
  /** @type {ReturnType<typeof createMockValidatedEventDispatcherForIntegration>} */
  let eventDispatcher;
  /** @type {InMemoryDataRegistry} */
  let registry;
  /** @type {ReturnType<typeof createMockSchemaValidator>} */
  let validator;
  /** @type {EntityManager} */
  let entityManager;
  /** @type {AnatomyCacheManager} */
  let manager;

  beforeEach(async () => {
    logger = createMockLogger();
    eventDispatcher = createMockValidatedEventDispatcherForIntegration();
    registry = new InMemoryDataRegistry({ logger });
    validator = createMockSchemaValidator();
    entityManager = new EntityManager({
      registry,
      validator,
      logger,
      dispatcher: eventDispatcher,
    });
    manager = new AnatomyCacheManager({ logger });

    registerBaseDefinitions(registry);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('exposes manual cache operations', () => {
    const node = {
      entityId: 'root',
      partType: 'torso',
      parentId: null,
      socketId: null,
      children: ['child'],
    };

    manager.set('root', node);
    expect(manager.get('root')).toEqual(node);
    expect(manager.has('root')).toBe(true);
    expect(manager.hasCacheForRoot('root')).toBe(true);
    expect([...manager.entries()]).toEqual([['root', node]]);
    expect(manager.size()).toBe(1);

    expect(manager.hasCacheForRoot('')).toBe(false);

    expect(manager.delete('root')).toBe(true);
    expect(manager.has('root')).toBe(false);
    expect(manager.size()).toBe(0);
  });

  it('invalidates cache entries for specific roots', () => {
    manager.set('root', {
      entityId: 'root',
      partType: 'torso',
      parentId: null,
      socketId: null,
      children: ['child'],
    });
    manager.set('child', {
      entityId: 'child',
      partType: 'arm',
      parentId: 'root',
      socketId: 'arm-socket',
      children: [],
    });
    manager.set('sibling', {
      entityId: 'sibling',
      partType: 'arm',
      parentId: null,
      socketId: null,
      children: [],
    });

    manager.invalidateCacheForRoot('root');

    expect(manager.has('root')).toBe(false);
    expect(manager.has('child')).toBe(false);
    expect(manager.has('sibling')).toBe(true);
  });

  it('throws when buildCache is invoked without required dependencies', async () => {
    await expect(
      manager.buildCache(undefined, entityManager)
    ).rejects.toBeInstanceOf(InvalidArgumentError);
    await expect(manager.buildCache('root', undefined)).rejects.toBeInstanceOf(
      InvalidArgumentError
    );
  });

  it('builds caches with a real entity manager and invalidates stale entries', async () => {
    const actorId = 'actor-basic';
    const parts = await createSimpleAnatomy(registry, entityManager, actorId);

    await manager.buildCache(actorId, entityManager);
    const invalidateSpy = jest.spyOn(manager, 'invalidateCacheForRoot');
    await manager.buildCache(actorId, entityManager);

    expect(invalidateSpy).toHaveBeenCalledWith(actorId);
    expect(manager.has(actorId)).toBe(true);
    expect(manager.get(parts.hand)).toEqual(
      expect.objectContaining({ parentId: parts.arm, socketId: 'hand-socket' })
    );
  });

  it('handles missing joints when building parent-to-children maps', async () => {
    const actorId = 'actor-without-joints';
    await createSimpleAnatomy(registry, entityManager, actorId);

    const original = getOriginalGetter(
      entityManager,
      'getEntitiesWithComponent'
    );
    const spy = jest.spyOn(entityManager, 'getEntitiesWithComponent');
    spy.mockImplementationOnce(() => null);
    spy.mockImplementation(original);

    await manager.buildCache(actorId, entityManager);

    expect(logger.debug).toHaveBeenCalledWith(
      'AnatomyCacheManager: No entities with joints found'
    );
  });

  it('warns when recursion depth exceeds the configured limit', async () => {
    const actorId = 'deep-actor';
    const segments = await createDeepChain(
      registry,
      entityManager,
      actorId,
      ANATOMY_CONSTANTS.MAX_RECURSION_DEPTH + 5
    );

    await manager.buildCache(actorId, entityManager);

    const maxDepthEntityId = segments[ANATOMY_CONSTANTS.MAX_RECURSION_DEPTH];
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        `AnatomyCacheManager: Max recursion depth reached at entity '${maxDepthEntityId}'`
      )
    );
  });

  it('logs errors when entity materialization fails during cache build', async () => {
    const actorId = 'actor-error-node';
    const parts = await createSimpleAnatomy(registry, entityManager, actorId);
    const faultyId = parts.hand;
    const original = getOriginalGetter(entityManager, 'getEntityInstance');

    jest
      .spyOn(entityManager, 'getEntityInstance')
      .mockImplementation((entityId) => {
        if (entityId === faultyId) {
          throw new Error('materialization failure');
        }
        return original(entityId);
      });

    await manager.buildCache(actorId, entityManager);

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        `Failed to build cache node for entity '${faultyId}'`
      ),
      expect.any(Object)
    );
  });

  it('recovers disconnected anatomy roots and links them to actors', async () => {
    const actorId = 'actor-disconnected';
    const rootPartId = `${actorId}-floating-root`;
    const childId = `${actorId}-floating-child`;

    createPartDefinition(registry, rootPartId, 'torso');
    createPartDefinition(registry, childId, 'arm');

    await entityManager.createEntityInstance(rootPartId, {
      instanceId: rootPartId,
    });
    await entityManager.createEntityInstance(childId, { instanceId: childId });
    await entityManager.addComponent(childId, 'anatomy:joint', {
      parentId: rootPartId,
      socketId: 'socket',
    });

    await entityManager.createEntityInstance('core:actor', {
      instanceId: actorId,
      componentOverrides: {
        'anatomy:body': {
          recipeId: 'test:humanoid',
          body: { root: rootPartId },
          structure: {
            rootPartId,
            parts: {
              [rootPartId]: { id: rootPartId, children: [childId] },
              [childId]: { id: childId, children: [] },
            },
          },
        },
      },
    });

    await manager.buildCache(actorId, entityManager);

    const actorNode = manager.get(actorId);
    expect(actorNode.children).toContain(rootPartId);
    expect(manager.has(childId)).toBe(true);
  });

  it('logs failures when recovering disconnected anatomy', async () => {
    const actorId = 'actor-disconnected-error';
    const rootPartId = `${actorId}-floating-root`;
    const childId = `${actorId}-floating-child`;

    createPartDefinition(registry, rootPartId, 'torso');
    createPartDefinition(registry, childId, 'arm');

    await entityManager.createEntityInstance(rootPartId, {
      instanceId: rootPartId,
    });
    await entityManager.createEntityInstance(childId, { instanceId: childId });
    await entityManager.addComponent(childId, 'anatomy:joint', {
      parentId: rootPartId,
      socketId: 'socket',
    });

    await entityManager.createEntityInstance('core:actor', {
      instanceId: actorId,
      componentOverrides: {
        'anatomy:body': {
          recipeId: 'test:humanoid',
          body: { root: rootPartId },
          structure: {
            rootPartId,
            parts: {
              [rootPartId]: { id: rootPartId, children: [childId] },
              [childId]: { id: childId, children: [] },
            },
          },
        },
      },
    });

    const original = getOriginalGetter(entityManager, 'getComponentData');
    let callCount = 0;
    jest
      .spyOn(entityManager, 'getComponentData')
      .mockImplementation((entityId, componentId) => {
        if (entityId === actorId && componentId === 'anatomy:body') {
          callCount += 1;
          if (callCount > 1) {
            throw new Error('body fetch failure');
          }
        }
        return original(entityId, componentId);
      });

    await manager.buildCache(actorId, entityManager);

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        `AnatomyCacheManager: Failed to handle disconnected actor anatomy for '${actorId}'`
      ),
      expect.any(Object)
    );
  });

  it('validates cache integrity and reports structural issues', async () => {
    const actorId = 'actor-validate';
    const parts = await createSimpleAnatomy(registry, entityManager, actorId);

    await manager.buildCache(actorId, entityManager);

    expect(() => manager.validateCache()).toThrow(InvalidArgumentError);

    const actorNode = manager.get(actorId);
    actorNode.children.push('ghost-child');

    const validation = manager.validateCache(entityManager);
    expect(validation.valid).toBe(false);
    expect(validation.issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Child 'ghost-child' of"),
      ])
    );
  });

  it('supports clearing cache state after complex operations', async () => {
    const actorId = 'actor-clear';
    await createSimpleAnatomy(registry, entityManager, actorId);

    await manager.buildCache(actorId, entityManager);
    expect(manager.size()).toBeGreaterThan(0);

    manager.clear();
    expect(manager.size()).toBe(0);
  });
});
