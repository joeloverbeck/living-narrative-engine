import { describe, it, expect, beforeEach } from '@jest/globals';
import BodyGraphService from '../../../src/anatomy/bodyGraphService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

class InMemoryEntityManager {
  constructor(initial = {}) {
    this.entities = new Set();
    this.components = new Map();
    this.componentIndex = new Map();

    for (const [entityId, components] of Object.entries(initial)) {
      for (const [componentId, data] of Object.entries(components)) {
        this.addComponent(entityId, componentId, data);
      }
    }
  }

  #key(entityId, componentId) {
    return `${entityId}:::${componentId}`;
  }

  #clone(value) {
    if (value === null || value === undefined) return value;
    if (typeof structuredClone === 'function') {
      return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
  }

  addComponent(entityId, componentId, data) {
    this.entities.add(entityId);
    const key = this.#key(entityId, componentId);
    this.components.set(key, this.#clone(data));

    if (!this.componentIndex.has(componentId)) {
      this.componentIndex.set(componentId, new Map());
    }
    this.componentIndex.get(componentId).set(entityId, { id: entityId });
  }

  async removeComponent(entityId, componentId) {
    const key = this.#key(entityId, componentId);
    this.components.delete(key);

    const index = this.componentIndex.get(componentId);
    if (index) {
      index.delete(entityId);
      if (index.size === 0) {
        this.componentIndex.delete(componentId);
      }
    }
  }

  getComponentData(entityId, componentId) {
    const key = this.#key(entityId, componentId);
    return this.#clone(this.components.get(key) ?? null);
  }

  updateComponent(entityId, componentId, data) {
    this.addComponent(entityId, componentId, data);
  }

  getEntitiesWithComponent(componentId) {
    const index = this.componentIndex.get(componentId);
    if (!index) return [];
    return Array.from(index.values()).map((entry) => ({ ...entry }));
  }

  getEntityInstance(entityId) {
    if (!this.entities.has(entityId)) {
      throw new Error(`Entity ${entityId} not found`);
    }
    return {
      id: entityId,
      getComponentData: (componentId) => this.getComponentData(entityId, componentId),
    };
  }
}

class RecordingDispatcher {
  constructor() {
    this.events = [];
  }

  async dispatch(eventId, payload) {
    this.events.push({ eventId, payload });
  }
}

const createLogger = () => ({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
});

/**
 *
 */
async function createBodyGraphFixture() {
  const entityManager = new InMemoryEntityManager();

  entityManager.addComponent('actor', 'anatomy:body', {
    recipeId: 'humanoid.basic',
    body: { root: 'actor' },
    structure: {
      rootPartId: 'torso',
    },
  });

  entityManager.addComponent('torso', 'anatomy:part', { subType: 'torso' });
  entityManager.addComponent('torso', 'anatomy:joint', {
    parentId: 'actor',
    socketId: 'spine',
  });

  entityManager.addComponent('leftArm', 'anatomy:part', { subType: 'arm' });
  entityManager.addComponent('leftArm', 'anatomy:joint', {
    parentId: 'torso',
    socketId: 'shoulder-left',
  });
  entityManager.addComponent('leftArm', 'custom:decor', {
    details: {
      marking: 'tattoo',
      color: 'blue',
    },
  });

  entityManager.addComponent('rightArm', 'anatomy:part', { subType: 'arm' });
  entityManager.addComponent('rightArm', 'anatomy:joint', {
    parentId: 'torso',
    socketId: 'shoulder-right',
  });

  entityManager.addComponent('leftHand', 'anatomy:part', { subType: 'hand' });
  entityManager.addComponent('leftHand', 'anatomy:joint', {
    parentId: 'leftArm',
    socketId: 'wrist-left',
  });

  entityManager.addComponent('floating', 'anatomy:part', { subType: 'drone' });
  entityManager.addComponent('floating', 'anatomy:joint', {
    parentId: null,
    socketId: 'levitate',
  });

  const logger = createLogger();
  const dispatcher = new RecordingDispatcher();
  const service = new BodyGraphService({
    entityManager,
    logger,
    eventDispatcher: dispatcher,
  });

  await service.buildAdjacencyCache('actor');

  return {
    service,
    entityManager,
    dispatcher,
    bodyComponent: entityManager.getComponentData('actor', 'anatomy:body'),
  };
}

describe('BodyGraphService dependency validation', () => {
  it('requires entity manager, logger, and event dispatcher', () => {
    const entityManager = new InMemoryEntityManager();
    const logger = createLogger();
    const dispatcher = new RecordingDispatcher();

    expect(() => new BodyGraphService({ logger, eventDispatcher: dispatcher })).toThrow(
      InvalidArgumentError
    );
    expect(() => new BodyGraphService({ entityManager, eventDispatcher: dispatcher })).toThrow(
      InvalidArgumentError
    );
    expect(() => new BodyGraphService({ entityManager, logger })).toThrow(
      InvalidArgumentError
    );
  });
});

describe('BodyGraphService cache validation integration', () => {
  let service;
  let entityManager;
  let bodyComponent;
  let dispatcher;

  beforeEach(async () => {
    const fixture = await createBodyGraphFixture();
    service = fixture.service;
    entityManager = fixture.entityManager;
    dispatcher = fixture.dispatcher;
    bodyComponent = fixture.bodyComponent;
  });

  it('reports healthy cache state and surfaces stale joint references', async () => {
    const healthy = service.validateCache();
    expect(healthy).toEqual({ valid: true, issues: [] });

    await entityManager.removeComponent('leftHand', 'anatomy:joint');

    const validation = service.validateCache();
    expect(validation.valid).toBe(false);
    expect(validation.issues).toEqual(
      expect.arrayContaining([
        "Entity 'leftHand' in cache has parent but no joint component",
      ])
    );
  });

  it('exposes cache-aware helpers with sensible fallbacks', async () => {
    const graph = await service.getBodyGraph('actor');
    const partIds = graph.getAllPartIds();
    expect(partIds).toEqual(
      expect.arrayContaining(['torso', 'leftArm', 'rightArm', 'leftHand'])
    );
    expect(graph.getConnectedParts('unknown-node')).toEqual([]);

    const decorated = service.hasPartWithComponentValue(
      bodyComponent,
      'custom:decor',
      'details.marking',
      'tattoo'
    );
    expect(decorated).toEqual({ found: true, partId: 'leftArm' });

    const missingValue = service.hasPartWithComponentValue(
      bodyComponent,
      'custom:decor',
      'details.nonexistent',
      'nothing'
    );
    expect(missingValue).toEqual({ found: false });

    entityManager.updateComponent('actor', 'anatomy:body', {
      body: { root: 'actor' },
      structure: { rootPartId: 'torso' },
    });
    const metadata = await service.getAnatomyData('actor');
    expect(metadata).toEqual({ recipeId: null, rootEntityId: 'actor' });
    await expect(service.getAnatomyData('ghost')).resolves.toBeNull();

    expect(service.hasCache('actor')).toBe(true);
    expect(service.hasCache('ghost')).toBe(false);
    expect(service.getChildren('ghost')).toEqual([]);
    expect(service.getParent('ghost')).toBeNull();
    expect(service.getAncestors('ghost')).toEqual([]);
    expect(service.getAllDescendants('leftArm')).toEqual(['leftHand']);
  });

  it('detaches parts without a resolvable anatomy root', async () => {
    const result = await service.detachPart('floating', { cascade: false, reason: 'cleanup' });

    expect(result).toEqual({
      detached: ['floating'],
      parentId: null,
      socketId: 'levitate',
    });
    expect(entityManager.getComponentData('floating', 'anatomy:joint')).toBeNull();
    expect(dispatcher.events.at(-1)).toMatchObject({
      eventId: expect.any(String),
      payload: expect.objectContaining({ detachedEntityId: 'floating', reason: 'cleanup' }),
    });
  });
});
