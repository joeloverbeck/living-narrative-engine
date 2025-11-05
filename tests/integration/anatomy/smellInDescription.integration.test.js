/**
 * @file Integration test for smell descriptor in body descriptions
 * @description Validates that smell descriptor from anatomy recipe appears correctly in composed descriptions
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestBedAnatomy } from '../../common/testbed.anatomy.js';

describe('Smell in Body Description - Integration', () => {
  let testBed;
  let entityManager;
  let bodyDescriptionComposer;

  beforeEach(async () => {
    testBed = new TestBedAnatomy();
    await testBed.setup();
    entityManager = testBed.entityManager;
    bodyDescriptionComposer = testBed.bodyDescriptionComposer;
  });

  afterEach(async () => {
    if (testBed && typeof testBed.cleanup === 'function') {
      await testBed.cleanup();
    }
  });

  it('should include smell descriptor in body description', async () => {
    // Create a body entity with smell descriptor
    const actor = await entityManager.createEntityInstance('core:actor', {
      skipValidation: false,
      generateId: true,
    });
    const actorId = actor.id;

    await entityManager.addComponent(actorId, 'anatomy:body', {
      recipeId: 'test:recipe',
      body: {
        root: 'root-id',
        descriptors: {
          height: 'tall',
          smell: 'musky',
          build: 'athletic',
        },
        parts: {},
      },
    });

    // Get the entity instance
    const entity = entityManager.getEntityInstance(actorId);

    // Compose the description
    const description = await bodyDescriptionComposer.composeDescription(
      entity
    );

    // Verify smell appears in description
    expect(description).toContain('Smell: musky');
    expect(description).toContain('Height: tall');
    expect(description).toContain('Build: athletic');
  });

  it('should handle multiple complex smell values', async () => {
    const testCases = [
      'sweaty and musky',
      'pungent manly perfume',
      'rotten meat and feces',
      'fresh mountain air',
    ];

    for (const smellValue of testCases) {
      const actor = await entityManager.createEntityInstance('core:actor', {
        skipValidation: false,
        generateId: true,
      });
      const actorId = actor.id;

      await entityManager.addComponent(actorId, 'anatomy:body', {
        recipeId: 'test:recipe',
        body: {
          root: 'root-id',
          descriptors: {
            smell: smellValue,
          },
          parts: {},
        },
      });

      const entity = entityManager.getEntityInstance(actorId);
      const description = await bodyDescriptionComposer.composeDescription(
        entity
      );

      expect(description).toContain(`Smell: ${smellValue}`);
    }
  });

  it('should work when smell is not provided', async () => {
    const actor = await entityManager.createEntityInstance('core:actor', {
      skipValidation: false,
      generateId: true,
    });
    const actorId = actor.id;

    await entityManager.addComponent(actorId, 'anatomy:body', {
      recipeId: 'test:recipe',
      body: {
        root: 'root-id',
        descriptors: {
          build: 'slim',
          composition: 'average',
        },
        parts: {},
      },
    });

    const entity = entityManager.getEntityInstance(actorId);
    const description = await bodyDescriptionComposer.composeDescription(
      entity
    );

    expect(description).not.toContain('Smell:');
    expect(description).toContain('Build: slim');
    expect(description).toContain('Body composition: average');
  });
});
