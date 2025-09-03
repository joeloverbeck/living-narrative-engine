/**
 * @file Integration tests for the intimacy:feel_arm_muscles action and rule.
 * @description Tests the rule execution after the feel_arm_muscles action is performed.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import feelArmMusclesRule from '../../../../data/mods/intimacy/rules/handle_feel_arm_muscles.rule.json';
import eventIsActionFeelArmMuscles from '../../../../data/mods/intimacy/conditions/event-is-action-feel-arm-muscles.condition.json';

describe('intimacy:feel_arm_muscles action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'intimacy',
      'intimacy:feel_arm_muscles',
      feelArmMusclesRule,
      eventIsActionFeelArmMuscles
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('performs feel arm muscles action successfully', async () => {
    // Create complex anatomy setup manually
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    
    // Add anatomy components for Bob
    scenario.target.components['anatomy:body'] = {
      body: { root: 'torso1' }
    };
    
    const anatomyEntities = [
      {
        id: 'torso1',
        components: {
          'anatomy:part': {
            parent: null,
            children: ['leftArm1', 'rightArm1'],
            subType: 'torso',
          },
        },
      },
      {
        id: 'leftArm1',
        components: {
          'anatomy:part': {
            parent: 'torso1',
            children: [],
            subType: 'arm',
          },
          'descriptors:build': { build: 'muscular' },
        },
      },
      {
        id: 'rightArm1',
        components: {
          'anatomy:part': {
            parent: 'torso1',
            children: [],
            subType: 'arm',
          },
          'descriptors:build': { build: 'muscular' },
        },
      },
    ];
    
    testFixture.reset([scenario.actor, scenario.target, ...anatomyEntities]);

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const types = testFixture.events.map((e) => e.eventType);
    expect(types).toEqual(
      expect.arrayContaining([
        'core:perceptible_event',
        'core:display_successful_action_result',
        'core:turn_ended',
      ])
    );

    // Verify the perception event was dispatched
    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();

    // Verify the success message was dispatched
    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toContain('feels the hard swell of');
  });

  it('does not fire rule for different action', async () => {
    const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

    await testFixture.eventBus.dispatch('core:attempt_action', {
      actionId: 'core:wait',
      actorId: scenario.actor.id,
    });

    // Should only have the attempt_action event
    testFixture.assertOnlyExpectedEvents(['core:attempt_action']);
  });

  it('handles missing target gracefully', async () => {
    const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);
    
    scenario.actor.components['positioning:closeness'] = { partners: [] };
    testFixture.reset([scenario.actor]);

    // This test verifies the rule handles missing entities gracefully
    // The action prerequisites would normally prevent this, but we test rule robustness
    await expect(async () => {
      await testFixture.eventBus.dispatch('core:attempt_action', {
        actionId: 'intimacy:feel_arm_muscles',
        actorId: scenario.actor.id,
        targetId: 'nonexistent',
      });
    }).not.toThrow();

    // With missing target, the rule should fail during GET_NAME operation
    // So only the initial attempt_action event should be present
    testFixture.assertOnlyExpectedEvents(['core:attempt_action']);
  });

  it('correctly processes muscular arms description', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    
    // Add anatomy components for Bob
    scenario.target.components['anatomy:body'] = {
      body: { root: 'torso1' }
    };
    
    const anatomyEntities = [
      {
        id: 'torso1',
        components: {
          'anatomy:part': {
            parent: null,
            children: ['leftArm1'],
            subType: 'torso',
          },
        },
      },
      {
        id: 'leftArm1',
        components: {
          'anatomy:part': {
            parent: 'torso1',
            children: [],
            subType: 'arm',
          },
          'descriptors:build': { build: 'muscular' },
        },
      },
    ];
    
    testFixture.reset([scenario.actor, scenario.target, ...anatomyEntities]);

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    // Find the display successful action result event
    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );

    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      "Alice feels the hard swell of Bob's muscles."
    );
  });
});
