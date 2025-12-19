/**
 * @file Integration tests for seduction:stretch_sexily action discovery.
 * @description Ensures the stretch sexily action is available without prerequisites and advertises expected styling.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import stretchSexilyAction from '../../../../data/mods/seduction/actions/stretch_sexily.action.json';
import stretchSexilyRule from '../../../../data/mods/seduction/rules/stretch_sexily.rule.json';
import eventIsActionStretchSexily from '../../../../data/mods/seduction/conditions/event-is-action-stretch-sexily.condition.json';

const ACTION_ID = 'seduction:stretch_sexily';

describe('seduction:stretch_sexily action discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'seduction',
      ACTION_ID,
      stretchSexilyRule,
      eventIsActionStretchSexily
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action metadata validation', () => {
    it('should define the correct core metadata', () => {
      expect(stretchSexilyAction).toBeDefined();
      expect(stretchSexilyAction.id).toBe(ACTION_ID);
      expect(stretchSexilyAction.name).toBe('Stretch Sexily');
      expect(stretchSexilyAction.description).toBe(
        'Roll your shoulders back and lengthen into a languid stretch, drawing attention to your body as you claim the space around you.'
      );
      expect(stretchSexilyAction.template).toBe('stretch sexily');
    });

    it('should be a self-targeting action', () => {
      expect(stretchSexilyAction.targets).toBe('none');
      expect(stretchSexilyAction.required_components).toEqual({});
      expect(stretchSexilyAction.forbidden_components).toEqual({
        actor: [
          'hugging-states:hugging',
          'positioning:doing_complex_performance',
          'physical-control-states:being_restrained',
        ],
      });
    });
  });

  describe('Visual styling validation', () => {
    it('should reuse the seduction orange palette', () => {
      expect(stretchSexilyAction.visual).toBeDefined();
      expect(stretchSexilyAction.visual.backgroundColor).toBe('#f57f17');
      expect(stretchSexilyAction.visual.textColor).toBe('#000000');
      expect(stretchSexilyAction.visual.hoverBackgroundColor).toBe('#f9a825');
      expect(stretchSexilyAction.visual.hoverTextColor).toBe('#212121');
    });
  });

  describe('Prerequisite handling', () => {
    it('should require other actors at location', () => {
      expect(stretchSexilyAction.prerequisites).toBeDefined();
      expect(Array.isArray(stretchSexilyAction.prerequisites)).toBe(true);
      expect(stretchSexilyAction.prerequisites).toHaveLength(1);

      const otherActorsPrerequisite = stretchSexilyAction.prerequisites[0];
      expect(otherActorsPrerequisite.logic.hasOtherActorsAtLocation).toEqual([
        'actor',
      ]);
      expect(otherActorsPrerequisite.failure_message).toBe(
        'There is nobody here to draw attention from.'
      );
    });
  });

  describe('Action discoverability scenarios', () => {
    it('should be executable without any special setup', async () => {
      const scenario = testFixture.createStandardActorTarget(['Ava', 'Marcus']);

      await testFixture.executeAction(scenario.actor.id, null);

      testFixture.assertActionSuccess(
        'Ava tilts head and spine, claiming space with a languid stretch, drawing attention to their body.'
      );
    });

    it('rejects execution when the actor is currently hugging someone', async () => {
      const scenario = testFixture.createStandardActorTarget(
        ['Dana', 'Elliot'],
        {
          includeRoom: false,
        }
      );

      scenario.actor.components['hugging-states:hugging'] = {
        embraced_entity_id: scenario.target.id,
        initiated: true,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      await expect(
        testFixture.executeAction(scenario.actor.id, null)
      ).rejects.toThrow(/forbidden component/i);

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
