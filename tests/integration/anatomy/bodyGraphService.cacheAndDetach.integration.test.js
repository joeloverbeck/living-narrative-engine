import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import BodyGraphService, {
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import EventBus from '../../../src/events/eventBus.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
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

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const ACTOR_ID = 'actor:test_subject';
const PART_IDS = {
  torso: 'part:torso',
  head: 'part:head',
  leftArm: 'part:left_arm',
  leftHand: 'part:left_hand',
  rightArm: 'part:right_arm',
  rightHand: 'part:right_hand',
  heart: 'part:heart',
};

const buildEntityManager = () =>
  new SimpleEntityManager([
    {
      id: ACTOR_ID,
      components: {
        'anatomy:body': {
          recipeId: 'human:base',
          body: { root: PART_IDS.torso },
          structure: { rootPartId: PART_IDS.torso },
        },
        'core:name': { text: 'Test Subject' },
      },
    },
    {
      id: PART_IDS.torso,
      components: {
        'anatomy:part': { subType: 'torso' },
        'anatomy:joint': { parentId: ACTOR_ID, socketId: 'core' },
      },
    },
    {
      id: PART_IDS.head,
      components: {
        'anatomy:part': { subType: 'head' },
        'anatomy:joint': { parentId: PART_IDS.torso, socketId: 'neck' },
      },
    },
    {
      id: PART_IDS.leftArm,
      components: {
        'anatomy:part': { subType: 'arm', side: 'left' },
        'anatomy:joint': {
          parentId: PART_IDS.torso,
          socketId: 'left_shoulder',
        },
      },
    },
    {
      id: PART_IDS.leftHand,
      components: {
        'anatomy:part': { subType: 'hand', side: 'left' },
        'anatomy:joint': { parentId: PART_IDS.leftArm, socketId: 'left_wrist' },
        'equipment:grip': { itemId: 'sword-1', quality: 'legendary' },
      },
    },
    {
      id: PART_IDS.rightArm,
      components: {
        'anatomy:part': { subType: 'arm', side: 'right' },
        'anatomy:joint': {
          parentId: PART_IDS.torso,
          socketId: 'right_shoulder',
        },
        'equipment:grip': {},
      },
    },
    {
      id: PART_IDS.rightHand,
      components: {
        'anatomy:part': { subType: 'hand', side: 'right' },
        'anatomy:joint': {
          parentId: PART_IDS.rightArm,
          socketId: 'right_wrist',
        },
        'equipment:ring': { style: { material: 'gold', engraved: true } },
      },
    },
    {
      id: PART_IDS.heart,
      components: {
        'anatomy:part': { subType: 'heart' },
        'anatomy:joint': { parentId: PART_IDS.torso, socketId: 'heart_socket' },
      },
    },
  ]);

describe('BodyGraphService integration: cache coordination and detachment', () => {
  let entityManager;
  let logger;
  let safeDispatcher;
  let service;
  let bodyComponent;
  let recordedEvents;
  let unsubscribe;

  beforeEach(() => {
    entityManager = buildEntityManager();
    logger = createLogger();
    const eventBus = new EventBus({ logger });
    const validatedDispatcher = new MinimalValidatedEventDispatcher(eventBus);
    safeDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher: validatedDispatcher,
      logger,
    });
    service = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher: safeDispatcher,
    });
    bodyComponent = entityManager.getComponentData(ACTOR_ID, 'anatomy:body');
    recordedEvents = [];
    unsubscribe = safeDispatcher.subscribe(LIMB_DETACHED_EVENT_ID, (event) => {
      // Event bus listeners receive an envelope that contains the payload.
      recordedEvents.push(event?.payload ?? event);
    });
  });

  afterEach(() => {
    if (typeof unsubscribe === 'function') {
      unsubscribe();
    }
  });

  it('coordinates caches, queries, and traversal with real dependencies', async () => {
    expect(service.hasCache(ACTOR_ID)).toBe(false);
    expect(service.getAllParts(null)).toEqual([]);
    expect(service.getAllParts({})).toEqual([]);

    expect(service.getAnatomyRoot(null)).toBeNull();
    expect(service.getAnatomyRoot(PART_IDS.leftHand)).toBe(ACTOR_ID);

    const blueprintBeforeCache = service.getAllParts({
      body: { root: PART_IDS.torso },
    });
    expect(new Set(blueprintBeforeCache)).toEqual(
      new Set([
        PART_IDS.torso,
        PART_IDS.head,
        PART_IDS.leftArm,
        PART_IDS.leftHand,
        PART_IDS.rightArm,
        PART_IDS.rightHand,
        PART_IDS.heart,
      ])
    );
    expect(new Set(service.getAllParts({ root: PART_IDS.torso }))).toEqual(
      new Set(blueprintBeforeCache)
    );

    const getComponentSpy = jest.spyOn(entityManager, 'getComponentData');
    const callCountBeforeBuild = getComponentSpy.mock.calls.length;
    await service.buildAdjacencyCache(ACTOR_ID);
    const callCountAfterFirstBuild = getComponentSpy.mock.calls.length;

    await service.buildAdjacencyCache(ACTOR_ID);
    expect(getComponentSpy.mock.calls.length).toBe(callCountAfterFirstBuild);
    getComponentSpy.mockRestore();

    expect(service.hasCache(ACTOR_ID)).toBe(true);

    const actorBody = entityManager.getComponentData(ACTOR_ID, 'anatomy:body');
    const allParts = service.getAllParts(actorBody, ACTOR_ID);
    expect(new Set(allParts)).toEqual(
      new Set([
        ACTOR_ID,
        PART_IDS.torso,
        PART_IDS.head,
        PART_IDS.leftArm,
        PART_IDS.leftHand,
        PART_IDS.rightArm,
        PART_IDS.rightHand,
        PART_IDS.heart,
      ])
    );
    expect(service.getAllParts(actorBody, ACTOR_ID)).toBe(allParts);

    const actorRootOnly = service.getAllParts({ root: ACTOR_ID });
    expect(new Set(actorRootOnly)).toEqual(new Set(allParts));

    const arms = service.findPartsByType(ACTOR_ID, 'arm');
    expect(new Set(arms)).toEqual(
      new Set([PART_IDS.leftArm, PART_IDS.rightArm])
    );
    expect(service.findPartsByType(ACTOR_ID, 'arm')).toBe(arms);
    expect(service.findPartsByType('missing', 'arm')).toEqual([]);

    expect(service.getChildren(PART_IDS.torso)).toEqual(
      expect.arrayContaining([
        PART_IDS.head,
        PART_IDS.leftArm,
        PART_IDS.rightArm,
        PART_IDS.heart,
      ])
    );
    expect(service.getChildren('unknown')).toEqual([]);
    expect(service.getParent(PART_IDS.torso)).toBe(ACTOR_ID);
    expect(service.getParent(ACTOR_ID)).toBeNull();
    expect(service.getParent('unknown')).toBeNull();

    expect(service.getAncestors(PART_IDS.leftHand)).toEqual([
      PART_IDS.leftArm,
      PART_IDS.torso,
      ACTOR_ID,
    ]);
    expect(service.getAncestors(ACTOR_ID)).toEqual([]);

    expect(new Set(service.getAllDescendants(PART_IDS.torso))).toEqual(
      new Set([
        PART_IDS.head,
        PART_IDS.leftArm,
        PART_IDS.leftHand,
        PART_IDS.rightArm,
        PART_IDS.rightHand,
        PART_IDS.heart,
      ])
    );
    expect(service.getAllDescendants('ghost:entity')).toEqual([]);

    expect(service.getPath(PART_IDS.leftHand, PART_IDS.rightHand)).toEqual([
      PART_IDS.leftHand,
      PART_IDS.leftArm,
      PART_IDS.torso,
      PART_IDS.rightArm,
      PART_IDS.rightHand,
    ]);
    expect(service.getPath(PART_IDS.leftHand, 'ghost:entity')).toBeNull();

    expect(service.hasPartWithComponent(actorBody, 'equipment:ring')).toBe(
      true
    );
    expect(
      service.hasPartWithComponent(actorBody, 'equipment:nonexistent')
    ).toBe(false);

    expect(
      service.hasPartWithComponentValue(
        actorBody,
        'equipment:ring',
        'style.material',
        'gold'
      )
    ).toEqual({ found: true, partId: PART_IDS.rightHand });
    expect(
      service.hasPartWithComponentValue(
        actorBody,
        'equipment:ring',
        'style.material',
        'silver'
      )
    ).toEqual({ found: false });
    expect(
      service.hasPartWithComponentValue(
        actorBody,
        'equipment:ring',
        'style.nonexistent',
        true
      )
    ).toEqual({ found: false });

    const bodyGraph = await service.getBodyGraph(ACTOR_ID);
    expect(new Set(bodyGraph.getAllPartIds())).toEqual(new Set(allParts));
    expect(bodyGraph.getConnectedParts(PART_IDS.torso)).toEqual(
      expect.arrayContaining([
        PART_IDS.head,
        PART_IDS.leftArm,
        PART_IDS.rightArm,
        PART_IDS.heart,
      ])
    );
    expect(bodyGraph.getConnectedParts(PART_IDS.rightHand)).toEqual([]);

    const validation = service.validateCache();
    expect(validation.valid).toBe(true);
    expect(validation.issues).toEqual([]);
  });

  it('detaches parts and invalidates caches for cascading scenarios', async () => {
    await service.buildAdjacencyCache(ACTOR_ID);
    const initialParts = service.getAllParts(bodyComponent, ACTOR_ID);
    const cachedAgain = service.getAllParts(bodyComponent, ACTOR_ID);
    expect(cachedAgain).toBe(initialParts);

    const firstDetach = await service.detachPart(PART_IDS.rightHand, {
      cascade: false,
      reason: 'manual-check',
    });
    expect(firstDetach).toEqual({
      detached: [PART_IDS.rightHand],
      parentId: PART_IDS.rightArm,
      socketId: 'right_wrist',
    });
    expect(recordedEvents.at(-1)).toMatchObject({
      detachedEntityId: PART_IDS.rightHand,
      parentEntityId: PART_IDS.rightArm,
      socketId: 'right_wrist',
      detachedCount: 1,
      reason: 'manual-check',
    });
    expect(
      entityManager.getComponentData(PART_IDS.rightHand, 'anatomy:joint')
    ).toBeNull();
    expect(service.hasCache(ACTOR_ID)).toBe(false);

    await entityManager.addComponent(PART_IDS.rightHand, 'anatomy:joint', {
      parentId: PART_IDS.rightArm,
      socketId: 'right_wrist',
    });
    await service.buildAdjacencyCache(ACTOR_ID);
    const rebuiltParts = service.getAllParts(bodyComponent, ACTOR_ID);
    expect(new Set(rebuiltParts)).toEqual(new Set(initialParts));
    expect(service.getAllParts(bodyComponent, ACTOR_ID)).toBe(rebuiltParts);

    const cascadeDetach = await service.detachPart(PART_IDS.leftArm, {
      cascade: true,
      reason: 'injury',
    });
    expect(new Set(cascadeDetach.detached)).toEqual(
      new Set([PART_IDS.leftArm, PART_IDS.leftHand])
    );
    expect(cascadeDetach.parentId).toBe(PART_IDS.torso);
    expect(cascadeDetach.socketId).toBe('left_shoulder');
    expect(recordedEvents.at(-1)).toMatchObject({
      detachedEntityId: PART_IDS.leftArm,
      detachedCount: 2,
      reason: 'injury',
    });
    expect(service.hasCache(ACTOR_ID)).toBe(false);

    await service.buildAdjacencyCache(ACTOR_ID);
    const remainingHands = service.findPartsByType(ACTOR_ID, 'hand');
    expect(remainingHands).toEqual([PART_IDS.rightHand]);
    expect(service.getAnatomyRoot(PART_IDS.leftHand)).toBe(PART_IDS.leftArm);
  });

  it('enforces invariants and error handling paths', async () => {
    expect(
      () =>
        new BodyGraphService({
          logger,
          eventDispatcher: safeDispatcher,
        })
    ).toThrow('entityManager is required');

    expect(
      () =>
        new BodyGraphService({
          entityManager,
          eventDispatcher: safeDispatcher,
        })
    ).toThrow('logger is required');

    expect(
      () =>
        new BodyGraphService({
          entityManager,
          logger,
        })
    ).toThrow('eventDispatcher is required');

    await expect(service.getBodyGraph(123)).rejects.toThrow(
      'Entity ID is required and must be a string'
    );
    await expect(service.getAnatomyData(123)).rejects.toThrow(
      'Entity ID is required and must be a string'
    );

    const originalBody = entityManager.getComponentData(
      ACTOR_ID,
      'anatomy:body'
    );
    entityManager.removeComponent(ACTOR_ID, 'anatomy:body');
    await expect(service.getBodyGraph(ACTOR_ID)).rejects.toThrow(
      `Entity ${ACTOR_ID} has no anatomy:body component`
    );
    await expect(service.getAnatomyData(ACTOR_ID)).resolves.toBeNull();
    await entityManager.addComponent(ACTOR_ID, 'anatomy:body', originalBody);

    await service.buildAdjacencyCache(ACTOR_ID);
    entityManager.removeComponent(PART_IDS.heart, 'anatomy:joint');
    await expect(service.detachPart(PART_IDS.heart)).rejects.toThrow(
      `Entity '${PART_IDS.heart}' has no joint component - cannot detach`
    );
  });
});
