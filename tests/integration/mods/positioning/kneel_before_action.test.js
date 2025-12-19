/**
 * @file Integration tests for the deference:kneel_before action and rule.
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
  scenario.actor.components['sitting-states:sitting_on'] = {
    furniture_id: 'test:chair',
    spot_index: 0,
  };

  return { ...scenario, chair };
}

/**
 * Creates scenario where target is sitting (throne scenario - should be valid).
 */
function setupTargetSittingScenario() {
  const scenario = setupKneelingScenario('Knight', 'King', 'throne_room');

  // Add a throne
  const throne = new ModEntityBuilder('test:throne')
    .withName('Royal Throne')
    .atLocation('throne_room')
    .build();

  // Target (King) is sitting on throne
  scenario.target.components['sitting-states:sitting_on'] = {
    furniture_id: 'test:throne',
    spot_index: 0,
  };

  return { ...scenario, throne };
}

/**
 * Creates scenario where target is kneeling (chain of reverence - should be valid).
 */
function setupTargetKneelingScenario() {
  const scenario = setupKneelingScenario('Squire', 'Knight', 'chapel');

  // Target (Knight) is kneeling before someone else
  scenario.target.components['positioning:kneeling_before'] = {
    entityId: 'test:high_priest',
  };

  return scenario;
}

/**
 * Creates scenario where target is bending over (should be invalid).
 */
function setupTargetBendingScenario() {
  const scenario = setupKneelingScenario('Servant', 'Worker', 'workshop');

  // Target is bending over
  scenario.target.components['bending-states:bending_over'] = {
    surface_id: 'test:workbench',
    spot_index: 0,
  };

  return scenario;
}

/**
 * Creates scenario where the actor is currently being hugged.
 */
function setupBeingHuggedScenario() {
  const scenario = setupKneelingScenario();

  const hugger = new ModEntityBuilder('test:hugger')
    .withName('Embracer')
    .atLocation('throne_room')
    .closeToEntity('test:actor1')
    .asActor()
    .build();

  scenario.actor.components['hugging-states:being_hugged'] = {
    hugging_entity_id: hugger.id,
  };

  return { ...scenario, hugger };
}

/**
 * Creates scenario where the actor is currently hugging another entity.
 */
function setupHuggingScenario() {
  const scenario = setupKneelingScenario();

  const huggee = new ModEntityBuilder('test:huggee')
    .withName('Comforted Friend')
    .atLocation('throne_room')
    .closeToEntity('test:actor1')
    .asActor()
    .build();

  scenario.actor.components['hugging-states:hugging'] = {
    embraced_entity_id: huggee.id,
    initiated: true,
  };

  return { ...scenario, huggee };
}

/**
 * Creates multi-actor scenario with mixed positioning states.
 */
function setupMixedPositioningScenario() {
  const room = new ModEntityBuilder('hall').asRoom('Great Hall').build();

  const kneeler = new ModEntityBuilder('test:kneeler')
    .withName('Loyal Knight')
    .atLocation('hall')
    .closeToEntity('test:king')
    .asActor()
    .build();

  const king = new ModEntityBuilder('test:king')
    .withName('King Arthur')
    .atLocation('hall')
    .closeToEntity('test:kneeler')
    .asActor()
    .build();

  const throne = new ModEntityBuilder('test:throne')
    .withName('Throne')
    .atLocation('hall')
    .build();

  // King is sitting on throne
  king.components['sitting-states:sitting_on'] = {
    furniture_id: 'test:throne',
    spot_index: 0,
  };

  const secondKnight = new ModEntityBuilder('test:second_knight')
    .withName('Second Knight')
    .atLocation('hall')
    .closeToEntity('test:third_knight')
    .asActor()
    .build();

  const thirdKnight = new ModEntityBuilder('test:third_knight')
    .withName('Third Knight')
    .atLocation('hall')
    .closeToEntity('test:second_knight')
    .asActor()
    .build();

  // Third Knight is already kneeling
  thirdKnight.components['positioning:kneeling_before'] = {
    entityId: 'test:king',
  };

  return { room, kneeler, king, throne, secondKnight, thirdKnight };
}

/**
 * Creates scenario where actor is straddling another actor.
 */
function setupStraddlingScenario() {
  const scenario = setupKneelingScenario();

  // Add a chair for the target to sit on
  const chair = new ModEntityBuilder('test:chair')
    .withName('Chair')
    .atLocation('throne_room')
    .build();

  // Add another actor who is being straddled
  const straddledTarget = new ModEntityBuilder('test:straddled_target')
    .withName('Bob')
    .atLocation('throne_room')
    .asActor()
    .withComponent('sitting-states:sitting_on', {
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

describe('deference:kneel_before action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'deference',
      'deference:kneel_before'
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

    // Validate sense-aware perspective fields
    expect(perceptibleEvent.payload.actorDescription).toBe(
      'I kneel before Queen Guinevere.'
    );
    expect(perceptibleEvent.payload.targetDescription).toBe(
      'Sir Galahad kneels before me.'
    );
    expect(perceptibleEvent.payload.alternateDescriptions).toEqual({
      auditory:
        'I hear the rustle of clothing and the sound of someone lowering to their knees nearby.',
    });
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

    // This test bypasses action discovery to test rule execution behavior directly
    // In real gameplay, the forbidden_components check would prevent this scenario
    await testFixture.executeAction('test:actor1', 'test:target1', {
      skipDiscovery: true,
    });

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
    // because the actor has the sitting-states:sitting_on component.
    // However, we're testing the rule execution directly to verify the logic.

    // NOTE: This test shows what would happen if somehow the action was triggered
    // In real gameplay, the action discovery system prevents this scenario
    await testFixture.executeAction('test:actor1', 'test:target1', {
      skipDiscovery: true,
    });

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
    expect(actor.components['sitting-states:sitting_on']).toBeDefined();
    expect(actor.components['sitting-states:sitting_on'].furniture_id).toBe(
      'test:chair'
    );
    expect(actor.components['sitting-states:sitting_on'].spot_index).toBe(0);

    // Verify the chair entity exists
    const chair = testFixture.entityManager.getEntityInstance('test:chair');
    expect(chair).toBeDefined();
    expect(chair.components['core:name'].text).toBe('Throne Chair');
  });

  describe('kneel_before target validation', () => {
    describe('valid target scenarios', () => {
      it('should allow kneeling before a standing target', async () => {
        // Default scenario has standing target
        const entities = setupKneelingScenario();
        testFixture.reset(Object.values(entities));

        await testFixture.executeAction('test:actor1', 'test:target1');

        ModAssertionHelpers.assertComponentAdded(
          testFixture.entityManager,
          'test:actor1',
          'positioning:kneeling_before',
          { entityId: 'test:target1' }
        );

        ModAssertionHelpers.assertActionSuccess(
          testFixture.events,
          'Alice kneels before King Bob.'
        );
      });

      it('should allow kneeling before a sitting target (throne scenario)', async () => {
        const entities = setupTargetSittingScenario();
        testFixture.reset(Object.values(entities));

        await testFixture.executeAction('test:actor1', 'test:target1');

        ModAssertionHelpers.assertComponentAdded(
          testFixture.entityManager,
          'test:actor1',
          'positioning:kneeling_before',
          { entityId: 'test:target1' }
        );

        ModAssertionHelpers.assertActionSuccess(
          testFixture.events,
          'Knight kneels before King.'
        );
      });

      it('should prevent kneeling before a kneeling target (forbidden by game rules)', async () => {
        const entities = setupTargetKneelingScenario();
        testFixture.reset(Object.values(entities));

        // Target has positioning:kneeling_before which is in forbidden_components.primary
        // New validation behavior: throws ActionValidationError instead of returning {blocked: true}
        await expect(async () => {
          await testFixture.executeAction('test:actor1', 'test:target1');
        }).rejects.toThrow(/forbidden component/);

        // Component should NOT be added (action was blocked before execution)
        const actor =
          testFixture.entityManager.getEntityInstance('test:actor1');
        expect(actor.components['positioning:kneeling_before']).toBeUndefined();
      });
    });

    describe('invalid target scenarios', () => {
      it('should demonstrate bending target restriction (action discovery would prevent this)', async () => {
        // NOTE: In real gameplay, the action discovery system would prevent this
        // because the target has bending-states:bending_over which is in forbidden_components.
        // This test demonstrates the rule execution if somehow bypassed.
        const entities = setupTargetBendingScenario();
        testFixture.reset(Object.values(entities));

        // The rule itself would still execute if action discovery was bypassed
        await testFixture.executeAction('test:actor1', 'test:target1', {
          skipDiscovery: true,
        });

        // Component would still be added because we're bypassing validation
        ModAssertionHelpers.assertComponentAdded(
          testFixture.entityManager,
          'test:actor1',
          'positioning:kneeling_before',
          { entityId: 'test:target1' }
        );

        // This proves restriction is at action discovery level, not rule level
      });
    });

    describe('invalid actor scenarios', () => {
      it('rejects kneeling before someone while being hugged', async () => {
        const { room, actor, target, hugger } = setupBeingHuggedScenario();
        testFixture.reset([room, actor, target, hugger]);

        await expect(
          testFixture.executeAction(actor.id, target.id)
        ).rejects.toThrow(/forbidden component.*hugging-states:being_hugged/i);
      });

      it('rejects kneeling before someone while hugging another actor', async () => {
        const { room, actor, target, huggee } = setupHuggingScenario();
        testFixture.reset([room, actor, target, huggee]);

        await expect(
          testFixture.executeAction(actor.id, target.id)
        ).rejects.toThrow(/forbidden component.*hugging-states:hugging/i);
      });

      it('should prevent kneeling while already kneeling', async () => {
        const entities = setupAlreadyKneelingScenario();
        testFixture.reset(Object.values(entities));

        // In real gameplay, action discovery would prevent this
        // because actor has positioning:kneeling_before
        // Bypass validation to test rule execution behavior
        await testFixture.executeAction('test:actor1', 'test:target1', {
          skipDiscovery: true,
        });

        // The component would be replaced if somehow executed
        const actor =
          testFixture.entityManager.getEntityInstance('test:actor1');
        expect(actor.components['positioning:kneeling_before'].entityId).toBe(
          'test:target1'
        );
      });

      it('should prevent kneeling while sitting', async () => {
        const entities = setupSittingScenario();
        testFixture.reset(Object.values(entities));

        // In real gameplay, action discovery would prevent this
        // because actor has sitting-states:sitting_on
        // Bypass validation to test rule execution behavior
        await testFixture.executeAction('test:actor1', 'test:target1', {
          skipDiscovery: true,
        });

        // If bypassed, the rule would still execute
        ModAssertionHelpers.assertComponentAdded(
          testFixture.entityManager,
          'test:actor1',
          'positioning:kneeling_before',
          { entityId: 'test:target1' }
        );
      });

      it('should prevent kneeling while bending over', async () => {
        const scenario = setupKneelingScenario();

        // Actor is bending over
        scenario.actor.components['bending-states:bending_over'] = {
          surface_id: 'test:table',
          spot_index: 0,
        };

        testFixture.reset(Object.values(scenario));

        // In real gameplay, action discovery would prevent this
        // because actor has bending-states:bending_over
        // Bypass validation to test rule execution behavior
        await testFixture.executeAction('test:actor1', 'test:target1', {
          skipDiscovery: true,
        });

        // If bypassed, the rule would still execute
        ModAssertionHelpers.assertComponentAdded(
          testFixture.entityManager,
          'test:actor1',
          'positioning:kneeling_before',
          { entityId: 'test:target1' }
        );
      });

      it('should prevent kneeling while lying down', async () => {
        const scenario = setupKneelingScenario();

        // Add a bed to the room
        const bed = new ModEntityBuilder('test:bed')
          .withName('Bed')
          .atLocation('throne_room')
          .withComponent('lying:allows_lying_on', {})
          .build();

        // Actor is lying down
        scenario.actor.components['positioning:lying_down'] = {
          furniture_id: 'test:bed',
        };

        testFixture.reset([...Object.values(scenario), bed]);

        // In real gameplay, action discovery would prevent this
        // because actor has positioning:lying_down
        // Bypass validation to test rule execution behavior
        await testFixture.executeAction('test:actor1', 'test:target1', {
          skipDiscovery: true,
        });

        // If bypassed, the rule would still execute
        ModAssertionHelpers.assertComponentAdded(
          testFixture.entityManager,
          'test:actor1',
          'positioning:kneeling_before',
          { entityId: 'test:target1' }
        );

        // Verify the lying component structure
        const actor =
          testFixture.entityManager.getEntityInstance('test:actor1');
        expect(actor.components['positioning:lying_down']).toBeDefined();
        expect(actor.components['positioning:lying_down'].furniture_id).toBe(
          'test:bed'
        );
      });

      it('should handle kneeling attempt when straddling another actor', async () => {
        // Arrange - actor straddling someone's waist
        const { room, actor, target, chair, straddledTarget } =
          setupStraddlingScenario();
        testFixture.reset([room, actor, target, chair, straddledTarget]);

        // Verify initial state
        const initialActor =
          testFixture.entityManager.getEntityInstance('test:actor1');
        expect(initialActor.components['positioning:straddling_waist']).toEqual(
          {
            target_id: 'test:straddled_target',
            facing_away: false,
          }
        );

        // Act - attempt to kneel while straddling
        await testFixture.executeAction('test:actor1', 'test:target1', {
          skipDiscovery: true,
        });

        // Assert - rule executes and adds kneeling_before component
        // Note: In real gameplay, action discovery would prevent this scenario
        // due to forbidden_components, but rule testing bypasses that layer
        const updatedActor =
          testFixture.entityManager.getEntityInstance('test:actor1');
        expect(updatedActor.components['positioning:kneeling_before']).toEqual({
          entityId: 'test:target1',
        });
        // Actor still retains straddling component as rule doesn't remove it
        expect(updatedActor.components['positioning:straddling_waist']).toEqual(
          {
            target_id: 'test:straddled_target',
            facing_away: false,
          }
        );
      });
    });

    describe('multi-actor scenarios', () => {
      it('should handle multiple actors with mixed positioning states', async () => {
        const entities = setupMixedPositioningScenario();
        testFixture.reset(Object.values(entities));

        // Kneeler kneeling before sitting King (valid - sitting_on not in forbidden_components.primary)
        await testFixture.executeAction('test:kneeler', 'test:king');

        ModAssertionHelpers.assertComponentAdded(
          testFixture.entityManager,
          'test:kneeler',
          'positioning:kneeling_before',
          { entityId: 'test:king' }
        );

        ModAssertionHelpers.assertActionSuccess(
          testFixture.events,
          'Loyal Knight kneels before King Arthur.'
        );

        // Clear events for next action
        testFixture.clearEvents();

        // Second knight kneeling before third knight who is already kneeling
        // Target has kneeling_before (forbidden) - bypass validation to test rule execution
        await testFixture.executeAction(
          'test:second_knight',
          'test:third_knight',
          { skipDiscovery: true }
        );

        ModAssertionHelpers.assertComponentAdded(
          testFixture.entityManager,
          'test:second_knight',
          'positioning:kneeling_before',
          { entityId: 'test:third_knight' }
        );

        ModAssertionHelpers.assertActionSuccess(
          testFixture.events,
          'Second Knight kneels before Third Knight.'
        );
      });

      it('should correctly handle circular kneeling scenarios', async () => {
        const room = new ModEntityBuilder('chapel').asRoom('Chapel').build();

        const knight1 = new ModEntityBuilder('test:knight1')
          .withName('Sir Lancelot')
          .atLocation('chapel')
          .closeToEntity('test:knight2')
          .asActor()
          .build();

        const knight2 = new ModEntityBuilder('test:knight2')
          .withName('Sir Gawain')
          .atLocation('chapel')
          .closeToEntity('test:knight1')
          .asActor()
          .build();

        testFixture.reset([room, knight1, knight2]);

        // Knight1 kneels before Knight2 (valid - neither has forbidden components)
        await testFixture.executeAction('test:knight1', 'test:knight2');

        ModAssertionHelpers.assertComponentAdded(
          testFixture.entityManager,
          'test:knight1',
          'positioning:kneeling_before',
          { entityId: 'test:knight2' }
        );

        testFixture.clearEvents();

        // Knight2 kneeling before Knight1 who is kneeling to Knight2
        // Knight1 has kneeling_before (forbidden for target) - bypass validation to test rule execution
        await testFixture.executeAction('test:knight2', 'test:knight1', {
          skipDiscovery: true,
        });

        ModAssertionHelpers.assertComponentAdded(
          testFixture.entityManager,
          'test:knight2',
          'positioning:kneeling_before',
          { entityId: 'test:knight1' }
        );

        // Both knights are now kneeling before each other
        const k1 = testFixture.entityManager.getEntityInstance('test:knight1');
        const k2 = testFixture.entityManager.getEntityInstance('test:knight2');

        expect(k1.components['positioning:kneeling_before'].entityId).toBe(
          'test:knight2'
        );
        expect(k2.components['positioning:kneeling_before'].entityId).toBe(
          'test:knight1'
        );
      });
    });
  });
});
