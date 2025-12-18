/**
 * @file Integration tests for the distress:bury_face_in_hands rule.
 * @description Validates rule triggering, messaging, and structural schema compliance for the bury face in hands action.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../../common/mods/ModTestFixture.js';

const ACTION_ID = 'distress:bury_face_in_hands';
const EXPECTED_MESSAGE =
  '{context.actorName} buries their face in their hands.';

describe('Distress Mod: Bury Face in Hands Rule', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('distress', ACTION_ID);
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Rule Execution', () => {
    it('logs success and ends the turn for the bury face in hands action', async () => {
      const scenario = testFixture.createStandardActorTarget(['Nina', 'Lucas']);

      await testFixture.executeAction(scenario.actor.id, null);

      testFixture.assertActionSuccess('Nina buries their face in their hands.');
    });

    it('emits perceptible event with null target and sense-aware descriptions', async () => {
      const scenario = testFixture.createStandardActorTarget(['Ivy', 'Owen']);

      await testFixture.executeAction(scenario.actor.id, null);

      testFixture.assertPerceptibleEvent({
        descriptionText: 'Ivy buries their face in their hands.',
        locationId: 'room1',
        actorId: scenario.actor.id,
        targetId: null,
        perceptionType: 'physical.self_action',
        actorDescription: 'I bury my face in my hands, overwhelmed.',
        alternateDescriptions: {
          auditory: 'I hear someone nearby making sounds of distress.',
        },
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
      expect(testFixture.ruleFile.rule_id).toBe('bury_face_in_hands');
      expect(testFixture.ruleFile.comment).toBe(
        "Handles the 'distress:bury_face_in_hands' action. Describes the actor folding in on themselves and hiding behind their hands."
      );
    });

    it('should process core:attempt_action events only', () => {
      expect(testFixture.ruleFile.event_type).toBe('core:attempt_action');
    });

    it('should reference the bury face in hands condition', () => {
      expect(testFixture.ruleFile.condition.condition_ref).toBe(
        'distress:event-is-action-bury-face-in-hands'
      );
    });
  });

  describe('Action sequence validation', () => {
    it('should include required variables and sense-aware operations', () => {
      const actions = testFixture.ruleFile.actions;
      expect(actions).toHaveLength(10);

      const [
        getName,
        queryComponent,
        messageAction,
        perceptionType,
        locationId,
        targetId,
        successMessage,
        dispatchPerceptible,
        dispatchEvent,
        endTurn,
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

      expect(successMessage.type).toBe('SET_VARIABLE');
      expect(successMessage.parameters.variable_name).toBe('successMessage');

      expect(dispatchPerceptible.type).toBe('DISPATCH_PERCEPTIBLE_EVENT');
      expect(dispatchPerceptible.parameters.actor_description).toBe(
        'I bury my face in my hands, overwhelmed.'
      );
      expect(dispatchPerceptible.parameters.alternate_descriptions).toMatchObject({
        auditory: 'I hear someone nearby making sounds of distress.',
      });

      expect(dispatchEvent.type).toBe('DISPATCH_EVENT');
      expect(dispatchEvent.parameters.eventType).toBe(
        'core:display_successful_action_result'
      );

      expect(endTurn.type).toBe('END_TURN');
    });
  });

  describe('Condition logic validation', () => {
    it('should match only the bury face in hands action id', () => {
      expect(testFixture.conditionFile.logic['==']).toEqual([
        { var: 'event.payload.actionId' },
        ACTION_ID,
      ]);
    });
  });
});
