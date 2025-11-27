/**
 * @file Integration test for anatomy cache manager scalability
 * Tests performance and isolation with 10+ concurrent character generations
 *
 * This validates that the cache isolation fix (commit 1c07662fc) scales
 * beyond the 4-character baseline to production scenarios with many NPCs.
 * @see tickets/ANACACISO-004-scalability-test.md
 * @see specs/anatomy-cache-isolation.spec.md
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';

describe('AnatomyCacheManager - Scalability', () => {
  let testBed;
  let bodyGraphService;
  let entityManager;

  beforeEach(async () => {
    testBed = new AnatomyIntegrationTestBed();
    await testBed.loadAnatomyModData();
    bodyGraphService = testBed.bodyGraphService;
    entityManager = testBed.entityManager;
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should handle 10 concurrent character generations without performance degradation', async () => {
    // Arrange: Create 10 characters with varied anatomies
    // Use only recipes loaded by testBed.loadAnatomyModData()
    const recipes = [
      'anatomy:human_male',      // 4x human male
      'anatomy:human_male',
      'anatomy:human_male',
      'anatomy:human_male',
      'anatomy:human_female',    // 4x human female  
      'anatomy:human_female',
      'anatomy:human_female',
      'anatomy:human_female',
      'anatomy:tortoise_person', // 2x tortoise
      'anatomy:tortoise_person'
    ];

    // Act: Generate all concurrently using testBed API and measure time
    const startTime = performance.now();

    const actorIds = await Promise.all(
      recipes.map(recipeId => testBed.createCharacterFromRecipe(recipeId))
    );

    const duration = performance.now() - startTime;

    // Assert: Performance threshold
    expect(duration).toBeLessThan(5000); // < 5 seconds

    // Assert: All characters generated successfully
    for (const actorId of actorIds) {
      const anatomy = entityManager.getComponentData(actorId, 'anatomy:body');
      expect(anatomy).toBeDefined();
      expect(anatomy.body.root).toBeDefined();
    }

    // Assert: No part sharing between characters
    const allPartSets = [];

    for (const actorId of actorIds) {
      const anatomy = entityManager.getComponentData(actorId, 'anatomy:body');
      const parts = bodyGraphService.getAllParts(anatomy, actorId);
      allPartSets.push({ actorId, parts });
    }

    // Validate no overlap (45 comparisons for 10 actors)
    for (let i = 0; i < allPartSets.length; i++) {
      for (let j = i + 1; j < allPartSets.length; j++) {
        const overlap = allPartSets[i].parts.filter(id =>
          allPartSets[j].parts.includes(id)
        );

        expect(overlap).toEqual([]);

        if (overlap.length > 0) {
          console.error(
            `FAILURE: Actors ${allPartSets[i].actorId} and ${allPartSets[j].actorId} share parts:`,
            overlap
          );
        }
      }
    }

    // Assert: Each character has reasonable part count
    for (const { parts } of allPartSets) {
      expect(parts.length).toBeGreaterThan(1);
      expect(parts.length).toBeLessThan(100); // Sanity check
    }

    // Log performance metrics
    console.log(`10 concurrent characters generated in ${duration.toFixed(2)}ms`);
    console.log(`Average per character: ${(duration / 10).toFixed(2)}ms`);
  }, 10000); // 10 second timeout

  // NOTE: Memory stability test has been moved to:
  // tests/memory/anatomy/anatomyCacheManager.scalability.memory.test.js
  // Run with: npm run test:memory -- --testPathPattern="anatomyCacheManager.scalability"

  it('should handle sequential batches of 5 concurrent characters', async () => {
    // Arrange: 3 batches of 5 characters
    const batches = [
      Array.from({ length: 5 }, () => 'anatomy:human_male'),
      Array.from({ length: 5 }, () => 'anatomy:human_female'),
      Array.from({ length: 5 }, () => 'anatomy:tortoise_person')
    ];

    // Act: Process each batch concurrently, batches sequentially
    const allActorIds = [];
    for (const batch of batches) {
      const batchActorIds = await Promise.all(
        batch.map(recipeId => testBed.createCharacterFromRecipe(recipeId))
      );
      allActorIds.push(...batchActorIds);
    }

    // Assert: All 15 characters have unique parts
    const allPartSets = [];

    for (const actorId of allActorIds) {
      const anatomy = entityManager.getComponentData(actorId, 'anatomy:body');
      const parts = bodyGraphService.getAllParts(anatomy, actorId);
      allPartSets.push({ actorId, parts });
    }

    // Validate no overlap across all 15 characters
    for (let i = 0; i < allPartSets.length; i++) {
      for (let j = i + 1; j < allPartSets.length; j++) {
        const overlap = allPartSets[i].parts.filter(id =>
          allPartSets[j].parts.includes(id)
        );
        expect(overlap).toEqual([]);
      }
    }
  }, 20000); // 20 second timeout
});
