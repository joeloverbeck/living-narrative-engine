/**
 * @file Integration test for anatomy cache unique part ownership invariant
 *
 * Tests Invariant 1: For any two distinct actors, their anatomy parts must be
 * disjoint sets (no shared part UUIDs).
 *
 * This test validates the fix for the concurrent processing bug (commit 1c07662fc)
 * that caused multiple characters to share body part instances from the first-generated
 * character.
 * @see specs/anatomy-cache-isolation.spec.md - Invariant 1 (lines 1011-1032)
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';

describe('AnatomyCacheManager - Unique Part Ownership', () => {
  let testBed;

  beforeEach(async () => {
    testBed = new AnatomyIntegrationTestBed();
    await testBed.loadAnatomyModData();

    // Load test recipes using only blueprints that are guaranteed to be loaded
    // (human_male and human_female are always loaded in loadAnatomyModData)
    testBed.loadRecipes({
      'test:character_male_1': {
        recipeId: 'test:character_male_1',
        blueprintId: 'anatomy:human_male',
        slots: {
          torso: { partType: 'torso', preferId: 'anatomy:human_male_torso' },
          head: { partType: 'head', preferId: 'anatomy:humanoid_head' },
        },
        patterns: [
          {
            matches: ['left_arm', 'right_arm'],
            partType: 'arm',
            preferId: 'anatomy:humanoid_arm',
          },
          {
            matches: ['left_leg', 'right_leg'],
            partType: 'leg',
            preferId: 'anatomy:human_leg',
          },
        ],
      },
      'test:character_female_1': {
        recipeId: 'test:character_female_1',
        blueprintId: 'anatomy:human_female',
        slots: {
          torso: { partType: 'torso', preferId: 'anatomy:human_female_torso' },
          head: { partType: 'head', preferId: 'anatomy:humanoid_head' },
        },
        patterns: [
          {
            matches: ['left_arm', 'right_arm'],
            partType: 'arm',
            preferId: 'anatomy:humanoid_arm',
          },
          {
            matches: ['left_leg', 'right_leg'],
            partType: 'leg',
            preferId: 'anatomy:human_leg_shapely',
          },
        ],
      },
      'test:character_male_2': {
        recipeId: 'test:character_male_2',
        blueprintId: 'anatomy:human_male',
        slots: {
          torso: {
            partType: 'torso',
            preferId: 'anatomy:human_male_torso_muscular',
          },
          head: { partType: 'head', preferId: 'anatomy:humanoid_head' },
        },
        patterns: [
          {
            matches: ['left_arm', 'right_arm'],
            partType: 'arm',
            preferId: 'anatomy:humanoid_arm',
          },
          {
            matches: ['left_leg', 'right_leg'],
            partType: 'leg',
            preferId: 'anatomy:human_leg',
          },
        ],
      },
      'test:character_female_2': {
        recipeId: 'test:character_female_2',
        blueprintId: 'anatomy:human_female',
        slots: {
          torso: {
            partType: 'torso',
            preferId: 'anatomy:human_female_torso_slim',
          },
          head: { partType: 'head', preferId: 'anatomy:humanoid_head' },
        },
        patterns: [
          {
            matches: ['left_arm', 'right_arm'],
            partType: 'arm',
            preferId: 'anatomy:humanoid_arm',
          },
          {
            matches: ['left_leg', 'right_leg'],
            partType: 'leg',
            preferId: 'anatomy:human_leg_shapely',
          },
        ],
      },
    });
  });

  afterEach(() => {
    if (testBed) {
      testBed.cleanup();
    }
  });

  it('should maintain unique part ownership per actor', async () => {
    // Arrange: Create 4 characters with different recipes
    const recipeIds = [
      'test:character_male_1',
      'test:character_female_1',
      'test:character_male_2',
      'test:character_female_2',
    ];

    // Act: Generate all characters
    const actorIds = await Promise.all(
      recipeIds.map((recipeId) => testBed.createCharacterFromRecipe(recipeId))
    );

    // Get parts for each character using correct method signature
    const partSets = [];
    for (const actorId of actorIds) {
      const anatomyBody = testBed.entityManager.getComponentData(
        actorId,
        'anatomy:body'
      );

      // BodyGraphService.getAllParts expects (bodyComponent, actorEntityId)
      const parts = testBed.bodyGraphService.getAllParts(anatomyBody, actorId);

      partSets.push({ actorId, parts });
    }

    // Assert: No overlapping entity IDs between any two characters
    for (let i = 0; i < partSets.length; i++) {
      for (let j = i + 1; j < partSets.length; j++) {
        const actorA = partSets[i];
        const actorB = partSets[j];

        const overlap = actorA.parts.filter((id) => actorB.parts.includes(id));

        // CRITICAL ASSERTION: No shared parts between actors
        expect(overlap).toEqual([]);

        // Diagnostic message on failure
        if (overlap.length > 0) {
          console.error(
            `FAILURE: Actors ${actorA.actorId} and ${actorB.actorId} share ${overlap.length} parts:`,
            overlap
          );
        }
      }
    }

    // Assert: Each character has expected part count
    for (const { parts } of partSets) {
      // At least actor + root entity
      expect(parts.length).toBeGreaterThan(1);

      // Verify all parts are valid entity IDs
      for (const partId of parts) {
        expect(typeof partId).toBe('string');
        expect(partId.length).toBeGreaterThan(0);
      }
    }
  });

  it('should maintain unique part ownership with concurrent generation', async () => {
    // This test specifically validates that concurrent character generation
    // (as happens during world loading) doesn't cause part sharing

    const recipeIds = [
      'test:character_male_1',
      'test:character_female_1',
      'test:character_male_2',
      'test:character_female_2',
    ];

    // Generate all characters concurrently
    const actorIds = await Promise.all(
      recipeIds.map((recipeId) => testBed.createCharacterFromRecipe(recipeId))
    );

    // Collect part sets for each actor
    const partSets = actorIds.map((actorId) => {
      const anatomyBody = testBed.entityManager.getComponentData(
        actorId,
        'anatomy:body'
      );
      const parts = testBed.bodyGraphService.getAllParts(anatomyBody, actorId);
      return { actorId, parts };
    });

    // Verify pairwise disjoint sets (Invariant 1)
    for (let i = 0; i < partSets.length; i++) {
      for (let j = i + 1; j < partSets.length; j++) {
        const actorA = partSets[i];
        const actorB = partSets[j];

        const overlapAtoB = actorA.parts.filter((id) =>
          actorB.parts.includes(id)
        );
        const overlapBtoA = actorB.parts.filter((id) =>
          actorA.parts.includes(id)
        );

        // Both directions should be empty
        expect(overlapAtoB).toEqual([]);
        expect(overlapBtoA).toEqual([]);

        if (overlapAtoB.length > 0 || overlapBtoA.length > 0) {
          console.error(
            `CONCURRENT GENERATION FAILURE:\n` +
              `  Actor A (${actorA.actorId}): ${actorA.parts.length} parts\n` +
              `  Actor B (${actorB.actorId}): ${actorB.parts.length} parts\n` +
              `  Overlap A→B: ${overlapAtoB.length} parts\n` +
              `  Overlap B→A: ${overlapBtoA.length} parts\n` +
              `  Shared parts: ${JSON.stringify([...new Set([...overlapAtoB, ...overlapBtoA])])}`
          );
        }
      }
    }

    // Verify each actor has a reasonable number of parts
    for (const { actorId, parts } of partSets) {
      expect(parts.length).toBeGreaterThan(1);

      // Log part counts for diagnostic purposes
      testBed.logger.debug(
        `Actor ${actorId} has ${parts.length} anatomy parts`
      );
    }
  });

  it('should maintain unique part ownership when generating same blueprint multiple times', async () => {
    // Test edge case: multiple actors from the same blueprint should still
    // have distinct part instances

    const recipeId = 'test:character_female_1';
    const actorCount = 3;

    // Generate 3 actors with the same recipe
    const actorIds = await Promise.all(
      Array(actorCount)
        .fill(recipeId)
        .map(() => testBed.createCharacterFromRecipe(recipeId))
    );

    // Collect part sets
    const partSets = actorIds.map((actorId) => {
      const anatomyBody = testBed.entityManager.getComponentData(
        actorId,
        'anatomy:body'
      );
      const parts = testBed.bodyGraphService.getAllParts(anatomyBody, actorId);
      return { actorId, parts };
    });

    // Verify all actors have same-sized part sets (same blueprint)
    const partCounts = partSets.map((ps) => ps.parts.length);
    const allSameCount = partCounts.every((count) => count === partCounts[0]);
    expect(allSameCount).toBe(true);

    // Verify no part sharing despite same blueprint
    for (let i = 0; i < partSets.length; i++) {
      for (let j = i + 1; j < partSets.length; j++) {
        const actorA = partSets[i];
        const actorB = partSets[j];

        const overlap = actorA.parts.filter((id) => actorB.parts.includes(id));

        expect(overlap).toEqual([]);

        if (overlap.length > 0) {
          console.error(
            `SAME BLUEPRINT FAILURE:\n` +
              `  Recipe: ${recipeId}\n` +
              `  Actor A: ${actorA.actorId}\n` +
              `  Actor B: ${actorB.actorId}\n` +
              `  Shared parts: ${overlap.length} / ${actorA.parts.length}\n` +
              `  This indicates cache is not properly isolated per actor!`
          );
        }
      }
    }
  });
});
