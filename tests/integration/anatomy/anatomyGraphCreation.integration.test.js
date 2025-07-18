/**
 * @file Integration test for anatomy graph creation, specifically testing proper hand and foot naming
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';

describe('Anatomy Graph Creation Integration Tests', () => {
  let testBed;

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Hand and Foot Creation', () => {
    it('should create both left and right hands with correct names', async () => {
      // Arrange
      const recipeId = 'anatomy:human_female';
      const actor = await testBed.createActor({ recipeId });

      // Generate anatomy for the actor
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      // Act
      const entityManager = testBed.container.get('IEntityManager');
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');

      // Assert
      expect(anatomyData).toBeDefined();
      expect(anatomyData.body).toBeDefined();
      expect(anatomyData.body.parts).toBeDefined();

      const parts = anatomyData.body.parts;

      // Check that both hands exist with proper names
      expect(parts['left hand']).toBeDefined();
      expect(parts['right hand']).toBeDefined();

      // Verify they are different entities
      expect(parts['left hand']).not.toBe(parts['right hand']);

      // Check that both feet exist with proper names
      expect(parts['left foot']).toBeDefined();
      expect(parts['right foot']).toBeDefined();

      // Verify they are different entities
      expect(parts['left foot']).not.toBe(parts['right foot']);
    });

    it('should correctly parent hands to their respective arms', async () => {
      // Arrange
      const recipeId = 'anatomy:human_female';
      const actor = await testBed.createActor({ recipeId });

      // Generate anatomy for the actor
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      // Act
      const entityManager = testBed.container.get('IEntityManager');
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');
      const parts = anatomyData.body.parts;

      // Get hand entities
      const leftHandEntity = entityManager.getEntityInstance(
        parts['left hand']
      );
      const rightHandEntity = entityManager.getEntityInstance(
        parts['right hand']
      );

      // Assert
      expect(leftHandEntity).toBeDefined();
      expect(rightHandEntity).toBeDefined();

      // Check joint components to verify parent relationships
      const leftHandJoint = leftHandEntity.getComponentData('anatomy:joint');
      const rightHandJoint = rightHandEntity.getComponentData('anatomy:joint');

      expect(leftHandJoint).toBeDefined();
      expect(rightHandJoint).toBeDefined();

      // Verify that hands are connected to their respective arms
      const leftArmId = parts['left arm'];
      const rightArmId = parts['right arm'];

      expect(leftHandJoint.parentId).toBe(leftArmId);
      expect(rightHandJoint.parentId).toBe(rightArmId);
      expect(leftHandJoint.socketId).toBe('wrist');
      expect(rightHandJoint.socketId).toBe('wrist');
    });

    it('should correctly parent feet to their respective legs', async () => {
      // Arrange
      const recipeId = 'anatomy:human_female';
      const actor = await testBed.createActor({ recipeId });

      // Generate anatomy for the actor
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      // Act
      const entityManager = testBed.container.get('IEntityManager');
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');
      const parts = anatomyData.body.parts;

      // Get foot entities
      const leftFootEntity = entityManager.getEntityInstance(
        parts['left foot']
      );
      const rightFootEntity = entityManager.getEntityInstance(
        parts['right foot']
      );

      // Assert
      expect(leftFootEntity).toBeDefined();
      expect(rightFootEntity).toBeDefined();

      // Check joint components to verify parent relationships
      const leftFootJoint = leftFootEntity.getComponentData('anatomy:joint');
      const rightFootJoint = rightFootEntity.getComponentData('anatomy:joint');

      expect(leftFootJoint).toBeDefined();
      expect(rightFootJoint).toBeDefined();

      // Verify that feet are connected to their respective legs
      const leftLegId = parts['left leg'];
      const rightLegId = parts['right leg'];

      expect(leftFootJoint.parentId).toBe(leftLegId);
      expect(rightFootJoint.parentId).toBe(rightLegId);
      expect(leftFootJoint.socketId).toBe('ankle');
      expect(rightFootJoint.socketId).toBe('ankle');
    });

    it('should ensure hands and feet have proper orientation in anatomy:part component', async () => {
      // Arrange
      const recipeId = 'anatomy:human_female';
      const actor = await testBed.createActor({ recipeId });

      // Generate anatomy for the actor
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      // Act
      const entityManager = testBed.container.get('IEntityManager');
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');
      const parts = anatomyData.body.parts;

      // Get hand entities
      const leftHandEntity = entityManager.getEntityInstance(
        parts['left hand']
      );
      const rightHandEntity = entityManager.getEntityInstance(
        parts['right hand']
      );
      const leftFootEntity = entityManager.getEntityInstance(
        parts['left foot']
      );
      const rightFootEntity = entityManager.getEntityInstance(
        parts['right foot']
      );

      // Assert
      const leftHandPart = leftHandEntity.getComponentData('anatomy:part');
      const rightHandPart = rightHandEntity.getComponentData('anatomy:part');
      const leftFootPart = leftFootEntity.getComponentData('anatomy:part');
      const rightFootPart = rightFootEntity.getComponentData('anatomy:part');

      // Verify orientation is properly set
      expect(leftHandPart.orientation).toBe('left');
      expect(rightHandPart.orientation).toBe('right');
      expect(leftFootPart.orientation).toBe('left');
      expect(rightFootPart.orientation).toBe('right');

      // Verify subType is correct
      expect(leftHandPart.subType).toBe('hand');
      expect(rightHandPart.subType).toBe('hand');
      expect(leftFootPart.subType).toBe('foot');
      expect(rightFootPart.subType).toBe('foot');
    });

    it('should create complete anatomy graph with all expected parts', async () => {
      // Arrange
      const recipeId = 'anatomy:human_female';
      const actor = await testBed.createActor({ recipeId });

      // Generate anatomy for the actor
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      // Act
      const entityManager = testBed.container.get('IEntityManager');
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');
      const parts = anatomyData.body.parts;

      // Assert - verify we have all expected parts
      const expectedParts = [
        'left arm',
        'right arm',
        'left leg',
        'right leg',
        'left hand',
        'right hand',
        'left foot',
        'right foot',
        'left eye',
        'right eye',
        'left ear',
        'right ear',
        'nose',
        'mouth',
        'teeth',
        'hair',
      ];

      for (const partName of expectedParts) {
        expect(parts[partName]).toBeDefined();
        expect(typeof parts[partName]).toBe('string');

        // Verify the entity exists
        const partEntity = entityManager.getEntityInstance(parts[partName]);
        expect(partEntity).toBeDefined();
        expect(partEntity.hasComponent('anatomy:part')).toBe(true);
      }

      // Verify we have at least the expected number of parts
      expect(Object.keys(parts).length).toBeGreaterThanOrEqual(
        expectedParts.length
      );
    });
  });

  describe('Regression Tests', () => {
    it('should not create duplicate parts with generic names', async () => {
      // Arrange
      const recipeId = 'anatomy:human_female';
      const actor = await testBed.createActor({ recipeId });

      // Generate anatomy for the actor
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      // Act
      const entityManager = testBed.container.get('IEntityManager');
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');
      const parts = anatomyData.body.parts;

      // Assert - verify we don't have generic names that would cause conflicts
      expect(parts['hand']).toBeUndefined();
      expect(parts['foot']).toBeUndefined();

      // Verify we have the correctly named parts instead
      expect(parts['left hand']).toBeDefined();
      expect(parts['right hand']).toBeDefined();
      expect(parts['left foot']).toBeDefined();
      expect(parts['right foot']).toBeDefined();
    });

    it('should handle multiple anatomy generation calls idempotently', async () => {
      // Arrange
      const recipeId = 'anatomy:human_female';
      const actor = await testBed.createActor({ recipeId });
      const anatomyService = testBed.container.get('AnatomyGenerationService');

      // Generate anatomy twice
      await anatomyService.generateAnatomy(actor.id);
      await anatomyService.generateAnatomy(actor.id);

      // Act
      const entityManager = testBed.container.get('IEntityManager');
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');
      const parts = anatomyData.body.parts;

      // Assert - should still have all parts correctly named
      expect(parts['left hand']).toBeDefined();
      expect(parts['right hand']).toBeDefined();
      expect(parts['left foot']).toBeDefined();
      expect(parts['right foot']).toBeDefined();

      // Verify all parts still exist as entities
      expect(entityManager.getEntityInstance(parts['left hand'])).toBeDefined();
      expect(
        entityManager.getEntityInstance(parts['right hand'])
      ).toBeDefined();
      expect(entityManager.getEntityInstance(parts['left foot'])).toBeDefined();
      expect(
        entityManager.getEntityInstance(parts['right foot'])
      ).toBeDefined();
    });
  });
});
