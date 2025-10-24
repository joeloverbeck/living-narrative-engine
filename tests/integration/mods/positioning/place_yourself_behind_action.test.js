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
function setupBehindPositioningScenario(
  actorName = 'Player Character',
  targetName = 'Guard NPC',
  locationId = 'test:room'
) {
  const room = new ModEntityBuilder(locationId).asRoom('Test Room').build();

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
  const room = new ModEntityBuilder('test:room').asRoom('Test Room').build();

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
    facing_away_from: ['test:existing'],
  };

  return scenario;
}

/**
 * Creates scenario where actor is sitting on furniture.
 */
function setupSittingBehindScenario() {
  const scenario = setupBehindPositioningScenario(
    'Sitting Player',
    'Standing Guard',
    'test:room'
  );

  // Add a bench to the room
  const bench = new ModEntityBuilder('test:bench')
    .withName('Wooden Bench')
    .atLocation('test:room')
    .build();

  // Actor is sitting on the bench
  scenario.actor.components['positioning:sitting_on'] = {
    furniture_id: 'test:bench',
    spot_index: 0,
  };

  return { ...scenario, bench };
}

/**
 * Creates scenario where actor is kneeling before someone.
 */
function setupKneelingBehindScenario() {
  const scenario = setupBehindPositioningScenario(
    'Kneeling Player',
    'Standing Guard',
    'test:room'
  );

  // Actor is kneeling before someone else
  scenario.actor.components['positioning:kneeling_before'] = {
    entityId: 'test:someone_else',
  };

  return scenario;
}

/**
 * Creates scenario where actor is lying down on furniture.
 */
function setupLyingBehindScenario() {
  const scenario = setupBehindPositioningScenario(
    'Lying Player',
    'Standing Guard',
    'test:room'
  );

  // Add a bed to the room
  const bed = new ModEntityBuilder('test:bed')
    .withName('Wooden Bed')
    .atLocation('test:room')
    .withComponent('positioning:allows_lying_on', {})
    .build();

  // Actor is lying down on the bed
  scenario.actor.components['positioning:lying_down'] = {
    furniture_id: 'test:bed',
  };

  return { ...scenario, bed };
}

/**
 * Creates scenario where actor is straddling another actor.
 */
function setupStraddlingBehindScenario() {
  const scenario = setupBehindPositioningScenario(
    'Straddling Player',
    'Standing Guard',
    'test:room'
  );

  // Add a chair for the straddled target to sit on
  const chair = new ModEntityBuilder('test:chair')
    .withName('Chair')
    .atLocation('test:room')
    .build();

  // Add another actor who is being straddled
  const straddledTarget = new ModEntityBuilder('test:straddled_target')
    .withName('Bob')
    .atLocation('test:room')
    .asActor()
    .withComponent('positioning:sitting_on', {
      furniture_id: 'test:chair',
      spot_index: 0,
    })
    .build();

  // Actor is straddling the straddled target's waist
  scenario.actor.components['positioning:straddling_waist'] = {
    target_id: 'test:straddled_target',
    facing_away: false,
  };

  return { ...scenario, chair, straddledTarget };
}

/**
 * Creates scenario where the actor is currently being hugged.
 */
function setupBeingHuggedBehindScenario() {
  const scenario = setupBehindPositioningScenario();

  const hugger = new ModEntityBuilder('test:hugger')
    .withName('Close Friend')
    .atLocation('test:room')
    .closeToEntity('test:player')
    .asActor()
    .build();

  scenario.actor.components['positioning:being_hugged'] = {
    hugging_entity_id: hugger.id,
  };

  return { ...scenario, hugger };
}

/**
 * Creates scenario where the actor is currently hugging another entity.
 */
function setupHuggingBehindScenario() {
  const scenario = setupBehindPositioningScenario();

  const huggee = new ModEntityBuilder('test:huggee')
    .withName('Close Friend')
    .atLocation('test:room')
    .closeToEntity('test:player')
    .asActor()
    .build();

  scenario.actor.components['positioning:hugging'] = {
    embraced_entity_id: huggee.id,
    initiated: true,
  };

  return { ...scenario, huggee };
}

describe('Place Yourself Behind Action Integration Tests', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'place_yourself_behind'
    );
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

  it('should not log validation warnings for positioning:actor_placed_behind event', async () => {
    const entities = setupBehindPositioningScenario();
    testFixture.reset(Object.values(entities));

    testFixture.logger.warn.mockClear();

    await testFixture.executeAction('test:player', 'test:npc');

    const validationWarnings = testFixture.logger.warn.mock.calls.filter(
      (call) =>
        typeof call[0] === 'string' &&
        call[0].includes('EventDefinition not found') &&
        call[0].includes('positioning:actor_placed_behind')
    );

    if (validationWarnings.length > 0) {
      console.log('Unexpected validation warnings:', validationWarnings);
    }

    expect(validationWarnings).toHaveLength(0);
  });

  it('rejects placing yourself behind someone while being hugged', async () => {
    const entities = setupBeingHuggedBehindScenario();
    testFixture.reset(Object.values(entities));

    await expect(
      testFixture.executeAction('test:player', 'test:npc')
    ).rejects.toThrow(/forbidden component.*positioning:being_hugged/i);
  });

  it('rejects placing yourself behind someone while hugging another actor', async () => {
    const entities = setupHuggingBehindScenario();
    testFixture.reset(Object.values(entities));

    await expect(
      testFixture.executeAction('test:player', 'test:npc')
    ).rejects.toThrow(/forbidden component.*positioning:hugging/i);
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

  it('should demonstrate sitting restriction (action discovery would prevent this)', async () => {
    // This test demonstrates that the forbidden_components logic would prevent
    // the action from being discovered when the actor is sitting
    const entities = setupSittingBehindScenario();
    testFixture.reset(Object.values(entities));

    // In normal action discovery, this action would not appear in available actions
    // because the actor has the positioning:sitting_on component.
    // However, we're testing the rule execution directly to verify the logic.

    // NOTE: This test shows what would happen if somehow the action was triggered
    // In real gameplay, the action discovery system prevents this scenario
    await testFixture.executeAction('test:player', 'test:npc', { skipDiscovery: true });

    // The rule itself would still execute because we're bypassing action discovery
    const target = testFixture.entityManager.getEntityInstance('test:npc');
    expect(target?.components['positioning:facing_away']).toBeDefined();
    expect(
      target.components['positioning:facing_away'].facing_away_from
    ).toContain('test:player');

    // Verify success message would still be generated
    ModAssertionHelpers.assertActionSuccess(
      testFixture.events,
      'Sitting Player places themselves behind Standing Guard.'
    );

    // This test proves the restriction is at the action discovery level,
    // not at the rule execution level - which is the correct design
  });

  it('should demonstrate kneeling restriction (action discovery would prevent this)', async () => {
    // This test demonstrates that the forbidden_components logic would prevent
    // the action from being discovered when the actor is kneeling
    const entities = setupKneelingBehindScenario();
    testFixture.reset(Object.values(entities));

    // In normal action discovery, this action would not appear in available actions
    // because the actor has the positioning:kneeling_before component.
    await testFixture.executeAction('test:player', 'test:npc', { skipDiscovery: true });

    // The rule itself would still execute because we're bypassing action discovery
    const target = testFixture.entityManager.getEntityInstance('test:npc');
    expect(target?.components['positioning:facing_away']).toBeDefined();
    expect(
      target.components['positioning:facing_away'].facing_away_from
    ).toContain('test:player');

    // Verify success message would still be generated
    ModAssertionHelpers.assertActionSuccess(
      testFixture.events,
      'Kneeling Player places themselves behind Standing Guard.'
    );

    // This test proves the restriction is at the action discovery level
  });

  it('validates sitting restriction component structure', async () => {
    // This test validates that the sitting_on component structure matches expectations
    const entities = setupSittingBehindScenario();
    testFixture.reset(Object.values(entities));

    // Verify the sitting component is properly structured
    const actor = testFixture.entityManager.getEntityInstance('test:player');
    expect(actor.components['positioning:sitting_on']).toBeDefined();
    expect(actor.components['positioning:sitting_on'].furniture_id).toBe(
      'test:bench'
    );
    expect(actor.components['positioning:sitting_on'].spot_index).toBe(0);

    // Verify the bench entity exists
    const bench = testFixture.entityManager.getEntityInstance('test:bench');
    expect(bench).toBeDefined();
    expect(bench.components['core:name'].text).toBe('Wooden Bench');
  });

  it('validates kneeling restriction component structure', async () => {
    // This test validates that the kneeling_before component structure matches expectations
    const entities = setupKneelingBehindScenario();
    testFixture.reset(Object.values(entities));

    // Verify the kneeling component is properly structured
    const actor = testFixture.entityManager.getEntityInstance('test:player');
    expect(actor.components['positioning:kneeling_before']).toBeDefined();
    expect(actor.components['positioning:kneeling_before'].entityId).toBe(
      'test:someone_else'
    );
  });

  it('should demonstrate lying restriction (action discovery would prevent this)', async () => {
    // This test demonstrates that the forbidden_components logic would prevent
    // the action from being discovered when the actor is lying down
    const entities = setupLyingBehindScenario();
    testFixture.reset(Object.values(entities));

    // In normal action discovery, this action would not appear in available actions
    // because the actor has the positioning:lying_down component.
    // However, we're testing the rule execution directly to verify the logic.

    // NOTE: This test shows what would happen if somehow the action was triggered
    // In real gameplay, the action discovery system prevents this scenario
    await testFixture.executeAction('test:player', 'test:npc', { skipDiscovery: true });

    // The rule itself would still execute because we're bypassing action discovery
    const target = testFixture.entityManager.getEntityInstance('test:npc');
    expect(target?.components['positioning:facing_away']).toBeDefined();
    expect(
      target.components['positioning:facing_away'].facing_away_from
    ).toContain('test:player');

    // Verify success message would still be generated
    ModAssertionHelpers.assertActionSuccess(
      testFixture.events,
      'Lying Player places themselves behind Standing Guard.'
    );

    // This test proves the restriction is at the action discovery level,
    // not at the rule execution level - which is the correct design
  });

  it('validates lying restriction component structure', async () => {
    // This test validates that the lying_down component structure matches expectations
    const entities = setupLyingBehindScenario();
    testFixture.reset(Object.values(entities));

    // Verify the lying component is properly structured
    const actor = testFixture.entityManager.getEntityInstance('test:player');
    expect(actor.components['positioning:lying_down']).toBeDefined();
    expect(actor.components['positioning:lying_down'].furniture_id).toBe(
      'test:bed'
    );

    // Verify the bed entity exists
    const bed = testFixture.entityManager.getEntityInstance('test:bed');
    expect(bed).toBeDefined();
    expect(bed.components['core:name'].text).toBe('Wooden Bed');
  });

  it('should demonstrate straddling restriction (action discovery would prevent this)', async () => {
    // This test demonstrates that the forbidden_components logic would prevent
    // the action from being discovered when the actor is straddling another actor
    const entities = setupStraddlingBehindScenario();
    testFixture.reset(Object.values(entities));

    // Verify initial state
    const initialActor = testFixture.entityManager.getEntityInstance('test:player');
    expect(initialActor.components['positioning:straddling_waist']).toEqual({
      target_id: 'test:straddled_target',
      facing_away: false,
    });

    // In normal action discovery, this action would not appear in available actions
    // because the actor has the positioning:straddling_waist component.
    // However, we're testing the rule execution directly to verify the logic.

    // NOTE: This test shows what would happen if somehow the action was triggered
    // In real gameplay, the action discovery system prevents this scenario
    await testFixture.executeAction('test:player', 'test:npc', { skipDiscovery: true });

    // The rule itself would still execute because we're bypassing action discovery
    const target = testFixture.entityManager.getEntityInstance('test:npc');
    expect(target?.components['positioning:facing_away']).toBeDefined();
    expect(
      target.components['positioning:facing_away'].facing_away_from
    ).toContain('test:player');

    // Verify success message would still be generated
    ModAssertionHelpers.assertActionSuccess(
      testFixture.events,
      'Straddling Player places themselves behind Standing Guard.'
    );

    // Actor still retains straddling component as rule doesn't remove it
    const updatedActor = testFixture.entityManager.getEntityInstance('test:player');
    expect(updatedActor.components['positioning:straddling_waist']).toEqual({
      target_id: 'test:straddled_target',
      facing_away: false,
    });

    // This test proves the restriction is at the action discovery level,
    // not at the rule execution level - which is the correct design
  });
});
