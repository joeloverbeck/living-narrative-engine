import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  BodyGraphService,
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

class IntegrationEntityManager {
  constructor() {
    /** @type {Set<string>} */
    this.entities = new Set();
    /** @type {Map<string, any>} */
    this.components = new Map();
    /** @type {Map<string, Map<string, { id: string }>>} */
    this.componentIndex = new Map();
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
    if (!this.components.has(key)) {
      return null;
    }
    return this.#clone(this.components.get(key));
  }

  getEntitiesWithComponent(componentId) {
    const index = this.componentIndex.get(componentId);
    if (!index) return [];
    return Array.from(index.keys()).map((id) => ({ id }));
  }

  getEntityInstance(entityId) {
    if (!this.entities.has(entityId)) {
      throw new Error(`Entity '${entityId}' not found`);
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

const createDispatcher = () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
});

/**
 *
 */
async function createFixture() {
  const entityManager = new IntegrationEntityManager();
  const logger = createLogger();
  const eventDispatcher = createDispatcher();
  const service = new BodyGraphService({
    entityManager,
    logger,
    eventDispatcher,
  });

  const actorId = 'actor-1';
  const partIds = {
    torso: 'torso-1',
    head: 'head-1',
    leftArm: 'left-arm-1',
    leftHand: 'left-hand-1',
    leftFinger: 'left-finger-1',
    rightArm: 'right-arm-1',
    rightHand: 'right-hand-1',
    heart: 'heart-1',
    floating: 'floating-1',
  };

  entityManager.addComponent(actorId, 'core:name', { text: 'Actor One' });
  entityManager.addComponent(actorId, 'anatomy:body', {
    recipeId: 'test:humanoid',
    body: { root: partIds.torso },
    structure: { rootPartId: partIds.torso },
  });

  entityManager.addComponent(partIds.torso, 'anatomy:part', {
    subType: 'torso',
  });
  entityManager.addComponent(partIds.torso, 'anatomy:joint', {
    parentId: actorId,
    socketId: 'core',
  });
  entityManager.addComponent(partIds.torso, 'custom:metadata', {
    labels: ['center', 'core'],
  });

  entityManager.addComponent(partIds.head, 'anatomy:part', { subType: 'head' });
  entityManager.addComponent(partIds.head, 'anatomy:joint', {
    parentId: partIds.torso,
    socketId: 'neck',
  });

  entityManager.addComponent(partIds.leftArm, 'anatomy:part', {
    subType: 'arm',
  });
  entityManager.addComponent(partIds.leftArm, 'anatomy:joint', {
    parentId: partIds.torso,
    socketId: 'left-shoulder',
  });
  entityManager.addComponent(partIds.leftArm, 'anatomy:status', {
    posture: { state: 'raised' },
  });

  entityManager.addComponent(partIds.leftHand, 'anatomy:part', {
    subType: 'hand',
  });
  entityManager.addComponent(partIds.leftHand, 'anatomy:joint', {
    parentId: partIds.leftArm,
    socketId: 'left-wrist',
  });
  entityManager.addComponent(partIds.leftHand, 'equipment:grip', {
    itemId: 'sword-1',
  });

  entityManager.addComponent(partIds.leftFinger, 'anatomy:part', {
    subType: 'finger',
  });
  entityManager.addComponent(partIds.leftFinger, 'anatomy:joint', {
    parentId: partIds.leftHand,
    socketId: 'left-index',
  });

  entityManager.addComponent(partIds.rightArm, 'anatomy:part', {
    subType: 'arm',
  });
  entityManager.addComponent(partIds.rightArm, 'anatomy:joint', {
    parentId: partIds.torso,
    socketId: 'right-shoulder',
  });

  entityManager.addComponent(partIds.rightHand, 'anatomy:part', {
    subType: 'hand',
  });
  entityManager.addComponent(partIds.rightHand, 'anatomy:joint', {
    parentId: partIds.rightArm,
    socketId: 'right-wrist',
  });

  entityManager.addComponent(partIds.heart, 'anatomy:part', {
    subType: 'heart',
  });
  entityManager.addComponent(partIds.heart, 'anatomy:joint', {
    parentId: partIds.torso,
    socketId: 'chest',
  });

  entityManager.addComponent(partIds.floating, 'anatomy:part', {
    subType: 'floating',
  });

  const bodyComponent = entityManager.getComponentData(actorId, 'anatomy:body');
  const blueprintBodyComponent = {
    root: partIds.torso,
    structure: { rootPartId: partIds.torso },
  };

  return {
    service,
    entityManager,
    logger,
    eventDispatcher,
    actorId,
    partIds,
    bodyComponent,
    blueprintBodyComponent,
  };
}

describe('BodyGraphService integration – graph operations', () => {
  it('validates dependencies before constructing the service', () => {
    const entityManager = new IntegrationEntityManager();
    const logger = createLogger();
    const dispatcher = createDispatcher();

    expect(
      () => new BodyGraphService({ logger, eventDispatcher: dispatcher })
    ).toThrow(InvalidArgumentError);
    expect(
      () => new BodyGraphService({ entityManager, eventDispatcher: dispatcher })
    ).toThrow(InvalidArgumentError);
    expect(() => new BodyGraphService({ entityManager, logger })).toThrow(
      InvalidArgumentError
    );

    const service = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher: dispatcher,
    });
    expect(service).toBeInstanceOf(BodyGraphService);
  });

  it('finds anatomy roots using entity data even before caches are built', async () => {
    const fixture = await createFixture();
    const { service, partIds, actorId } = fixture;

    expect(service.hasCache(actorId)).toBe(false);
    expect(service.getAnatomyRoot(partIds.leftHand)).toBe(actorId);
    expect(service.getAnatomyRoot('non-existent')).toBe('non-existent');
    expect(service.getAnatomyRoot(undefined)).toBeNull();
  });

  describe('with populated caches', () => {
    /** @type {ReturnType<typeof createFixture> extends Promise<infer T> ? T : never} */
    let fixture;

    beforeEach(async () => {
      fixture = await createFixture();
      await fixture.service.buildAdjacencyCache(fixture.actorId);
      // Second call should be a no-op but covers branch where cache already exists
      await fixture.service.buildAdjacencyCache(fixture.actorId);
    });

    it('supports traversing and caching body parts across graph helpers', () => {
      const {
        service,
        actorId,
        partIds,
        bodyComponent,
        blueprintBodyComponent,
      } = fixture;

      expect(service.hasCache(actorId)).toBe(true);

      const allPartsFirst = service.getAllParts(bodyComponent, actorId);
      expect(allPartsFirst).toEqual(
        expect.arrayContaining([
          partIds.torso,
          partIds.head,
          partIds.leftArm,
          partIds.leftHand,
          partIds.leftFinger,
          partIds.rightArm,
          partIds.rightHand,
          partIds.heart,
        ])
      );

      const allPartsSecond = service.getAllParts(bodyComponent, actorId);
      expect(allPartsSecond).toBe(allPartsFirst);

      const expectedWithoutActor = allPartsFirst.filter((id) => id !== actorId);
      const blueprintParts = service.getAllParts(blueprintBodyComponent);
      expect(blueprintParts).toEqual(
        expect.arrayContaining(expectedWithoutActor)
      );
      expect(blueprintParts).toHaveLength(expectedWithoutActor.length);

      const fallbackRootParts = service.getAllParts(
        bodyComponent,
        'other-actor'
      );
      expect(fallbackRootParts).toEqual(
        expect.arrayContaining(expectedWithoutActor)
      );
      expect(fallbackRootParts).toHaveLength(expectedWithoutActor.length);

      expect(service.getAllParts(null)).toEqual([]);
      expect(service.getAllParts({})).toEqual([]);

      const handPartsFirst = service.findPartsByType(actorId, 'hand');
      expect(handPartsFirst).toEqual(
        expect.arrayContaining([partIds.leftHand, partIds.rightHand])
      );
      const handPartsSecond = service.findPartsByType(actorId, 'hand');
      expect(handPartsSecond).toBe(handPartsFirst);

      expect(service.getAnatomyRoot(partIds.leftHand)).toBe(actorId);

      expect(service.getChildren(actorId)).toEqual([partIds.torso]);
      expect(service.getChildren(partIds.leftArm)).toEqual([partIds.leftHand]);

      expect(service.getParent(partIds.leftHand)).toBe(partIds.leftArm);
      expect(service.getParent('unknown')).toBeNull();

      expect(service.getAncestors(partIds.leftFinger)).toEqual([
        partIds.leftHand,
        partIds.leftArm,
        partIds.torso,
        actorId,
      ]);
      expect(service.getAncestors(partIds.torso)).toEqual([actorId]);

      expect(service.getAllDescendants(partIds.torso)).toEqual(
        expect.arrayContaining([
          partIds.head,
          partIds.leftArm,
          partIds.leftHand,
          partIds.leftFinger,
          partIds.rightArm,
          partIds.rightHand,
          partIds.heart,
        ])
      );

      expect(service.getPath(partIds.leftFinger, partIds.rightHand)).toEqual([
        partIds.leftFinger,
        partIds.leftHand,
        partIds.leftArm,
        partIds.torso,
        partIds.rightArm,
        partIds.rightHand,
      ]);
      expect(service.getPath(partIds.leftHand, partIds.leftHand)).toEqual([
        partIds.leftHand,
      ]);
      expect(service.getPath(partIds.leftHand, partIds.floating)).toBeNull();

      const validation = service.validateCache();
      expect(validation.valid).toBe(true);
      expect(validation.issues).toEqual([]);
    });

    it('checks component presence and nested values across the anatomy', () => {
      const { service, bodyComponent, partIds } = fixture;

      expect(
        service.hasPartWithComponent(bodyComponent, 'equipment:grip')
      ).toBe(true);
      expect(
        service.hasPartWithComponent(bodyComponent, 'anatomy:status')
      ).toBe(true);
      expect(service.hasPartWithComponent(bodyComponent, 'non-existent')).toBe(
        false
      );

      const gripCheck = service.hasPartWithComponentValue(
        bodyComponent,
        'equipment:grip',
        'itemId',
        'sword-1'
      );
      expect(gripCheck).toEqual({ found: true, partId: partIds.leftHand });

      const statusCheck = service.hasPartWithComponentValue(
        bodyComponent,
        'anatomy:status',
        'posture.state',
        'raised'
      );
      expect(statusCheck).toEqual({ found: true, partId: partIds.leftArm });

      const missingCheck = service.hasPartWithComponentValue(
        bodyComponent,
        'anatomy:status',
        'posture.state',
        'relaxed'
      );
      expect(missingCheck).toEqual({ found: false });
    });

    it('retrieves body graphs, metadata, and handles graph access errors', async () => {
      const { service, actorId, entityManager } = fixture;

      await expect(service.getBodyGraph(null)).rejects.toThrow(
        InvalidArgumentError
      );

      entityManager.addComponent('spectator-1', 'core:name', {
        text: 'Spectator',
      });
      await expect(service.getBodyGraph('spectator-1')).rejects.toThrow(
        'Entity spectator-1 has no anatomy:body component'
      );

      const graph = await service.getBodyGraph(actorId);
      const cachedParts = service.getAllParts(fixture.bodyComponent, actorId);
      expect(graph.getAllPartIds()).toEqual(
        expect.arrayContaining(cachedParts)
      );
      expect(graph.getConnectedParts(fixture.partIds.leftArm)).toEqual([
        fixture.partIds.leftHand,
      ]);
      expect(graph.getConnectedParts(fixture.partIds.rightHand)).toEqual([]);

      await expect(service.getAnatomyData('')).rejects.toThrow(
        InvalidArgumentError
      );

      const anatomyData = await service.getAnatomyData(actorId);
      expect(anatomyData).toEqual({
        recipeId: 'test:humanoid',
        rootEntityId: actorId,
      });

      const noBodyData = await service.getAnatomyData('spectator-1');
      expect(noBodyData).toBeNull();
    });

    it('detaches parts, invalidates caches, and emits limb detachment events', async () => {
      const { service, actorId, partIds, eventDispatcher, entityManager } =
        fixture;

      await expect(service.detachPart('spectator-1')).rejects.toThrow(
        InvalidArgumentError
      );

      const detachResult = await service.detachPart(partIds.leftArm, {
        cascade: true,
        reason: 'injury',
      });
      expect(detachResult).toEqual({
        detached: expect.arrayContaining([
          partIds.leftArm,
          partIds.leftHand,
          partIds.leftFinger,
        ]),
        parentId: partIds.torso,
        socketId: 'left-shoulder',
      });

      expect(service.hasCache(actorId)).toBe(false);

      expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
        LIMB_DETACHED_EVENT_ID,
        expect.objectContaining({
          detachedEntityId: partIds.leftArm,
          parentEntityId: partIds.torso,
          socketId: 'left-shoulder',
          detachedCount: detachResult.detached.length,
          reason: 'injury',
          timestamp: expect.any(Number),
        })
      );

      // Rebuild cache and ensure detached parts are gone
      await service.buildAdjacencyCache(actorId);
      const graphAfterDetach = await service.getBodyGraph(actorId);
      expect(graphAfterDetach.getAllPartIds()).toEqual(
        expect.not.arrayContaining([partIds.leftArm, partIds.leftHand])
      );

      // Add a fresh limb to test non-cascading detach
      entityManager.addComponent(partIds.leftArm, 'anatomy:part', {
        subType: 'arm',
      });
      entityManager.addComponent(partIds.leftArm, 'anatomy:joint', {
        parentId: partIds.torso,
        socketId: 'left-shoulder',
      });
      entityManager.addComponent(partIds.leftHand, 'anatomy:part', {
        subType: 'hand',
      });
      entityManager.addComponent(partIds.leftHand, 'anatomy:joint', {
        parentId: partIds.leftArm,
        socketId: 'left-wrist',
      });
      await service.buildAdjacencyCache(actorId);

      const detachSingle = await service.detachPart(partIds.leftHand, {
        cascade: false,
      });
      expect(detachSingle.detached).toEqual([partIds.leftHand]);
      expect(
        entityManager.getComponentData(partIds.leftHand, 'anatomy:joint')
      ).toBeNull();
    });
  });
});
