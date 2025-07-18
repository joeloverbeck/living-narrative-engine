/**
 * @file Integration test for anatomy orientation propagation from parent sockets to child parts
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';

describe('Anatomy Orientation Propagation Integration Tests', () => {
  let testBed;

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Socket Orientation Propagation', () => {
    it('should propagate orientation from parent socket to child anatomy:part component', async () => {
      // Arrange
      const recipeId = 'p_erotica:amaia_castillo_recipe';
      const actor = await testBed.createActor({ recipeId });

      // Generate anatomy for the actor
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      // Act
      const entityManager = testBed.container.get('IEntityManager');
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');
      const parts = anatomyData.body.parts;

      // Get the torso entity to check its socket orientations
      const torsoEntity = entityManager.getEntityInstance(
        anatomyData.body.root
      );
      const torsoSockets = torsoEntity.getComponentData('anatomy:sockets');

      // Assert - verify socket orientations match child orientations
      const leftArmSocket = torsoSockets.sockets.find(
        (s) => s.id === 'left_shoulder'
      );
      const rightArmSocket = torsoSockets.sockets.find(
        (s) => s.id === 'right_shoulder'
      );
      const leftLegSocket = torsoSockets.sockets.find(
        (s) => s.id === 'left_hip'
      );
      const rightLegSocket = torsoSockets.sockets.find(
        (s) => s.id === 'right_hip'
      );

      // Verify socket orientations are set correctly
      expect(leftArmSocket.orientation).toBe('left');
      expect(rightArmSocket.orientation).toBe('right');
      expect(leftLegSocket.orientation).toBe('left');
      expect(rightLegSocket.orientation).toBe('right');

      // Verify that child parts received the correct orientation
      const leftArmEntity = entityManager.getEntityInstance(parts['left arm']);
      const rightArmEntity = entityManager.getEntityInstance(
        parts['right arm']
      );
      const leftLegEntity = entityManager.getEntityInstance(parts['left leg']);
      const rightLegEntity = entityManager.getEntityInstance(
        parts['right leg']
      );

      const leftArmPart = leftArmEntity.getComponentData('anatomy:part');
      const rightArmPart = rightArmEntity.getComponentData('anatomy:part');
      const leftLegPart = leftLegEntity.getComponentData('anatomy:part');
      const rightLegPart = rightLegEntity.getComponentData('anatomy:part');

      expect(leftArmPart.orientation).toBe('left');
      expect(rightArmPart.orientation).toBe('right');
      expect(leftLegPart.orientation).toBe('left');
      expect(rightLegPart.orientation).toBe('right');
    });

    it('should propagate orientation down the hierarchy (arm → hand)', async () => {
      // Arrange
      const recipeId = 'p_erotica:amaia_castillo_recipe';
      const actor = await testBed.createActor({ recipeId });

      // Generate anatomy for the actor
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      // Act
      const entityManager = testBed.container.get('IEntityManager');
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');
      const parts = anatomyData.body.parts;

      // Get arm entities and their sockets
      const leftArmEntity = entityManager.getEntityInstance(parts['left arm']);
      const rightArmEntity = entityManager.getEntityInstance(
        parts['right arm']
      );

      const leftArmSockets = leftArmEntity.getComponentData('anatomy:sockets');
      const rightArmSockets =
        rightArmEntity.getComponentData('anatomy:sockets');

      // Assert - verify that arm sockets don't have explicit orientation
      // but their children get orientation from the parent arm's orientation
      const leftWristSocket = leftArmSockets.sockets.find(
        (s) => s.id === 'wrist'
      );
      const rightWristSocket = rightArmSockets.sockets.find(
        (s) => s.id === 'wrist'
      );

      // Wrist sockets typically don't have explicit orientation in their definition
      expect(leftWristSocket.orientation).toBeUndefined();
      expect(rightWristSocket.orientation).toBeUndefined();

      // But the hands should get orientation from their parent arms
      const leftHandEntity = entityManager.getEntityInstance(
        parts['left hand']
      );
      const rightHandEntity = entityManager.getEntityInstance(
        parts['right hand']
      );

      const leftHandPart = leftHandEntity.getComponentData('anatomy:part');
      const rightHandPart = rightHandEntity.getComponentData('anatomy:part');

      // The hands should inherit the orientation from their parent arms
      expect(leftHandPart.orientation).toBe('left');
      expect(rightHandPart.orientation).toBe('right');
    });

    it('should propagate orientation down the hierarchy (leg → foot)', async () => {
      // Arrange
      const recipeId = 'p_erotica:amaia_castillo_recipe';
      const actor = await testBed.createActor({ recipeId });

      // Generate anatomy for the actor
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      // Act
      const entityManager = testBed.container.get('IEntityManager');
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');
      const parts = anatomyData.body.parts;

      // Get leg entities and their sockets
      const leftLegEntity = entityManager.getEntityInstance(parts['left leg']);
      const rightLegEntity = entityManager.getEntityInstance(
        parts['right leg']
      );

      const leftLegSockets = leftLegEntity.getComponentData('anatomy:sockets');
      const rightLegSockets =
        rightLegEntity.getComponentData('anatomy:sockets');

      // Assert - verify that leg sockets don't have explicit orientation
      // but their children get orientation from the parent leg's orientation
      const leftAnkleSocket = leftLegSockets.sockets.find(
        (s) => s.id === 'ankle'
      );
      const rightAnkleSocket = rightLegSockets.sockets.find(
        (s) => s.id === 'ankle'
      );

      // Ankle sockets typically don't have explicit orientation in their definition
      expect(leftAnkleSocket.orientation).toBeUndefined();
      expect(rightAnkleSocket.orientation).toBeUndefined();

      // But the feet should get orientation from their parent legs
      const leftFootEntity = entityManager.getEntityInstance(
        parts['left foot']
      );
      const rightFootEntity = entityManager.getEntityInstance(
        parts['right foot']
      );

      const leftFootPart = leftFootEntity.getComponentData('anatomy:part');
      const rightFootPart = rightFootEntity.getComponentData('anatomy:part');

      // The feet should inherit the orientation from their parent legs
      expect(leftFootPart.orientation).toBe('left');
      expect(rightFootPart.orientation).toBe('right');
    });

    it('should handle parts without explicit orientation (single parts)', async () => {
      // Arrange
      const recipeId = 'p_erotica:amaia_castillo_recipe';
      const actor = await testBed.createActor({ recipeId });

      // Generate anatomy for the actor
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      // Act
      const entityManager = testBed.container.get('IEntityManager');
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');
      const parts = anatomyData.body.parts;

      // Get single parts that don't have orientation
      const singleParts = ['nose', 'mouth', 'teeth', 'hair'];

      // Assert - verify that single parts don't have orientation
      for (const partName of singleParts) {
        const partEntity = entityManager.getEntityInstance(parts[partName]);
        const partComponent = partEntity.getComponentData('anatomy:part');

        // Single parts should not have orientation
        expect(partComponent.orientation).toBeUndefined();
      }
    });
  });

  describe('Effective Orientation Resolution', () => {
    it('should resolve effective_orientation template correctly', async () => {
      // Arrange
      const recipeId = 'p_erotica:amaia_castillo_recipe';
      const actor = await testBed.createActor({ recipeId });

      // Generate anatomy for the actor
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      // Act
      const entityManager = testBed.container.get('IEntityManager');
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');
      const parts = anatomyData.body.parts;

      // Get the SocketManager to test template resolution
      const socketManager = testBed.container.get('SocketManager');

      // Get arm entities and their sockets
      const leftArmEntity = entityManager.getEntityInstance(parts['left arm']);
      const rightArmEntity = entityManager.getEntityInstance(
        parts['right arm']
      );

      const leftArmSockets = leftArmEntity.getComponentData('anatomy:sockets');
      const rightArmSockets =
        rightArmEntity.getComponentData('anatomy:sockets');

      const leftWristSocket = leftArmSockets.sockets.find(
        (s) => s.id === 'wrist'
      );
      const rightWristSocket = rightArmSockets.sockets.find(
        (s) => s.id === 'wrist'
      );

      // Assert - verify that effective_orientation template resolution works
      // When a child entity has orientation, it should be used in the template
      const leftHandEntity = entityManager.getEntityInstance(
        parts['left hand']
      );
      const rightHandEntity = entityManager.getEntityInstance(
        parts['right hand']
      );

      const leftHandName = socketManager.generatePartName(
        leftWristSocket,
        leftHandEntity.id,
        leftArmEntity.id
      );
      const rightHandName = socketManager.generatePartName(
        rightWristSocket,
        rightHandEntity.id,
        rightArmEntity.id
      );

      // The effective_orientation template should resolve to the propagated orientation
      expect(leftHandName).toBe('left hand');
      expect(rightHandName).toBe('right hand');
    });

    it('should handle template resolution when socket has no orientation', async () => {
      // Arrange
      const recipeId = 'p_erotica:amaia_castillo_recipe';
      const actor = await testBed.createActor({ recipeId });

      // Generate anatomy for the actor
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      // Act
      const entityManager = testBed.container.get('IEntityManager');
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');
      const parts = anatomyData.body.parts;

      // Get the SocketManager to test template resolution
      const socketManager = testBed.container.get('SocketManager');

      // Get head entity and its sockets (which don't have orientation)
      const headEntity = entityManager.getEntityInstance(parts['head']);
      const headSockets = headEntity.getComponentData('anatomy:sockets');

      // Assert - verify that template resolution works for non-oriented sockets
      const noseSocket = headSockets.sockets.find((s) => s.id === 'nose');
      const mouthSocket = headSockets.sockets.find((s) => s.id === 'mouth');

      expect(noseSocket.orientation).toBeUndefined();
      expect(mouthSocket.orientation).toBeUndefined();

      // When socket has no orientation, template should resolve to just the type
      const noseEntity = entityManager.getEntityInstance(parts['nose']);
      const mouthEntity = entityManager.getEntityInstance(parts['mouth']);

      const noseName = socketManager.generatePartName(
        noseSocket,
        noseEntity.id,
        headEntity.id
      );
      const mouthName = socketManager.generatePartName(
        mouthSocket,
        mouthEntity.id,
        headEntity.id
      );

      expect(noseName).toBe('nose');
      expect(mouthName).toBe('mouth');
    });
  });

  describe('Orientation Inheritance Chain', () => {
    it('should verify the complete orientation inheritance chain', async () => {
      // Arrange
      const recipeId = 'p_erotica:amaia_castillo_recipe';
      const actor = await testBed.createActor({ recipeId });

      // Generate anatomy for the actor
      const anatomyService = testBed.container.get('AnatomyGenerationService');
      await anatomyService.generateAnatomy(actor.id);

      // Act
      const entityManager = testBed.container.get('IEntityManager');
      const actorInstance = entityManager.getEntityInstance(actor.id);
      const anatomyData = actorInstance.getComponentData('anatomy:body');
      const parts = anatomyData.body.parts;

      // Trace the orientation inheritance chain for left side
      const torsoEntity = entityManager.getEntityInstance(
        anatomyData.body.root
      );
      const leftArmEntity = entityManager.getEntityInstance(parts['left arm']);
      const leftHandEntity = entityManager.getEntityInstance(
        parts['left hand']
      );
      const leftLegEntity = entityManager.getEntityInstance(parts['left leg']);
      const leftFootEntity = entityManager.getEntityInstance(
        parts['left foot']
      );

      // Get joint components to verify the hierarchy
      const leftArmJoint = leftArmEntity.getComponentData('anatomy:joint');
      const leftHandJoint = leftHandEntity.getComponentData('anatomy:joint');
      const leftLegJoint = leftLegEntity.getComponentData('anatomy:joint');
      const leftFootJoint = leftFootEntity.getComponentData('anatomy:joint');

      // Assert - verify the complete chain
      // 1. Torso → Left Arm
      expect(leftArmJoint.parentId).toBe(torsoEntity.id);
      expect(leftArmJoint.socketId).toBe('left_shoulder');

      // 2. Left Arm → Left Hand
      expect(leftHandJoint.parentId).toBe(leftArmEntity.id);
      expect(leftHandJoint.socketId).toBe('wrist');

      // 3. Torso → Left Leg
      expect(leftLegJoint.parentId).toBe(torsoEntity.id);
      expect(leftLegJoint.socketId).toBe('left_hip');

      // 4. Left Leg → Left Foot
      expect(leftFootJoint.parentId).toBe(leftLegEntity.id);
      expect(leftFootJoint.socketId).toBe('ankle');

      // Verify orientation propagation through the chain
      const leftArmPart = leftArmEntity.getComponentData('anatomy:part');
      const leftHandPart = leftHandEntity.getComponentData('anatomy:part');
      const leftLegPart = leftLegEntity.getComponentData('anatomy:part');
      const leftFootPart = leftFootEntity.getComponentData('anatomy:part');

      expect(leftArmPart.orientation).toBe('left');
      expect(leftHandPart.orientation).toBe('left');
      expect(leftLegPart.orientation).toBe('left');
      expect(leftFootPart.orientation).toBe('left');
    });
  });
});
