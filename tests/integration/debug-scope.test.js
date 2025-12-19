/**
 * Debug test to understand why canScootCloser isn't working in scope
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../common/mods/ModEntityBuilder.js';
import handleScootCloserRule from '../../data/mods/personal-space/rules/handle_scoot_closer.rule.json' assert { type: 'json' };
import eventIsActionScootCloser from '../../data/mods/personal-space/conditions/event-is-action-scoot-closer.condition.json' assert { type: 'json' };

describe('Debug canScootCloser in scope', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'personal-space',
      'personal-space:scoot_closer',
      handleScootCloserRule,
      eventIsActionScootCloser
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('should show what furniture_actor_sitting_on scope returns', async () => {
    // Setup: Furniture with [occupant1, null, actor] - actor can scoot to middle
    const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

    const furniture = new ModEntityBuilder('furniture1')
      .withName('bench')
      .atLocation('room1')
      .withComponent('sitting:allows_sitting', {
        spots: ['occupant1', null, 'actor1'],
      })
      .build();

    const occupant1 = new ModEntityBuilder('occupant1')
      .withName('Bob')
      .atLocation('room1')
      .asActor()
      .withComponent('positioning:sitting_on', {
        furniture_id: 'furniture1',
        spot_index: 0,
      })
      .build();

    const actor = new ModEntityBuilder('actor1')
      .withName('Alice')
      .atLocation('room1')
      .asActor()
      .withComponent('positioning:sitting_on', {
        furniture_id: 'furniture1',
        spot_index: 2,
      })
      .build();

    testFixture.reset([room, furniture, occupant1, actor]);

    // Debug: Check what components the actor actually has
    const actorEntity = testFixture.entityManager.getEntityInstance('actor1');
    console.log('\n=== ACTOR COMPONENTS ===');
    console.log('Actor components:', Object.keys(actorEntity.components));
    console.log(
      'sitting_on component:',
      actorEntity.components['positioning:sitting_on']
    );
    console.log(
      'Actor has positioning:sitting_on?',
      !!actorEntity.components['positioning:sitting_on']
    );
    console.log('=== END ACTOR COMPONENTS ===\n');

    // Try action discovery
    const actions = await testFixture.discoverActions('actor1');
    const actionIds = actions.map((a) => a.id);
    console.log('\n=== DISCOVERED ACTIONS ===');
    console.log('Total actions:', actions.length);
    console.log('Action IDs:', actionIds);
    console.log('\n=== FULL ACTION OBJECTS ===');
    actions.forEach((action, idx) => {
      console.log(`\nAction ${idx}:`, JSON.stringify(action, null, 2));
    });
    console.log('=== END FULL ACTION OBJECTS ===\n');

    const scootAction = actions.find(
      (a) => a.id === 'personal-space:scoot_closer'
    );
    console.log('\nscoot_closer found:', !!scootAction);

    if (scootAction) {
      console.log(
        'scootAction.targets:',
        JSON.stringify(scootAction.targets, null, 2)
      );
    } else {
      console.log('\nNo scoot_closer action discovered!');
      console.log('\nLet me check what actions ARE discovered:');
      actions.forEach((action) => {
        console.log(`  - ${action.id}:`);
        if (action.targets) {
          console.log(`    targets:`, JSON.stringify(action.targets, null, 2));
        }
      });
    }
    console.log('=== END DISCOVERED ACTIONS ===\n');

    // Scoot closer should be discovered - actor has empty spot to left with occupant beyond
    expect(scootAction).toBeDefined();
    expect(scootAction.id).toBe('personal-space:scoot_closer');
    // Note: get_up_from_furniture action is not tested here - this test focuses on scoot_closer discovery
  });
});
