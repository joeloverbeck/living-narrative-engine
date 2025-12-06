/**
 * @file Integration tests for the physical-control:push_off action using new mod test infrastructure.
 * @description Tests the action execution and rule integration patterns, focusing on
 * correct component state changes (array modification for actor, removal for target).
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ActionValidationError } from '../../../common/mods/actionExecutionValidator.js';
import pushOffRule from '../../../../data/mods/physical-control/rules/handle_push_off.rule.json';
import eventIsActionPushOff from '../../../../data/mods/physical-control/conditions/event-is-action-push-off.condition.json';

describe('Physical Control Mod: Push Off Action Integration', () => {
  let testFixture;

  beforeEach(async () => {
    // Create test fixture with explicit rule and condition files
    testFixture = await ModTestFixture.forAction(
      'physical-control',
      'physical-control:push_off',
      pushOffRule,
      eventIsActionPushOff
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Action Execution', () => {
    // eslint-disable-next-line jest/expect-expect -- Uses testFixture.assertActionSuccess
    it('performs push off action successfully', async () => {
      // Create actor and target entities
      const scenario = testFixture.createCloseActors(['Alice', 'Beth']);

      // Execute the action
      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      testFixture.assertActionSuccess(
        'Alice pushes Beth off forcefully, breaking their closeness.'
      );
    });

    // eslint-disable-next-line jest/expect-expect -- Uses testFixture.assertOnlyExpectedEvents
    it('does not fire rule for different action', async () => {
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

      // Try with different action
      const payload = {
        eventName: 'core:attempt_action',
        actorId: scenario.actor.id,
        actionId: 'core:wait',
        originalInput: 'wait',
      };

      await testFixture.eventBus.dispatch('core:attempt_action', payload);

      // Should not have any perceptible events from our rule
      testFixture.assertOnlyExpectedEvents(['core:attempt_action']);
    });

    it('handles missing target gracefully', async () => {
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Beth']);

      // Pre-flight validation now catches missing entities before rule execution
      // This validates that the validation system properly detects missing targets
      await expect(async () => {
        await testFixture.executeAction(scenario.actor.id, 'nonexistent');
      }).rejects.toThrow(ActionValidationError);
    });

    it('rejects when actor is straddling the target', async () => {
      const scenario = testFixture.createCloseActors(['Jade', 'Kira']);

      await testFixture.entityManager.addComponent(
        scenario.actor.id,
        'positioning:straddling_waist',
        {
          target_id: scenario.target.id,
          facing_away: false,
        }
      );

      await expect(async () => {
        await testFixture.executeAction(scenario.actor.id, scenario.target.id);
      }).rejects.toThrow(/forbidden component.*positioning:straddling_waist/i);
    });
  });

  describe('Component State Changes', () => {
    it('removes target from actor closeness partners array', async () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      // Verify initial state
      const actorBefore = testFixture.entityManager.getEntityInstance(
        scenario.actor.id
      );
      expect(actorBefore.components['positioning:closeness'].partners).toEqual([
        scenario.target.id,
      ]);

      console.log('=== DEBUG: Before executeAction ===');
      console.log('Actor ID:', scenario.actor.id);
      console.log('Target ID:', scenario.target.id);
      console.log(
        'Partners array:',
        actorBefore.components['positioning:closeness'].partners
      );

      // Hook the event bus to see the payload
      const originalDispatch = testFixture.eventBus.dispatch;
      testFixture.eventBus.dispatch = function (eventType, payload) {
        if (eventType === 'core:attempt_action') {
          console.log('=== INTERCEPTED EVENT ===');
          console.log('Event Type:', eventType);
          console.log('Payload:', JSON.stringify(payload, null, 2));
        }
        return originalDispatch.call(this, eventType, payload);
      };

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      // Restore original dispatch
      testFixture.eventBus.dispatch = originalDispatch;

      console.log('=== DEBUG: After executeAction ===');
      // Verify actor's closeness component is removed (no remaining partners)
      const actorAfter = testFixture.entityManager.getEntityInstance(
        scenario.actor.id
      );

      expect(actorAfter.components['positioning:closeness']).toBeUndefined();
    });

    it('removes entire closeness component from target', async () => {
      const scenario = testFixture.createCloseActors(['Maya', 'Noah']);

      // Verify initial state
      const targetBefore = testFixture.entityManager.getEntityInstance(
        scenario.target.id
      );
      expect(targetBefore.components['positioning:closeness']).toBeDefined();

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      // Verify target's closeness component is completely removed
      const targetAfter = testFixture.entityManager.getEntityInstance(
        scenario.target.id
      );
      expect(targetAfter.components['positioning:closeness']).toBeUndefined();
    });

    it('preserves actor closeness with other partners when pushing off one target', async () => {
      // Create scenario with actor close to multiple partners
      const { ModEntityBuilder } = await import(
        '../../../common/mods/ModEntityBuilder.js'
      );
      const ModEntityScenarios = (
        await import('../../../common/mods/ModEntityBuilder.js')
      ).ModEntityScenarios;

      const actor = new ModEntityBuilder('actor1')
        .withName('Ivy')
        .atLocation('room1')
        .withLocationComponent('room1')
        .asActor()
        .build();
      const target1 = new ModEntityBuilder('target1')
        .withName('Liam')
        .atLocation('room1')
        .withLocationComponent('room1')
        .asActor()
        .build();
      const target2 = new ModEntityBuilder('target2')
        .withName('Chloe')
        .atLocation('room1')
        .withLocationComponent('room1')
        .asActor()
        .build();

      // Set up actor with closeness to both targets
      actor.components['positioning:closeness'] = {
        partners: [target1.id, target2.id],
      };
      target1.components['positioning:closeness'] = {
        partners: [actor.id],
      };
      target2.components['positioning:closeness'] = {
        partners: [actor.id],
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, actor, target1, target2]);

      // Execute push off on target1
      await testFixture.executeAction(actor.id, target1.id);

      // Verify actor still has closeness with target2
      const actorAfter = testFixture.entityManager.getEntityInstance(actor.id);
      expect(actorAfter.components['positioning:closeness']).toBeDefined();
      expect(actorAfter.components['positioning:closeness'].partners).toEqual([
        target2.id,
      ]);

      // Verify target1 has closeness removed
      const target1After = testFixture.entityManager.getEntityInstance(
        target1.id
      );
      expect(target1After.components['positioning:closeness']).toBeUndefined();

      // Verify target2 still has closeness (unchanged)
      const target2After = testFixture.entityManager.getEntityInstance(
        target2.id
      );
      expect(target2After.components['positioning:closeness']).toBeDefined();
      expect(target2After.components['positioning:closeness'].partners).toEqual(
        [actor.id]
      );
    });

    it('does not modify other components on actor or target', async () => {
      const scenario = testFixture.createCloseActors(['Eve', 'Frank']);

      // Add additional components to verify they remain unchanged
      scenario.actor.components['test:marker'] = { value: 'test' };
      scenario.target.components['test:marker'] = { value: 'test' };

      const ModEntityScenarios = (
        await import('../../../common/mods/ModEntityBuilder.js')
      ).ModEntityScenarios;
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      const actorAfter = testFixture.entityManager.getEntityInstance(
        scenario.actor.id
      );
      const targetAfter = testFixture.entityManager.getEntityInstance(
        scenario.target.id
      );

      // Verify other components remain unchanged
      expect(actorAfter.components['test:marker']).toEqual({ value: 'test' });
      expect(targetAfter.components['test:marker']).toEqual({ value: 'test' });
    });
  });

  describe('Event Generation', () => {
    // eslint-disable-next-line jest/expect-expect -- Uses testFixture.assertPerceptibleEvent
    it('generates correct perceptible event message', async () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Beth']);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      testFixture.assertPerceptibleEvent({
        descriptionText:
          'Alice pushes Beth off forcefully, breaking their closeness.',
        locationId: 'room1',
        actorId: scenario.actor.id,
        targetId: scenario.target.id,
        perceptionType: 'action_target_general',
      });
    });

    // eslint-disable-next-line jest/expect-expect -- Uses testFixture.assertPerceptibleEvent
    it('works with different actor and target names', async () => {
      const scenario = testFixture.createCloseActors(['John', 'Mary']);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      testFixture.assertPerceptibleEvent({
        descriptionText:
          'John pushes Mary off forcefully, breaking their closeness.',
        locationId: 'room1',
        actorId: scenario.actor.id,
        targetId: scenario.target.id,
        perceptionType: 'action_target_general',
      });
    });
  });

  describe('Message Validation', () => {
    // eslint-disable-next-line jest/expect-expect -- Uses testFixture.assertActionSuccess
    it('generates correct perceptible log message', async () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      // Verify both the perceptible event and success message are correct
      testFixture.assertActionSuccess(
        'Alice pushes Bob off forcefully, breaking their closeness.'
      );
      testFixture.assertPerceptibleEvent({
        descriptionText:
          'Alice pushes Bob off forcefully, breaking their closeness.',
        perceptionType: 'action_target_general',
        locationId: 'room1',
        actorId: scenario.actor.id,
        targetId: scenario.target.id,
      });
    });
  });
});
