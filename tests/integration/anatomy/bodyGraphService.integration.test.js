import {
  BodyGraphService,
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import { SimpleEntityManager } from '../../common/entities/index.js';

/**
 * @description Creates a simple logger implementation that records every log entry.
 * @returns {{entries: Array<{level:string,message:string,details:any[]}>, debug: Function, info: Function, warn: Function, error: Function}}
 */
function createRecordingLogger() {
  const entries = [];
  const record =
    (level) =>
    (message, ...details) => {
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
 * @description Creates an event dispatcher that records dispatched events.
 * @returns {{events: Array<{eventId:string,payload:any}>, dispatch: Function}}
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

describe('BodyGraphService integration', () => {
  let entityManager;
  let bodyGraphService;
  let logger;
  let eventDispatcher;

  const actorId = 'actor-1';
  const torsoId = 'torso-1';
  const leftArmId = 'left-arm-1';
  const rightArmId = 'right-arm-1';
  const leftHandId = 'left-hand-1';
  const heartId = 'heart-1';

  /**
   * @description Seeds the entity manager with a connected anatomy graph for the tests.
   * @returns {Promise<void>}
   */
  const seedAnatomy = async () => {
    await entityManager.addComponent(actorId, 'core:name', {
      text: 'Integration Actor',
    });

    await entityManager.addComponent(torsoId, 'anatomy:part', {
      partType: 'torso',
      subType: 'torso',
    });
    await entityManager.addComponent(torsoId, 'core:description', {
      text: 'central torso',
    });

    await entityManager.addComponent(leftArmId, 'anatomy:part', {
      partType: 'limb',
      subType: 'arm',
    });
    await entityManager.addComponent(leftArmId, 'anatomy:joint', {
      parentId: torsoId,
      socketId: 'left_shoulder',
    });
    await entityManager.addComponent(leftArmId, 'core:description', {
      text: 'left arm',
    });

    await entityManager.addComponent(rightArmId, 'anatomy:part', {
      partType: 'limb',
      subType: 'arm',
    });
    await entityManager.addComponent(rightArmId, 'anatomy:joint', {
      parentId: torsoId,
      socketId: 'right_shoulder',
    });

    await entityManager.addComponent(leftHandId, 'anatomy:part', {
      partType: 'extremity',
      subType: 'hand',
    });
    await entityManager.addComponent(leftHandId, 'anatomy:joint', {
      parentId: leftArmId,
      socketId: 'left_wrist',
    });
    await entityManager.addComponent(leftHandId, 'core:description', {
      text: 'left hand',
    });

    await entityManager.addComponent(heartId, 'anatomy:part', {
      partType: 'organ',
      subType: 'heart',
    });
    await entityManager.addComponent(heartId, 'anatomy:joint', {
      parentId: torsoId,
      socketId: 'chest_cavity',
    });
    await entityManager.addComponent(heartId, 'core:description', {
      text: 'vital heart',
    });
    await entityManager.addComponent(heartId, 'custom:status', {
      vitals: { pulse: 72, rhythm: 'steady' },
    });

    await entityManager.addComponent(actorId, 'anatomy:body', {
      recipeId: 'integration_recipe',
      body: {
        root: torsoId,
        parts: {
          torso: torsoId,
          leftArm: leftArmId,
          rightArm: rightArmId,
          leftHand: leftHandId,
          heart: heartId,
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

  it('builds caches and answers anatomy queries using real collaborators', async () => {
    await bodyGraphService.buildAdjacencyCache(torsoId);
    expect(bodyGraphService.hasCache(torsoId)).toBe(true);

    const children = bodyGraphService.getChildren(torsoId);
    expect(children).toEqual(
      expect.arrayContaining([leftArmId, rightArmId, heartId])
    );

    expect(bodyGraphService.getParent(leftArmId)).toBe(torsoId);
    expect(bodyGraphService.getAncestors(leftHandId)).toEqual([
      leftArmId,
      torsoId,
    ]);
    expect(bodyGraphService.getAllDescendants(torsoId)).toEqual(
      expect.arrayContaining([leftArmId, rightArmId, leftHandId, heartId])
    );

    const armsFirst = bodyGraphService.findPartsByType(torsoId, 'arm');
    expect(armsFirst).toEqual(expect.arrayContaining([leftArmId, rightArmId]));
    const armsSecond = bodyGraphService.findPartsByType(torsoId, 'arm');
    expect(armsSecond).toBe(armsFirst);

    expect(bodyGraphService.getAnatomyRoot(leftHandId)).toBe(torsoId);

    const path = bodyGraphService.getPath(leftHandId, rightArmId);
    expect(path).toEqual([leftHandId, leftArmId, torsoId, rightArmId]);

    const bodyComponent = await bodyGraphService.getAnatomyData(actorId);
    expect(bodyComponent).toEqual({
      recipeId: 'integration_recipe',
      rootEntityId: actorId,
    });

    const actorBodyComponent = entityManager.getComponentData(
      actorId,
      'anatomy:body'
    );
    const partsFirst = bodyGraphService.getAllParts(actorBodyComponent);
    expect(partsFirst).toEqual(
      expect.arrayContaining([
        torsoId,
        leftArmId,
        rightArmId,
        leftHandId,
        heartId,
      ])
    );
    const partsSecond = bodyGraphService.getAllParts(actorBodyComponent);
    expect(partsSecond).toBe(partsFirst);

    const directStructureParts = bodyGraphService.getAllParts(
      actorBodyComponent.body
    );
    expect(directStructureParts).toEqual(partsFirst);
    expect(bodyGraphService.getAllParts({})).toEqual([]);

    expect(
      bodyGraphService.hasPartWithComponent(
        actorBodyComponent,
        'core:description'
      )
    ).toBe(true);
    expect(
      bodyGraphService.hasPartWithComponent(
        actorBodyComponent,
        'missing:component'
      )
    ).toBe(false);

    expect(
      bodyGraphService.hasPartWithComponentValue(
        actorBodyComponent,
        'custom:status',
        'vitals.pulse',
        72
      )
    ).toEqual({ found: true, partId: heartId });
    expect(
      bodyGraphService.hasPartWithComponentValue(
        actorBodyComponent,
        'custom:status',
        'vitals.pulse',
        30
      )
    ).toEqual({ found: false });

    const validationBeforeActorCache = bodyGraphService.validateCache();
    expect(validationBeforeActorCache.valid).toBe(true);
    expect(validationBeforeActorCache.issues).toEqual([]);

    const graph = await bodyGraphService.getBodyGraph(actorId);
    expect(graph.getAllPartIds()).toEqual(expect.arrayContaining(partsFirst));
    expect(graph.getConnectedParts(leftArmId)).toEqual([leftHandId]);

    await bodyGraphService.buildAdjacencyCache(actorId);
    expect(bodyGraphService.hasCache(actorId)).toBe(true);
    const actorScopedParts = bodyGraphService.getAllParts(
      actorBodyComponent,
      actorId
    );
    expect(actorScopedParts).toEqual(
      expect.arrayContaining([...partsFirst, actorId])
    );
    expect(actorScopedParts).toHaveLength(partsFirst.length + 1);

    const validationAfterActorCache = bodyGraphService.validateCache();
    expect(validationAfterActorCache.valid).toBe(false);
    expect(validationAfterActorCache.issues).toContain(
      "Entity 'torso-1' in cache has parent but no joint component"
    );
    expect(bodyGraphService.hasCache('unknown-root')).toBe(false);
  });

  it('detaches limbs and invalidates caches through shared services', async () => {
    await bodyGraphService.buildAdjacencyCache(torsoId);
    await bodyGraphService.buildAdjacencyCache(actorId);

    const result = await bodyGraphService.detachPart(leftArmId, {
      cascade: true,
      reason: 'integration-test',
    });

    expect(result.parentId).toBe(torsoId);
    expect(result.socketId).toBe('left_shoulder');
    expect(result.detached).toEqual(
      expect.arrayContaining([leftArmId, leftHandId])
    );
    expect(
      entityManager.getComponentData(leftArmId, 'anatomy:joint')
    ).toBeNull();

    expect(eventDispatcher.events).toContainEqual({
      eventId: LIMB_DETACHED_EVENT_ID,
      payload: expect.objectContaining({
        detachedEntityId: leftArmId,
        parentEntityId: torsoId,
        socketId: 'left_shoulder',
        detachedCount: 2,
        reason: 'integration-test',
      }),
    });

    expect(bodyGraphService.hasCache(torsoId)).toBe(false);
    expect(bodyGraphService.getChildren(torsoId)).not.toContain(leftArmId);

    await expect(
      bodyGraphService.detachPart(heartId, {
        cascade: false,
        reason: 'single-detach',
      })
    ).resolves.toEqual(
      expect.objectContaining({
        parentId: torsoId,
        detached: [heartId],
      })
    );
    expect(entityManager.getComponentData(heartId, 'anatomy:joint')).toBeNull();
  });

  it('surfaces meaningful errors when inputs are invalid', async () => {
    await expect(bodyGraphService.getBodyGraph('left-arm-1')).rejects.toThrow(
      'has no anatomy:body component'
    );
    await expect(bodyGraphService.getBodyGraph(42)).rejects.toThrow(
      'Entity ID is required and must be a string'
    );

    await expect(bodyGraphService.getAnatomyData(42)).rejects.toThrow(
      'Entity ID is required and must be a string'
    );
    await expect(
      bodyGraphService.getAnatomyData(leftArmId)
    ).resolves.toBeNull();

    await expect(bodyGraphService.detachPart(torsoId)).rejects.toThrow(
      'has no joint component'
    );
  });
});
