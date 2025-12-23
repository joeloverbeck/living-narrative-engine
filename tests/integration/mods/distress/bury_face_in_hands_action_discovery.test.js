/**
 * @file Integration tests for distress:bury_face_in_hands action discovery.
 * @description Ensures the bury face in hands action is available without prerequisites and presents the distress palette.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import buryFaceInHandsAction from '../../../../data/mods/distress/actions/bury_face_in_hands.action.json';

const ACTION_ID = 'distress:bury_face_in_hands';

describe('distress:bury_face_in_hands action discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('distress', ACTION_ID);
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action metadata validation', () => {
    it('should define the correct core metadata', () => {
      expect(buryFaceInHandsAction).toBeDefined();
      expect(buryFaceInHandsAction.id).toBe(ACTION_ID);
      expect(buryFaceInHandsAction.name).toBe('Bury Face in Hands');
      expect(buryFaceInHandsAction.description).toBe(
        'Collapse inward and hide your face behind your hands, shutting out the world as the weight of it all presses down.'
      );
      expect(buryFaceInHandsAction.template).toBe(
        'bury your face in your hands'
      );
    });

    it('should be a self-targeting action', () => {
      expect(buryFaceInHandsAction.targets).toBe('none');
      expect(buryFaceInHandsAction.required_components).toEqual({});
      expect(buryFaceInHandsAction.forbidden_components).toEqual({
        actor: [
          'biting-states:biting_neck',
          'hugging-states:hugging',
          'performances-states:doing_complex_performance',
          'physical-control-states:restraining',
        ],
      });
    });
  });

  describe('Visual styling validation', () => {
    it('should use the distress obsidian frost palette', () => {
      expect(buryFaceInHandsAction.visual).toBeDefined();
      expect(buryFaceInHandsAction.visual.backgroundColor).toBe('#0b132b');
      expect(buryFaceInHandsAction.visual.textColor).toBe('#f2f4f8');
      expect(buryFaceInHandsAction.visual.hoverBackgroundColor).toBe('#1c2541');
      expect(buryFaceInHandsAction.visual.hoverTextColor).toBe('#e0e7ff');
    });
  });

  describe('Prerequisite handling', () => {
    it('should require two free grabbing appendages', () => {
      expect(buryFaceInHandsAction.prerequisites).toBeDefined();
      expect(Array.isArray(buryFaceInHandsAction.prerequisites)).toBe(true);
      expect(buryFaceInHandsAction.prerequisites).toHaveLength(1);
      expect(buryFaceInHandsAction.prerequisites[0].logic.condition_ref).toBe(
        'anatomy:actor-has-two-free-grabbing-appendages'
      );
      expect(buryFaceInHandsAction.prerequisites[0].failure_message).toBe(
        'You need both hands free to bury your face in them.'
      );
    });
  });

  describe('Action discoverability scenarios', () => {
    it('should be executable without any special setup', async () => {
      const scenario = testFixture.createStandardActorTarget(['Ava', 'Marcus']);

      await testFixture.executeAction(scenario.actor.id, null);

      testFixture.assertActionSuccess('Ava buries their face in their hands.');
    });

    it('should be blocked when the actor is currently hugging someone', async () => {
      const scenario = testFixture.createStandardActorTarget(['Rin', 'Theo'], {
        includeRoom: false,
      });

      scenario.actor.components['hugging-states:hugging'] = {
        embraced_entity_id: scenario.target.id,
        initiated: true,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      await expect(
        testFixture.executeAction(scenario.actor.id, null)
      ).rejects.toThrow('forbidden component');

      const actorInstance = testFixture.entityManager.getEntityInstance(
        scenario.actor.id
      );
      expect(actorInstance.components['hugging-states:hugging']).toEqual({
        embraced_entity_id: scenario.target.id,
        initiated: true,
      });
    });
  });
});
