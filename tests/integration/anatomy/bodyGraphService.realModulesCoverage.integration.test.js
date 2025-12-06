import {
  BodyGraphService,
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import AnatomyQueryCache from '../../../src/anatomy/cache/AnatomyQueryCache.js';
import { SimpleEntityManager } from '../../common/entities/index.js';

describe('BodyGraphService integration with real anatomy collaborators', () => {
  /** @type {SimpleEntityManager} */
  let entityManager;
  let logger;
  let eventDispatcher;
  let bodyGraphService;
  let actorId;
  let torsoId;
  let headId;
  let leftArmId;
  let leftHandId;
  let rightArmId;
  let legId;
  let bodyComponent;

  const createLogger = () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  });

  /**
   *
   */
  async function seedAnatomy() {
    await entityManager.addComponent(torsoId, 'anatomy:part', {
      subType: 'torso',
    });
    await entityManager.addComponent(torsoId, 'core:name', { text: 'Torso' });

    await entityManager.addComponent(headId, 'anatomy:part', {
      subType: 'head',
    });
    await entityManager.addComponent(headId, 'core:name', { text: 'Head' });
    await entityManager.addComponent(headId, 'anatomy:joint', {
      parentId: torsoId,
      socketId: 'neck',
    });

    await entityManager.addComponent(leftArmId, 'anatomy:part', {
      subType: 'arm',
    });
    await entityManager.addComponent(leftArmId, 'core:name', {
      text: 'Left Arm',
    });
    await entityManager.addComponent(leftArmId, 'core:tattoo', {
      pattern: 'dragon',
      appearance: { color: 'blue' },
    });
    await entityManager.addComponent(leftArmId, 'anatomy:joint', {
      parentId: torsoId,
      socketId: 'left_shoulder',
    });

    await entityManager.addComponent(leftHandId, 'anatomy:part', {
      subType: 'hand',
    });
    await entityManager.addComponent(leftHandId, 'core:name', {
      text: 'Left Hand',
    });
    await entityManager.addComponent(leftHandId, 'anatomy:joint', {
      parentId: leftArmId,
      socketId: 'left_wrist',
    });
    await entityManager.addComponent(leftHandId, 'appearance:details', {
      jewelry: { ring: 'gold' },
    });

    await entityManager.addComponent(rightArmId, 'anatomy:part', {
      subType: 'arm',
    });
    await entityManager.addComponent(rightArmId, 'core:name', {
      text: 'Right Arm',
    });
    await entityManager.addComponent(rightArmId, 'core:scar', {});
    await entityManager.addComponent(rightArmId, 'anatomy:joint', {
      parentId: torsoId,
      socketId: 'right_shoulder',
    });

    await entityManager.addComponent(legId, 'anatomy:part', { subType: 'leg' });
    await entityManager.addComponent(legId, 'core:name', { text: 'Leg' });
    await entityManager.addComponent(legId, 'anatomy:joint', {
      parentId: torsoId,
      socketId: 'hip',
    });

    await entityManager.addComponent(actorId, 'anatomy:body', {
      recipeId: 'test_recipe',
      body: { root: torsoId },
      root: torsoId,
      structure: { rootPartId: torsoId },
    });
  }

  beforeEach(async () => {
    entityManager = new SimpleEntityManager();
    logger = createLogger();
    eventDispatcher = {
      dispatch: jest.fn(async () => {}),
    };

    actorId = 'actor-1';
    torsoId = 'torso-1';
    headId = 'head-1';
    leftArmId = 'left-arm-1';
    leftHandId = 'left-hand-1';
    rightArmId = 'right-arm-1';
    legId = 'leg-1';

    await seedAnatomy();

    bodyGraphService = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher,
    });

    await bodyGraphService.buildAdjacencyCache(torsoId);
    bodyComponent = entityManager.getComponentData(actorId, 'anatomy:body');
  });

  it('validates required constructor dependencies', () => {
    const baseLogger = createLogger();
    const baseDispatcher = { dispatch: jest.fn() };
    expect(
      () =>
        new BodyGraphService({
          logger: baseLogger,
          eventDispatcher: baseDispatcher,
        })
    ).toThrow(InvalidArgumentError);
    expect(
      () =>
        new BodyGraphService({
          entityManager: new SimpleEntityManager(),
          eventDispatcher: baseDispatcher,
        })
    ).toThrow(InvalidArgumentError);
    expect(
      () =>
        new BodyGraphService({
          entityManager: new SimpleEntityManager(),
          logger: baseLogger,
        })
    ).toThrow(InvalidArgumentError);
  });

  it('builds adjacency cache once and caches repeated graph queries', async () => {
    expect(bodyGraphService.hasCache(torsoId)).toBe(true);
    await bodyGraphService.buildAdjacencyCache(torsoId);

    const arms = bodyGraphService.findPartsByType(torsoId, 'arm');
    expect(arms.sort()).toEqual([leftArmId, rightArmId]);

    logger.debug.mockClear();
    const cachedArms = bodyGraphService.findPartsByType(torsoId, 'arm');
    expect(cachedArms).toEqual(arms);
    expect(
      logger.debug.mock.calls.some(
        ([message]) =>
          typeof message === 'string' && message.includes('Cache hit for key')
      )
    ).toBe(true);
  });

  it('navigates cached anatomy structures', () => {
    const allParts = bodyGraphService.getAllParts(bodyComponent, torsoId);
    expect(allParts.sort()).toEqual(
      [torsoId, headId, leftArmId, leftHandId, rightArmId, legId].sort()
    );

    logger.debug.mockClear();
    const cachedParts = bodyGraphService.getAllParts(bodyComponent, torsoId);
    expect(cachedParts).toEqual(allParts);
    expect(
      logger.debug.mock.calls.some(
        ([message]) =>
          typeof message === 'string' &&
          message.includes(
            'BodyGraphService.getAllParts: CACHE HIT for cache root'
          )
      )
    ).toBe(true);

    expect(bodyGraphService.getAllParts(null, torsoId)).toEqual([]);
    expect(bodyGraphService.getAllParts({}, torsoId)).toEqual([]);

    const simpleBody = { root: torsoId };
    expect(bodyGraphService.getAllParts(simpleBody, torsoId)).toEqual(allParts);

    const actorRootParts = bodyGraphService.getAllParts(bodyComponent, actorId);
    expect(actorRootParts).toEqual(allParts);
  });

  it('checks component presence and values across the entire anatomy', () => {
    expect(
      bodyGraphService.hasPartWithComponent(bodyComponent, 'core:tattoo')
    ).toBe(true);
    expect(
      bodyGraphService.hasPartWithComponent(bodyComponent, 'core:scar')
    ).toBe(false);

    expect(
      bodyGraphService.hasPartWithComponentValue(
        bodyComponent,
        'anatomy:part',
        'subType',
        'hand'
      )
    ).toEqual({ found: true, partId: leftHandId });

    expect(
      bodyGraphService.hasPartWithComponentValue(
        bodyComponent,
        'appearance:details',
        'jewelry.ring',
        'gold'
      )
    ).toEqual({ found: true, partId: leftHandId });

    expect(
      bodyGraphService.hasPartWithComponentValue(
        bodyComponent,
        'appearance:details',
        'jewelry.ring',
        'silver'
      )
    ).toEqual({ found: false });
  });

  it('computes graph paths, ancestry, and descendant relationships', () => {
    expect(bodyGraphService.getAnatomyRoot(leftHandId)).toBe(torsoId);
    expect(bodyGraphService.getAnatomyRoot('unknown-part')).toBe(
      'unknown-part'
    );

    const path = bodyGraphService.getPath(leftHandId, rightArmId);
    expect(path).toEqual([leftHandId, leftArmId, torsoId, rightArmId]);
    expect(bodyGraphService.getPath(leftHandId, leftHandId)).toEqual([
      leftHandId,
    ]);
    expect(bodyGraphService.getPath(leftHandId, 'missing-target')).toBeNull();

    expect(bodyGraphService.getChildren(torsoId).sort()).toEqual(
      [headId, leftArmId, rightArmId, legId].sort()
    );
    expect(bodyGraphService.getParent(leftHandId)).toBe(leftArmId);
    expect(bodyGraphService.getParent('no-parent')).toBeNull();
    expect(bodyGraphService.getAncestors(leftHandId)).toEqual([
      leftArmId,
      torsoId,
    ]);
    expect(bodyGraphService.getAllDescendants(leftArmId)).toEqual([leftHandId]);
  });

  it('creates body graph helpers and validates anatomy metadata', async () => {
    await expect(bodyGraphService.getBodyGraph(null)).rejects.toThrow(
      InvalidArgumentError
    );
    await expect(bodyGraphService.getBodyGraph(leftArmId)).rejects.toThrow(
      /has no anatomy:body component/
    );

    const graph = await bodyGraphService.getBodyGraph(actorId);
    expect(graph.getAllPartIds().sort()).toEqual(
      [
        actorId,
        torsoId,
        headId,
        leftArmId,
        leftHandId,
        rightArmId,
        legId,
      ].sort()
    );
    expect(graph.getConnectedParts(leftArmId)).toEqual([leftHandId]);
    expect(graph.getConnectedParts(torsoId).sort()).toEqual(
      [headId, leftArmId, rightArmId, legId].sort()
    );

    await expect(bodyGraphService.getAnatomyData(null)).rejects.toThrow(
      InvalidArgumentError
    );
    expect(await bodyGraphService.getAnatomyData(leftArmId)).toBeNull();
    await expect(bodyGraphService.getAnatomyData(actorId)).resolves.toEqual({
      recipeId: 'test_recipe',
      rootEntityId: actorId,
    });
  });

  it('validates cache integrity for the active graph', () => {
    const validation = bodyGraphService.validateCache();
    expect(validation).toEqual({ valid: true, issues: [] });
    expect(bodyGraphService.hasCache(torsoId)).toBe(true);
    expect(bodyGraphService.hasCache('missing-root')).toBe(false);
  });

  it('detaches parts, invalidates caches, and emits events', async () => {
    const result = await bodyGraphService.detachPart(leftArmId);
    expect(result.detached.sort()).toEqual([leftArmId, leftHandId].sort());
    expect(result.parentId).toBe(torsoId);
    expect(result.socketId).toBe('left_shoulder');

    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
      LIMB_DETACHED_EVENT_ID,
      expect.objectContaining({
        detachedEntityId: leftArmId,
        parentEntityId: torsoId,
        socketId: 'left_shoulder',
        detachedCount: 2,
        reason: 'manual',
      })
    );
    expect(bodyGraphService.hasCache(torsoId)).toBe(false);
    expect(
      entityManager.getComponentData(leftArmId, 'anatomy:joint')
    ).toBeNull();
  });

  it('supports non-cascading detachment when requested', async () => {
    const result = await bodyGraphService.detachPart(rightArmId, {
      cascade: false,
      reason: 'surgery',
    });

    expect(result.detached).toEqual([rightArmId]);
    expect(result.parentId).toBe(torsoId);
    expect(result.socketId).toBe('right_shoulder');
    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
      LIMB_DETACHED_EVENT_ID,
      expect.objectContaining({
        detachedEntityId: rightArmId,
        detachedCount: 1,
        reason: 'surgery',
      })
    );
  });

  it('throws when detaching a part without a joint component', async () => {
    await expect(bodyGraphService.detachPart(torsoId)).rejects.toThrow(
      /has no joint component/
    );
  });

  it('can operate with an externally provided query cache', async () => {
    const sharedLogger = createLogger();
    const customCache = new AnatomyQueryCache({ logger: sharedLogger });
    const serviceWithCustomCache = new BodyGraphService({
      entityManager,
      logger: sharedLogger,
      eventDispatcher,
      queryCache: customCache,
    });

    await serviceWithCustomCache.buildAdjacencyCache(torsoId);
    const firstLookup = serviceWithCustomCache.findPartsByType(torsoId, 'arm');
    expect(customCache.getCachedFindPartsByType(torsoId, 'arm').sort()).toEqual(
      firstLookup.sort()
    );

    const cacheHitCountBefore = sharedLogger.debug.mock.calls.filter(
      ([message]) =>
        typeof message === 'string' &&
        message.includes('AnatomyQueryCache: Cache hit')
    ).length;

    serviceWithCustomCache.findPartsByType(torsoId, 'arm');

    const cacheHitCountAfter = sharedLogger.debug.mock.calls.filter(
      ([message]) =>
        typeof message === 'string' &&
        message.includes('AnatomyQueryCache: Cache hit')
    ).length;
    expect(cacheHitCountAfter).toBeGreaterThan(cacheHitCountBefore);

    const partListing = serviceWithCustomCache.getAllParts(
      bodyComponent,
      torsoId
    );
    expect(customCache.getCachedGetAllParts(torsoId).sort()).toEqual(
      partListing.sort()
    );
  });
});
