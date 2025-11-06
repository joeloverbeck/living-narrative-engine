/**
 * @file Test to verify anatomy:part component doesn't include parentEntity property
 * @see https://github.com/joeloverbeck/living-narrative-engine/issues/XXXX
 *
 * This test reproduces the bug where anatomy graph generation was failing because
 * entityGraphBuilder.js was adding a 'parentEntity' property to the anatomy:part
 * component, which is not allowed by the schema (additionalProperties: false).
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';

describe('Anatomy Part Component - ParentEntity Validation', () => {
  let testBed;

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should generate full anatomy graph without parentEntity in anatomy:part components', async () => {
    // Create an actor with anatomy
    const recipeId = 'anatomy:human_female';
    const actor = await testBed.createActor({ recipeId });

    // Generate anatomy for the actor
    const anatomyService = testBed.container.get('AnatomyGenerationService');
    await anatomyService.generateAnatomy(actor.id);

    // Get the anatomy data
    const entityManager = testBed.container.get('IEntityManager');
    const actorInstance = entityManager.getEntityInstance(actor.id);
    const anatomyData = actorInstance.getComponentData('anatomy:body');

    expect(anatomyData).toBeDefined();
    expect(anatomyData.body).toBeDefined();
    expect(anatomyData.body.parts).toBeDefined();

    const parts = anatomyData.body.parts;

    // Check some key body parts exist
    expect(parts['left arm']).toBeDefined();
    expect(parts['right arm']).toBeDefined();
    expect(parts['left hand']).toBeDefined();
    expect(parts['right hand']).toBeDefined();

    // Verify that anatomy:part components don't have parentEntity
    const leftArmEntity = entityManager.getEntityInstance(parts['left arm']);
    const leftArmPart = leftArmEntity.getComponentData('anatomy:part');

    expect(leftArmPart).toBeDefined();
    expect(leftArmPart).not.toHaveProperty('parentEntity');
    expect(leftArmPart.subType).toBe('arm');
    expect(leftArmPart.orientation).toBe('left');

    // Verify parent relationship is in anatomy:joint instead
    const leftArmJoint = leftArmEntity.getComponentData('anatomy:joint');
    expect(leftArmJoint).toBeDefined();
    expect(leftArmJoint.parentId).toBeDefined();
    expect(leftArmJoint.socketId).toBe('left_shoulder');

    // Check another part (hand)
    const leftHandEntity = entityManager.getEntityInstance(parts['left hand']);
    const leftHandPart = leftHandEntity.getComponentData('anatomy:part');

    expect(leftHandPart).toBeDefined();
    expect(leftHandPart).not.toHaveProperty('parentEntity');
    expect(leftHandPart.subType).toBe('hand');
    expect(leftHandPart.orientation).toBe('left');
  });
});
