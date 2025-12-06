import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import BodyGraphService, {
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import SimplifiedAnatomyTestBed from '../../common/anatomy/simplifiedAnatomyTestBed.js';

/**
 * Builds a small but realistic anatomy graph using the real EntityManager.
 *
 * @param {SimplifiedAnatomyTestBed} testBed - The anatomy test bed instance.
 * @returns {Promise<{
 *   service: BodyGraphService,
 *   actorId: string,
 *   bodyComponent: object,
 *   parts: Record<string, string>
 * }>} Constructed services and entity identifiers.
 */
async function buildAnatomyGraph(testBed) {
  const { entityManager, logger, eventDispatcher } = testBed;

  const service = new BodyGraphService({
    entityManager,
    logger,
    eventDispatcher,
  });

  const actor = await entityManager.createEntityInstance('core:actor');
  await entityManager.addComponent(actor.id, 'core:name', {
    text: 'Integration Actor',
  });

  const createPart = async (definitionId, partData, jointData, extras = {}) => {
    const part = await entityManager.createEntityInstance(definitionId);
    await entityManager.addComponent(part.id, 'anatomy:part', partData);
    if (jointData) {
      await entityManager.addComponent(part.id, 'anatomy:joint', jointData);
    }
    for (const [componentId, data] of Object.entries(extras)) {
      await entityManager.addComponent(part.id, componentId, data);
    }
    return part;
  };

  const torso = await createPart(
    'anatomy:torso',
    { subType: 'torso' },
    { parentId: actor.id, socketId: 'torso-socket' },
    { 'custom:flag': { isImportant: true } }
  );
  const head = await createPart(
    'anatomy:head',
    { subType: 'head' },
    {
      parentId: torso.id,
      socketId: 'neck-socket',
    }
  );
  const leftArm = await createPart(
    'anatomy:arm',
    { subType: 'arm', orientation: 'left' },
    { parentId: torso.id, socketId: 'left-shoulder' },
    { 'custom:status': { metadata: { functional: 'primary' } } }
  );
  const rightArm = await createPart(
    'anatomy:arm',
    { subType: 'arm', orientation: 'right' },
    { parentId: torso.id, socketId: 'right-shoulder' },
    { 'custom:status': { metadata: { functional: 'secondary' } } }
  );
  const leftHand = await createPart(
    'anatomy:hand',
    { subType: 'hand', orientation: 'left' },
    { parentId: leftArm.id, socketId: 'left-wrist' }
  );
  const rightHand = await createPart(
    'anatomy:hand',
    { subType: 'hand', orientation: 'right' },
    { parentId: rightArm.id, socketId: 'right-wrist' }
  );
  const heart = await createPart(
    'anatomy:heart',
    { subType: 'heart' },
    { parentId: torso.id, socketId: 'inner-torso' },
    { 'vital:stats': { status: { beating: true } } }
  );
  const floating = await createPart('anatomy:arm', {
    subType: 'arm',
    orientation: 'floating',
  });

  const bodyComponent = {
    recipeId: 'integration:humanoid',
    body: {
      root: torso.id,
      parts: {
        torso: torso.id,
        head: head.id,
        leftArm: leftArm.id,
        rightArm: rightArm.id,
        leftHand: leftHand.id,
        rightHand: rightHand.id,
        heart: heart.id,
      },
    },
    structure: { rootPartId: torso.id },
  };
  await entityManager.addComponent(actor.id, 'anatomy:body', bodyComponent);

  return {
    service,
    actorId: actor.id,
    bodyComponent,
    parts: {
      actor: actor.id,
      torso: torso.id,
      head: head.id,
      leftArm: leftArm.id,
      rightArm: rightArm.id,
      leftHand: leftHand.id,
      rightHand: rightHand.id,
      heart: heart.id,
      floating: floating.id,
    },
  };
}

describe('BodyGraphService real cache integration', () => {
  /** @type {SimplifiedAnatomyTestBed} */
  let testBed;
  /** @type {BodyGraphService} */
  let service;
  /** @type {string} */
  let actorId;
  /** @type {Record<string, string>} */
  let parts;
  /** @type {object} */
  let bodyComponent;

  beforeEach(async () => {
    testBed = new SimplifiedAnatomyTestBed();
    await testBed.setup();

    testBed.loadMinimalComponents();
    testBed.loadComponents({
      'anatomy:joint': { id: 'anatomy:joint' },
      'custom:flag': { id: 'custom:flag' },
      'custom:status': { id: 'custom:status' },
      'vital:stats': { id: 'vital:stats' },
    });

    testBed.loadMinimalEntityDefinitions();
    testBed.loadEntityDefinitions({
      'anatomy:torso': {
        id: 'anatomy:torso',
        description: 'Torso for integration graph',
        components: { 'anatomy:part': { subType: 'torso' } },
      },
      'anatomy:head': {
        id: 'anatomy:head',
        description: 'Head for integration graph',
        components: { 'anatomy:part': { subType: 'head' } },
      },
      'anatomy:arm': {
        id: 'anatomy:arm',
        description: 'Arm for integration graph',
        components: { 'anatomy:part': { subType: 'arm' } },
      },
      'anatomy:hand': {
        id: 'anatomy:hand',
        description: 'Hand for integration graph',
        components: { 'anatomy:part': { subType: 'hand' } },
      },
      'anatomy:heart': {
        id: 'anatomy:heart',
        description: 'Heart for integration graph',
        components: { 'anatomy:part': { subType: 'heart' } },
      },
      'test:bodyless_actor': {
        id: 'test:bodyless_actor',
        description: 'Entity without anatomy for negative graph checks',
        components: { 'core:name': {} },
      },
    });

    const graph = await buildAnatomyGraph(testBed);
    service = graph.service;
    actorId = graph.actorId;
    bodyComponent = graph.bodyComponent;
    parts = graph.parts;
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  it('traverses and caches anatomy graphs using real dependencies', async () => {
    expect(service.getAnatomyRoot(parts.leftHand)).toBe(actorId);

    await service.buildAdjacencyCache(actorId);
    await service.buildAdjacencyCache(actorId);

    expect(service.hasCache(actorId)).toBe(true);

    expect(service.getAllParts(null)).toEqual([]);
    expect(service.getAllParts({})).toEqual([]);

    const blueprintParts = service.getAllParts(bodyComponent);
    expect(new Set(blueprintParts)).toEqual(
      new Set([
        parts.torso,
        parts.head,
        parts.leftArm,
        parts.rightArm,
        parts.leftHand,
        parts.rightHand,
        parts.heart,
      ])
    );

    const blueprintCached = service.getAllParts(bodyComponent);
    expect(blueprintCached).toBe(blueprintParts);

    const directStructureParts = service.getAllParts({ root: parts.torso });
    expect(new Set(directStructureParts)).toEqual(new Set(blueprintParts));

    const actorParts = service.getAllParts(bodyComponent, actorId);
    expect(actorParts).toContain(actorId);
    expect(new Set(actorParts)).toEqual(new Set([actorId, ...blueprintParts]));

    const actorPartsCached = service.getAllParts(bodyComponent, actorId);
    expect(actorPartsCached).toBe(actorParts);

    const fallbackParts = service.getAllParts(bodyComponent, 'unknown-root');
    expect(new Set(fallbackParts)).toEqual(new Set(blueprintParts));

    const hands = service.findPartsByType(actorId, 'hand');
    expect(new Set(hands)).toEqual(new Set([parts.leftHand, parts.rightHand]));
    const cachedHands = service.findPartsByType(actorId, 'hand');
    expect(cachedHands).toBe(hands);

    expect(service.hasPartWithComponent(bodyComponent, 'custom:flag')).toBe(
      true
    );
    expect(
      service.hasPartWithComponent(bodyComponent, 'missing:component')
    ).toBe(false);

    expect(
      service.hasPartWithComponentValue(
        bodyComponent,
        'custom:status',
        'metadata.functional',
        'primary'
      )
    ).toEqual({ found: true, partId: parts.leftArm });
    expect(
      service.hasPartWithComponentValue(
        bodyComponent,
        'custom:status',
        'metadata.functional',
        'unknown'
      )
    ).toEqual({ found: false });

    expect(service.getAnatomyRoot(parts.leftHand)).toBe(actorId);
    expect(service.getAnatomyRoot(parts.heart)).toBe(actorId);

    expect(service.getPath(parts.leftHand, parts.head)).toEqual([
      parts.leftHand,
      parts.leftArm,
      parts.torso,
      parts.head,
    ]);
    expect(service.getPath(parts.leftHand, parts.floating)).toBeNull();

    const graph = await service.getBodyGraph(actorId);
    expect(graph.getAllPartIds()).toBe(actorParts);
    expect(new Set(graph.getConnectedParts(parts.torso))).toEqual(
      new Set([parts.head, parts.leftArm, parts.rightArm, parts.heart])
    );

    const ancestors = service.getAncestors(parts.leftHand);
    expect(ancestors).toEqual([parts.leftArm, parts.torso, actorId]);

    const descendants = service.getAllDescendants(parts.torso);
    expect(new Set(descendants)).toEqual(
      new Set([
        parts.head,
        parts.leftArm,
        parts.rightArm,
        parts.leftHand,
        parts.rightHand,
        parts.heart,
      ])
    );
    expect(descendants).not.toContain(parts.torso);

    const validation = service.validateCache();
    expect(validation.valid).toBe(true);
    expect(validation.issues).toHaveLength(0);

    await expect(service.getAnatomyData(actorId)).resolves.toEqual({
      recipeId: bodyComponent.recipeId,
      rootEntityId: actorId,
    });
    await expect(service.getAnatomyData(parts.head)).resolves.toBeNull();

    await expect(service.getBodyGraph('')).rejects.toThrow(
      'Entity ID is required and must be a string'
    );

    const bodyless = await testBed.entityManager.createEntityInstance(
      'test:bodyless_actor'
    );
    await testBed.entityManager.addComponent(bodyless.id, 'core:name', {
      text: 'Bodyless actor',
    });
    await expect(service.getBodyGraph(bodyless.id)).rejects.toThrow(
      `Entity ${bodyless.id} has no anatomy:body component`
    );
  });

  it('detaches parts and invalidates caches end-to-end', async () => {
    await service.buildAdjacencyCache(actorId);
    const initialParts = service.getAllParts(bodyComponent, actorId);

    const detachCascade = await service.detachPart(parts.leftArm, {
      cascade: true,
      reason: 'integration-test',
    });

    expect(new Set(detachCascade.detached)).toEqual(
      new Set([parts.leftArm, parts.leftHand])
    );
    expect(detachCascade.parentId).toBe(parts.torso);
    expect(detachCascade.socketId).toBe('left-shoulder');
    expect(service.hasCache(actorId)).toBe(false);

    expect(testBed.eventDispatcher.dispatch).toHaveBeenCalledWith(
      LIMB_DETACHED_EVENT_ID,
      expect.objectContaining({
        detachedEntityId: parts.leftArm,
        parentEntityId: parts.torso,
        socketId: 'left-shoulder',
        detachedCount: 2,
        reason: 'integration-test',
      })
    );

    expect(
      testBed.entityManager.getComponentData(parts.leftArm, 'anatomy:joint')
    ).toBeUndefined();

    await service.buildAdjacencyCache(actorId);
    const rebuiltParts = service.getAllParts(bodyComponent, actorId);
    expect(rebuiltParts).not.toContain(parts.leftArm);
    expect(rebuiltParts).not.toContain(parts.leftHand);
    expect(rebuiltParts).not.toBe(initialParts);

    const rebuiltCached = service.getAllParts(bodyComponent, actorId);
    expect(rebuiltCached).toBe(rebuiltParts);

    const detachSingle = await service.detachPart(parts.rightArm, {
      cascade: false,
    });
    expect(detachSingle.detached).toEqual([parts.rightArm]);
    expect(service.hasCache(actorId)).toBe(false);

    await expect(service.detachPart(parts.floating)).rejects.toThrow(
      `Entity '${parts.floating}' has no joint component - cannot detach`
    );
  });
});
