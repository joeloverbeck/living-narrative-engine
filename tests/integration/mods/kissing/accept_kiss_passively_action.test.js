/**
 * @file Integration tests for the kissing:accept_kiss_passively action and rule.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import acceptKissPassivelyRule from '../../../../data/mods/kissing/rules/accept_kiss_passively.rule.json';
import eventIsActionAcceptKissPassively from '../../../../data/mods/kissing/conditions/event-is-action-accept-kiss-passively.condition.json';

describe('kissing:accept_kiss_passively action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'kissing',
      'kissing:accept_kiss_passively',
      acceptKissPassivelyRule,
      eventIsActionAcceptKissPassively
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('successfully executes accept kiss passively action between close actors', async () => {
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
