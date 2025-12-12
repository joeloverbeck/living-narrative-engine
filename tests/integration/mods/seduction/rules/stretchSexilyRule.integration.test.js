/**
 * @file Integration tests for the seduction:stretch_sexily rule.
 * @description Validates rule triggering, messaging, and structural schema compliance for the stretch sexily action.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../../common/mods/ModTestFixture.js';

const ACTION_ID = 'seduction:stretch_sexily';
const EXPECTED_MESSAGE =
  '{context.actorName} tilts head and spine, claiming space with a languid stretch, drawing attention to their body.';

describe('Seduction Mod: Stretch Sexily Rule', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('seduction', ACTION_ID);
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Rule Execution', () => {
    it('logs success and ends the turn for the stretch action', async () => {
      const scenario = testFixture.createStandardActorTarget(['Nina', 'Lucas']);

      await testFixture.executeAction(scenario.actor.id, null);

      testFixture.assertActionSuccess(
        'Nina tilts head and spine, claiming space with a languid stretch, drawing attention to their body.'
      );
    });

    it('emits perceptible event with null target', async () => {
      const scenario = testFixture.createStandardActorTarget(['Ivy', 'Owen']);

      await testFixture.executeAction(scenario.actor.id, null);

      testFixture.assertPerceptibleEvent({
        descriptionText:
          'Ivy tilts head and spine, claiming space with a languid stretch, drawing attention to their body.',
        locationId: 'room1',
        actorId: scenario.actor.id,
        targetId: null,
        perceptionType: 'physical.self_action',
      });
    });

    it('ignores unrelated actions', async () => {
      const scenario = testFixture.createStandardActorTarget(['Zoe', 'Ethan']);

      const payload = {
        eventName: 'core:attempt_action',
        actorId: scenario.actor.id,
        actionId: 'core:wait',
        originalInput: 'wait',
      };

      await testFixture.eventBus.dispatch('core:attempt_action', payload);

      testFixture.assertOnlyExpectedEvents(['core:attempt_action']);
    });
  });

  describe('Rule Structure Validation', () => {
    it('should identify rule metadata correctly', () => {
      expect(testFixture.ruleFile.rule_id).toBe('stretch_sexily');
      expect(testFixture.ruleFile.comment).toBe(
        "Handles the 'seduction:stretch_sexily' action. Generates descriptive text about the actor stretching languidly to draw attention."
      );
    });

    it('should process core:attempt_action events only', () => {
      expect(testFixture.ruleFile.event_type).toBe('core:attempt_action');
    });

    it('should reference the stretch action condition', () => {
      expect(testFixture.ruleFile.condition.condition_ref).toBe(
        'seduction:event-is-action-stretch-sexily'
      );
    });
  });

  describe('Action sequence validation', () => {
    it('should include required variables and macro', () => {
      const actions = testFixture.ruleFile.actions;
      expect(actions).toHaveLength(7);

      const [
        getName,
        queryComponent,
        messageAction,
        perceptionType,
        locationId,
        targetId,
        macro,
      ] = actions;

      expect(getName.type).toBe('GET_NAME');
      expect(getName.parameters.entity_ref).toBe('actor');
      expect(getName.parameters.result_variable).toBe('actorName');

      expect(queryComponent.type).toBe('QUERY_COMPONENT');
      expect(queryComponent.parameters.component_type).toBe('core:position');
      expect(queryComponent.parameters.result_variable).toBe('actorPosition');

      expect(messageAction.type).toBe('SET_VARIABLE');
      expect(messageAction.parameters.variable_name).toBe('logMessage');
      expect(messageAction.parameters.value).toBe(EXPECTED_MESSAGE);

      expect(perceptionType.parameters.variable_name).toBe('perceptionType');
      expect(perceptionType.parameters.value).toBe('physical.self_action');

      expect(locationId.parameters.variable_name).toBe('locationId');
      expect(locationId.parameters.value).toBe(
        '{context.actorPosition.locationId}'
      );

      expect(targetId.parameters.variable_name).toBe('targetId');
      expect(targetId.parameters.value).toBeNull();

      expect(macro.macro).toBe('core:logSuccessAndEndTurn');
    });
  });

  describe('Condition logic validation', () => {
    it('should match only the stretch action id', () => {
      expect(testFixture.conditionFile.logic['==']).toEqual([
        { var: 'event.payload.actionId' },
        ACTION_ID,
      ]);
    });
  });
});
