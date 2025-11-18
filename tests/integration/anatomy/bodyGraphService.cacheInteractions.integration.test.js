import { BodyGraphService, LIMB_DETACHED_EVENT_ID } from '../../../src/anatomy/bodyGraphService.js';
import { SimpleEntityManager } from '../../common/entities/index.js';

/**
 *
 */
function createRecordingLogger() {
  const entries = [];
  const record = (level) => (message, ...details) => {
    entries.push({ level, message, details });
  };

  return {
    entries,
    debug: record('debug'),
    info: record('info'),
    warn: record('warn'),
    error: record('error'),
  };
}

/**
 *
 */
function createRecordingDispatcher() {
  const events = [];
  return {
    events,
    async dispatch(eventId, payload) {
      events.push({ eventId, payload });
      return true;
    },
  };
}

describe('BodyGraphService cache interactions integration', () => {
  const ids = {
    actor: 'actor-1',
    torso: 'torso-1',
    leftArm: 'left-arm-1',
    rightArm: 'right-arm-1',
    leftHand: 'left-hand-1',
    heart: 'heart-1',
  };

  /** @type {SimpleEntityManager} */
  let entityManager;
  let bodyGraphService;
  let logger;
  let eventDispatcher;

  const seedAnatomy = async () => {
    await entityManager.addComponent(ids.actor, 'core:name', { text: 'Integration Actor' });

    await entityManager.addComponent(ids.torso, 'anatomy:part', {
      partType: 'torso',
      subType: 'torso',
    });
    await entityManager.addComponent(ids.torso, 'core:description', { text: 'central torso' });

    await entityManager.addComponent(ids.leftArm, 'anatomy:part', {
      partType: 'limb',
      subType: 'arm',
    });
    await entityManager.addComponent(ids.leftArm, 'anatomy:joint', {
      parentId: ids.torso,
      socketId: 'left_shoulder',
    });
    await entityManager.addComponent(ids.leftArm, 'core:description', {
      text: 'left arm',
    });

    await entityManager.addComponent(ids.rightArm, 'anatomy:part', {
      partType: 'limb',
      subType: 'arm',
    });
    await entityManager.addComponent(ids.rightArm, 'anatomy:joint', {
      parentId: ids.torso,
      socketId: 'right_shoulder',
    });
    await entityManager.addComponent(ids.rightArm, 'core:description', {
      text: 'right arm',
    });

    await entityManager.addComponent(ids.leftHand, 'anatomy:part', {
      partType: 'extremity',
      subType: 'hand',
    });
    await entityManager.addComponent(ids.leftHand, 'anatomy:joint', {
      parentId: ids.leftArm,
      socketId: 'left_wrist',
    });

    await entityManager.addComponent(ids.heart, 'anatomy:part', {
      partType: 'organ',
      subType: 'heart',
    });
    await entityManager.addComponent(ids.heart, 'anatomy:joint', {
      parentId: ids.torso,
      socketId: 'chest_cavity',
    });
    await entityManager.addComponent(ids.heart, 'core:description', {
      text: 'vital heart',
    });
    await entityManager.addComponent(ids.heart, 'custom:status', {
      vitals: { pulse: 72, rhythm: 'steady' },
    });

    await entityManager.addComponent(ids.actor, 'anatomy:body', {
      recipeId: 'integration_recipe',
      body: {
        root: ids.torso,
        parts: {
          torso: ids.torso,
          leftArm: ids.leftArm,
          rightArm: ids.rightArm,
          leftHand: ids.leftHand,
          heart: ids.heart,
        },
      },
    });
  };

  beforeEach(async () => {
    entityManager = new SimpleEntityManager();
    logger = createRecordingLogger();
    eventDispatcher = createRecordingDispatcher();
    bodyGraphService = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher,
    });

    await seedAnatomy();
  });

  it('manages caches and queries across blueprint and actor roots', async () => {
    await bodyGraphService.buildAdjacencyCache(ids.torso);
    await bodyGraphService.buildAdjacencyCache(ids.torso);

    const buildLogs = logger.entries.filter((entry) =>
      entry.message.includes('AnatomyCacheManager: Building cache for anatomy rooted at')
    );
    expect(buildLogs).toHaveLength(1);

    const armsFirst = bodyGraphService.findPartsByType(ids.torso, 'arm');
    expect(armsFirst).toEqual(expect.arrayContaining([ids.leftArm, ids.rightArm]));
    const armsSecond = bodyGraphService.findPartsByType(ids.torso, 'arm');
    expect(armsSecond).toBe(armsFirst);

    const bodyComponent = entityManager.getComponentData(ids.actor, 'anatomy:body');
    const allPartsFirst = bodyGraphService.getAllParts(bodyComponent.body);
    expect(allPartsFirst).toEqual(
      expect.arrayContaining([ids.torso, ids.leftArm, ids.rightArm, ids.leftHand, ids.heart])
    );
    const allPartsSecond = bodyGraphService.getAllParts(bodyComponent.body);
    expect(allPartsSecond).toBe(allPartsFirst);

    expect(bodyGraphService.getParent(ids.torso)).toBeNull();

    const graph = await bodyGraphService.getBodyGraph(ids.actor);
    expect(graph.getAllPartIds()).toEqual(expect.arrayContaining(allPartsFirst));
    expect(graph.getConnectedParts(ids.leftArm)).toEqual([ids.leftHand]);

    await bodyGraphService.buildAdjacencyCache(ids.actor);
    expect(bodyGraphService.hasCache(ids.actor)).toBe(true);
    const actorScopedParts = bodyGraphService.getAllParts(bodyComponent, ids.actor);
    expect(actorScopedParts).toEqual(
      expect.arrayContaining([...allPartsFirst, ids.actor])
    );
    expect(actorScopedParts).toHaveLength(allPartsFirst.length + 1);

    expect(bodyGraphService.getParent(ids.torso)).toBe(ids.actor);
    expect(bodyGraphService.getParent(ids.leftArm)).toBe(ids.torso);
    expect(bodyGraphService.getChildren(ids.torso)).toEqual(
      expect.arrayContaining([ids.leftArm, ids.rightArm, ids.heart])
    );
    expect(bodyGraphService.getAncestors(ids.leftHand)).toEqual([
      ids.leftArm,
      ids.torso,
      ids.actor,
    ]);
    expect(bodyGraphService.getAllDescendants(ids.rightArm)).toEqual([]);
    expect(bodyGraphService.getAllDescendants(ids.torso)).toEqual(
      expect.arrayContaining([ids.leftArm, ids.leftHand, ids.rightArm, ids.heart])
    );
    expect(bodyGraphService.getPath(ids.leftHand, ids.rightArm)).toEqual([
      ids.leftHand,
      ids.leftArm,
      ids.torso,
      ids.rightArm,
    ]);
    expect(bodyGraphService.getPath(ids.leftHand, 'missing')).toBeNull();

    expect(
      bodyGraphService.hasPartWithComponent(bodyComponent, 'core:description')
    ).toBe(true);
    expect(
      bodyGraphService.hasPartWithComponent(bodyComponent, 'missing:component')
    ).toBe(false);
    expect(
      bodyGraphService.hasPartWithComponentValue(
        bodyComponent,
        'custom:status',
        'vitals.pulse',
        72
      )
    ).toEqual({ found: true, partId: ids.heart });
    expect(
      bodyGraphService.hasPartWithComponentValue(
        bodyComponent,
        'custom:status',
        'vitals.pulse',
        40
      )
    ).toEqual({ found: false });
    expect(bodyGraphService.getAllParts({})).toEqual([]);

    const anatomyData = await bodyGraphService.getAnatomyData(ids.actor);
    expect(anatomyData).toEqual({
      recipeId: 'integration_recipe',
      rootEntityId: ids.actor,
    });
    expect(await bodyGraphService.getAnatomyData('unknown-actor')).toBeNull();

    const validationBeforeBreak = bodyGraphService.validateCache();
    expect(validationBeforeBreak.valid).toBe(false);
    expect(validationBeforeBreak.issues).toEqual(
      expect.arrayContaining([
        "Entity 'torso-1' in cache has parent but no joint component",
      ])
    );

    await bodyGraphService.buildAdjacencyCache(ids.torso);
    entityManager.removeComponent(ids.leftArm, 'anatomy:joint');
    const validationAfterBreak = bodyGraphService.validateCache();
    expect(validationAfterBreak.valid).toBe(false);
    expect(validationAfterBreak.issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Entity 'left-arm-1' in cache has parent but no joint component"),
      ])
    );

    await entityManager.addComponent(ids.leftArm, 'anatomy:joint', {
      parentId: ids.torso,
      socketId: 'left_shoulder',
    });
    await bodyGraphService.buildAdjacencyCache(ids.torso);
    const validationAfterFix = bodyGraphService.validateCache();
    expect(validationAfterFix.valid).toBe(false);
    expect(validationAfterFix.issues).toEqual(
      expect.arrayContaining([
        "Entity 'torso-1' in cache has parent but no joint component",
      ])
    );
    expect(validationAfterFix.issues).not.toEqual(
      expect.arrayContaining([
        expect.stringContaining("Entity 'left-arm-1' in cache has parent but no joint component"),
      ])
    );
  });

  it('invalidates caches and query results when detaching anatomy parts', async () => {
    await bodyGraphService.buildAdjacencyCache(ids.torso);

    const bodyComponent = entityManager.getComponentData(ids.actor, 'anatomy:body');
    const partsBeforeDetach = bodyGraphService.getAllParts(bodyComponent.body);
    const cachedPartsBeforeDetach = bodyGraphService.getAllParts(bodyComponent.body);
    expect(cachedPartsBeforeDetach).toBe(partsBeforeDetach);

    const armsBeforeDetach = bodyGraphService.findPartsByType(ids.torso, 'arm');
    expect(armsBeforeDetach).toHaveLength(2);

    const detachCascade = await bodyGraphService.detachPart(ids.leftArm, {
      cascade: true,
      reason: 'injury',
    });
    expect(detachCascade).toEqual(
      expect.objectContaining({
        parentId: ids.torso,
        socketId: 'left_shoulder',
        detached: expect.arrayContaining([ids.leftArm, ids.leftHand]),
      })
    );

    const dispatchedEvent = eventDispatcher.events.find(
      (evt) => evt.eventId === LIMB_DETACHED_EVENT_ID
    );
    expect(dispatchedEvent).toBeDefined();
    expect(dispatchedEvent.payload.detachedEntityId).toBe(ids.leftArm);
    expect(dispatchedEvent.payload.parentEntityId).toBe(ids.torso);
    expect(dispatchedEvent.payload.detachedCount).toBe(2);
    expect(dispatchedEvent.payload.reason).toBe('injury');
    expect(typeof dispatchedEvent.payload.timestamp).toBe('number');

    expect(bodyGraphService.hasCache(ids.torso)).toBe(false);
    await bodyGraphService.buildAdjacencyCache(ids.torso);

    const armsAfterDetach = bodyGraphService.findPartsByType(ids.torso, 'arm');
    expect(armsAfterDetach).not.toBe(armsBeforeDetach);
    expect(armsAfterDetach).toEqual([ids.rightArm]);

    const partsAfterDetach = bodyGraphService.getAllParts(bodyComponent.body);
    expect(partsAfterDetach).not.toBe(partsBeforeDetach);
    expect(partsAfterDetach).toEqual(
      expect.arrayContaining([ids.torso, ids.rightArm, ids.heart])
    );
    expect(partsAfterDetach).not.toEqual(
      expect.arrayContaining([ids.leftArm, ids.leftHand])
    );

    const invalidationLog = logger.entries.find((entry) =>
      entry.message.includes('AnatomyQueryCache: Invalidated')
    );
    expect(invalidationLog).toBeDefined();

    const detachSingle = await bodyGraphService.detachPart(ids.heart, {
      cascade: false,
      reason: 'surgery',
    });
    expect(detachSingle.detached).toEqual([ids.heart]);
    expect(detachSingle.parentId).toBe(ids.torso);
    expect(detachSingle.socketId).toBe('chest_cavity');

    expect(bodyGraphService.hasCache(ids.torso)).toBe(false);
    await bodyGraphService.buildAdjacencyCache(ids.torso);
    expect(bodyGraphService.getChildren(ids.torso)).toEqual([ids.rightArm]);

    const graphAfterDetach = await bodyGraphService.getBodyGraph(ids.actor);
    expect(graphAfterDetach.getConnectedParts(ids.torso)).toEqual(
      expect.arrayContaining([ids.rightArm])
    );
    expect(graphAfterDetach.getConnectedParts('missing-node')).toEqual([]);

    await expect(bodyGraphService.detachPart('unknown-node')).rejects.toThrow(
      /has no joint component/
    );
    await expect(bodyGraphService.getBodyGraph(42)).rejects.toThrow(
      /Entity ID is required and must be a string/
    );
    await expect(bodyGraphService.getAnatomyData(42)).rejects.toThrow(
      /Entity ID is required and must be a string/
    );
  });
});
