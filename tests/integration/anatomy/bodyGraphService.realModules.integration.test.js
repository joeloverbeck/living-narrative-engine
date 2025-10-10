import { describe, expect, it } from '@jest/globals';
import BodyGraphService, {
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import { AnatomyQueryCache } from '../../../src/anatomy/cache/AnatomyQueryCache.js';
import EventBus from '../../../src/events/eventBus.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';

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

describe('BodyGraphService integration with real caches', () => {
  it('should manage anatomy caches, queries, and detachments end-to-end', async () => {
    const logger = new ConsoleLogger(LogLevel.ERROR);
    const eventBus = new EventBus({ logger });
    const validatedDispatcher = new MinimalValidatedEventDispatcher(eventBus);
    const safeDispatcher = new SafeEventDispatcher({
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
      eventDispatcher: safeDispatcher,
      queryCache,
    });

    expect(service.hasCache(actorId)).toBe(false);
    expect(service.getAllParts(null)).toEqual([]);
    expect(service.getAnatomyRoot(leftHandId)).toBe(actorId);

    const preCacheParts = service.getAllParts({ body: { root: torsoId } });
    expect(new Set(preCacheParts)).toEqual(
      new Set([torsoId, leftArmId, rightArmId, leftHandId, rightHandId])
    );

    await expect(service.getBodyGraph(123)).rejects.toThrow(
      'Entity ID is required and must be a string'
    );
    await expect(service.getAnatomyData(123)).rejects.toThrow(
      'Entity ID is required and must be a string'
    );

    await service.buildAdjacencyCache(actorId);
    expect(service.hasCache(actorId)).toBe(true);
    await service.buildAdjacencyCache(actorId);

    const bodyComponent = entityManager.getComponentData(
      actorId,
      'anatomy:body'
    );
    const allParts = service.getAllParts(bodyComponent, actorId);
    expect(allParts.length).toBe(6);
    expect(new Set(allParts)).toEqual(
      new Set([
        actorId,
        torsoId,
        leftArmId,
        rightArmId,
        leftHandId,
        rightHandId,
      ])
    );
    expect(service.getAllParts(bodyComponent, actorId)).toBe(allParts);

    const blueprintParts = service.getAllParts({ body: { root: torsoId } });
    expect(new Set(blueprintParts)).toEqual(
      new Set([torsoId, leftArmId, rightArmId, leftHandId, rightHandId])
    );
    expect(service.getAllParts({ body: { root: torsoId } })).toBe(blueprintParts);

    const arms = service.findPartsByType(actorId, 'arm');
    expect(new Set(arms)).toEqual(new Set([leftArmId, rightArmId]));
    expect(service.findPartsByType(actorId, 'arm')).toBe(arms);

    expect(new Set(service.getChildren(torsoId))).toEqual(
      new Set([leftArmId, rightArmId])
    );
    expect(service.getParent(leftHandId)).toBe(leftArmId);
    expect(service.getAncestors(leftHandId)).toEqual([
      leftArmId,
      torsoId,
      actorId,
    ]);
    expect(new Set(service.getAllDescendants(torsoId))).toEqual(
      new Set([leftArmId, rightArmId, leftHandId, rightHandId])
    );

    expect(service.getPath(leftHandId, rightHandId)).toEqual([
      leftHandId,
      leftArmId,
      torsoId,
      rightArmId,
      rightHandId,
    ]);
    expect(service.getAnatomyRoot(rightHandId)).toBe(actorId);

    expect(service.hasPartWithComponent(bodyComponent, 'equipment:ring')).toBe(
      true
    );
    expect(
      service.hasPartWithComponent(bodyComponent, 'equipment:nonexistent')
    ).toBe(false);

    expect(
      service.hasPartWithComponentValue(
        bodyComponent,
        'equipment:ring',
        'style.material',
        'gold'
      )
    ).toEqual({ found: true, partId: rightHandId });
    expect(
      service.hasPartWithComponentValue(
        bodyComponent,
        'equipment:ring',
        'style.material',
        'silver'
      )
    ).toEqual({ found: false });

    const bodyGraph = await service.getBodyGraph(actorId);
    expect(new Set(bodyGraph.getAllPartIds())).toEqual(new Set(allParts));
    expect(new Set(bodyGraph.getConnectedParts(torsoId))).toEqual(
      new Set([leftArmId, rightArmId])
    );

    await expect(service.getBodyGraph('missing')).rejects.toThrow(
      'Entity missing has no anatomy:body component'
    );

    expect(await service.getAnatomyData(actorId)).toEqual({
      recipeId: 'human:base',
      rootEntityId: actorId,
    });
    expect(await service.getAnatomyData(leftArmId)).toBeNull();

    expect(service.validateCache()).toEqual({ valid: true, issues: [] });

    await expect(service.detachPart(actorId)).rejects.toThrow(
      "Entity 'actor:test_subject' has no joint component - cannot detach"
    );

    const dispatchedEvents = [];
    const unsubscribe = safeDispatcher.subscribe(
      LIMB_DETACHED_EVENT_ID,
      (event) => {
        dispatchedEvents.push(event);
      }
    );

    const nonCascadeResult = await service.detachPart(leftHandId, {
      cascade: false,
      reason: 'non-cascade check',
    });
    expect(nonCascadeResult).toEqual({
      detached: [leftHandId],
      parentId: leftArmId,
      socketId: 'left_wrist',
    });
    expect(service.hasCache(actorId)).toBe(false);

    const afterDetachParts = service.getAllParts(bodyComponent, actorId);
    expect(afterDetachParts).toBe(blueprintParts);
    expect(afterDetachParts).toContain(leftHandId);

    await service.buildAdjacencyCache(actorId);
    const postRebuildParts = service.getAllParts(bodyComponent, actorId);
    expect(new Set(postRebuildParts)).toEqual(
      new Set([actorId, torsoId, leftArmId, rightArmId, rightHandId])
    );
    expect(postRebuildParts).not.toBe(afterDetachParts);
    expect(postRebuildParts).not.toContain(leftHandId);

    const cascadeResult = await service.detachPart(rightArmId, {
      cascade: true,
      reason: 'cascade check',
    });
    expect(new Set(cascadeResult.detached)).toEqual(
      new Set([rightArmId, rightHandId])
    );
    expect(service.hasCache(actorId)).toBe(false);

    const afterCascadeParts = service.getAllParts(bodyComponent, actorId);
    expect(afterCascadeParts).toBe(blueprintParts);

    await service.buildAdjacencyCache(actorId);
    const finalParts = service.getAllParts(bodyComponent, actorId);
    expect(new Set(finalParts)).toEqual(new Set([actorId, torsoId, leftArmId]));
    expect(finalParts).not.toContain(rightArmId);
    expect(finalParts).not.toContain(rightHandId);

    expect(new Set(service.getChildren(torsoId))).toEqual(new Set([leftArmId]));
    expect(service.getAllDescendants(torsoId)).toEqual([leftArmId]);
    expect(service.validateCache()).toEqual({ valid: true, issues: [] });

    expect(dispatchedEvents).toHaveLength(2);
    const [firstEvent, secondEvent] = dispatchedEvents;
    expect(firstEvent.type).toBe(LIMB_DETACHED_EVENT_ID);
    expect(firstEvent.payload.detachedEntityId).toBe(leftHandId);
    expect(firstEvent.payload.reason).toBe('non-cascade check');
    expect(firstEvent.payload.detachedCount).toBe(1);

    expect(secondEvent.type).toBe(LIMB_DETACHED_EVENT_ID);
    expect(secondEvent.payload.detachedEntityId).toBe(rightArmId);
    expect(secondEvent.payload.detachedCount).toBe(2);
    expect(secondEvent.payload.reason).toBe('cascade check');

    unsubscribe?.();
  }, 20000);
});
