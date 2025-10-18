/**
 * @file Integration tests for the kissing:explore_mouth_with_tongue action and rule.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import exploreMouthWithTongueRule from '../../../../data/mods/kissing/rules/explore_mouth_with_tongue.rule.json';
import eventIsActionExploreMouthWithTongue from '../../../../data/mods/kissing/conditions/event-is-action-explore-mouth-with-tongue.condition.json';

describe('kissing:explore_mouth_with_tongue action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'kissing',
      'kissing:explore_mouth_with_tongue',
      exploreMouthWithTongueRule,
      eventIsActionExploreMouthWithTongue
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('successfully executes explore mouth with tongue action between close actors', async () => {
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
  });

  it('validates perceptible event message matches action success message', async () => {
    const room = ModEntityScenarios.createRoom('library', 'Library');

    const actor = new ModEntityBuilder('diana')
      .withName('Diana')
      .atLocation('library')
      .closeToEntity('victor')
      .withComponent('kissing:kissing', { partner: 'victor' })
      .asActor()
      .build();

    const target = new ModEntityBuilder('victor')
      .withName('Victor')
      .atLocation('library')
      .closeToEntity('diana')
      .withComponent('kissing:kissing', { partner: 'diana' })
      .asActor()
      .build();

    testFixture.reset([room, actor, target]);

    await testFixture.executeAction('diana', 'victor');

    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );

    expect(successEvent).toBeDefined();
    expect(perceptibleEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      perceptibleEvent.payload.descriptionText
    );
  });
});
