/**
 * @file Integration test for anatomy cache isolation during concurrent operations
 * Tests Invariant 5: Cache operations on actor A cannot modify cache entries for actor B,
 * even during concurrent processing and invalidation.
 *
 * This test validates the per-root cache isolation design that was critical
 * for fixing the race condition bug where multiple characters would share
 * body parts during concurrent generation.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';

describe('AnatomyCacheManager - Concurrent Cache Isolation', () => {
  let testBed;
  let cacheManager;
  let bodyGraphService;
  let entityManager;

  beforeEach(async () => {
    testBed = new AnatomyIntegrationTestBed();
    await testBed.loadAnatomyModData();

    cacheManager = testBed.anatomyCacheManager;
    bodyGraphService = testBed.bodyGraphService;
    entityManager = testBed.entityManager;
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should isolate cache operations per actor during concurrent processing', async () => {
    // Arrange: Create 2 characters using test recipes
    const actorAId =
      await testBed.createCharacterFromRecipe('anatomy:human_male');
    const actorBId = await testBed.createCharacterFromRecipe(
      'anatomy:human_female'
    );

    // Get initial parts for both
    const entityA = entityManager.getEntityInstance(actorAId);
    const entityB = entityManager.getEntityInstance(actorBId);
    const anatomyA = entityA.getComponentData('anatomy:body');
    const anatomyB = entityB.getComponentData('anatomy:body');

    const initialPartsA = bodyGraphService.getAllParts(anatomyA, actorAId);
    const initialPartsB = bodyGraphService.getAllParts(anatomyB, actorBId);

    // Assert initial state is valid
    expect(initialPartsA.length).toBeGreaterThan(1);
    expect(initialPartsB.length).toBeGreaterThan(1);

    // Act: Concurrently invalidate A, rebuild A, and read B
    await Promise.all([
      (async () => {
        // Invalidate and rebuild A
        cacheManager.invalidateCacheForRoot(actorAId);
        await cacheManager.buildCache(actorAId, entityManager);
      })(),
      (async () => {
        // Read B while A is being rebuilt
        const partsB = bodyGraphService.getAllParts(anatomyB, actorBId);
        expect(partsB.length).toBeGreaterThan(1);
      })(),
    ]);

    // Assert: B's parts unchanged by A's operations
    const finalPartsB = bodyGraphService.getAllParts(anatomyB, actorBId);

    expect(finalPartsB).toEqual(initialPartsB);
    expect(finalPartsB.length).toBe(initialPartsB.length);

    // Verify no shared parts after rebuild
    const finalPartsA = bodyGraphService.getAllParts(anatomyA, actorAId);
    const overlap = finalPartsA.filter((id) => finalPartsB.includes(id));

    expect(overlap).toEqual([]);
  });

  it('should handle multiple concurrent invalidations without interference', async () => {
    // Arrange: Create 4 actors
    const recipes = [
      'anatomy:human_male',
      'anatomy:human_female',
      'anatomy:human_male',
      'anatomy:human_female',
    ];

    // Generate all actors
    const actorIds = await Promise.all(
      recipes.map((recipe) => testBed.createCharacterFromRecipe(recipe))
    );

    // Get initial part sets
    const initialPartSets = actorIds.map((actorId) => {
      const entity = entityManager.getEntityInstance(actorId);
      const anatomy = entity.getComponentData('anatomy:body');
      return {
        actorId,
        parts: bodyGraphService.getAllParts(anatomy, actorId),
      };
    });

    // Act: Concurrently invalidate/rebuild actors 0 and 1, read actors 2 and 3
    await Promise.all([
      (async () => {
        cacheManager.invalidateCacheForRoot(actorIds[0]);
        await cacheManager.buildCache(actorIds[0], entityManager);
      })(),
      (async () => {
        cacheManager.invalidateCacheForRoot(actorIds[1]);
        await cacheManager.buildCache(actorIds[1], entityManager);
      })(),
      (async () => {
        const entity2 = entityManager.getEntityInstance(actorIds[2]);
        const anatomy2 = entity2.getComponentData('anatomy:body');
        bodyGraphService.getAllParts(anatomy2, actorIds[2]);
      })(),
      (async () => {
        const entity3 = entityManager.getEntityInstance(actorIds[3]);
        const anatomy3 = entity3.getComponentData('anatomy:body');
        bodyGraphService.getAllParts(anatomy3, actorIds[3]);
      })(),
    ]);

    // Assert: Actors 2 and 3 unchanged
    const finalPartSet2 = initialPartSets.find(
      (s) => s.actorId === actorIds[2]
    );
    const finalPartSet3 = initialPartSets.find(
      (s) => s.actorId === actorIds[3]
    );

    const entity2 = entityManager.getEntityInstance(actorIds[2]);
    const entity3 = entityManager.getEntityInstance(actorIds[3]);
    const anatomy2 = entity2.getComponentData('anatomy:body');
    const anatomy3 = entity3.getComponentData('anatomy:body');

    const currentParts2 = bodyGraphService.getAllParts(anatomy2, actorIds[2]);
    const currentParts3 = bodyGraphService.getAllParts(anatomy3, actorIds[3]);

    expect(currentParts2).toEqual(finalPartSet2.parts);
    expect(currentParts3).toEqual(finalPartSet3.parts);

    // Assert: All 4 actors still have unique parts
    const allPartSets = actorIds.map((actorId) => {
      const entity = entityManager.getEntityInstance(actorId);
      const anatomy = entity.getComponentData('anatomy:body');
      return bodyGraphService.getAllParts(anatomy, actorId);
    });

    for (let i = 0; i < allPartSets.length; i++) {
      for (let j = i + 1; j < allPartSets.length; j++) {
        const overlap = allPartSets[i].filter((id) =>
          allPartSets[j].includes(id)
        );
        expect(overlap).toEqual([]);
      }
    }
  });
});
