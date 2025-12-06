import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import BodyGraphService, {
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

class InMemoryEntityManager {
  constructor() {
    /** @type {Map<string, Map<string, any>>} */
    this.entities = new Map();
    /** @type {Map<string, Map<string, { id: string }>>} */
    this.componentIndex = new Map();
  }

  #ensureEntity(entityId) {
    if (!this.entities.has(entityId)) {
      this.entities.set(entityId, new Map());
    }
  }

  #clone(value) {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof structuredClone === 'function') {
      return structuredClone(value);
    }

    return JSON.parse(JSON.stringify(value));
  }

  addComponent(entityId, componentId, data) {
    this.#ensureEntity(entityId);
    this.entities.get(entityId).set(componentId, this.#clone(data));

    if (!this.componentIndex.has(componentId)) {
      this.componentIndex.set(componentId, new Map());
    }

    this.componentIndex.get(componentId).set(entityId, { id: entityId });
  }

  updateComponent(entityId, componentId, data) {
    this.addComponent(entityId, componentId, data);
  }

  async removeComponent(entityId, componentId) {
    const entity = this.entities.get(entityId);
    if (entity) {
      entity.delete(componentId);
    }

    const index = this.componentIndex.get(componentId);
    if (index) {
      index.delete(entityId);
      if (index.size === 0) {
        this.componentIndex.delete(componentId);
      }
    }
  }

  getComponentData(entityId, componentId) {
    const entity = this.entities.get(entityId);
    if (!entity) {
      return null;
    }

    const component = entity.get(componentId);
    return component !== undefined ? this.#clone(component) : null;
  }

  getEntitiesWithComponent(componentId) {
    const index = this.componentIndex.get(componentId);
    if (!index) {
      return [];
    }

    return Array.from(index.values()).map(({ id }) => ({ id }));
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

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createEventDispatcher = (collector) => ({
  dispatch: jest.fn((eventId, payload) => {
    collector.push({ eventId, payload });
    return Promise.resolve();
  }),
});

describe('BodyGraphService integration – comprehensive coverage', () => {
  /** @type {InMemoryEntityManager} */
  let entityManager;
  let logger;
  let dispatchedEvents;
  let eventDispatcher;
  /** @type {BodyGraphService} */
  let service;
  let ids;
  let actorBodyComponent;
  let blueprintBodyComponent;

  beforeEach(() => {
    entityManager = new InMemoryEntityManager();
    logger = createLogger();
    dispatchedEvents = [];
    eventDispatcher = createEventDispatcher(dispatchedEvents);
    service = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher,
    });

    ids = {
      blueprintRoot: 'blueprint-root',
      blueprintTorso: 'blueprint-torso',
      blueprintArm: 'blueprint-arm',
      actor: 'actor-root',
      torso: 'actor-torso',
      head: 'actor-head',
      leftArm: 'actor-left-arm',
      rightArm: 'actor-right-arm',
      leftHand: 'actor-left-hand',
      rightHand: 'actor-right-hand',
      leftFinger: 'actor-left-finger',
      orphanSensor: 'actor-orphan-sensor',
      nonBodyEntity: 'non-body-entity',
    };

    // Blueprint structure
    entityManager.addComponent(ids.blueprintRoot, 'anatomy:body', {
      recipeId: 'blueprint:synthetic',
      body: { root: ids.blueprintTorso },
      structure: { rootPartId: ids.blueprintTorso },
    });
    entityManager.addComponent(ids.blueprintTorso, 'anatomy:part', {
      subType: 'torso',
    });
    entityManager.addComponent(ids.blueprintTorso, 'anatomy:joint', {
      parentId: ids.blueprintRoot,
      socketId: 'core',
    });
    entityManager.addComponent(ids.blueprintArm, 'anatomy:part', {
      subType: 'arm',
    });
    entityManager.addComponent(ids.blueprintArm, 'anatomy:joint', {
      parentId: ids.blueprintTorso,
      socketId: 'left-shoulder',
    });

    // Actor structure
    entityManager.addComponent(ids.actor, 'anatomy:body', {
      recipeId: 'actor:synthetic',
      body: { root: ids.torso },
      structure: { rootPartId: ids.torso },
    });
    entityManager.addComponent(ids.torso, 'anatomy:part', { subType: 'torso' });
    entityManager.addComponent(ids.torso, 'anatomy:joint', {
      parentId: ids.actor,
      socketId: 'core',
    });
    entityManager.addComponent(ids.head, 'anatomy:part', { subType: 'head' });
    entityManager.addComponent(ids.head, 'anatomy:joint', {
      parentId: ids.torso,
      socketId: 'neck',
    });
    entityManager.addComponent(ids.leftArm, 'anatomy:part', { subType: 'arm' });
    entityManager.addComponent(ids.leftArm, 'anatomy:joint', {
      parentId: ids.torso,
      socketId: 'left-shoulder',
    });
    entityManager.addComponent(ids.rightArm, 'anatomy:part', {
      subType: 'arm',
    });
    entityManager.addComponent(ids.rightArm, 'anatomy:joint', {
      parentId: ids.torso,
      socketId: 'right-shoulder',
    });
    entityManager.addComponent(ids.leftHand, 'anatomy:part', {
      subType: 'hand',
    });
    entityManager.addComponent(ids.leftHand, 'anatomy:joint', {
      parentId: ids.leftArm,
      socketId: 'wrist',
    });
    entityManager.addComponent(ids.rightHand, 'anatomy:part', {
      subType: 'hand',
    });
    entityManager.addComponent(ids.rightHand, 'anatomy:joint', {
      parentId: ids.rightArm,
      socketId: 'wrist',
    });
    entityManager.addComponent(ids.leftFinger, 'anatomy:part', {
      subType: 'finger',
    });
    entityManager.addComponent(ids.leftFinger, 'anatomy:joint', {
      parentId: ids.leftHand,
      socketId: 'finger-1',
    });

    // Additional components for coverage checks
    entityManager.addComponent(ids.leftHand, 'status:health', { health: 90 });
    entityManager.addComponent(ids.rightHand, 'status:empty', {});
    entityManager.addComponent(ids.leftFinger, 'custom:sensor', {
      state: { mode: 'grip' },
    });

    // Non-body entity for negative scenarios
    entityManager.addComponent(ids.nonBodyEntity, 'inventory:slot', {
      capacity: 2,
    });

    actorBodyComponent = entityManager.getComponentData(
      ids.actor,
      'anatomy:body'
    );
    blueprintBodyComponent = entityManager.getComponentData(
      ids.blueprintRoot,
      'anatomy:body'
    );
  });

  it('enforces dependency requirements', () => {
    const localEntityManager = new InMemoryEntityManager();
    const localLogger = createLogger();
    const localDispatcher = createEventDispatcher([]);

    expect(
      () =>
        new BodyGraphService({
          logger: localLogger,
          eventDispatcher: localDispatcher,
        })
    ).toThrow('entityManager is required');

    expect(
      () =>
        new BodyGraphService({
          entityManager: localEntityManager,
          eventDispatcher: localDispatcher,
        })
    ).toThrow('logger is required');

    expect(
      () =>
        new BodyGraphService({
          entityManager: localEntityManager,
          logger: localLogger,
        })
    ).toThrow('eventDispatcher is required');
  });

  it('performs full anatomy graph operations with caching, queries, and traversal', async () => {
    await service.buildAdjacencyCache(ids.actor);
    await service.buildAdjacencyCache(ids.actor);
    await service.buildAdjacencyCache(ids.blueprintRoot);

    expect(service.hasCache(ids.actor)).toBe(true);
    expect(service.hasCache(ids.blueprintRoot)).toBe(true);
    expect(service.hasCache('unknown-root')).toBe(false);

    expect(service.getAllParts()).toEqual([]);
    expect(service.getAllParts({})).toEqual([]);

    const blueprintPartsFirst = service.getAllParts(blueprintBodyComponent);
    const blueprintPartsSecond = service.getAllParts(blueprintBodyComponent);
    expect(blueprintPartsSecond).toEqual(blueprintPartsFirst);
    expect(new Set(blueprintPartsFirst)).toEqual(
      new Set([ids.blueprintTorso, ids.blueprintArm])
    );

    const actorPartsFirst = service.getAllParts(actorBodyComponent, ids.actor);
    const actorPartsSecond = service.getAllParts(actorBodyComponent, ids.actor);
    expect(actorPartsSecond).toEqual(actorPartsFirst);
    expect(actorPartsFirst).toEqual(
      expect.arrayContaining([
        ids.actor,
        ids.torso,
        ids.head,
        ids.leftArm,
        ids.rightArm,
        ids.leftHand,
        ids.rightHand,
        ids.leftFinger,
      ])
    );

    const fallbackToBlueprint = service.getAllParts(
      actorBodyComponent,
      'untracked-actor'
    );
    expect(fallbackToBlueprint).toEqual(
      expect.arrayContaining(
        actorPartsFirst.filter((partId) => partId !== ids.actor)
      )
    );

    const directStructureParts = service.getAllParts({ root: ids.torso });
    expect(directStructureParts).toEqual(
      expect.arrayContaining(
        actorPartsFirst.filter((partId) => partId !== ids.actor)
      )
    );

    expect(service.getAllParts({ root: undefined })).toEqual([]);

    const findUnknown = service.findPartsByType('missing-root', 'arm');
    expect(findUnknown).toEqual([]);

    const armsFirst = service.findPartsByType(ids.actor, 'arm');
    const armsSecond = service.findPartsByType(ids.actor, 'arm');
    expect(armsSecond).toEqual(armsFirst);
    expect(new Set(armsFirst)).toEqual(new Set([ids.leftArm, ids.rightArm]));

    expect(service.getAnatomyRoot(null)).toBeNull();
    expect(service.getAnatomyRoot('missing-entity')).toBe('missing-entity');

    const rootFromHand = service.getAnatomyRoot(ids.leftHand);
    expect(rootFromHand).toBe(ids.actor);

    entityManager.addComponent(ids.orphanSensor, 'anatomy:part', {
      subType: 'sensor',
    });
    entityManager.addComponent(ids.orphanSensor, 'anatomy:joint', {
      parentId: ids.leftHand,
      socketId: 'sensor',
    });
    const rootFromOrphan = service.getAnatomyRoot(ids.orphanSensor);
    expect(rootFromOrphan).toBe(ids.actor);

    const samePath = service.getPath(ids.leftHand, ids.leftHand);
    expect(samePath).toEqual([ids.leftHand]);

    const pathBetweenHands = service.getPath(ids.leftHand, ids.rightHand);
    expect(pathBetweenHands).toEqual([
      ids.leftHand,
      ids.leftArm,
      ids.torso,
      ids.rightArm,
      ids.rightHand,
    ]);

    expect(service.getPath(ids.leftHand, 'missing-hand')).toBeNull();

    expect(
      service.hasPartWithComponent(actorBodyComponent, 'status:health')
    ).toBe(true);
    expect(
      service.hasPartWithComponent(actorBodyComponent, 'status:empty')
    ).toBe(false);
    expect(
      service.hasPartWithComponent(actorBodyComponent, 'nonexistent:component')
    ).toBe(false);

    const sensorMatch = service.hasPartWithComponentValue(
      actorBodyComponent,
      'custom:sensor',
      'state.mode',
      'grip'
    );
    expect(sensorMatch).toEqual({ found: true, partId: ids.leftFinger });

    const sensorMiss = service.hasPartWithComponentValue(
      actorBodyComponent,
      'custom:sensor',
      'state.mode',
      'release'
    );
    expect(sensorMiss).toEqual({ found: false });

    await expect(service.getBodyGraph(null)).rejects.toThrow(
      InvalidArgumentError
    );
    await expect(service.getBodyGraph(ids.nonBodyEntity)).rejects.toThrow(
      `Entity ${ids.nonBodyEntity} has no anatomy:body component`
    );

    const bodyGraph = await service.getBodyGraph(ids.actor);
    const allPartIds = bodyGraph.getAllPartIds();
    expect(new Set(allPartIds)).toEqual(new Set(actorPartsFirst));
    expect(bodyGraph.getConnectedParts(ids.leftArm)).toEqual([ids.leftHand]);
    expect(bodyGraph.getConnectedParts('missing-node')).toEqual([]);

    await expect(service.getAnatomyData(null)).rejects.toThrow(
      InvalidArgumentError
    );
    await expect(service.getAnatomyData('unknown-entity')).resolves.toBeNull();

    const anatomyData = await service.getAnatomyData(ids.actor);
    expect(anatomyData).toEqual({
      recipeId: 'actor:synthetic',
      rootEntityId: ids.actor,
    });

    const blueprintData = await service.getAnatomyData(ids.blueprintRoot);
    expect(blueprintData).toEqual({
      recipeId: 'blueprint:synthetic',
      rootEntityId: ids.blueprintRoot,
    });

    const validation = service.validateCache();
    expect(validation.valid).toBe(true);
    expect(validation.issues).toEqual([]);

    expect(service.getChildren(ids.actor)).toEqual([ids.torso]);
    expect(new Set(service.getChildren(ids.torso))).toEqual(
      new Set([ids.head, ids.leftArm, ids.rightArm])
    );
    expect(service.getChildren('ghost')).toEqual([]);

    expect(service.getParent(ids.actor)).toBeNull();
    expect(service.getParent(ids.torso)).toBe(ids.actor);
    expect(service.getParent('ghost')).toBeNull();

    expect(service.getAncestors(ids.leftFinger)).toEqual([
      ids.leftHand,
      ids.leftArm,
      ids.torso,
      ids.actor,
    ]);
    expect(service.getAncestors('ghost')).toEqual([]);

    expect(new Set(service.getAllDescendants(ids.actor))).toEqual(
      new Set([
        ids.torso,
        ids.head,
        ids.leftArm,
        ids.rightArm,
        ids.leftHand,
        ids.rightHand,
        ids.leftFinger,
      ])
    );
    expect(new Set(service.getAllDescendants(ids.leftArm))).toEqual(
      new Set([ids.leftHand, ids.leftFinger])
    );
    expect(service.getAllDescendants('ghost')).toEqual([]);
  });

  it('handles detaching parts with and without cascades while maintaining cache integrity', async () => {
    await service.buildAdjacencyCache(ids.actor);

    const rightHandDetach = await service.detachPart(ids.rightHand, {
      cascade: false,
      reason: 'manual-check',
    });
    expect(rightHandDetach).toEqual({
      detached: [ids.rightHand],
      parentId: ids.rightArm,
      socketId: 'wrist',
    });

    expect(dispatchedEvents[0].eventId).toBe(LIMB_DETACHED_EVENT_ID);
    expect(dispatchedEvents[0].payload.detachedCount).toBe(1);
    expect(dispatchedEvents[0].payload.reason).toBe('manual-check');

    // Re-add detached joint to prepare for cascade coverage
    entityManager.addComponent(ids.rightHand, 'anatomy:joint', {
      parentId: ids.rightArm,
      socketId: 'wrist',
    });

    await service.buildAdjacencyCache(ids.actor);

    const cascadeDetach = await service.detachPart(ids.leftArm, {
      cascade: true,
      reason: 'cascade',
    });

    expect(new Set(cascadeDetach.detached)).toEqual(
      new Set([ids.leftArm, ids.leftHand, ids.leftFinger])
    );
    expect(cascadeDetach.parentId).toBe(ids.torso);
    expect(cascadeDetach.socketId).toBe('left-shoulder');

    expect(dispatchedEvents[1].eventId).toBe(LIMB_DETACHED_EVENT_ID);
    expect(dispatchedEvents[1].payload.detachedEntityId).toBe(ids.leftArm);
    expect(dispatchedEvents[1].payload.parentEntityId).toBe(ids.torso);
    expect(dispatchedEvents[1].payload.detachedCount).toBe(3);
    expect(dispatchedEvents[1].payload.reason).toBe('cascade');
    expect(typeof dispatchedEvents[1].payload.timestamp).toBe('number');

    expect(service.hasCache(ids.actor)).toBe(false);

    await expect(service.detachPart(ids.actor)).rejects.toThrow(
      `Entity '${ids.actor}' has no joint component - cannot detach`
    );
  });

  it('detects cache inconsistencies after external mutations', async () => {
    await service.buildAdjacencyCache(ids.actor);

    let validation = service.validateCache();
    expect(validation.valid).toBe(true);
    expect(validation.issues).toHaveLength(0);

    await service.buildAdjacencyCache(ids.blueprintRoot);

    await entityManager.removeComponent(ids.leftHand, 'anatomy:joint');

    validation = service.validateCache();
    expect(validation.valid).toBe(false);
    expect(validation.issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`'${ids.leftHand}'`),
        expect.stringContaining('no joint component'),
      ])
    );
  });
});
