import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import BodyGraphService, {
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import { AnatomyCacheManager } from '../../../src/anatomy/anatomyCacheManager.js';
import { AnatomyGraphAlgorithms } from '../../../src/anatomy/anatomyGraphAlgorithms.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

class InMemoryEntityManager {
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

  #ensureEntity(entityId) {
    if (!entityId) {
      throw new Error('entityId is required');
    }
    this.entities.add(entityId);
  }

  addComponent(entityId, componentId, data) {
    this.#ensureEntity(entityId);
    const key = this.#key(entityId, componentId);
    this.components.set(key, this.#clone(data));
    if (!this.componentIndex.has(componentId)) {
      this.componentIndex.set(componentId, new Map());
    }
    this.componentIndex.get(componentId).set(entityId, { id: entityId });
  }

  updateComponent(entityId, componentId, data) {
    this.addComponent(entityId, componentId, data);
  }

  getComponentData(entityId, componentId) {
    const key = this.#key(entityId, componentId);
    const stored = this.components.get(key);
    return stored !== undefined ? this.#clone(stored) : null;
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

  getEntitiesWithComponent(componentId) {
    const index = this.componentIndex.get(componentId);
    if (!index) return [];
    return Array.from(index.values()).map((entry) => ({ id: entry.id }));
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

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createEventDispatcher = () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
});

/**
 *
 */
function buildEnvironment() {
  const entityManager = new InMemoryEntityManager();
  const logger = createLogger();
  const eventDispatcher = createEventDispatcher();
  const service = new BodyGraphService({
    entityManager,
    logger,
    eventDispatcher,
  });

  const actorAlpha = 'actor-alpha';
  const partsAlpha = {
    torso: 'torso-alpha',
    head: 'head-alpha',
    leftArm: 'left-arm-alpha',
    leftHand: 'left-hand-alpha',
    rightArm: 'right-arm-alpha',
    rightHand: 'right-hand-alpha',
    heart: 'heart-alpha',
  };

  const actorBeta = 'actor-beta';
  const partsBeta = {
    torso: 'torso-beta',
    head: 'head-beta',
    leftLeg: 'left-leg-beta',
    rightLeg: 'right-leg-beta',
  };

  entityManager.addComponent(actorAlpha, 'anatomy:body', {
    recipeId: 'humanoid-alpha',
    body: { root: partsAlpha.torso },
    structure: { rootPartId: partsAlpha.torso },
  });
  entityManager.addComponent(actorAlpha, 'core:name', { text: 'Alpha' });

  entityManager.addComponent(partsAlpha.torso, 'anatomy:part', { subType: 'torso' });
  entityManager.addComponent(partsAlpha.torso, 'anatomy:joint', {
    parentId: actorAlpha,
    socketId: 'core',
  });

  entityManager.addComponent(partsAlpha.head, 'anatomy:part', { subType: 'head' });
  entityManager.addComponent(partsAlpha.head, 'anatomy:joint', {
    parentId: partsAlpha.torso,
    socketId: 'neck',
  });

  entityManager.addComponent(partsAlpha.leftArm, 'anatomy:part', { subType: 'arm' });
  entityManager.addComponent(partsAlpha.leftArm, 'anatomy:joint', {
    parentId: partsAlpha.torso,
    socketId: 'left-shoulder',
  });

  entityManager.addComponent(partsAlpha.leftHand, 'anatomy:part', { subType: 'hand' });
  entityManager.addComponent(partsAlpha.leftHand, 'anatomy:joint', {
    parentId: partsAlpha.leftArm,
    socketId: 'left-wrist',
  });
  entityManager.addComponent(partsAlpha.leftHand, 'equipment:grip', {
    itemId: 'sword-01',
    quality: 'rare',
  });
  entityManager.addComponent(partsAlpha.leftHand, 'anatomy:status', {
    posture: { state: 'raised' },
  });

  entityManager.addComponent(partsAlpha.rightArm, 'anatomy:part', { subType: 'arm' });
  entityManager.addComponent(partsAlpha.rightArm, 'anatomy:joint', {
    parentId: partsAlpha.torso,
    socketId: 'right-shoulder',
  });
  entityManager.addComponent(partsAlpha.rightArm, 'equipment:grip', {});

  entityManager.addComponent(partsAlpha.rightHand, 'anatomy:part', { subType: 'hand' });
  entityManager.addComponent(partsAlpha.rightHand, 'anatomy:joint', {
    parentId: partsAlpha.rightArm,
    socketId: 'right-wrist',
  });

  entityManager.addComponent(partsAlpha.heart, 'anatomy:part', { subType: 'organ' });
  entityManager.addComponent(partsAlpha.heart, 'anatomy:joint', {
    parentId: partsAlpha.torso,
    socketId: 'heart-socket',
  });
  entityManager.addComponent(partsAlpha.heart, 'vitals:status', { bpm: 62 });

  entityManager.addComponent(actorBeta, 'anatomy:body', {
    recipeId: 'humanoid-beta',
    body: { root: partsBeta.torso },
    structure: { rootPartId: partsBeta.torso },
  });
  entityManager.addComponent(actorBeta, 'core:name', { text: 'Beta' });

  entityManager.addComponent(partsBeta.torso, 'anatomy:part', { subType: 'torso' });
  entityManager.addComponent(partsBeta.torso, 'anatomy:joint', {
    parentId: actorBeta,
    socketId: 'core',
  });

  entityManager.addComponent(partsBeta.head, 'anatomy:part', { subType: 'head' });
  entityManager.addComponent(partsBeta.head, 'anatomy:joint', {
    parentId: partsBeta.torso,
    socketId: 'neck',
  });

  entityManager.addComponent(partsBeta.leftLeg, 'anatomy:part', { subType: 'leg' });
  entityManager.addComponent(partsBeta.leftLeg, 'anatomy:joint', {
    parentId: partsBeta.torso,
    socketId: 'left-hip',
  });

  entityManager.addComponent(partsBeta.rightLeg, 'anatomy:part', { subType: 'leg' });
  entityManager.addComponent(partsBeta.rightLeg, 'anatomy:joint', {
    parentId: partsBeta.torso,
    socketId: 'right-hip',
  });

  const floatingPart = 'floating-part';
  entityManager.addComponent(floatingPart, 'anatomy:part', { subType: 'detached' });

  return {
    service,
    entityManager,
    logger,
    eventDispatcher,
    actorAlpha,
    actorBeta,
    partsAlpha,
    partsBeta,
    floatingPart,
  };
}

describe('BodyGraphService multi-root integration', () => {
  let env;

  beforeEach(() => {
    env = buildEnvironment();
  });

  it('builds caches per actor and reuses query results', async () => {
    const buildSpy = jest.spyOn(AnatomyCacheManager.prototype, 'buildCache');

    await env.service.buildAdjacencyCache(env.actorAlpha);
    await env.service.buildAdjacencyCache(env.actorAlpha);
    await env.service.buildAdjacencyCache(env.actorBeta);

    expect(buildSpy).toHaveBeenCalledTimes(2);
    buildSpy.mockRestore();

    const alphaBody = env.entityManager.getComponentData(
      env.actorAlpha,
      'anatomy:body'
    );

    const initialParts = env.service.getAllParts(alphaBody, env.actorAlpha);
    expect(initialParts).toEqual(
      expect.arrayContaining([
        env.actorAlpha,
        env.partsAlpha.torso,
        env.partsAlpha.head,
        env.partsAlpha.leftArm,
        env.partsAlpha.leftHand,
        env.partsAlpha.rightArm,
        env.partsAlpha.rightHand,
        env.partsAlpha.heart,
      ])
    );

    const cachedParts = env.service.getAllParts(alphaBody, env.actorAlpha);
    expect(cachedParts).toBe(initialParts);

    const blueprintPerspective = env.service.getAllParts(alphaBody);
    expect(blueprintPerspective).toEqual(
      expect.arrayContaining([
        env.partsAlpha.torso,
        env.partsAlpha.head,
        env.partsAlpha.leftArm,
        env.partsAlpha.leftHand,
        env.partsAlpha.rightArm,
        env.partsAlpha.rightHand,
        env.partsAlpha.heart,
      ])
    );

    const missingRootResult = env.service.getAllParts({ body: {} });
    expect(missingRootResult).toEqual([]);

    const findSpy = jest.spyOn(AnatomyGraphAlgorithms, 'findPartsByType');
    const firstArms = env.service.findPartsByType(env.actorAlpha, 'arm');
    const secondArms = env.service.findPartsByType(env.actorAlpha, 'arm');
    expect(secondArms).toBe(firstArms);
    expect(firstArms).toEqual(
      expect.arrayContaining([
        env.partsAlpha.leftArm,
        env.partsAlpha.rightArm,
      ])
    );
    expect(findSpy).toHaveBeenCalledTimes(1);
    findSpy.mockRestore();

    const betaLegs = env.service.findPartsByType(env.actorBeta, 'leg');
    expect(betaLegs).toEqual(
      expect.arrayContaining([
        env.partsBeta.leftLeg,
        env.partsBeta.rightLeg,
      ])
    );
  });

  it('detaches parts and invalidates caches and query results', async () => {
    await env.service.buildAdjacencyCache(env.actorAlpha);
    const body = env.entityManager.getComponentData(
      env.actorAlpha,
      'anatomy:body'
    );

    const handsBefore = env.service.findPartsByType(env.actorAlpha, 'hand');
    expect(handsBefore).toEqual(
      expect.arrayContaining([
        env.partsAlpha.leftHand,
        env.partsAlpha.rightHand,
      ])
    );

    const partsBefore = env.service.getAllParts(body, env.actorAlpha);
    expect(partsBefore).toContain(env.partsAlpha.leftArm);
    expect(partsBefore).toContain(env.partsAlpha.leftHand);

    const cascadeResult = await env.service.detachPart(env.partsAlpha.leftArm);
    expect(cascadeResult).toEqual({
      detached: [env.partsAlpha.leftArm, env.partsAlpha.leftHand],
      parentId: env.partsAlpha.torso,
      socketId: 'left-shoulder',
    });

    expect(env.eventDispatcher.dispatch).toHaveBeenCalledWith(
      LIMB_DETACHED_EVENT_ID,
      expect.objectContaining({
        detachedEntityId: env.partsAlpha.leftArm,
        parentEntityId: env.partsAlpha.torso,
        detachedCount: 2,
        reason: 'manual',
      })
    );
    expect(env.service.hasCache(env.actorAlpha)).toBe(false);

    await env.service.buildAdjacencyCache(env.actorAlpha);
    const partsAfterCascade = env.service.getAllParts(body, env.actorAlpha);
    expect(partsAfterCascade).not.toContain(env.partsAlpha.leftArm);
    expect(partsAfterCascade).not.toContain(env.partsAlpha.leftHand);

    const handsAfterCascade = env.service.findPartsByType(
      env.actorAlpha,
      'hand'
    );
    expect(handsAfterCascade).not.toEqual(handsBefore);
    expect(handsAfterCascade).not.toContain(env.partsAlpha.leftHand);

    const singleResult = await env.service.detachPart(
      env.partsAlpha.rightArm,
      { cascade: false, reason: 'testing' }
    );
    expect(singleResult).toEqual({
      detached: [env.partsAlpha.rightArm],
      parentId: env.partsAlpha.torso,
      socketId: 'right-shoulder',
    });
    expect(env.service.hasCache(env.actorAlpha)).toBe(false);

    await env.service.buildAdjacencyCache(env.actorAlpha);
    const handsAfterSingle = env.service.findPartsByType(
      env.actorAlpha,
      'hand'
    );
    expect(handsAfterSingle).toEqual([]);
    expect(
      env.entityManager.getComponentData(
        env.partsAlpha.rightHand,
        'anatomy:part'
      )
    ).not.toBeNull();

    await expect(env.service.detachPart(env.floatingPart)).rejects.toThrow(
      InvalidArgumentError
    );
  });

  it('navigates anatomy graphs and enforces guard rails', async () => {
    await env.service.buildAdjacencyCache(env.actorAlpha);
    await env.service.buildAdjacencyCache(env.actorBeta);

    const alphaBody = env.entityManager.getComponentData(
      env.actorAlpha,
      'anatomy:body'
    );

    const path = env.service.getPath(
      env.partsAlpha.leftHand,
      env.partsAlpha.head
    );
    expect(path).toEqual([
      env.partsAlpha.leftHand,
      env.partsAlpha.leftArm,
      env.partsAlpha.torso,
      env.partsAlpha.head,
    ]);

    expect(env.service.getAnatomyRoot(env.partsAlpha.head)).toBe(
      env.actorAlpha
    );

    expect(env.service.getChildren(env.partsAlpha.torso)).toEqual(
      expect.arrayContaining([
        env.partsAlpha.head,
        env.partsAlpha.leftArm,
        env.partsAlpha.rightArm,
        env.partsAlpha.heart,
      ])
    );
    expect(env.service.getChildren('unknown-part')).toEqual([]);

    expect(env.service.getParent(env.partsAlpha.leftHand)).toBe(
      env.partsAlpha.leftArm
    );
    expect(env.service.getParent('ghost')).toBeNull();

    expect(env.service.getAncestors(env.partsAlpha.leftHand)).toEqual([
      env.partsAlpha.leftArm,
      env.partsAlpha.torso,
      env.actorAlpha,
    ]);

    const descendants = env.service.getAllDescendants(env.actorAlpha);
    expect(descendants).toEqual(
      expect.arrayContaining([
        env.partsAlpha.torso,
        env.partsAlpha.head,
        env.partsAlpha.leftArm,
        env.partsAlpha.leftHand,
        env.partsAlpha.rightArm,
        env.partsAlpha.rightHand,
        env.partsAlpha.heart,
      ])
    );

    const graph = await env.service.getBodyGraph(env.actorAlpha);
    expect(graph.getAllPartIds()).toEqual(
      env.service.getAllParts(alphaBody, env.actorAlpha)
    );
    expect(graph.getConnectedParts(env.partsAlpha.torso)).toEqual(
      expect.arrayContaining([
        env.partsAlpha.head,
        env.partsAlpha.leftArm,
        env.partsAlpha.rightArm,
        env.partsAlpha.heart,
      ])
    );

    env.entityManager.addComponent('npc-1', 'core:name', { text: 'NPC' });
    await expect(env.service.getBodyGraph('npc-1')).rejects.toThrow(
      'has no anatomy:body component'
    );
    await expect(env.service.getBodyGraph(null)).rejects.toThrow(
      InvalidArgumentError
    );

    await expect(env.service.getAnatomyData(null)).rejects.toThrow(
      InvalidArgumentError
    );
    const anatomyData = await env.service.getAnatomyData(env.actorAlpha);
    expect(anatomyData).toEqual({
      recipeId: 'humanoid-alpha',
      rootEntityId: env.actorAlpha,
    });

    env.entityManager.addComponent('actor-beta-ghost', 'core:name', {
      text: 'Ghost',
    });
    await expect(
      env.service.getAnatomyData('actor-beta-ghost')
    ).resolves.toBeNull();

    expect(
      env.service.hasPartWithComponent(alphaBody, 'equipment:grip')
    ).toBe(true);
    expect(
      env.service.hasPartWithComponent(alphaBody, 'custom:metadata')
    ).toBe(false);

    expect(
      env.service.hasPartWithComponentValue(
        alphaBody,
        'anatomy:status',
        'posture.state',
        'raised'
      )
    ).toEqual({ found: true, partId: env.partsAlpha.leftHand });
    expect(
      env.service.hasPartWithComponentValue(
        alphaBody,
        'anatomy:status',
        'posture.state',
        'lowered'
      )
    ).toEqual({ found: false });

    const validation = env.service.validateCache();
    expect(validation.valid).toBe(true);
    expect(validation.issues).toEqual([]);

    expect(env.service.hasCache(env.actorAlpha)).toBe(true);
    expect(env.service.hasCache('unknown-actor')).toBe(false);

    const serviceFactory = () =>
      new BodyGraphService({ logger: env.logger, eventDispatcher: env.eventDispatcher });
    expect(serviceFactory).toThrow(InvalidArgumentError);
    expect(
      () =>
        new BodyGraphService({
          entityManager: env.entityManager,
          eventDispatcher: env.eventDispatcher,
        })
    ).toThrow(InvalidArgumentError);
    expect(
      () =>
        new BodyGraphService({
          entityManager: env.entityManager,
          logger: env.logger,
        })
    ).toThrow(InvalidArgumentError);
  });
});
