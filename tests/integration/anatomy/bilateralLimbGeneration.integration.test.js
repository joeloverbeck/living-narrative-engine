/**
 * @file Integration test for bilateral limb generation in anatomy system
 * Tests that bilateral limbs (hands, feet) are created symmetrically for both left and right sides
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';

describe('Bilateral Limb Generation', () => {
  let testBed;

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Tortoise Blueprint Bilateral Symmetry', () => {
    it('should create both left and right hands for tortoise anatomy', async () => {
      // Arrange: Create actor with tortoise recipe
      const recipeId = 'anatomy-creatures:tortoise_person';
      const actor = await testBed.createActor({ recipeId });

      // Act: Generate anatomy
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      // Assert: Get anatomy body component
      const entityManager = testBed.container.get('IEntityManager');
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');
      expect(anatomyData).toBeDefined();
      expect(anatomyData.body).toBeDefined();
      expect(anatomyData.body.parts).toBeDefined();

      const parts = anatomyData.body.parts;

      // DEBUG: Log what parts were actually created
      console.log('[TEST DEBUG] Parts created:', Object.keys(parts));
      console.log(
        '[TEST DEBUG] Full parts object:',
        JSON.stringify(parts, null, 2)
      );

      // Critical assertion: Both hands should exist with proper names
      // THIS SHOULD FAIL INITIALLY - demonstrating the bilateral limb bug
      expect(parts['left hand']).toBeDefined();
      expect(parts['right hand']).toBeDefined();

      // Verify they are different entities
      expect(parts['left hand']).not.toBe(parts['right hand']);

      // Verify hand entities exist
      expect(entityManager.hasEntity(parts['left hand'])).toBe(true);
      expect(entityManager.hasEntity(parts['right hand'])).toBe(true);
    });

    it('should create both left and right feet for tortoise anatomy', async () => {
      // Arrange: Create actor with tortoise recipe
      const recipeId = 'anatomy-creatures:tortoise_person';
      const actor = await testBed.createActor({ recipeId });

      // Act: Generate anatomy
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      // Assert: Get anatomy body component
      const entityManager = testBed.container.get('IEntityManager');
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');
      expect(anatomyData).toBeDefined();
      expect(anatomyData.body).toBeDefined();
      expect(anatomyData.body.parts).toBeDefined();

      const parts = anatomyData.body.parts;

      // Critical assertion: Both feet should exist with proper names
      // THIS SHOULD FAIL INITIALLY - demonstrating the bilateral limb bug
      expect(parts['left foot']).toBeDefined();
      expect(parts['right foot']).toBeDefined();

      // Verify they are different entities
      expect(parts['left foot']).not.toBe(parts['right foot']);

      // Verify foot entities exist
      expect(entityManager.hasEntity(parts['left foot'])).toBe(true);
      expect(entityManager.hasEntity(parts['right foot'])).toBe(true);
    });

    it('should create all four extremities (2 hands, 2 feet) symmetrically', async () => {
      // Arrange: Create actor with tortoise recipe
      const recipeId = 'anatomy-creatures:tortoise_person';
      const actor = await testBed.createActor({ recipeId });

      // Act: Generate anatomy
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      // Assert: Get all anatomy parts
      const entityManager = testBed.container.get('IEntityManager');
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');
      const parts = anatomyData.body.parts;

      // Critical assertion: All four extremities should exist
      // THIS SHOULD FAIL INITIALLY - demonstrating the bilateral limb bug
      expect(parts['left hand']).toBeDefined();
      expect(parts['right hand']).toBeDefined();
      expect(parts['left foot']).toBeDefined();
      expect(parts['right foot']).toBeDefined();

      // Verify all extremities are different entities
      const extremities = [
        parts['left hand'],
        parts['right hand'],
        parts['left foot'],
        parts['right foot'],
      ];
      const uniqueExtremities = new Set(extremities);
      expect(uniqueExtremities.size).toBe(4);
    });
  });

  describe('Blueprint Slot Processing', () => {
    it('should process all bilateral slots defined in blueprint', async () => {
      // Arrange: Create actor with tortoise recipe
      const recipeId = 'anatomy-creatures:tortoise_person';
      const actor = await testBed.createActor({ recipeId });

      // Act: Generate anatomy
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      // Assert: Get anatomy body parts
      const entityManager = testBed.container.get('IEntityManager');
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');
      const parts = anatomyData.body.parts;

      // The tortoise_person blueprint defines these bilateral body parts
      const expectedBilateralParts = [
        'left arm',
        'right arm',
        'left leg',
        'right leg',
        'left hand',
        'right hand',
        'left foot',
        'right foot',
      ];

      // THIS SHOULD FAIL FOR HANDS/FEET - demonstrating the bilateral limb bug
      expectedBilateralParts.forEach((partName) => {
        expect(parts[partName]).toBeDefined();
      });
    });

    it('should not misclassify anatomy sockets as equipment slots', async () => {
      // Arrange: Create actor with tortoise recipe
      const recipeId = 'anatomy-creatures:tortoise_person';
      const actor = await testBed.createActor({ recipeId });

      // Act: Generate anatomy
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      // Assert: Get anatomy body parts
      const entityManager = testBed.container.get('IEntityManager');
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');
      const parts = anatomyData.body.parts;

      // Hand and foot parts should exist as anatomy parts
      // If these were misclassified as equipment slots, they wouldn't be created
      const handParts = Object.keys(parts).filter((name) =>
        name.includes('hand')
      );
      const footParts = Object.keys(parts).filter((name) =>
        name.includes('foot')
      );

      // THIS SHOULD FAIL - demonstrating the bilateral limb bug
      expect(handParts.length).toBeGreaterThan(0);
      expect(footParts.length).toBeGreaterThan(0);

      // Specifically for bilateral symmetry
      expect(handParts).toHaveLength(2);
      expect(footParts).toHaveLength(2);
    });
  });
});
