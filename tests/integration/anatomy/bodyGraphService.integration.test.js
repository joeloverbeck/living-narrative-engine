/**
 * @file Integration tests for BodyGraphService covering graph traversal, caching,
 * and mutation workflows using the real anatomy generation pipeline.
 */

import { describe, beforeEach, afterEach, expect, test, jest } from '@jest/globals';
import { BodyGraphService, LIMB_DETACHED_EVENT_ID } from '../../../src/anatomy/bodyGraphService.js';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';

const RECIPE_ID = 'anatomy:human_female_balanced';

/**
 * Helper to locate the first part ID that matches a predicate.
 *
 * @param {string[]} partIds
 * @param {(partData: any, partId: string) => boolean} predicate
 * @param {AnatomyIntegrationTestBed} testBed
 * @returns {string}
 */
function findPart(partIds, predicate, testBed) {
  for (const partId of partIds) {
    const partData = testBed.entityManager.getComponentData(partId, 'anatomy:part');
    if (predicate(partData, partId)) {
      return partId;
    }
  }
  return '';
}

describe('BodyGraphService integration', () => {
  let testBed;
  let service;
  let actor;
  let bodyComponent;

  beforeEach(async () => {
    jest.setTimeout(30000);
    testBed = new AnatomyIntegrationTestBed();
    await testBed.setup();

    service = new BodyGraphService({
      entityManager: testBed.entityManager,
      logger: testBed.logger,
      eventDispatcher: testBed.eventDispatcher,
    });

    actor = await testBed.createActor({ recipeId: RECIPE_ID });
    await testBed.anatomyGenerationService.generateAnatomyIfNeeded(actor.id);
    bodyComponent = testBed.entityManager.getComponentData(actor.id, 'anatomy:body');
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  test('builds adjacency caches and supports anatomy traversal', async () => {
    const blueprintParts = service.getAllParts(bodyComponent);
    expect(blueprintParts.length).toBeGreaterThan(0);
    expect(blueprintParts).toContain(bodyComponent.body.root);

    await service.buildAdjacencyCache(actor.id);
    expect(service.hasCache(actor.id)).toBe(true);

    const actorScopedParts = service.getAllParts(bodyComponent, actor.id);
    expect(actorScopedParts).toContain(bodyComponent.body.root);
    expect(service.getAllParts(bodyComponent, actor.id)).toBe(actorScopedParts);

    const torsoId = findPart(actorScopedParts, (part) => part?.subType === 'torso', testBed);
    const legId = findPart(actorScopedParts, (part) => part?.subType === 'leg', testBed);
    const handId = findPart(actorScopedParts, (part) => part?.subType === 'hand', testBed);

    expect(torsoId).toBeTruthy();
    expect(legId).toBeTruthy();
    expect(handId).toBeTruthy();

    expect(service.getParent(legId)).toBe(torsoId);
    expect(service.getAncestors(legId)).toEqual(expect.arrayContaining([torsoId, actor.id]));

    const torsoChildren = service.getChildren(torsoId);
    expect(torsoChildren.length).toBeGreaterThan(0);
    expect(torsoChildren).toEqual(expect.arrayContaining([legId]));

    const torsoDescendants = service.getAllDescendants(torsoId);
    expect(torsoDescendants).toEqual(expect.arrayContaining([legId, handId]));

    const pathToHand = service.getPath(actor.id, handId);
    expect(pathToHand).not.toBeNull();
    expect(pathToHand[0]).toBe(actor.id);
    expect(pathToHand[pathToHand.length - 1]).toBe(handId);
    expect(service.getAnatomyRoot(handId)).toBe(actor.id);

    const arms = service.findPartsByType(actor.id, 'arm');
    expect(arms.length).toBeGreaterThanOrEqual(2);
    expect(service.findPartsByType(actor.id, 'arm')).toBe(arms);

    const graph = await service.getBodyGraph(actor.id);
    expect(graph.getAllPartIds()).toBe(actorScopedParts);
    expect(graph.getConnectedParts(torsoId)).toEqual(expect.arrayContaining(torsoChildren));

    const validation = service.validateCache();
    expect(validation.valid).toBe(false);
    expect(validation.issues.length).toBeGreaterThan(0);
    expect(validation.issues[0]).toContain('has parent but no joint component');
  });

  test('detaches anatomy parts and invalidates caches while dispatching events', async () => {
    await service.buildAdjacencyCache(actor.id);
    const legs = service.findPartsByType(actor.id, 'leg');
    const legId = legs[0];
    const secondLegId = legs[1];

    const jointBefore = testBed.entityManager.getComponentData(legId, 'anatomy:joint');
    const parentId = jointBefore.parentId || jointBefore.parentEntityId;
    const socketId = jointBefore.socketId || jointBefore.childSocketId;

    const result = await service.detachPart(legId, { reason: 'integration-test' });

    expect(result.detached).toContain(legId);
    expect(result.parentId).toBe(parentId);
    expect(result.socketId).toBe(socketId);

    expect(testBed.eventDispatcher.dispatch).toHaveBeenCalledWith(
      LIMB_DETACHED_EVENT_ID,
      expect.objectContaining({
        detachedEntityId: legId,
        parentEntityId: parentId,
        socketId,
        detachedCount: result.detached.length,
        reason: 'integration-test',
      })
    );

    expect(testBed.entityManager.getComponentData(legId, 'anatomy:joint')).toBeUndefined();
    expect(service.hasCache(actor.id)).toBe(false);

    await service.buildAdjacencyCache(actor.id);
    const noCascadeResult = await service.detachPart(secondLegId, {
      cascade: false,
      reason: 'no-cascade',
    });

    expect(noCascadeResult.detached).toEqual([secondLegId]);
    expect(testBed.eventDispatcher.dispatch).toHaveBeenCalledWith(
      LIMB_DETACHED_EVENT_ID,
      expect.objectContaining({
        detachedEntityId: secondLegId,
        detachedCount: 1,
        reason: 'no-cascade',
      })
    );
  });

  test('resolves anatomy metadata and component queries with caching safeguards', async () => {
    await service.buildAdjacencyCache(actor.id);

    expect(service.hasPartWithComponent(bodyComponent, 'core:name')).toBe(true);
    expect(service.hasPartWithComponent(bodyComponent, 'nonexistent:component')).toBe(false);

    const foundTorso = service.hasPartWithComponentValue(
      bodyComponent,
      'anatomy:part',
      'subType',
      'torso'
    );
    expect(foundTorso.found).toBe(true);
    expect(
      testBed.entityManager.getComponentData(foundTorso.partId, 'anatomy:part')?.subType
    ).toBe('torso');

    expect(
      service.hasPartWithComponentValue(bodyComponent, 'core:name', 'text', 'does-not-exist')
    ).toEqual({ found: false });

    const directStructure = {
      root: bodyComponent.body.root,
      parts: bodyComponent.body.parts,
    };
    expect(service.getAllParts(directStructure)).toEqual(
      expect.arrayContaining([bodyComponent.body.root])
    );
    expect(service.getAllParts({ body: {} })).toEqual([]);

    const anatomyData = await service.getAnatomyData(actor.id);
    expect(anatomyData).toEqual({ recipeId: RECIPE_ID, rootEntityId: actor.id });

    const entityWithoutBody = await testBed.entityManager.createEntityInstance('core:actor');
    await expect(service.getAnatomyData(entityWithoutBody.id)).resolves.toBeNull();
    await expect(service.getBodyGraph(entityWithoutBody.id)).rejects.toThrow(
      'has no anatomy:body component'
    );
    await expect(service.getBodyGraph(123)).rejects.toThrow('must be a string');
    await expect(service.getAnatomyData(123)).rejects.toThrow('must be a string');

    await expect(service.detachPart(actor.id)).rejects.toThrow('has no joint component');

    expect(() =>
      new BodyGraphService({
        logger: testBed.logger,
        eventDispatcher: testBed.eventDispatcher,
      })
    ).toThrow('entityManager is required');
    expect(() =>
      new BodyGraphService({
        entityManager: testBed.entityManager,
        eventDispatcher: testBed.eventDispatcher,
      })
    ).toThrow('logger is required');
    expect(() =>
      new BodyGraphService({
        entityManager: testBed.entityManager,
        logger: testBed.logger,
      })
    ).toThrow('eventDispatcher is required');

    expect(service.getAllParts(null)).toEqual([]);
  });
});

