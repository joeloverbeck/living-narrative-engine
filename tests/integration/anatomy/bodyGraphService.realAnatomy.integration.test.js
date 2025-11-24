import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import BodyGraphService, {
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

const HUMAN_BALANCED_RECIPE = 'anatomy:human_female_balanced';

describe('BodyGraphService real anatomy integration', () => {
  let testBed;
  let actor;
  let entityManager;
  let logger;
  let eventDispatcher;
  let service;
  let bodyComponent;
  let parts;
  let torsoId;
  let leftArmId;
  let rightArmId;
  let leftHandId;
  let rightHandId;
  let headId;
  let leftLegId;
  let leftArmJoint;
  let rightArmJoint;

  beforeEach(async () => {
    testBed = new AnatomyIntegrationTestBed();
    actor = await testBed.createActor({ recipeId: HUMAN_BALANCED_RECIPE });
    entityManager = testBed.entityManager;
    logger = testBed.logger;
    eventDispatcher = testBed.eventDispatcher;

    await testBed.anatomyGenerationService.generateAnatomyIfNeeded(actor.id);

    const actorInstance = entityManager.getEntityInstance(actor.id);
    bodyComponent = actorInstance.getComponentData('anatomy:body');
    parts = bodyComponent.body.parts;
    torsoId = bodyComponent.body.root;
    leftArmId = parts['left arm'];
    rightArmId = parts['right arm'];
    leftHandId = parts['left hand'];
    rightHandId = parts['right hand'];
    headId = parts.head;
    leftLegId = parts['left leg'];

    leftArmJoint = entityManager.getComponentData(leftArmId, 'anatomy:joint');
    rightArmJoint = entityManager.getComponentData(rightArmId, 'anatomy:joint');

    service = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher,
    });

    await service.buildAdjacencyCache(actor.id);

    logger.debug.mockClear();
    logger.info.mockClear();
    eventDispatcher.dispatch.mockClear();
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  it('performs full graph traversal on generated anatomy', async () => {
    expect(service.hasCache(actor.id)).toBe(true);

    expect(service.getAllParts(null)).toEqual([]);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('No bodyComponent provided')
    );

    const missingRootResult = service.getAllParts({ body: {} });
    expect(missingRootResult).toEqual([]);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('No root ID found')
    );

    const actorParts = service.getAllParts(bodyComponent, actor.id);
    expect(actorParts).toEqual(
      expect.arrayContaining([
        torsoId,
        leftArmId,
        rightArmId,
        leftHandId,
        rightHandId,
        headId,
        leftLegId,
      ])
    );

    const cachedParts = service.getAllParts(bodyComponent, actor.id);
    expect(cachedParts).toBe(actorParts);

    const blueprintParts = service.getAllParts(bodyComponent);
    expect(blueprintParts).toEqual(
      expect.arrayContaining([
        torsoId,
        leftArmId,
        rightArmId,
        leftHandId,
        rightHandId,
      ])
    );

    const fallbackParts = service.getAllParts(bodyComponent, 'ghost-actor');
    expect(fallbackParts).toEqual(blueprintParts);
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Using blueprint root')
    );

    const arms = service.findPartsByType(actor.id, 'arm');
    expect(arms).toEqual(expect.arrayContaining([leftArmId, rightArmId]));
    const cachedArms = service.findPartsByType(actor.id, 'arm');
    expect(cachedArms).toBe(arms);
    expect(service.findPartsByType(actor.id, 'wing')).toEqual([]);

    const path = service.getPath(leftHandId, rightArmId);
    expect(path).toEqual([leftHandId, leftArmId, torsoId, rightArmId]);
    expect(service.getPath(leftHandId, leftHandId)).toEqual([leftHandId]);

    expect(service.getAnatomyRoot(leftHandId)).toBe(actor.id);
    expect(service.getAnatomyRoot(null)).toBeNull();
    expect(service.getAnatomyRoot('nonexistent-part')).toBe(
      'nonexistent-part'
    );

    expect(service.getChildren(torsoId)).toEqual(
      expect.arrayContaining([leftArmId, rightArmId, headId])
    );
    expect(service.getChildren('unknown')).toEqual([]);

    expect(service.getParent(leftHandId)).toBe(leftArmId);
    expect(service.getParent('unknown')).toBeNull();

    expect(service.getAncestors(leftHandId)).toEqual([
      leftArmId,
      torsoId,
      actor.id,
    ]);

    const descendantsFromActor = service.getAllDescendants(actor.id);
    expect(descendantsFromActor).toEqual(
      expect.arrayContaining([
        torsoId,
        leftArmId,
        rightArmId,
        leftHandId,
        rightHandId,
        headId,
      ])
    );
    expect(descendantsFromActor).not.toContain(actor.id);

    const descendantsFromLeftArm = service.getAllDescendants(leftArmId);
    expect(descendantsFromLeftArm).toEqual(
      expect.arrayContaining([leftHandId])
    );
    expect(descendantsFromLeftArm).not.toContain(leftArmId);

    expect(
      service.hasPartWithComponent(bodyComponent, 'anatomy:joint')
    ).toBe(true);
    expect(
      service.hasPartWithComponent(bodyComponent, 'nonexistent:component')
    ).toBe(false);

    const orientationMatch = service.hasPartWithComponentValue(
      bodyComponent,
      'anatomy:part',
      'orientation',
      'left'
    );
    expect(orientationMatch).toEqual({ found: true, partId: orientationMatch.partId });
    expect(Object.values(parts)).toContain(orientationMatch.partId);

    const orientationMiss = service.hasPartWithComponentValue(
      bodyComponent,
      'anatomy:part',
      'orientation',
      'upside-down'
    );
    expect(orientationMiss).toEqual({ found: false });

    const bodyGraph = await service.getBodyGraph(actor.id);
    expect(bodyGraph.getAllPartIds()).toBe(actorParts);
    expect(bodyGraph.getConnectedParts(torsoId)).toEqual(
      expect.arrayContaining([leftArmId, rightArmId, headId])
    );
    expect(bodyGraph.getConnectedParts('unknown')).toEqual([]);

    const validation = service.validateCache();
    expect(validation.valid).toBe(false);
    expect(validation.issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining('has parent but no joint component'),
      ])
    );
  });

  it('handles detachment, cache invalidation, and error scenarios', async () => {
    const cascadeResult = await service.detachPart(leftArmId);
    expect(cascadeResult.detached).toEqual(
      expect.arrayContaining([leftArmId, leftHandId])
    );
    expect(cascadeResult.parentId).toBe(torsoId);
    expect(cascadeResult.socketId).toBe(leftArmJoint.socketId);

    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
      LIMB_DETACHED_EVENT_ID,
      expect.objectContaining({
        detachedEntityId: leftArmId,
        parentEntityId: torsoId,
        detachedCount: 2,
        reason: 'manual',
      })
    );

    expect(service.hasCache(actor.id)).toBe(false);

    await service.buildAdjacencyCache(actor.id);
    const partsAfterCascade = service.getAllParts(bodyComponent, actor.id);
    expect(partsAfterCascade).not.toContain(leftArmId);
    expect(partsAfterCascade).not.toContain(leftHandId);

    const armsAfterCascade = service.findPartsByType(actor.id, 'arm');
    expect(armsAfterCascade).not.toContain(leftArmId);
    const cachedArmsAfterCascade = service.findPartsByType(actor.id, 'arm');
    expect(cachedArmsAfterCascade).toBe(armsAfterCascade);

    const singleDetach = await service.detachPart(rightArmId, {
      cascade: false,
      reason: 'surgery',
    });
    expect(singleDetach.detached).toEqual([rightArmId]);
    expect(singleDetach.parentId).toBe(torsoId);
    expect(singleDetach.socketId).toBe(rightArmJoint.socketId);

    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
      LIMB_DETACHED_EVENT_ID,
      expect.objectContaining({
        detachedEntityId: rightArmId,
        detachedCount: 1,
        reason: 'surgery',
      })
    );

    const detachCalls = eventDispatcher.dispatch.mock.calls.filter(
      ([eventId]) => eventId === LIMB_DETACHED_EVENT_ID
    );
    expect(detachCalls).toHaveLength(2);

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Detached 2 entities')
    );

    await service.buildAdjacencyCache(actor.id);
    const armsAfterAllDetachments = service.findPartsByType(actor.id, 'arm');
    expect(armsAfterAllDetachments).not.toContain(rightArmId);

    testBed.loadEntityDefinitions({
      'test:blank': { description: 'Blank entity', components: {} },
    });
    const strayEntity = await entityManager.createEntityInstance('test:blank');
    const strayEntityId = strayEntity.id;
    await expect(service.detachPart(strayEntityId)).rejects.toThrow(
      InvalidArgumentError
    );

    await expect(service.getBodyGraph(null)).rejects.toThrow(
      InvalidArgumentError
    );
    await expect(service.getBodyGraph(strayEntityId)).rejects.toThrow(
      'has no anatomy:body component'
    );

    await expect(service.getAnatomyData(null)).rejects.toThrow(
      InvalidArgumentError
    );
    await expect(service.getAnatomyData(strayEntityId)).resolves.toBeNull();
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('has no anatomy:body component')
    );
  });
});
