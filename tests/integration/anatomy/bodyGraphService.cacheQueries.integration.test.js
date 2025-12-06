import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  BodyGraphService,
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';

class FakeLogger {
  constructor() {
    this.messages = { debug: [], info: [], warn: [], error: [] };
  }

  debug(...args) {
    this.messages.debug.push(args.join(' '));
  }

  info(...args) {
    this.messages.info.push(args.join(' '));
  }

  warn(...args) {
    this.messages.warn.push(args.join(' '));
  }

  error(...args) {
    this.messages.error.push(args.join(' '));
  }
}

class FakeEventDispatcher {
  constructor() {
    this.dispatchCalls = [];
  }

  async dispatch(typeOrEvent, payload) {
    if (typeof typeOrEvent === 'object') {
      this.dispatchCalls.push(typeOrEvent);
    } else {
      this.dispatchCalls.push({ type: typeOrEvent, payload });
    }
  }
}

const clone = (value) =>
  value && typeof value === 'object'
    ? JSON.parse(JSON.stringify(value))
    : value;

class FakeEntityManager {
  constructor() {
    this.entities = new Map();
    this.componentIndex = new Map();
  }

  createEntity(id, { type = 'entity', components = {} } = {}) {
    if (this.entities.has(id)) {
      throw new Error(`Entity '${id}' already exists`);
    }

    const componentMap = new Map();
    for (const [componentId, data] of Object.entries(components)) {
      componentMap.set(componentId, clone(data));
      this.#indexComponent(id, componentId);
    }

    const entity = { id, type, components: componentMap };
    this.entities.set(id, entity);
    return entity;
  }

  addComponent(id, componentId, data) {
    const entity = this.entities.get(id);
    if (!entity) {
      throw new Error(`Unknown entity '${id}'`);
    }
    entity.components.set(componentId, clone(data));
    this.#indexComponent(id, componentId);
  }

  removeComponent(id, componentId) {
    const entity = this.entities.get(id);
    if (!entity) {
      return;
    }
    if (entity.components.delete(componentId)) {
      const index = this.componentIndex.get(componentId);
      if (index) {
        index.delete(id);
        if (index.size === 0) {
          this.componentIndex.delete(componentId);
        }
      }
    }
  }

  deleteEntity(id) {
    const entity = this.entities.get(id);
    if (!entity) {
      return;
    }
    for (const componentId of entity.components.keys()) {
      const index = this.componentIndex.get(componentId);
      if (index) {
        index.delete(id);
        if (index.size === 0) {
          this.componentIndex.delete(componentId);
        }
      }
    }
    this.entities.delete(id);
  }

  getComponentData(id, componentId) {
    const entity = this.entities.get(id);
    if (!entity) {
      return null;
    }
    return entity.components.get(componentId) ?? null;
  }

  hasComponent(id, componentId) {
    const entity = this.entities.get(id);
    return entity ? entity.components.has(componentId) : false;
  }

  getAllComponentTypesForEntity(id) {
    const entity = this.entities.get(id);
    return entity ? Array.from(entity.components.keys()) : [];
  }

  getEntitiesWithComponent(componentId) {
    const index = this.componentIndex.get(componentId);
    if (!index) {
      return [];
    }
    return Array.from(index, (entityId) => ({ id: entityId }));
  }

  getEntityInstance(id) {
    const entity = this.entities.get(id);
    if (!entity) {
      throw new Error(`Entity '${id}' not found`);
    }
    return {
      id: entity.id,
      type: entity.type,
      getComponentData: (componentId) =>
        this.getComponentData(entity.id, componentId),
    };
  }

  #indexComponent(entityId, componentId) {
    if (!this.componentIndex.has(componentId)) {
      this.componentIndex.set(componentId, new Set());
    }
    this.componentIndex.get(componentId).add(entityId);
  }
}

describe('BodyGraphService cache & query integration', () => {
  let entityManager;
  let eventDispatcher;
  let logger;
  let service;
  let actor;
  let torso;
  let arm;
  let hand;
  let finger;
  let head;

  const createBodyComponent = () =>
    entityManager.getComponentData(actor.id, 'anatomy:body');

  beforeEach(() => {
    entityManager = new FakeEntityManager();
    eventDispatcher = new FakeEventDispatcher();
    logger = new FakeLogger();

    actor = entityManager.createEntity('actor-1', {
      type: 'actor',
      components: {
        'anatomy:body': {
          body: { root: 'torso-1' },
          recipeId: 'recipe:human-base',
        },
      },
    });

    torso = entityManager.createEntity('torso-1', {
      type: 'part',
      components: {
        'anatomy:part': { subType: 'torso' },
      },
    });

    arm = entityManager.createEntity('arm-1', {
      type: 'part',
      components: {
        'anatomy:part': { subType: 'arm' },
        'anatomy:joint': { parentId: torso.id, socketId: 'shoulder-left' },
      },
    });

    hand = entityManager.createEntity('hand-1', {
      type: 'part',
      components: {
        'anatomy:part': { subType: 'hand' },
        'anatomy:joint': { parentId: arm.id, socketId: 'wrist' },
        'core:tattoo': { name: 'spiral' },
        'core:metrics': { status: { color: 'red' } },
      },
    });

    finger = entityManager.createEntity('finger-1', {
      type: 'part',
      components: {
        'anatomy:part': { subType: 'finger' },
        'anatomy:joint': { parentId: hand.id, socketId: 'finger-socket' },
      },
    });

    head = entityManager.createEntity('head-1', {
      type: 'part',
      components: {
        'anatomy:part': { subType: 'head' },
        'anatomy:joint': { parentId: torso.id, socketId: 'neck' },
      },
    });

    service = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher,
    });
  });

  it('builds caches and exposes relationships between parts', async () => {
    await service.buildAdjacencyCache(torso.id);

    expect(service.hasCache(torso.id)).toBe(true);
    expect(new Set(service.getChildren(torso.id))).toEqual(
      new Set([arm.id, head.id])
    );
    expect(service.getParent(arm.id)).toBe(torso.id);
    expect(service.getAncestors(finger.id)).toEqual([
      hand.id,
      arm.id,
      torso.id,
    ]);
    expect(new Set(service.getAllDescendants(torso.id))).toEqual(
      new Set([arm.id, hand.id, finger.id, head.id])
    );

    expect(service.getAnatomyRoot(finger.id)).toBe(torso.id);

    const path = service.getPath(finger.id, head.id);
    expect(path).toEqual([finger.id, hand.id, arm.id, torso.id, head.id]);

    const armsFirstPass = service.findPartsByType(torso.id, 'arm');
    expect(armsFirstPass).toEqual([arm.id]);

    // Exercise query cache path by calling again
    const armsSecondPass = service.findPartsByType(torso.id, 'arm');
    expect(armsSecondPass).toEqual([arm.id]);
  });

  it('retrieves all parts from anatomy definitions and caches results', async () => {
    await service.buildAdjacencyCache(actor.id);

    const bodyComponent = createBodyComponent();
    const firstPass = service.getAllParts(bodyComponent, actor.id);
    expect(new Set(firstPass)).toEqual(
      new Set([actor.id, torso.id, arm.id, hand.id, finger.id, head.id])
    );

    const secondPass = service.getAllParts(bodyComponent, actor.id);
    expect(secondPass).toEqual(firstPass);

    const blueprintPass = service.getAllParts(bodyComponent);
    expect(new Set(blueprintPass)).toEqual(
      new Set([torso.id, arm.id, hand.id, finger.id, head.id])
    );
  });

  it('evaluates component presence and nested values across all parts', async () => {
    await service.buildAdjacencyCache(actor.id);
    const bodyComponent = createBodyComponent();

    expect(service.hasPartWithComponent(bodyComponent, 'core:tattoo')).toBe(
      true
    );
    expect(
      service.hasPartWithComponent(bodyComponent, 'core:nonexistent')
    ).toBe(false);

    expect(
      service.hasPartWithComponentValue(
        bodyComponent,
        'core:metrics',
        'status.color',
        'red'
      )
    ).toEqual({ found: true, partId: hand.id });
    expect(
      service.hasPartWithComponentValue(
        bodyComponent,
        'core:metrics',
        'status.color',
        'blue'
      )
    ).toEqual({ found: false });
  });

  it('exposes body graph facade and anatomy metadata', async () => {
    const graph = await service.getBodyGraph(actor.id);
    expect(new Set(graph.getAllPartIds())).toEqual(
      new Set([actor.id, torso.id, arm.id, hand.id, finger.id, head.id])
    );
    expect(graph.getConnectedParts(arm.id)).toEqual([hand.id]);

    const anatomyData = await service.getAnatomyData(actor.id);
    expect(anatomyData).toEqual({
      recipeId: 'recipe:human-base',
      rootEntityId: actor.id,
    });

    const missingData = await service.getAnatomyData(head.id);
    expect(missingData).toBeNull();
  });

  it('detaches parts with and without cascading while invalidating caches', async () => {
    await service.buildAdjacencyCache(torso.id);

    const nonCascadeResult = await service.detachPart(arm.id, {
      cascade: false,
      reason: 'selective-removal',
    });

    expect(nonCascadeResult).toEqual({
      detached: [arm.id],
      parentId: torso.id,
      socketId: 'shoulder-left',
    });
    expect(entityManager.getComponentData(arm.id, 'anatomy:joint')).toBeNull();
    expect(
      entityManager.getComponentData(hand.id, 'anatomy:joint')
    ).not.toBeNull();
    expect(service.hasCache(torso.id)).toBe(false);

    // Reattach for cascade scenario
    entityManager.addComponent(arm.id, 'anatomy:joint', {
      parentId: torso.id,
      socketId: 'shoulder-left',
    });
    await service.buildAdjacencyCache(torso.id);

    const cascadeResult = await service.detachPart(arm.id);
    expect(new Set(cascadeResult.detached)).toEqual(
      new Set([arm.id, hand.id, finger.id])
    );
    const detachEvent = eventDispatcher.dispatchCalls.at(-1);
    expect(detachEvent).toMatchObject({
      type: LIMB_DETACHED_EVENT_ID,
      payload: expect.objectContaining({
        detachedEntityId: arm.id,
        parentEntityId: torso.id,
        socketId: 'shoulder-left',
      }),
    });
    expect(detachEvent.payload.detachedCount).toBe(
      cascadeResult.detached.length
    );
    expect(service.hasCache(torso.id)).toBe(false);
  });

  it('validates cache integrity and reports issues when anatomy changes', async () => {
    await service.buildAdjacencyCache(torso.id);
    const healthyValidation = service.validateCache();
    expect(healthyValidation).toEqual({ valid: true, issues: [] });

    entityManager.deleteEntity(hand.id);
    const failingValidation = service.validateCache();
    expect(failingValidation.valid).toBe(false);
    expect(failingValidation.issues.length).toBeGreaterThan(0);
  });

  it('throws when attempting to detach entities without joint data', async () => {
    await service.buildAdjacencyCache(torso.id);
    await expect(service.detachPart(torso.id)).rejects.toThrow(
      /has no joint component/
    );
  });
});
