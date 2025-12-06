import { describe, it, expect, beforeEach } from '@jest/globals';

import BodyGraphService from '../../../src/anatomy/bodyGraphService.js';
import AnatomySocketIndex from '../../../src/anatomy/services/anatomySocketIndex.js';
import { AnatomyQueryCache } from '../../../src/anatomy/cache/AnatomyQueryCache.js';

class RecordingEventDispatcher {
  constructor() {
    this.events = [];
  }

  async dispatch(eventId, payload) {
    this.events.push({ eventId, payload });
    return true;
  }
}

const createLogger = () => {
  const messages = {
    debug: [],
    info: [],
    warn: [],
    error: [],
  };

  const render = (value) =>
    typeof value === 'string' ? value : JSON.stringify(value);
  const capture =
    (level) =>
    (...args) => {
      messages[level].push(args.map(render).join(' '));
    };

  return {
    messages,
    debug: capture('debug'),
    info: capture('info'),
    warn: capture('warn'),
    error: capture('error'),
  };
};

class InMemoryEntityManager {
  constructor(initialEntities = {}) {
    this.entities = new Map();
    this.errorMap = new Map();

    Object.entries(initialEntities).forEach(([entityId, components]) => {
      const componentMap = new Map();
      Object.entries(components).forEach(([componentId, value]) => {
        componentMap.set(componentId, value);
      });
      this.entities.set(entityId, componentMap);
    });
  }

  setComponent(entityId, componentId, value) {
    if (!this.entities.has(entityId)) {
      this.entities.set(entityId, new Map());
    }
    this.entities.get(entityId).set(componentId, value);
  }

  removeComponent(entityId, componentId) {
    const components = this.entities.get(entityId);
    if (components) {
      components.delete(componentId);
    }
  }

  setErrorOnGet(entityId, componentId, error) {
    this.errorMap.set(`${entityId}::${componentId}`, error);
  }

  clearErrors() {
    this.errorMap.clear();
  }

  getComponentData(entityId, componentId) {
    const error = this.errorMap.get(`${entityId}::${componentId}`);
    if (error) {
      throw error;
    }

    const components = this.entities.get(entityId);
    if (!components) {
      return null;
    }
    const value = components.get(componentId);
    return value === undefined ? null : value;
  }

  getEntitiesWithComponent(componentId) {
    const results = [];
    for (const [entityId, components] of this.entities.entries()) {
      if (components.has(componentId)) {
        results.push({ id: entityId });
      }
    }
    return results;
  }

  getEntityInstance(entityId) {
    if (!this.entities.has(entityId)) {
      throw new Error(`Entity ${entityId} not found`);
    }
    return {
      id: entityId,
      getComponentData: (componentId) =>
        this.getComponentData(entityId, componentId),
    };
  }
}

const buildAnatomyDataset = () => ({
  actor: {
    'anatomy:body': {
      recipeId: 'humanoid.test',
      body: { root: 'actor' },
      structure: {
        rootPartId: 'torso',
        parts: {
          torso: {
            children: ['leftArm', 'rightArm', 'head', 'faultyLimb'],
            partType: 'torso',
          },
          leftArm: { children: ['leftHand'], partType: 'arm' },
          leftHand: { children: [], partType: 'hand' },
          rightArm: { children: ['rightHand'], partType: 'arm' },
          rightHand: { children: [], partType: 'hand' },
          head: { children: [], partType: 'head' },
          faultyLimb: { children: [], partType: 'limb' },
        },
      },
    },
    'anatomy:sockets': {
      sockets: [{ id: 'actor:core', orientation: 'center' }],
    },
  },
  torso: {
    'anatomy:part': { subType: 'torso' },
    'anatomy:joint': { parentId: 'actor', socketId: 'torso-anchor' },
    'anatomy:sockets': {
      sockets: [
        { id: 'torso:left', orientation: 'left' },
        { id: 'torso:right', orientation: 'right' },
      ],
    },
  },
  leftArm: {
    'anatomy:part': { subType: 'arm' },
    'anatomy:joint': { parentId: 'torso', socketId: 'shoulder-left' },
    'anatomy:sockets': {
      sockets: [{ id: 'leftArm:elbow', orientation: 'down' }],
    },
  },
  leftHand: {
    'anatomy:part': { subType: 'hand' },
    'anatomy:joint': { parentId: 'leftArm', socketId: 'wrist-left' },
    'anatomy:sockets': {
      sockets: [{ id: 'leftHand:palm', orientation: 'front' }],
    },
  },
  rightArm: {
    'anatomy:part': { subType: 'arm' },
    'anatomy:joint': { parentId: 'torso', socketId: 'shoulder-right' },
    'anatomy:sockets': {
      sockets: [
        { id: 'rightArm:elbow', orientation: 'down' },
        { id: 'rightArm:wrist', orientation: 'front' },
      ],
    },
  },
  rightHand: {
    'anatomy:part': { subType: 'hand' },
    'anatomy:joint': { parentId: 'rightArm', socketId: 'wrist-right' },
    'anatomy:sockets': {
      sockets: [{ id: 'rightHand:palm', orientation: 'front' }],
    },
  },
  head: {
    'anatomy:part': { subType: 'head' },
    'anatomy:joint': { parentId: 'torso', socketId: 'neck-root' },
    // intentionally omit anatomy:sockets to cover empty branch handling
  },
  faultyLimb: {
    'anatomy:part': { subType: 'limb' },
    'anatomy:joint': { parentId: 'torso', socketId: 'faulty-socket' },
    'anatomy:sockets': {
      sockets: [{ id: 'faultyLimb:socket', orientation: 'rear' }],
    },
  },
  spectator: {
    'anatomy:body': {
      recipeId: 'spectator.test',
      body: { root: 'spectator' },
      structure: {
        rootPartId: 'spectatorTorso',
        parts: {
          spectatorTorso: { children: ['spectatorHead'], partType: 'torso' },
          spectatorHead: { children: [], partType: 'head' },
        },
      },
    },
    'anatomy:sockets': {
      sockets: [{ id: 'spectator:core', orientation: 'center' }],
    },
  },
  spectatorTorso: {
    'anatomy:part': { subType: 'torso' },
    'anatomy:joint': { parentId: 'spectator', socketId: 'spectator-anchor' },
    'anatomy:sockets': {
      sockets: [{ id: 'spectatorTorso:front', orientation: 'front' }],
    },
  },
  spectatorHead: {
    'anatomy:part': { subType: 'head' },
    'anatomy:joint': { parentId: 'spectatorTorso', socketId: 'spectator-neck' },
    'anatomy:sockets': {
      sockets: [],
    },
  },
});

describe('AnatomySocketIndex integration with BodyGraphService', () => {
  let entityManager;
  let logger;
  let bodyGraphService;
  let socketIndex;

  beforeEach(() => {
    logger = createLogger();
    entityManager = new InMemoryEntityManager(buildAnatomyDataset());
    entityManager.setErrorOnGet(
      'faultyLimb',
      'anatomy:sockets',
      new Error('Simulated socket retrieval failure')
    );

    const dispatcher = new RecordingEventDispatcher();
    const queryCache = new AnatomyQueryCache({ logger });

    bodyGraphService = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher: dispatcher,
      queryCache,
    });

    socketIndex = new AnatomySocketIndex({
      logger,
      entityManager,
      bodyGraphService,
    });
  });

  it('indexes sockets across multiple anatomy roots and resolves lookups', async () => {
    await socketIndex.buildIndex('actor');

    const actorSockets = await socketIndex.getEntitySockets('actor');
    expect(actorSockets).toEqual([{ id: 'actor:core', orientation: 'center' }]);

    const leftArmSockets = await socketIndex.getEntitySockets('leftArm');
    expect(leftArmSockets).toEqual([
      { id: 'leftArm:elbow', orientation: 'down' },
    ]);

    const faultySockets = await socketIndex.getEntitySockets('faultyLimb');
    expect(faultySockets).toEqual([]);
    expect(
      logger.messages.warn.some((message) =>
        message.includes('Failed to collect sockets for entity faultyLimb')
      )
    ).toBe(true);

    const entitiesWithSockets =
      await socketIndex.getEntitiesWithSockets('actor');
    expect(entitiesWithSockets).toEqual(
      expect.arrayContaining([
        'actor',
        'torso',
        'leftArm',
        'leftHand',
        'rightArm',
        'rightHand',
      ])
    );
    expect(entitiesWithSockets).not.toContain('faultyLimb');

    await socketIndex.buildIndex('spectator');

    await expect(
      socketIndex.findEntityWithSocket('actor', 'rightHand:palm')
    ).resolves.toBe('rightHand');
    await expect(
      socketIndex.findEntityWithSocket('actor', 'spectator:core')
    ).resolves.toBeNull();
    await expect(
      socketIndex.findEntityWithSocket('spectator', 'spectator:core')
    ).resolves.toBe('spectator');
  });

  it('rebuilds indexes after invalidation and captures new sockets', async () => {
    await socketIndex.getEntitiesWithSockets('actor');

    entityManager.setComponent('leftHand', 'anatomy:sockets', {
      sockets: [
        { id: 'leftHand:palm', orientation: 'front' },
        { id: 'leftHand:grip', orientation: 'inward' },
      ],
    });

    socketIndex.invalidateIndex('actor');

    const updatedSockets = await socketIndex.getEntitySockets('leftHand');
    expect(updatedSockets).toEqual(
      expect.arrayContaining([
        { id: 'leftHand:palm', orientation: 'front' },
        { id: 'leftHand:grip', orientation: 'inward' },
      ])
    );

    await expect(
      socketIndex.findEntityWithSocket('actor', 'leftHand:grip')
    ).resolves.toBe('leftHand');
    await expect(
      socketIndex.findEntityWithSocket('actor', 'unknown-socket')
    ).resolves.toBeNull();
  });

  it('clears cached indexes and rebuilds on demand', async () => {
    await socketIndex.buildIndex('actor');
    socketIndex.clearCache();

    const rebuilt = await socketIndex.getEntitiesWithSockets('actor');
    expect(rebuilt).toEqual(
      expect.arrayContaining(['actor', 'torso', 'leftArm', 'rightArm'])
    );

    const torsoSockets = await socketIndex.getEntitySockets('torso');
    expect(torsoSockets).toEqual(
      expect.arrayContaining([
        { id: 'torso:left', orientation: 'left' },
        { id: 'torso:right', orientation: 'right' },
      ])
    );

    expect(
      logger.messages.debug.some((message) =>
        message.includes('Cleared all socket indexes')
      )
    ).toBe(true);
  });

  it('validates input arguments for public APIs', async () => {
    await expect(socketIndex.buildIndex('')).rejects.toThrow('rootEntityId');
    await expect(socketIndex.findEntityWithSocket('actor', '')).rejects.toThrow(
      'socketId'
    );
    await expect(socketIndex.getEntitySockets('')).rejects.toThrow('entityId');
    await expect(socketIndex.getEntitiesWithSockets('')).rejects.toThrow(
      'rootEntityId'
    );
    expect(() => socketIndex.invalidateIndex('')).toThrow('rootEntityId');
  });
});
