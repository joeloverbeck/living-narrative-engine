/**
 * @file Integration tests for distress rules display_successful_action_result payload validation.
 * @description Validates that distress rules dispatch core:display_successful_action_result
 * with schema-compliant payloads (only 'message' property, no additional properties).
 *
 * This test was created to reproduce and verify fixes for runtime validation errors:
 * "VED: Payload validation FAILED for event 'core:display_successful_action_result'.
 * Dispatch SKIPPED. Errors: [root]: must NOT have additional properties"
 *
 * The event schema (data/mods/core/events/display_successful_action_result.event.json) specifies:
 * - additionalProperties: false
 * - Only the 'message' property is allowed
 *
 * Rules must NOT include actorId or actionId in the payload.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../../common/mods/ModTestFixture.js';

describe('Distress Rules - display_successful_action_result Payload Validation', () => {
  describe('bury_face_in_hands rule', () => {
    let testFixture;
    const ACTION_ID = 'distress:bury_face_in_hands';

    beforeEach(async () => {
      testFixture = await ModTestFixture.forAction('distress', ACTION_ID);
    });

    afterEach(() => {
      if (testFixture) {
        testFixture.cleanup();
      }
    });

    it('should have rule structure that only sends message in display event payload', () => {
      // Find DISPATCH_EVENT operations for display_successful_action_result
      const dispatchEventActions = testFixture.ruleFile.actions.filter(
        (action) =>
          action.type === 'DISPATCH_EVENT' &&
          action.parameters?.eventType ===
            'core:display_successful_action_result'
      );

      expect(dispatchEventActions).toHaveLength(1);

      const payload = dispatchEventActions[0].parameters.payload;
      const payloadKeys = Object.keys(payload);

      // Schema requires only 'message', with additionalProperties: false
      // This was the bug fix: removed actorId and actionId from payload
      expect(payloadKeys).toEqual(['message']);
      expect(payload.message).toBeDefined();

      // Explicitly verify no forbidden properties exist
      expect(payload).not.toHaveProperty('actorId');
      expect(payload).not.toHaveProperty('actionId');
    });

    // eslint-disable-next-line jest/expect-expect -- assertActionSuccess calls expect internally
    it('should execute action successfully after fix', async () => {
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

      await testFixture.executeAction(scenario.actor.id, null);

      // Verify the action executed successfully
      testFixture.assertActionSuccess('Alice buries their face in their hands.');
    });
  });

  describe('throw_self_to_ground rule', () => {
    let testFixture;
    const ACTION_ID = 'distress:throw_self_to_ground';

    beforeEach(async () => {
      testFixture = await ModTestFixture.forAction('distress', ACTION_ID);
    });

    afterEach(() => {
      if (testFixture) {
        testFixture.cleanup();
      }
    });

    it('should have rule structure that only sends message in display event payload', () => {
      // Find DISPATCH_EVENT operations for display_successful_action_result
      const dispatchEventActions = testFixture.ruleFile.actions.filter(
        (action) =>
          action.type === 'DISPATCH_EVENT' &&
          action.parameters?.eventType ===
            'core:display_successful_action_result'
      );

      expect(dispatchEventActions).toHaveLength(1);

      const payload = dispatchEventActions[0].parameters.payload;
      const payloadKeys = Object.keys(payload);

      // Schema requires only 'message', with additionalProperties: false
      // This was the bug fix: removed actorId and actionId from payload
      expect(payloadKeys).toEqual(['message']);
      expect(payload.message).toBeDefined();

      // Explicitly verify no forbidden properties exist
      expect(payload).not.toHaveProperty('actorId');
      expect(payload).not.toHaveProperty('actionId');
    });

    // eslint-disable-next-line jest/expect-expect -- assertActionSuccess calls expect internally
    it('should execute action successfully after fix', async () => {
      const scenario = testFixture.createStandardActorTarget(['Charlie', 'Dave']);

      await testFixture.executeAction(scenario.actor.id, null);

      // Verify the action executed successfully
      testFixture.assertActionSuccess(
        'Charlie throws themselves to the ground in grief.'
      );
    });
  });

  describe('clutch_onto_upper_clothing rule (reference - uses macro)', () => {
    let testFixture;
    const ACTION_ID = 'distress:clutch_onto_upper_clothing';

    beforeEach(async () => {
      testFixture = await ModTestFixture.forAction('distress', ACTION_ID);
    });

    afterEach(() => {
      if (testFixture) {
        testFixture.cleanup();
      }
    });

    it('should use displaySuccessAndEndTurn macro which sends correct payload', () => {
      // This rule correctly uses the macro which handles the event dispatch properly
      const macroActions = testFixture.ruleFile.actions.filter(
        (action) => action.macro === 'core:displaySuccessAndEndTurn'
      );

      expect(macroActions).toHaveLength(1);

      // Verify no direct DISPATCH_EVENT for display_successful_action_result
      // (the macro handles this correctly with only 'message' property)
      const directDispatchActions = testFixture.ruleFile.actions.filter(
        (action) =>
          action.type === 'DISPATCH_EVENT' &&
          action.parameters?.eventType ===
            'core:display_successful_action_result'
      );

      expect(directDispatchActions).toHaveLength(0);
    });
  });
});
