/**
 * @file Integration test for anatomy naming conventions and template system
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';

describe('Anatomy Naming Conventions Integration Tests', () => {
  let testBed;

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Template-Based Naming', () => {
    it('should use effective_orientation template for hands and feet', async () => {
      // Arrange
      const recipeId = 'anatomy:human_female';
      const actor = testBed.createActor({ recipeId });

      // Generate anatomy for the actor
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      // Act
      const entityManager = testBed.container.get('IEntityManager');
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');
      const parts = anatomyData.body.parts;

      // Debug: Log what's actually in the parts map
      console.error('Parts map keys:', Object.keys(parts));
      console.error('Parts map:', parts);

      // Assert - verify template-based naming works
      // Template: "{{effective_orientation}} {{type}}"
      expect(parts['left hand']).toBeDefined();
      expect(parts['right hand']).toBeDefined();
      expect(parts['left foot']).toBeDefined();
      expect(parts['right foot']).toBeDefined();

      // Verify the entities have correct names in their core:name component
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

      const leftHandName = leftHandEntity.getComponentData('core:name');
      const rightHandName = rightHandEntity.getComponentData('core:name');
      const leftFootName = leftFootEntity.getComponentData('core:name');
      const rightFootName = rightFootEntity.getComponentData('core:name');

      expect(leftHandName?.text).toBe('left hand');
      expect(rightHandName?.text).toBe('right hand');
      expect(leftFootName?.text).toBe('left foot');
      expect(rightFootName?.text).toBe('right foot');
    });

    it('should use orientation template for arms and legs', async () => {
      // Arrange
      const recipeId = 'anatomy:human_female';
      const actor = testBed.createActor({ recipeId });

      // Generate anatomy for the actor
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      // Act
      const entityManager = testBed.container.get('IEntityManager');
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');
      const parts = anatomyData.body.parts;

      // Assert - verify orientation template works for arms and legs
      // Template: "{{orientation}} {{type}}"
      expect(parts['left arm']).toBeDefined();
      expect(parts['right arm']).toBeDefined();
      expect(parts['left leg']).toBeDefined();
      expect(parts['right leg']).toBeDefined();

      // Verify the entities have correct names in their core:name component
      const leftArmEntity = entityManager.getEntityInstance(parts['left arm']);
      const rightArmEntity = entityManager.getEntityInstance(
        parts['right arm']
      );
      const leftLegEntity = entityManager.getEntityInstance(parts['left leg']);
      const rightLegEntity = entityManager.getEntityInstance(
        parts['right leg']
      );

      const leftArmName = leftArmEntity.getComponentData('core:name');
      const rightArmName = rightArmEntity.getComponentData('core:name');
      const leftLegName = leftLegEntity.getComponentData('core:name');
      const rightLegName = rightLegEntity.getComponentData('core:name');

      expect(leftArmName?.text).toBe('left arm');
      expect(rightArmName?.text).toBe('right arm');
      expect(leftLegName?.text).toBe('left leg');
      expect(rightLegName?.text).toBe('right leg');
    });

    it('should use simple type template for non-paired parts', async () => {
      // Arrange
      const recipeId = 'anatomy:human_female';
      const actor = testBed.createActor({ recipeId });

      // Generate anatomy for the actor
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      // Act
      const entityManager = testBed.container.get('IEntityManager');
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');
      const parts = anatomyData.body.parts;

      // Assert - verify simple type template works for single parts
      // Template: "{{type}}"
      const singleParts = ['nose', 'mouth', 'teeth', 'hair'];

      for (const partName of singleParts) {
        expect(parts[partName]).toBeDefined();

        const partEntity = entityManager.getEntityInstance(parts[partName]);
        const partNameComponent = partEntity.getComponentData('core:name');

        expect(partNameComponent?.text).toBe(partName);
      }
    });
  });

  describe('Naming Edge Cases', () => {
    it('should handle orientation propagation correctly', async () => {
      // Arrange
      const recipeId = 'anatomy:human_female';
      const actor = testBed.createActor({ recipeId });

      // Generate anatomy for the actor
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      // Act
      const entityManager = testBed.container.get('IEntityManager');
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');
      const parts = anatomyData.body.parts;

      // Assert - verify orientation propagation from parent to child
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

      // Check that orientation is correctly set in anatomy:part components
      const leftHandPart = leftHandEntity.getComponentData('anatomy:part');
      const rightHandPart = rightHandEntity.getComponentData('anatomy:part');
      const leftFootPart = leftFootEntity.getComponentData('anatomy:part');
      const rightFootPart = rightFootEntity.getComponentData('anatomy:part');

      // Verify that effective_orientation template uses the propagated orientation
      expect(leftHandPart.orientation).toBe('left');
      expect(rightHandPart.orientation).toBe('right');
      expect(leftFootPart.orientation).toBe('left');
      expect(rightFootPart.orientation).toBe('right');
    });

    it('should ensure unique names in parts map', async () => {
      // Arrange
      const recipeId = 'anatomy:human_female';
      const actor = testBed.createActor({ recipeId });

      // Generate anatomy for the actor
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      // Act
      const entityManager = testBed.container.get('IEntityManager');
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');
      const parts = anatomyData.body.parts;

      // Assert - verify all names are unique
      const partNames = Object.keys(parts);
      const partEntityIds = Object.values(parts);

      // Check that all names are unique
      const uniqueNames = new Set(partNames);
      expect(uniqueNames.size).toBe(partNames.length);

      // Check that all entity IDs are unique
      const uniqueEntityIds = new Set(partEntityIds);
      expect(uniqueEntityIds.size).toBe(partEntityIds.length);

      // Verify no generic names exist that would cause conflicts
      expect(partNames).not.toContain('hand');
      expect(partNames).not.toContain('foot');
      expect(partNames).not.toContain('arm');
      expect(partNames).not.toContain('leg');
    });

    it('should handle different entity definitions with same subType', async () => {
      // Arrange
      const recipeId = 'anatomy:human_female';
      const actor = testBed.createActor({ recipeId });

      // Generate anatomy for the actor
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      // Act
      const entityManager = testBed.container.get('IEntityManager');
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');
      const parts = anatomyData.body.parts;

      // Assert - verify that different entity definitions can have same subType
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

      // Both hands should have the same subType but different names
      const leftHandPart = leftHandEntity.getComponentData('anatomy:part');
      const rightHandPart = rightHandEntity.getComponentData('anatomy:part');
      const leftFootPart = leftFootEntity.getComponentData('anatomy:part');
      const rightFootPart = rightFootEntity.getComponentData('anatomy:part');

      expect(leftHandPart.subType).toBe('hand');
      expect(rightHandPart.subType).toBe('hand');
      expect(leftFootPart.subType).toBe('foot');
      expect(rightFootPart.subType).toBe('foot');

      // But they should have different names
      const leftHandName = leftHandEntity.getComponentData('core:name');
      const rightHandName = rightHandEntity.getComponentData('core:name');
      const leftFootName = leftFootEntity.getComponentData('core:name');
      const rightFootName = rightFootEntity.getComponentData('core:name');

      expect(leftHandName?.text).toBe('left hand');
      expect(rightHandName?.text).toBe('right hand');
      expect(leftFootName?.text).toBe('left foot');
      expect(rightFootName?.text).toBe('right foot');
    });
  });

  describe('Socket Name Templates', () => {
    it('should verify that socket templates are properly configured', async () => {
      // Arrange
      const recipeId = 'anatomy:human_female';
      const actor = testBed.createActor({ recipeId });

      // Generate anatomy for the actor
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      // Act
      const entityManager = testBed.container.get('IEntityManager');
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');
      const parts = anatomyData.body.parts;

      // Get arm entities to check their socket configurations
      const leftArmEntity = entityManager.getEntityInstance(parts['left arm']);
      const rightArmEntity = entityManager.getEntityInstance(
        parts['right arm']
      );
      const leftLegEntity = entityManager.getEntityInstance(parts['left leg']);
      const rightLegEntity = entityManager.getEntityInstance(
        parts['right leg']
      );

      // Assert - verify socket templates exist and are correct
      const leftArmSockets = leftArmEntity.getComponentData('anatomy:sockets');
      const rightArmSockets =
        rightArmEntity.getComponentData('anatomy:sockets');
      const leftLegSockets = leftLegEntity.getComponentData('anatomy:sockets');
      const rightLegSockets =
        rightLegEntity.getComponentData('anatomy:sockets');

      // Check that sockets have the correct name templates
      expect(leftArmSockets?.sockets?.[0]?.nameTpl).toBe(
        '{{effective_orientation}} {{type}}'
      );
      expect(rightArmSockets?.sockets?.[0]?.nameTpl).toBe(
        '{{effective_orientation}} {{type}}'
      );
      expect(leftLegSockets?.sockets?.[0]?.nameTpl).toBe(
        '{{effective_orientation}} {{type}}'
      );
      expect(rightLegSockets?.sockets?.[0]?.nameTpl).toBe(
        '{{effective_orientation}} {{type}}'
      );

      // Check socket IDs are correct
      expect(leftArmSockets?.sockets?.[0]?.id).toBe('wrist');
      expect(rightArmSockets?.sockets?.[0]?.id).toBe('wrist');
      expect(leftLegSockets?.sockets?.[0]?.id).toBe('ankle');
      expect(rightLegSockets?.sockets?.[0]?.id).toBe('ankle');
    });
  });
});
