/**
 * @file Minimal debug test for open_container rule matching (WORKING VERSION)
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import openContainerRule from '../../../../data/mods/containers/rules/handle_open_container.rule.json' assert { type: 'json' };
import eventIsActionOpenContainer from '../../../../data/mods/containers/conditions/event-is-action-open-container.condition.json' assert { type: 'json' };

describe('DEBUG: open_container rule matching (WORKING)', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'containers',
      'containers:open_container',
      openContainerRule,
      eventIsActionOpenContainer
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('minimal scenario - does rule match?', async () => {
    // Setup minimal scenario
    const room = new ModEntityBuilder('room1').asRoom('Room').build();
    const actor = new ModEntityBuilder('actor1')
      .withName('Actor')
      .atLocation('room1')
      .asActor()
      .withComponent('items:inventory', {
        items: [],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .build();
    const container = new ModEntityBuilder('container1')
      .withName('Container')
      .atLocation('room1')
      .withComponent('containers-core:container', { items: [] })
      .withComponent('items-core:openable', { isOpen: false })
      .build();

    testFixture.reset([room, actor, container]);

    // Execute action
    await testFixture.executeAction('actor1', 'container1');

    // Log ALL events
    console.log(
      '\n=== ALL EVENTS (OPEN_CONTAINER) ===\n',
      testFixture.events.map((e, i) => ({
        index: i,
        type: e.eventType,
        payload: e.payload,
      }))
    );

    // Check if rule executed (should have more than just attempt_action)
    console.log('\n=== EVENT COUNT (OPEN_CONTAINER) ===');
    console.log('Total events dispatched:', testFixture.events.length);

    // This should PASS because open_container works
    expect(testFixture.events.length).toBeGreaterThan(1);
  });
});
