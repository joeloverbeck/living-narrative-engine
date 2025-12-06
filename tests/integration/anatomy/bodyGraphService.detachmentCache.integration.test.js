import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import BodyGraphService, {
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

class InMemoryEntityManager {
  constructor() {
    /** @type {Map<string, Map<string, any>>} */
    this.entities = new Map();
  }

  #clone(value) {
    if (value === null || value === undefined) {
      return value;
    }
    return JSON.parse(JSON.stringify(value));
  }

  #ensureEntity(entityId) {
    if (!this.entities.has(entityId)) {
      this.entities.set(entityId, new Map());
    }
  }

  addComponent(entityId, componentId, data) {
    this.#ensureEntity(entityId);
    this.entities.get(entityId).set(componentId, this.#clone(data));
  }

  setComponent(entityId, componentId, data) {
    this.addComponent(entityId, componentId, data);
  }

  updateComponent(entityId, componentId, data) {
    this.addComponent(entityId, componentId, data);
  }

  getComponentData(entityId, componentId) {
    const components = this.entities.get(entityId);
    if (!components) {
      return null;
    }
    const value = components.get(componentId);
    return value === undefined ? null : this.#clone(value);
  }

  async removeComponent(entityId, componentId) {
    const components = this.entities.get(entityId);
    if (components) {
      components.delete(componentId);
    }
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

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createEventDispatcher = () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
});

const ACTOR_ID = 'actor-hero';
const PART_IDS = {
  blueprintTorso: 'blueprint-torso',
  torso: 'actor-torso',
  head: 'actor-head',
  leftArm: 'left-arm',
  leftHand: 'left-hand',
  rightArm: 'right-arm',
  rightHand: 'right-hand',
  heart: 'actor-heart',
  leftLeg: 'left-leg',
  leftFoot: 'left-foot',
  floating: 'floating-crystal',
};

const populateAnatomy = (entityManager) => {
  entityManager.addComponent(ACTOR_ID, 'core:name', { text: 'Hero' });
  entityManager.addComponent(ACTOR_ID, 'anatomy:body', {
    recipeId: 'humanoid-recipe',
    body: { root: PART_IDS.torso, blueprintRoot: PART_IDS.blueprintTorso },
    structure: { rootPartId: PART_IDS.torso },
  });

  entityManager.addComponent(PART_IDS.blueprintTorso, 'anatomy:part', {
    subType: 'torso',
  });

  entityManager.addComponent(PART_IDS.torso, 'anatomy:part', {
    subType: 'torso',
  });
  entityManager.addComponent(PART_IDS.torso, 'anatomy:joint', {
    parentId: ACTOR_ID,
    socketId: 'core',
  });

  entityManager.addComponent(PART_IDS.head, 'anatomy:part', {
    subType: 'head',
  });
  entityManager.addComponent(PART_IDS.head, 'anatomy:joint', {
    parentId: PART_IDS.torso,
    socketId: 'neck',
  });

  entityManager.addComponent(PART_IDS.leftArm, 'anatomy:part', {
    subType: 'arm',
  });
  entityManager.addComponent(PART_IDS.leftArm, 'anatomy:joint', {
    parentId: PART_IDS.torso,
    socketId: 'left-shoulder',
  });
  entityManager.addComponent(PART_IDS.leftArm, 'anatomy:status', {
    posture: { state: 'raised' },
  });

  entityManager.addComponent(PART_IDS.leftHand, 'anatomy:part', {
    subType: 'hand',
  });
  entityManager.addComponent(PART_IDS.leftHand, 'anatomy:joint', {
    parentId: PART_IDS.leftArm,
    socketId: 'left-wrist',
  });
  entityManager.addComponent(PART_IDS.leftHand, 'equipment:grip', {
    itemId: 'sword',
    quality: 'legendary',
  });

  entityManager.addComponent(PART_IDS.rightArm, 'anatomy:part', {
    subType: 'arm',
  });
  entityManager.addComponent(PART_IDS.rightArm, 'anatomy:joint', {
    parentId: PART_IDS.torso,
    socketId: 'right-shoulder',
  });
  entityManager.addComponent(PART_IDS.rightArm, 'equipment:grip', {});

  entityManager.addComponent(PART_IDS.rightHand, 'anatomy:part', {
    subType: 'hand',
  });
  entityManager.addComponent(PART_IDS.rightHand, 'anatomy:joint', {
    parentId: PART_IDS.rightArm,
    socketId: 'right-wrist',
  });

  entityManager.addComponent(PART_IDS.heart, 'anatomy:part', {
    subType: 'heart',
  });
  entityManager.addComponent(PART_IDS.heart, 'anatomy:joint', {
    parentId: PART_IDS.torso,
    socketId: 'heart-socket',
  });
  entityManager.addComponent(PART_IDS.heart, 'vital:status', {
    metrics: { heartbeat: { bpm: 72 } },
  });

  entityManager.addComponent(PART_IDS.leftLeg, 'anatomy:part', {
    subType: 'leg',
  });
  entityManager.addComponent(PART_IDS.leftLeg, 'anatomy:joint', {
    parentId: PART_IDS.torso,
    socketId: 'left-hip',
  });

  entityManager.addComponent(PART_IDS.leftFoot, 'anatomy:part', {
    subType: 'foot',
  });
  entityManager.addComponent(PART_IDS.leftFoot, 'anatomy:joint', {
    parentId: PART_IDS.leftLeg,
    socketId: 'left-ankle',
  });

  entityManager.addComponent(PART_IDS.floating, 'anatomy:part', {
    subType: 'floating',
  });
};

const createService = () => {
  const entityManager = new InMemoryEntityManager();
  const logger = createLogger();
  const eventDispatcher = createEventDispatcher();
  const service = new BodyGraphService({
    entityManager,
    logger,
    eventDispatcher,
  });
  return { service, entityManager, logger, eventDispatcher };
};

describe('BodyGraphService detachment and cache invalidation integration', () => {
  let service;
  let entityManager;
  let logger;
  let eventDispatcher;
  let bodyComponent;

  beforeEach(() => {
    ({ service, entityManager, logger, eventDispatcher } = createService());
    populateAnatomy(entityManager);
    bodyComponent = entityManager.getComponentData(ACTOR_ID, 'anatomy:body');
  });

  it('manages anatomy caches, queries, and detachment flows end-to-end', async () => {
    expect(service.getAllParts(null)).toEqual([]);
    expect(service.getAllParts(undefined)).toEqual([]);

    const blueprintBodyComponent = { body: { root: PART_IDS.blueprintTorso } };
    const partsWithoutActorContext = service.getAllParts(
      blueprintBodyComponent
    );
    expect(partsWithoutActorContext).toEqual([PART_IDS.blueprintTorso]);

    await service.buildAdjacencyCache(ACTOR_ID);
    expect(service.hasCache(ACTOR_ID)).toBe(true);

    const validation = service.validateCache();
    expect(validation).toEqual({ valid: true, issues: [] });

    const allParts = service.getAllParts(bodyComponent, ACTOR_ID);
    const expectedInitialParts = new Set([
      ACTOR_ID,
      PART_IDS.torso,
      PART_IDS.head,
      PART_IDS.leftArm,
      PART_IDS.leftHand,
      PART_IDS.rightArm,
      PART_IDS.rightHand,
      PART_IDS.heart,
      PART_IDS.leftLeg,
      PART_IDS.leftFoot,
    ]);
    expect(new Set(allParts)).toEqual(expectedInitialParts);

    const cachedAllParts = service.getAllParts(bodyComponent, ACTOR_ID);
    expect(cachedAllParts).toBe(allParts);

    const hands = service.findPartsByType(ACTOR_ID, 'hand');
    expect(new Set(hands)).toEqual(
      new Set([PART_IDS.leftHand, PART_IDS.rightHand])
    );
    const cachedHands = service.findPartsByType(ACTOR_ID, 'hand');
    expect(cachedHands).toBe(hands);

    const anatomyRoot = service.getAnatomyRoot(PART_IDS.leftHand);
    expect(anatomyRoot).toBe(ACTOR_ID);
    const floatingRoot = service.getAnatomyRoot(PART_IDS.floating);
    expect(floatingRoot).toBe(PART_IDS.floating);

    const path = service.getPath(PART_IDS.leftHand, PART_IDS.heart);
    expect(path).not.toBeNull();
    expect(path[0]).toBe(PART_IDS.leftHand);
    expect(path[path.length - 1]).toBe(PART_IDS.heart);
    expect(path).toContain(PART_IDS.torso);

    expect(service.getParent(PART_IDS.leftHand)).toBe(PART_IDS.leftArm);
    expect(new Set(service.getChildren(PART_IDS.torso))).toEqual(
      new Set([
        PART_IDS.head,
        PART_IDS.leftArm,
        PART_IDS.rightArm,
        PART_IDS.heart,
        PART_IDS.leftLeg,
      ])
    );
    expect(service.getAncestors(PART_IDS.leftHand)).toEqual([
      PART_IDS.leftArm,
      PART_IDS.torso,
      ACTOR_ID,
    ]);
    expect(new Set(service.getAllDescendants(PART_IDS.leftArm))).toEqual(
      new Set([PART_IDS.leftHand])
    );

    const actorRootBodyComponent = JSON.parse(JSON.stringify(bodyComponent));
    actorRootBodyComponent.body.root = ACTOR_ID;

    expect(
      service.hasPartWithComponent(actorRootBodyComponent, 'equipment:grip')
    ).toBe(true);
    const gripAfterDetachExpectation = () =>
      service.hasPartWithComponent(actorRootBodyComponent, 'equipment:grip');

    const postureMatch = service.hasPartWithComponentValue(
      actorRootBodyComponent,
      'anatomy:status',
      'posture.state',
      'raised'
    );
    expect(postureMatch).toEqual({ found: true, partId: PART_IDS.leftArm });
    const missingPosture = service.hasPartWithComponentValue(
      bodyComponent,
      'anatomy:status',
      'posture.state',
      'lowered'
    );
    expect(missingPosture).toEqual({ found: false });

    const graph = await service.getBodyGraph(ACTOR_ID);
    expect(new Set(graph.getAllPartIds())).toEqual(expectedInitialParts);
    expect(new Set(graph.getConnectedParts(PART_IDS.torso))).toEqual(
      new Set([
        PART_IDS.head,
        PART_IDS.leftArm,
        PART_IDS.rightArm,
        PART_IDS.heart,
        PART_IDS.leftLeg,
      ])
    );
    await expect(service.getBodyGraph(PART_IDS.floating)).rejects.toThrow(
      'has no anatomy:body component'
    );
    await expect(service.getBodyGraph(123)).rejects.toThrow(
      'Entity ID is required and must be a string'
    );

    await expect(service.getAnatomyData(123)).rejects.toThrow(
      'Entity ID is required and must be a string'
    );
    await expect(service.getAnatomyData(PART_IDS.floating)).resolves.toBeNull();
    await expect(service.getAnatomyData(ACTOR_ID)).resolves.toEqual({
      recipeId: 'humanoid-recipe',
      rootEntityId: ACTOR_ID,
    });

    const handsBeforeDetach = service.findPartsByType(ACTOR_ID, 'hand');
    expect(new Set(handsBeforeDetach)).toEqual(
      new Set([PART_IDS.leftHand, PART_IDS.rightHand])
    );

    const detachCascade = await service.detachPart(PART_IDS.leftArm, {
      cascade: true,
      reason: 'injury',
    });
    expect(detachCascade.detached).toEqual(
      expect.arrayContaining([PART_IDS.leftArm, PART_IDS.leftHand])
    );
    expect(detachCascade.parentId).toBe(PART_IDS.torso);
    expect(detachCascade.socketId).toBe('left-shoulder');
    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
      LIMB_DETACHED_EVENT_ID,
      expect.objectContaining({
        detachedEntityId: PART_IDS.leftArm,
        parentEntityId: PART_IDS.torso,
        socketId: 'left-shoulder',
        detachedCount: 2,
        reason: 'injury',
      })
    );
    expect(
      entityManager.getComponentData(PART_IDS.leftArm, 'anatomy:joint')
    ).toBeNull();
    expect(service.hasCache(ACTOR_ID)).toBe(false);
    const validationAfterDetach = service.validateCache();
    expect(validationAfterDetach).toEqual({ valid: true, issues: [] });

    await service.buildAdjacencyCache(ACTOR_ID);
    const handsAfterCascade = service.findPartsByType(ACTOR_ID, 'hand');
    expect(handsAfterCascade).toEqual([PART_IDS.rightHand]);
    expect(handsAfterCascade).not.toBe(handsBeforeDetach);
    expect(gripAfterDetachExpectation()).toBe(false);
    const postureAfterDetach = service.hasPartWithComponentValue(
      actorRootBodyComponent,
      'anatomy:status',
      'posture.state',
      'raised'
    );
    expect(postureAfterDetach).toEqual({ found: false });

    const detachSingle = await service.detachPart(PART_IDS.rightHand, {
      cascade: false,
      reason: 'inspection',
    });
    expect(detachSingle.detached).toEqual([PART_IDS.rightHand]);
    expect(detachSingle.parentId).toBe(PART_IDS.rightArm);
    expect(detachSingle.socketId).toBe('right-wrist');
    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
      LIMB_DETACHED_EVENT_ID,
      expect.objectContaining({
        detachedEntityId: PART_IDS.rightHand,
        parentEntityId: PART_IDS.rightArm,
        detachedCount: 1,
        reason: 'inspection',
      })
    );

    await expect(service.detachPart(PART_IDS.floating)).rejects.toThrow(
      InvalidArgumentError
    );

    await service.buildAdjacencyCache(ACTOR_ID);
    const finalHands = service.findPartsByType(ACTOR_ID, 'hand');
    expect(finalHands).toEqual([]);
    const finalParts = service.getAllParts(bodyComponent, ACTOR_ID);
    expect(new Set(finalParts)).toEqual(
      new Set([
        ACTOR_ID,
        PART_IDS.torso,
        PART_IDS.head,
        PART_IDS.rightArm,
        PART_IDS.heart,
        PART_IDS.leftLeg,
        PART_IDS.leftFoot,
      ])
    );

    const pathAfterUpdates = service.getPath(PART_IDS.rightArm, PART_IDS.heart);
    expect(pathAfterUpdates).toContain(PART_IDS.torso);

    expect(logger.debug).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalled();
  });
});
