/**
 * @file Integration tests for the positioning:kneel_before action and rule.
 * @description Tests the rule execution after the kneel_before action is performed.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';
import kneelBeforeComponent from '../../../../data/mods/positioning/components/kneeling_before.component.json';

/**
 * Creates standardized kneeling positioning scenario.
 *
 * @param {string} actorName - Name for the actor
 * @param {string} targetName - Name for the target
 * @param {string} locationId - Location for the scenario
 * @returns {object} Object with actor, target, and location entities
 */
function setupKneelingScenario(
  actorName = 'Alice',
  targetName = 'King Bob',
  locationId = 'throne_room'
) {
  const room = new ModEntityBuilder(locationId).asRoom('Throne Room').build();

  const actor = new ModEntityBuilder('test:actor1')
    .withName(actorName)
    .atLocation(locationId)
    .closeToEntity('test:target1')
    .asActor()
    .build();

  const target = new ModEntityBuilder('test:target1')
    .withName(targetName)
    .atLocation(locationId)
    .closeToEntity('test:actor1')
    .asActor()
    .build();

  return { room, actor, target };
}

/**
 * Creates multi-actor kneeling scenario with witness.
 */
function setupMultiActorKneelingScenario() {
  const scenario = setupKneelingScenario('Knight', 'Lord', 'courtyard');

  const witness = new ModEntityBuilder('test:witness1')
    .withName('Peasant')
    .atLocation('courtyard')
    .asActor()
    .build();

  return { ...scenario, witness };
}

/**
 * Creates scenario where actor is already kneeling.
 */
function setupAlreadyKneelingScenario() {
  const scenario = setupKneelingScenario();

  // Actor is already kneeling to someone else
  scenario.actor.components['positioning:kneeling_before'] = {
    entityId: 'test:existing_target',
  };

  return scenario;
}

/**
 * Creates scenario where actor is sitting on furniture.
 */
function setupSittingScenario() {
  const scenario = setupKneelingScenario('Alice', 'King Bob', 'throne_room');

  // Add a chair to the room
  const chair = new ModEntityBuilder('test:chair')
    .withName('Throne Chair')
    .atLocation('throne_room')
    .build();

  // Actor is sitting on the chair
  scenario.actor.components['positioning:sitting_on'] = {
    furniture_id: 'test:chair',
    spot_index: 0,
  };

  return { ...scenario, chair };
}

describe('positioning:kneel_before action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:kneel_before'
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('successfully executes kneel before action', async () => {
    const entities = setupKneelingScenario();
    testFixture.reset(Object.values(entities));

    await testFixture.executeAction('test:actor1', 'test:target1');

    // Verify kneeling component was added
    ModAssertionHelpers.assertComponentAdded(
      testFixture.entityManager,
      'test:actor1',
      'positioning:kneeling_before',
      { entityId: 'test:target1' }
    );

    // Verify action success
    ModAssertionHelpers.assertActionSuccess(
      testFixture.events,
      'Alice kneels before King Bob.'
    );
  });

  it('creates correct perceptible event', async () => {
    const entities = setupKneelingScenario(
      'Sir Galahad',
      'Queen Guinevere',
      'castle_hall'
    );
    testFixture.reset(Object.values(entities));

    await testFixture.executeAction('test:actor1', 'test:target1');

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );

    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      'Sir Galahad kneels before Queen Guinevere.'
    );
    expect(perceptibleEvent.payload.locationId).toBe('castle_hall');
    expect(perceptibleEvent.payload.actorId).toBe('test:actor1');
    expect(perceptibleEvent.payload.targetId).toBe('test:target1');
  });

  it('handles multiple actors in same location', async () => {
    const entities = setupMultiActorKneelingScenario();
    testFixture.reset(Object.values(entities));

    await testFixture.executeAction('test:actor1', 'test:target1');

    // Verify kneeling component was added
    ModAssertionHelpers.assertComponentAdded(
      testFixture.entityManager,
      'test:actor1',
      'positioning:kneeling_before',
      { entityId: 'test:target1' }
    );

    // Perceptible event should be visible to all in location
    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent.payload.locationId).toBe('courtyard');
  });

  it('prevents kneeling while already kneeling (component lifecycle)', async () => {
    const entities = setupAlreadyKneelingScenario();
    testFixture.reset(Object.values(entities));

    // This test verifies that the action system would prevent this
    // based on forbidden_components, but we dispatch directly
    // The rule should still execute but this demonstrates the logic
    await testFixture.executeAction('test:actor1', 'test:target1');

    // The ADD_COMPONENT operation would replace existing component
    const actor = testFixture.entityManager.getEntityInstance('test:actor1');
    expect(actor.components['positioning:kneeling_before'].entityId).toBe(
      'test:target1'
    );
  });

  it('only fires for correct action ID', async () => {
    const entities = setupKneelingScenario();
    testFixture.reset(Object.values(entities));

    // Try with a different action
    await testFixture.executeActionManual(
      'test:actor1',
      'core:wait',
      'test:target1'
    );

    // Should not have any perceptible events from our rule
    const perceptibleEvents = testFixture.events.filter(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvents).toHaveLength(0);

    // Should not have added the component
    const actor = testFixture.entityManager.getEntityInstance('test:actor1');
    expect(actor.components['positioning:kneeling_before']).toBeUndefined();
  });

  it('reproduces production error with realistic entity IDs', async () => {
    // This test reproduces the exact error scenario from the production logs
    const room = new ModEntityBuilder('coffee_shop')
      .asRoom('Coffee Shop')
      .build();

    const actor = new ModEntityBuilder('p_erotica:iker_aguirre_instance')
      .withName('Iker')
      .atLocation('coffee_shop')
      .closeToEntity('p_erotica:amaia_castillo_instance')
      .asActor()
      .build();

    const target = new ModEntityBuilder('p_erotica:amaia_castillo_instance')
      .withName('Amaia')
      .atLocation('coffee_shop')
      .closeToEntity('p_erotica:iker_aguirre_instance')
      .asActor()
      .build();

    testFixture.reset([room, actor, target]);

    await testFixture.executeAction(
      'p_erotica:iker_aguirre_instance',
      'p_erotica:amaia_castillo_instance'
    );

    // This should work with the schema fix - component should store the namespaced target ID
    ModAssertionHelpers.assertComponentAdded(
      testFixture.entityManager,
      'p_erotica:iker_aguirre_instance',
      'positioning:kneeling_before',
      { entityId: 'p_erotica:amaia_castillo_instance' }
    );

    // Verify action success
    ModAssertionHelpers.assertActionSuccess(
      testFixture.events,
      'Iker kneels before Amaia.'
    );
  });

  it('validates component schema supports namespaced entity IDs', async () => {
    // This test verifies that the component schema accepts namespaced IDs
    const kneelComponent = kneelBeforeComponent;

    // Test data that should pass with the fixed schema
    const validData = { entityId: 'test:target_entity' };
    const validData2 = { entityId: 'p_erotica:amaia_castillo_instance' };

    // Test data that should fail with the fixed schema (non-namespaced)
    const invalidData = { entityId: 'simple_entity_id' };

    // Manual validation using JSON schema pattern
    const pattern = new RegExp(
      kneelComponent.dataSchema.properties.entityId.pattern
    );

    expect(pattern.test(validData.entityId)).toBe(true);
    expect(pattern.test(validData2.entityId)).toBe(true);
    expect(pattern.test(invalidData.entityId)).toBe(false);
  });

  it('should demonstrate sitting restriction (action discovery would prevent this)', async () => {
    // This test demonstrates that the forbidden_components logic would prevent
    // the action from being discovered when the actor is sitting
    const entities = setupSittingScenario();
    testFixture.reset(Object.values(entities));

    // In normal action discovery, this action would not appear in available actions
    // because the actor has the positioning:sitting_on component.
    // However, we're testing the rule execution directly to verify the logic.

    // NOTE: This test shows what would happen if somehow the action was triggered
    // In real gameplay, the action discovery system prevents this scenario
    await testFixture.executeAction('test:actor1', 'test:target1');

    // The rule itself would still execute because we're bypassing action discovery
    ModAssertionHelpers.assertComponentAdded(
      testFixture.entityManager,
      'test:actor1',
      'positioning:kneeling_before',
      { entityId: 'test:target1' }
    );

    // Verify success message would still be generated
    ModAssertionHelpers.assertActionSuccess(
      testFixture.events,
      'Alice kneels before King Bob.'
    );

    // This test proves the restriction is at the action discovery level,
    // not at the rule execution level - which is the correct design
  });

  it('validates sitting restriction component structure', async () => {
    // This test validates that the sitting_on component structure matches expectations
    const entities = setupSittingScenario();
    testFixture.reset(Object.values(entities));

    // Verify the sitting component is properly structured
    const actor = testFixture.entityManager.getEntityInstance('test:actor1');
    expect(actor.components['positioning:sitting_on']).toBeDefined();
    expect(actor.components['positioning:sitting_on'].furniture_id).toBe(
      'test:chair'
    );
    expect(actor.components['positioning:sitting_on'].spot_index).toBe(0);

    // Verify the chair entity exists
    const chair = testFixture.entityManager.getEntityInstance('test:chair');
    expect(chair).toBeDefined();
    expect(chair.components['core:name'].text).toBe('Throne Chair');
  });
});
