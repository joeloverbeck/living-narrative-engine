/**
 * @file Integration tests for seduction:brush_hair_back_coyly action discovery.
 * @description Ensures the brush hair back coyly action is available when actor has hair
 * and advertises expected styling.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import brushHairBackCoylyAction from '../../../../data/mods/seduction/actions/brush_hair_back_coyly.action.json';
import brushHairBackCoylyRule from '../../../../data/mods/seduction/rules/brush_hair_back_coyly.rule.json';
import eventIsActionBrushHairBackCoyly from '../../../../data/mods/seduction/conditions/event-is-action-brush-hair-back-coyly.condition.json';

const ACTION_ID = 'seduction:brush_hair_back_coyly';

describe('seduction:brush_hair_back_coyly action discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'seduction',
      ACTION_ID,
      brushHairBackCoylyRule,
      eventIsActionBrushHairBackCoyly
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action metadata validation', () => {
    it('should define the correct core metadata', () => {
      expect(brushHairBackCoylyAction).toBeDefined();
      expect(brushHairBackCoylyAction.id).toBe(ACTION_ID);
      expect(brushHairBackCoylyAction.name).toBe('Brush Hair Back Coyly');
      expect(brushHairBackCoylyAction.description).toBe(
        'Run your fingers through your hair and tuck it behind your ear in a coy, flirtatious gesture.'
      );
      expect(brushHairBackCoylyAction.template).toBe(
        'brush your hair back coyly'
      );
    });

    it('should be a self-targeting action', () => {
      expect(brushHairBackCoylyAction.targets).toBe('none');
      expect(brushHairBackCoylyAction.required_components).toEqual({});
      expect(brushHairBackCoylyAction.forbidden_components).toEqual({
        actor: [
          'hugging-states:hugging',
          'positioning:doing_complex_performance',
          'physical-control-states:restraining',
        ],
      });
    });
  });

  describe('Visual styling validation', () => {
    it('should reuse the seduction orange palette', () => {
      expect(brushHairBackCoylyAction.visual).toBeDefined();
      expect(brushHairBackCoylyAction.visual.backgroundColor).toBe('#f57f17');
      expect(brushHairBackCoylyAction.visual.textColor).toBe('#000000');
      expect(brushHairBackCoylyAction.visual.hoverBackgroundColor).toBe(
        '#f9a825'
      );
      expect(brushHairBackCoylyAction.visual.hoverTextColor).toBe('#212121');
    });
  });

  describe('Prerequisite handling', () => {
    it('should have three prerequisites in correct order', () => {
      expect(brushHairBackCoylyAction.prerequisites).toBeDefined();
      expect(Array.isArray(brushHairBackCoylyAction.prerequisites)).toBe(true);
      expect(brushHairBackCoylyAction.prerequisites).toHaveLength(3);

      // First: grabbing appendage prerequisite (physical capability)
      const grabbingPrerequisite = brushHairBackCoylyAction.prerequisites[0];
      expect(grabbingPrerequisite.logic.condition_ref).toBe(
        'anatomy:actor-has-free-grabbing-appendage'
      );
      expect(grabbingPrerequisite.failure_message).toBe(
        'You need a free hand to brush your hair.'
      );

      // Second: hair prerequisite
      const hairPrerequisite = brushHairBackCoylyAction.prerequisites[1];
      expect(hairPrerequisite.logic.hasPartOfType).toEqual(['actor', 'hair']);
      expect(hairPrerequisite.failure_message).toBe(
        'You need hair to perform this action.'
      );

      // Third: other actors at location prerequisite
      const otherActorsPrerequisite = brushHairBackCoylyAction.prerequisites[2];
      expect(otherActorsPrerequisite.logic.hasOtherActorsAtLocation).toEqual([
        'actor',
      ]);
      expect(otherActorsPrerequisite.failure_message).toBe(
        'There is nobody here to draw attention from.'
      );
    });
  });

  describe('Action discoverability scenarios', () => {
    // eslint-disable-next-line jest/expect-expect -- assertActionSuccess contains assertions
    it('should be executable when actor has hair', async () => {
      const scenario = testFixture.createStandardActorTarget(['Ava', 'Marcus']);

      await testFixture.executeAction(scenario.actor.id, null);

      testFixture.assertActionSuccess('Ava brushes their hair back coyly.');
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
