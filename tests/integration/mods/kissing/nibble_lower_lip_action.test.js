/**
 * @file Integration tests for the kissing:nibble_lower_lip action and rule.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import nibbleLowerLipRule from '../../../../data/mods/kissing/rules/nibble_lower_lip.rule.json';
import eventIsActionNibbleLowerLip from '../../../../data/mods/kissing/conditions/event-is-action-nibble-lower-lip.condition.json';

describe('kissing:nibble_lower_lip action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'kissing',
      'kissing:nibble_lower_lip',
      nibbleLowerLipRule,
      eventIsActionNibbleLowerLip
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('successfully executes nibble lower lip action between close actors', async () => {
    const room = ModEntityScenarios.createRoom('room1', 'Test Room');

    const actor = new ModEntityBuilder('alice')
      .withName('Alice')
      .atLocation('room1')
      .closeToEntity('bob')
      .withComponent('kissing:kissing', { partner: 'bob' })
      .asActor()
      .build();

    const target = new ModEntityBuilder('bob')
      .withName('Bob')
      .atLocation('room1')
      .closeToEntity('alice')
      .withComponent('kissing:kissing', { partner: 'alice' })
      .asActor()
      .build();

    testFixture.reset([room, actor, target]);

    await testFixture.executeAction('alice', 'bob');

    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
  });
});
