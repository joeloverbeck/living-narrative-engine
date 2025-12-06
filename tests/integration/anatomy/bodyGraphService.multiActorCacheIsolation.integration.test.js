import { beforeEach, describe, expect, it } from '@jest/globals';
import BodyGraphService, {
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import { AnatomyQueryCache } from '../../../src/anatomy/cache/AnatomyQueryCache.js';
import EventBus from '../../../src/events/eventBus.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';

class RecordingLogger {
  constructor() {
    this.debugEntries = [];
    this.infoEntries = [];
    this.warnEntries = [];
    this.errorEntries = [];
  }

  debug(message, metadata) {
    this.debugEntries.push({ message, metadata });
  }

  info(message, metadata) {
    this.infoEntries.push({ message, metadata });
  }

  warn(message, metadata) {
    this.warnEntries.push({ message, metadata });
  }

  error(message, metadata) {
    this.errorEntries.push({ message, metadata });
  }
}

class MinimalValidatedEventDispatcher {
  constructor(eventBus) {
    this.eventBus = eventBus;
  }

  async dispatch(eventName, payload) {
    await this.eventBus.dispatch(eventName, payload);
    return true;
  }

  subscribe(eventName, listener) {
    return this.eventBus.subscribe(eventName, listener);
  }

  unsubscribe(eventName, listener) {
    return this.eventBus.unsubscribe(eventName, listener);
  }

  setBatchMode(enabled, options) {
    if (typeof this.eventBus.setBatchMode === 'function') {
      this.eventBus.setBatchMode(enabled, options);
    }
  }
}

/**
 *
 * @param entityManager
 * @param ids
 */
async function seedActorAlpha(entityManager, ids) {
  await entityManager.addComponent(ids.actorAlpha, 'anatomy:body', {
    recipeId: 'alpha:base',
    body: { root: ids.torsoAlpha },
  });
  await entityManager.addComponent(ids.actorAlpha, 'core:description', {
    text: 'Alpha actor',
  });

  await entityManager.addComponent(ids.torsoAlpha, 'anatomy:part', {
    partType: 'core',
    subType: 'torso',
  });
  await entityManager.addComponent(ids.torsoAlpha, 'anatomy:joint', {
    parentId: ids.actorAlpha,
    socketId: 'core',
  });

  await entityManager.addComponent(ids.leftArmAlpha, 'anatomy:part', {
    partType: 'limb',
    subType: 'arm',
  });
  await entityManager.addComponent(ids.leftArmAlpha, 'anatomy:joint', {
    parentId: ids.torsoAlpha,
    socketId: 'left_shoulder',
  });

  await entityManager.addComponent(ids.leftHandAlpha, 'anatomy:part', {
    partType: 'extremity',
    subType: 'hand',
  });
  await entityManager.addComponent(ids.leftHandAlpha, 'anatomy:joint', {
    parentId: ids.leftArmAlpha,
    socketId: 'left_wrist',
  });
  await entityManager.addComponent(ids.leftHandAlpha, 'equipment:glove', {
    color: 'red',
    condition: { dryness: 'dry' },
  });

  await entityManager.addComponent(ids.rightArmAlpha, 'anatomy:part', {
    partType: 'limb',
    subType: 'arm',
  });
  await entityManager.addComponent(ids.rightArmAlpha, 'anatomy:joint', {
    parentId: ids.torsoAlpha,
    socketId: 'right_shoulder',
  });

  await entityManager.addComponent(ids.heartAlpha, 'anatomy:part', {
    partType: 'organ',
    subType: 'heart',
  });
  await entityManager.addComponent(ids.heartAlpha, 'anatomy:joint', {
    parentId: ids.torsoAlpha,
    socketId: 'heart_socket',
  });
  await entityManager.addComponent(ids.heartAlpha, 'biology:status', {
    vitals: { heartRate: 72, oxygen: 96 },
  });
}

/**
 *
 * @param entityManager
 * @param ids
 */
async function seedActorBeta(entityManager, ids) {
  await entityManager.addComponent(ids.actorBeta, 'anatomy:body', {
    recipeId: 'beta:base',
    body: { root: ids.torsoBeta },
  });
  await entityManager.addComponent(ids.actorBeta, 'core:description', {
    text: 'Beta actor',
  });

  await entityManager.addComponent(ids.torsoBeta, 'anatomy:part', {
    partType: 'core',
    subType: 'torso',
  });
  await entityManager.addComponent(ids.torsoBeta, 'anatomy:joint', {
    parentId: ids.actorBeta,
    socketId: 'core',
  });

  await entityManager.addComponent(ids.headBeta, 'anatomy:part', {
    partType: 'head',
    subType: 'skull',
  });
  await entityManager.addComponent(ids.headBeta, 'anatomy:joint', {
    parentId: ids.torsoBeta,
    socketId: 'neck',
  });

  await entityManager.addComponent(ids.tailBeta, 'anatomy:part', {
    partType: 'appendage',
    subType: 'tail',
  });
  await entityManager.addComponent(ids.tailBeta, 'anatomy:joint', {
    parentId: ids.torsoBeta,
    socketId: 'tail_socket',
  });
}

/**
 *
 */
async function createEnvironment() {
  const logger = new RecordingLogger();
  const eventBus = new EventBus({ logger });
  const validatedDispatcher = new MinimalValidatedEventDispatcher(eventBus);
  const safeEventDispatcher = new SafeEventDispatcher({
    validatedEventDispatcher: validatedDispatcher,
    logger,
  });

  const entityManager = new SimpleEntityManager();
  const queryCache = new AnatomyQueryCache(
    { logger },
    { maxSize: 32, ttl: 10_000 }
  );

  const ids = {
    actorAlpha: 'actor:alpha',
    torsoAlpha: 'part:alpha:torso',
    leftArmAlpha: 'part:alpha:left_arm',
    leftHandAlpha: 'part:alpha:left_hand',
    rightArmAlpha: 'part:alpha:right_arm',
    heartAlpha: 'part:alpha:heart',
    actorBeta: 'actor:beta',
    torsoBeta: 'part:beta:torso',
    headBeta: 'part:beta:head',
    tailBeta: 'part:beta:tail',
    strayEntity: 'prop:lantern',
  };

  await seedActorAlpha(entityManager, ids);
  await seedActorBeta(entityManager, ids);

  await entityManager.addComponent(ids.strayEntity, 'core:description', {
    text: 'A decorative lantern',
  });

  const service = new BodyGraphService({
    entityManager,
    logger,
    eventDispatcher: safeEventDispatcher,
    queryCache,
  });

  return {
    service,
    entityManager,
    queryCache,
    logger,
    safeEventDispatcher,
    eventBus,
    ids,
  };
}

describe('BodyGraphService multi-actor cache isolation integration', () => {
  let env;

  beforeEach(async () => {
    env = await createEnvironment();
  });

  it('isolates caches per actor and only invalidates affected query results on detach', async () => {
    const { service, entityManager, queryCache, safeEventDispatcher, ids } =
      env;

    const recordedEvents = [];
    const unsubscribe = safeEventDispatcher.subscribe(
      LIMB_DETACHED_EVENT_ID,
      (event) => recordedEvents.push(event)
    );

    await service.buildAdjacencyCache(ids.actorAlpha);
    await service.buildAdjacencyCache(ids.actorBeta);

    expect(service.hasCache(ids.actorAlpha)).toBe(true);
    expect(service.hasCache(ids.actorBeta)).toBe(true);

    const alphaBody = await entityManager.getComponentData(
      ids.actorAlpha,
      'anatomy:body'
    );
    const betaBody = await entityManager.getComponentData(
      ids.actorBeta,
      'anatomy:body'
    );

    const alphaPartsFirst = service.getAllParts(alphaBody, ids.actorAlpha);
    expect(new Set(alphaPartsFirst)).toEqual(
      new Set([
        ids.actorAlpha,
        ids.torsoAlpha,
        ids.leftArmAlpha,
        ids.leftHandAlpha,
        ids.rightArmAlpha,
        ids.heartAlpha,
      ])
    );
    const alphaPartsCached = service.getAllParts(alphaBody, ids.actorAlpha);
    expect(alphaPartsCached).toBe(alphaPartsFirst);

    const betaPartsFirst = service.getAllParts(betaBody, ids.actorBeta);
    expect(new Set(betaPartsFirst)).toEqual(
      new Set([ids.actorBeta, ids.torsoBeta, ids.headBeta, ids.tailBeta])
    );
    expect(service.getAllParts(betaBody, ids.actorBeta)).toBe(betaPartsFirst);

    const alphaLimbs = service.findPartsByType(ids.actorAlpha, 'arm');
    expect(new Set(alphaLimbs)).toEqual(
      new Set([ids.leftArmAlpha, ids.rightArmAlpha])
    );
    expect(service.findPartsByType(ids.actorAlpha, 'arm')).toBe(alphaLimbs);

    expect(service.getChildren(ids.torsoAlpha)).toEqual(
      expect.arrayContaining([
        ids.leftArmAlpha,
        ids.rightArmAlpha,
        ids.heartAlpha,
      ])
    );
    expect(service.getParent(ids.leftHandAlpha)).toBe(ids.leftArmAlpha);
    expect(service.getAncestors(ids.leftHandAlpha)).toEqual([
      ids.leftArmAlpha,
      ids.torsoAlpha,
      ids.actorAlpha,
    ]);
    expect(new Set(service.getAllDescendants(ids.actorAlpha))).toEqual(
      new Set([
        ids.torsoAlpha,
        ids.leftArmAlpha,
        ids.leftHandAlpha,
        ids.rightArmAlpha,
        ids.heartAlpha,
      ])
    );

    expect(service.hasPartWithComponent(alphaBody, 'equipment:glove')).toBe(
      true
    );
    expect(service.hasPartWithComponent(alphaBody, 'equipment:cloak')).toBe(
      false
    );

    expect(
      service.hasPartWithComponentValue(
        alphaBody,
        'biology:status',
        'vitals.heartRate',
        72
      )
    ).toEqual({ found: true, partId: ids.heartAlpha });
    expect(
      service.hasPartWithComponentValue(
        alphaBody,
        'biology:status',
        'vitals.heartRate',
        10
      )
    ).toEqual({ found: false });

    expect(service.getPath(ids.leftHandAlpha, ids.rightArmAlpha)).toEqual([
      ids.leftHandAlpha,
      ids.leftArmAlpha,
      ids.torsoAlpha,
      ids.rightArmAlpha,
    ]);
    expect(service.getAnatomyRoot(ids.leftHandAlpha)).toBe(ids.actorAlpha);

    const alphaGraph = await service.getBodyGraph(ids.actorAlpha);
    expect(alphaGraph.getAllPartIds()).toEqual(
      expect.arrayContaining(alphaPartsFirst)
    );
    expect(alphaGraph.getConnectedParts(ids.torsoAlpha)).toEqual(
      expect.arrayContaining([
        ids.leftArmAlpha,
        ids.rightArmAlpha,
        ids.heartAlpha,
      ])
    );

    expect(queryCache.getCachedGetAllParts(ids.actorAlpha)).toBe(
      alphaPartsFirst
    );
    expect(queryCache.getCachedGetAllParts(ids.actorBeta)).toBe(betaPartsFirst);

    const detachResult = await service.detachPart(ids.leftArmAlpha, {
      cascade: true,
      reason: 'multi-actor-detach',
    });
    expect(new Set(detachResult.detached)).toEqual(
      new Set([ids.leftArmAlpha, ids.leftHandAlpha])
    );
    expect(detachResult.parentId).toBe(ids.torsoAlpha);
    expect(detachResult.socketId).toBe('left_shoulder');

    expect(service.hasCache(ids.actorAlpha)).toBe(false);
    expect(service.hasCache(ids.actorBeta)).toBe(true);

    expect(queryCache.getCachedGetAllParts(ids.actorAlpha)).toBeUndefined();
    expect(
      queryCache.getCachedFindPartsByType(ids.actorAlpha, 'arm')
    ).toBeUndefined();
    expect(queryCache.getCachedGetAllParts(ids.actorBeta)).toBe(betaPartsFirst);

    await service.buildAdjacencyCache(ids.actorAlpha);
    const rebuiltAlphaParts = service.getAllParts(alphaBody, ids.actorAlpha);
    expect(rebuiltAlphaParts).not.toContain(ids.leftArmAlpha);
    expect(rebuiltAlphaParts).not.toContain(ids.leftHandAlpha);
    expect(service.getAllParts(betaBody, ids.actorBeta)).toBe(betaPartsFirst);

    expect(recordedEvents).toHaveLength(1);
    expect(recordedEvents[0].payload).toMatchObject({
      detachedEntityId: ids.leftArmAlpha,
      parentEntityId: ids.torsoAlpha,
      socketId: 'left_shoulder',
      detachedCount: 2,
      reason: 'multi-actor-detach',
    });

    unsubscribe?.();

    expect(service.getAllParts({})).toEqual([]);

    const anatomyData = await service.getAnatomyData(ids.actorAlpha);
    expect(anatomyData).toEqual({
      recipeId: 'alpha:base',
      rootEntityId: ids.actorAlpha,
    });
    const missingAnatomy = await service.getAnatomyData(ids.strayEntity);
    expect(missingAnatomy).toBeNull();

    await expect(service.getBodyGraph(null)).rejects.toThrow(
      'Entity ID is required and must be a string'
    );
    await expect(service.getBodyGraph(ids.strayEntity)).rejects.toThrow(
      `Entity ${ids.strayEntity} has no anatomy:body component`
    );
  });
});
