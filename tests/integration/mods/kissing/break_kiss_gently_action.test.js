/**
 * @file Integration tests for the kissing:break_kiss_gently action and rule.
 * @description Tests the rule execution after the break_kiss_gently action is performed.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import breakKissGentlyRule from '../../../../data/mods/kissing/rules/break_kiss_gently.rule.json';
import eventIsActionBreakKissGently from '../../../../data/mods/kissing/conditions/event-is-action-break-kiss-gently.condition.json';

describe('kissing:break_kiss_gently action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'kissing',
      'kissing:break_kiss_gently',
      breakKissGentlyRule,
      eventIsActionBreakKissGently
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('removes kissing component when breaking kiss', async () => {
    const room = ModEntityScenarios.createRoom('bedroom', 'Bedroom');

    const actor = new ModEntityBuilder('alice')
      .withName('Alice')
      .atLocation('bedroom')
      .closeToEntity('bob')
      .withComponent('kissing:kissing', { partner: 'bob', initiator: true })
      .asActor()
      .build();

    const target = new ModEntityBuilder('bob')
      .withName('Bob')
      .atLocation('bedroom')
      .closeToEntity('alice')
      .withComponent('kissing:kissing', { partner: 'alice', initiator: false })
      .asActor()
      .build();

    testFixture.reset([room, actor, target]);

    await testFixture.executeAction('alice', 'bob');

    // Verify component removed from both actors
    const actorInstance = testFixture.entityManager.getEntityInstance('alice');
    const targetInstance = testFixture.entityManager.getEntityInstance('bob');

    expect(actorInstance.components['kissing:kissing']).toBeUndefined();
    expect(targetInstance.components['kissing:kissing']).toBeUndefined();
  });

  it('generates correct perceptible event for breaking kiss', async () => {
    const room = ModEntityScenarios.createRoom('bedroom', 'Bedroom');

    const actor = new ModEntityBuilder('alice')
      .withName('Alice')
      .atLocation('bedroom')
      .closeToEntity('bob')
      .withComponent('kissing:kissing', { partner: 'bob', initiator: true })
      .asActor()
      .build();

    const target = new ModEntityBuilder('bob')
      .withName('Bob')
      .atLocation('bedroom')
      .closeToEntity('alice')
      .withComponent('kissing:kissing', { partner: 'alice', initiator: false })
      .asActor()
      .build();

    testFixture.reset([room, actor, target]);

    await testFixture.executeAction('alice', 'bob');

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
  });

  it('validates perceptible event message matches action success message', async () => {
    const room = ModEntityScenarios.createRoom('library', 'Library');

    const actor = new ModEntityBuilder('diana')
      .withName('Diana')
      .atLocation('library')
      .closeToEntity('victor')
      .withComponent('kissing:kissing', { partner: 'victor', initiator: true })
      .asActor()
      .build();

    const target = new ModEntityBuilder('victor')
      .withName('Victor')
      .atLocation('library')
      .closeToEntity('diana')
      .withComponent('kissing:kissing', {
        partner: 'diana',
        initiator: false,
      })
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

    // Both should have the same descriptive message
    expect(successEvent.payload.message).toBe(
      perceptibleEvent.payload.descriptionText
    );
  });
});
