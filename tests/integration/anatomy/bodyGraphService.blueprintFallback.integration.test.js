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
  /**
   * @param {EventBus} eventBus
   */
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
 */
function createEnvironment() {
  const logger = new RecordingLogger();
  const eventBus = new EventBus({ logger });
  const validatedDispatcher = new MinimalValidatedEventDispatcher(eventBus);
  const safeEventDispatcher = new SafeEventDispatcher({
    validatedEventDispatcher: validatedDispatcher,
    logger,
  });

  const actorId = 'actor:test_subject';
  const torsoId = 'part:torso';
  const leftArmId = 'part:left_arm';
  const rightArmId = 'part:right_arm';
  const leftHandId = 'part:left_hand';
  const rightHandId = 'part:right_hand';

  const entityManager = new SimpleEntityManager([
    {
      id: actorId,
      components: {
        'anatomy:body': {
          recipeId: 'human:base',
          root: torsoId,
          body: { root: torsoId },
        },
      },
    },
    {
      id: torsoId,
      components: {
        'anatomy:part': { subType: 'torso' },
        'anatomy:joint': { parentId: actorId, socketId: 'torso_socket' },
      },
    },
    {
      id: leftArmId,
      components: {
        'anatomy:part': { subType: 'arm', side: 'left' },
        'anatomy:joint': { parentId: torsoId, socketId: 'left_shoulder' },
      },
    },
    {
      id: rightArmId,
      components: {
        'anatomy:part': { subType: 'arm', side: 'right' },
        'anatomy:joint': { parentId: torsoId, socketId: 'right_shoulder' },
      },
    },
    {
      id: leftHandId,
      components: {
        'anatomy:part': { subType: 'hand', side: 'left' },
        'anatomy:joint': { parentId: leftArmId, socketId: 'left_wrist' },
        'equipment:glove': { color: 'black', style: { material: 'leather' } },
      },
    },
    {
      id: rightHandId,
      components: {
        'anatomy:part': { subType: 'hand', side: 'right' },
        'anatomy:joint': { parentId: rightArmId, socketId: 'right_wrist' },
        'equipment:ring': { style: { material: 'gold', engraved: true } },
      },
    },
  ]);

  const queryCache = new AnatomyQueryCache({ logger });
  const service = new BodyGraphService({
    entityManager,
    logger,
    eventDispatcher: safeEventDispatcher,
    queryCache,
  });

  return {
    service,
    logger,
    eventBus,
    safeEventDispatcher,
    queryCache,
    entityManager,
    actorId,
    torsoId,
    leftArmId,
    rightArmId,
    leftHandId,
    rightHandId,
  };
}

describe('BodyGraphService blueprint and cache fallback integration', () => {
  let env;

  beforeEach(() => {
    env = createEnvironment();
  });

  it('enforces required dependencies even with real dispatcher wiring', () => {
    expect(() =>
      new BodyGraphService({
        logger: env.logger,
        eventDispatcher: env.safeEventDispatcher,
        queryCache: env.queryCache,
      })
    ).toThrow('entityManager is required');

    expect(() =>
      new BodyGraphService({
        entityManager: env.entityManager,
        logger: env.logger,
      })
    ).toThrow('eventDispatcher is required');
  });

  it('extracts parts from blueprint-only metadata and caches the result', async () => {
    await env.service.buildAdjacencyCache(env.actorId);

    const blueprintBody = { root: env.torsoId };

    const firstResult = env.service.getAllParts(blueprintBody);
    expect(new Set(firstResult)).toEqual(
      new Set([
        env.torsoId,
        env.leftArmId,
        env.rightArmId,
        env.leftHandId,
        env.rightHandId,
      ])
    );

    const secondResult = env.service.getAllParts(blueprintBody);
    expect(secondResult).toBe(firstResult);

    expect(
      env.logger.debugEntries.some(({ message }) =>
        message.includes('bodyComponent.root')
      )
    ).toBe(true);
    expect(
      env.logger.infoEntries.some(({ message }) => message.includes('Using blueprint root'))
    ).toBe(true);
  });

  it('manages detachments and traversal when actor caches are present', async () => {
    const events = [];
    const unsubscribe = env.safeEventDispatcher.subscribe(
      LIMB_DETACHED_EVENT_ID,
      (event) => {
        events.push(event);
      }
    );

    await env.service.buildAdjacencyCache(env.actorId);
    expect(env.service.hasCache(env.actorId)).toBe(true);

    const bodyComponent = env.entityManager.getComponentData(
      env.actorId,
      'anatomy:body'
    );

    const actorParts = env.service.getAllParts(bodyComponent, env.actorId);
    expect(new Set(actorParts)).toEqual(
      new Set([
        env.actorId,
        env.torsoId,
        env.leftArmId,
        env.rightArmId,
        env.leftHandId,
        env.rightHandId,
      ])
    );

    const cachedActorParts = env.service.getAllParts(bodyComponent, env.actorId);
    expect(cachedActorParts).toBe(actorParts);

    const arms = env.service.findPartsByType(env.actorId, 'arm');
    expect(new Set(arms)).toEqual(new Set([env.leftArmId, env.rightArmId]));
    const cachedArms = env.service.findPartsByType(env.actorId, 'arm');
    expect(cachedArms).toBe(arms);

    expect(new Set(env.service.getChildren(env.torsoId))).toEqual(
      new Set([env.leftArmId, env.rightArmId])
    );
    expect(env.service.getParent(env.leftHandId)).toBe(env.leftArmId);
    expect(env.service.getAncestors(env.leftHandId)).toEqual([
      env.leftArmId,
      env.torsoId,
      env.actorId,
    ]);
    expect(new Set(env.service.getAllDescendants(env.actorId))).toEqual(
      new Set([
        env.torsoId,
        env.leftArmId,
        env.rightArmId,
        env.leftHandId,
        env.rightHandId,
      ])
    );

    expect(env.service.getPath(env.leftHandId, env.rightHandId)).toEqual([
      env.leftHandId,
      env.leftArmId,
      env.torsoId,
      env.rightArmId,
      env.rightHandId,
    ]);
    expect(env.service.getAnatomyRoot(env.rightHandId)).toBe(env.actorId);

    expect(
      env.service.hasPartWithComponent(bodyComponent, 'equipment:ring')
    ).toBe(true);
    expect(
      env.service.hasPartWithComponent(bodyComponent, 'equipment:cloak')
    ).toBe(false);

    expect(
      env.service.hasPartWithComponentValue(
        bodyComponent,
        'equipment:ring',
        'style.material',
        'gold'
      )
    ).toEqual({ found: true, partId: env.rightHandId });
    expect(
      env.service.hasPartWithComponentValue(
        bodyComponent,
        'equipment:ring',
        'style.material',
        'silver'
      )
    ).toEqual({ found: false });

    const nonCascade = await env.service.detachPart(env.leftHandId, {
      cascade: false,
      reason: 'verification-non-cascade',
    });
    expect(nonCascade).toEqual({
      detached: [env.leftHandId],
      parentId: env.leftArmId,
      socketId: 'left_wrist',
    });
    expect(
      env.entityManager.getComponentData(env.leftHandId, 'anatomy:joint')
    ).toBeNull();
    expect(env.service.hasCache(env.actorId)).toBe(false);

    await env.service.buildAdjacencyCache(env.actorId);
    const afterNonCascade = env.service.getAllParts(bodyComponent, env.actorId);
    expect(afterNonCascade).not.toContain(env.leftHandId);

    await env.entityManager.addComponent(env.leftHandId, 'anatomy:joint', {
      parentId: env.leftArmId,
      socketId: 'left_wrist',
    });
    await env.service.buildAdjacencyCache(env.actorId);

    const cascade = await env.service.detachPart(env.rightArmId, {
      cascade: true,
      reason: 'verification-cascade',
    });
    expect(new Set(cascade.detached)).toEqual(
      new Set([env.rightArmId, env.rightHandId])
    );
    expect(env.service.hasCache(env.actorId)).toBe(false);

    await env.service.buildAdjacencyCache(env.actorId);
    const afterCascade = env.service.getAllParts(bodyComponent, env.actorId);
    expect(afterCascade).not.toContain(env.rightArmId);
    expect(afterCascade).not.toContain(env.rightHandId);

    expect(events).toHaveLength(2);
    expect(events[0].payload.detachedCount).toBe(1);
    expect(events[0].payload.reason).toBe('verification-non-cascade');
    expect(events[1].payload.detachedCount).toBe(2);
    expect(events[1].payload.reason).toBe('verification-cascade');
    unsubscribe?.();

    env.entityManager.removeComponent(env.leftHandId, 'anatomy:joint');
    await expect(env.service.detachPart(env.leftHandId)).rejects.toThrow(
      `Entity '${env.leftHandId}' has no joint component - cannot detach`
    );

    await env.entityManager.addComponent(env.leftHandId, 'anatomy:joint', {
      parentId: env.leftArmId,
      socketId: 'left_wrist',
    });
    await env.service.buildAdjacencyCache(env.actorId);

    await expect(env.service.getBodyGraph(123)).rejects.toThrow(
      'Entity ID is required and must be a string'
    );
    await expect(env.service.getBodyGraph('missing')).rejects.toThrow(
      'Entity missing has no anatomy:body component'
    );

    const bodyGraph = await env.service.getBodyGraph(env.actorId);
    const graphParts = bodyGraph.getAllPartIds();
    expect(new Set(graphParts)).toEqual(new Set(afterCascade));
    expect(new Set(bodyGraph.getConnectedParts(env.torsoId))).toEqual(
      new Set([env.leftArmId])
    );

    const anatomyData = await env.service.getAnatomyData(env.actorId);
    expect(anatomyData).toEqual({
      recipeId: 'human:base',
      rootEntityId: env.actorId,
    });
    const partAnatomy = await env.service.getAnatomyData(env.leftArmId);
    expect(partAnatomy).toBeNull();
    const missingAnatomy = await env.service.getAnatomyData('unknown:entity');
    expect(missingAnatomy).toBeNull();
    await expect(env.service.getAnatomyData(123)).rejects.toThrow(
      'Entity ID is required and must be a string'
    );

    expect(env.service.validateCache()).toEqual({ valid: true, issues: [] });
    expect(env.service.getAllParts(null)).toEqual([]);
  });

  it('logs and returns an empty list when body metadata lacks a root reference', () => {
    const result = env.service.getAllParts({ flags: ['missing-root'] });
    expect(result).toEqual([]);
    expect(
      env.logger.debugEntries.some(({ message }) =>
        message.includes('No root ID found in bodyComponent')
      )
    ).toBe(true);
  });
});
