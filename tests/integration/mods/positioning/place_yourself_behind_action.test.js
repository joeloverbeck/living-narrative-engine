/**
 * @file Integration tests for the positioning:place_yourself_behind action and rule.
 * @description Tests the rule execution after the place_yourself_behind action is performed.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';

/**
 * Creates a standardized behind-positioning scenario.
 * 
 * @param {string} actorName - Name for the actor
 * @param {string} targetName - Name for the target
 * @param {string} locationId - Location ID
 * @returns {object} Object with actor, target, and location entities
 */
function setupBehindPositioningScenario(actorName = 'Player Character', targetName = 'Guard NPC', locationId = 'test:room') {
  const room = new ModEntityBuilder(locationId)
    .asRoom('Test Room')
    .build();

  const actor = new ModEntityBuilder('test:player')
    .withName(actorName)
    .atLocation(locationId)
    .closeToEntity('test:npc')
    .asActor()
    .build();

  const target = new ModEntityBuilder('test:npc')
    .withName(targetName)
    .closeToEntity('test:player')
    .asActor()
    .build();

  return { room, actor, target };
}

/**
 * Creates multi-actor behind-positioning scenario.
 */
function setupMultiActorBehindScenario() {
  const room = new ModEntityBuilder('test:room')
    .asRoom('Test Room')
    .build();

  const actor1 = new ModEntityBuilder('test:player1')
    .withName('Player One')
    .atLocation('test:room')
    .closeToEntity('test:npc')
    .asActor()
    .build();

  const actor2 = new ModEntityBuilder('test:player2')
    .withName('Player Two')
    .atLocation('test:room')
    .closeToEntity('test:npc')
    .asActor()
    .build();

  const target = new ModEntityBuilder('test:npc')
    .withName('Guard NPC')
    .closeToEntity('test:player1')
    .asActor()
    .build();

  return { room, actor1, actor2, target };
}

/**
 * Creates scenario with existing facing_away relationships.
 */
function setupExistingFacingAwayScenario() {
  const scenario = setupBehindPositioningScenario();
  
  // Modify target to have existing facing_away component
  scenario.target.components['positioning:facing_away'] = {
    facing_away_from: ['test:existing']
  };

  return scenario;
}

describe('Place Yourself Behind Action Integration Tests', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('positioning', 'positioning:place_yourself_behind');
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('should successfully execute place_yourself_behind action with proper component assignment', async () => {
    const entities = setupBehindPositioningScenario();
    testFixture.reset(Object.values(entities));

    await testFixture.executeAction('test:player', 'test:npc');

    // Verify target receives the facing_away component
    const target = testFixture.entityManager.getEntityInstance('test:npc');
    expect(target?.components['positioning:facing_away']).toBeDefined();
    expect(
      target.components['positioning:facing_away'].facing_away_from
    ).toContain('test:player');

    // Verify actor does NOT receive the facing_away component
    const actor = testFixture.entityManager.getEntityInstance('test:player');
    expect(actor?.components['positioning:facing_away']).toBeUndefined();

    // Verify action success
    ModAssertionHelpers.assertActionSuccess(
      testFixture.events,
      'Player Character places themselves behind Guard NPC.'
    );

    // Verify proper event dispatch
    const placedBehindEvent = testFixture.events.find(
      (e) => e.eventType === 'positioning:actor_placed_behind'
    );
    expect(placedBehindEvent.payload.actor).toBe('test:player');
    expect(placedBehindEvent.payload.target).toBe('test:npc');
  });

  it('should handle multiple actors placing themselves behind the same target', async () => {
    const entities = setupMultiActorBehindScenario();
    testFixture.reset(Object.values(entities));

    // First actor places themselves behind target
    await testFixture.executeAction('test:player1', 'test:npc');

    // Second actor places themselves behind same target
    await testFixture.executeAction('test:player2', 'test:npc');

    // Target should be facing away from both actors
    const target = testFixture.entityManager.getEntityInstance('test:npc');
    expect(target?.components['positioning:facing_away']).toBeDefined();
    expect(
      target.components['positioning:facing_away'].facing_away_from
    ).toContain('test:player1');
    expect(
      target.components['positioning:facing_away'].facing_away_from
    ).toContain('test:player2');
    expect(
      target.components['positioning:facing_away'].facing_away_from
    ).toHaveLength(2);

    // Verify both actions succeeded
    const successEvents = testFixture.events.filter(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvents).toHaveLength(2);
  });

  it('should work with entities that already have facing_away relationships', async () => {
    const entities = setupExistingFacingAwayScenario();
    testFixture.reset(Object.values(entities));

    await testFixture.executeAction('test:player', 'test:npc');

    // Target should be facing away from both original and new actor
    const target = testFixture.entityManager.getEntityInstance('test:npc');
    expect(target?.components['positioning:facing_away']).toBeDefined();
    expect(
      target.components['positioning:facing_away'].facing_away_from
    ).toContain('test:existing');
    expect(
      target.components['positioning:facing_away'].facing_away_from
    ).toContain('test:player');
    expect(
      target.components['positioning:facing_away'].facing_away_from
    ).toHaveLength(2);

    // Verify action success
    ModAssertionHelpers.assertActionSuccess(
      testFixture.events,
      'Player Character places themselves behind Guard NPC.'
    );

    // Verify component array modification
    ModAssertionHelpers.assertComponentAdded(
      testFixture.entityManager,
      'test:npc',
      'positioning:facing_away',
      { facing_away_from: ['test:existing', 'test:player'] }
    );
  });
});