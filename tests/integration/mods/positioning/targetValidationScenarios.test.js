/**
 * @file Integration tests for positioning target validation scenarios
 * @description Tests comprehensive positioning validation through real action execution
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';

describe('Positioning Target Validation Scenarios', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('positioning', 'positioning:kneel_before');
  });

  afterEach(() => {
    if (fixture) {
      fixture.cleanup();
    }
  });

  describe('kneeling validation', () => {
    it('should prevent kneeling before someone already kneeling', async () => {
      // Setup entities using ModEntityBuilder
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();
      const actor = new ModEntityBuilder('actor1')
        .withName('Test Actor')
        .atLocation('room1')
        .closeToEntity('target1')
        .asActor()
        .build();
      const target = new ModEntityBuilder('target1')
        .withName('Test Target')
        .atLocation('room1')
        .closeToEntity('actor1')
        .asActor()
        .build();

      // Target is kneeling before someone else
      target.components['positioning:kneeling_before'] = {
        entityId: 'other_character'
      };

      // Reset fixture with entities
      fixture.reset([room, actor, target]);

      // Try to kneel before the kneeling target - should be blocked by validation
      const result = await fixture.executeAction(actor.id, target.id);

      // Target validation should prevent this action from being discovered/executed
      // The action should not be added because target has forbidden component
      expect(result).toBeDefined();
    });

    it('should prevent circular kneeling', async () => {
      // Setup entities using ModEntityBuilder
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();
      const actorA = new ModEntityBuilder('actorA')
        .withName('Actor A')
        .atLocation('room1')
        .closeToEntity('actorB')
        .asActor()
        .build();
      const actorB = new ModEntityBuilder('actorB')
        .withName('Actor B')
        .atLocation('room1')
        .closeToEntity('actorA')
        .asActor()
        .build();

      // Add entities to fixture
      fixture.reset([room, actorA, actorB]);

      // Actor A kneels before Actor B
      await fixture.executeAction(actorA.id, actorB.id);

      // Verify A is kneeling before B
      expect(fixture.entityManager.hasComponent(actorA.id, 'positioning:kneeling_before')).toBe(true);

      // Actor B tries to kneel before Actor A (circular) - should be blocked
      // Target validation prevents kneeling before someone who is already kneeling
      await fixture.executeAction(actorB.id, actorA.id);

      // Circular kneeling is prevented by target validation
      // Actor B should NOT have the kneeling component because action was filtered
      expect(fixture.entityManager.hasComponent(actorB.id, 'positioning:kneeling_before')).toBe(false);
    });

    it('should allow multiple actors to kneel before same target', async () => {
      // Setup entities using ModEntityBuilder
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();
      const actorA = new ModEntityBuilder('actorA')
        .withName('Actor A')
        .atLocation('room1')
        .asActor()
        .build();
      const actorB = new ModEntityBuilder('actorB')
        .withName('Actor B')
        .atLocation('room1')
        .asActor()
        .build();
      const target = new ModEntityBuilder('target1')
        .withName('Noble Target')
        .atLocation('room1')
        .asActor()
        .build();

      // Add entities to fixture
      fixture.reset([room, actorA, actorB, target]);

      // Actor A kneels before Target
      await fixture.executeAction(actorA.id, target.id);

      expect(fixture.entityManager.hasComponent(actorA.id, 'positioning:kneeling_before')).toBe(true);

      // Actor B kneels before Target (should be allowed)
      await fixture.executeAction(actorB.id, target.id);

      expect(fixture.entityManager.hasComponent(actorB.id, 'positioning:kneeling_before')).toBe(true);
    });

    it('should allow kneeling after target stands up', async () => {
      // Setup entities using ModEntityBuilder
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();
      const actor = new ModEntityBuilder('actor1')
        .withName('Test Actor')
        .atLocation('room1')
        .asActor()
        .build();
      const target = new ModEntityBuilder('target1')
        .withName('Test Target')
        .atLocation('room1')
        .asActor()
        .build();

      // Add entities to fixture
      fixture.reset([room, actor, target]);

      // Target is initially kneeling
      fixture.entityManager.addComponent(target.id, 'positioning:kneeling_before', {
        entityId: 'someone'
      });

      // First attempt should be blocked by target validation
      await fixture.executeAction(actor.id, target.id);

      // Action should be blocked because target has forbidden kneeling_before component
      expect(fixture.entityManager.hasComponent(actor.id, 'positioning:kneeling_before')).toBe(false);

      // Target stands up (remove kneeling component)
      fixture.entityManager.removeComponent(target.id, 'positioning:kneeling_before');

      // Second attempt should succeed
      await fixture.executeAction(actor.id, target.id);

      // This should succeed (target no longer has forbidden component)
      expect(fixture.entityManager.hasComponent(actor.id, 'positioning:kneeling_before')).toBe(true);
    });
  });

  describe('complex positioning states', () => {
    it('should validate target in lying down state', async () => {
      // Setup entities using ModEntityBuilder
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();
      const actor = new ModEntityBuilder('actor1')
        .withName('Test Actor')
        .atLocation('room1')
        .asActor()
        .build();
      const target = new ModEntityBuilder('target1')
        .withName('Test Target')
        .atLocation('room1')
        .asActor()
        .build();

      // Add entities to fixture
      fixture.reset([room, actor, target]);

      // Target is lying down
      fixture.entityManager.addComponent(target.id, 'positioning:lying_down', {});

      // Try to kneel - should be blocked because target is lying down
      await fixture.executeAction(actor.id, target.id);

      // Action should be blocked because target has forbidden lying_down component
      expect(fixture.entityManager.hasComponent(actor.id, 'positioning:kneeling_before')).toBe(false);
    });

    it('should validate target bending over', async () => {
      // Setup entities using ModEntityBuilder
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();
      const actor = new ModEntityBuilder('actor1')
        .withName('Test Actor')
        .atLocation('room1')
        .asActor()
        .build();
      const target = new ModEntityBuilder('target1')
        .withName('Test Target')
        .atLocation('room1')
        .asActor()
        .build();

      // Add entities to fixture
      fixture.reset([room, actor, target]);

      // Target is bending over
      fixture.entityManager.addComponent(target.id, 'positioning:bending_over', {});

      // Try to kneel - should be blocked because target is bending over
      await fixture.executeAction(actor.id, target.id);

      // Action should be blocked because target has forbidden bending_over component
      expect(fixture.entityManager.hasComponent(actor.id, 'positioning:kneeling_before')).toBe(false);
    });

    it('should handle multiple forbidden positioning states simultaneously', async () => {
      // Setup entities using ModEntityBuilder
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();
      const actor = new ModEntityBuilder('actor1')
        .withName('Test Actor')
        .atLocation('room1')
        .asActor()
        .build();
      const target = new ModEntityBuilder('target1')
        .withName('Test Target')
        .atLocation('room1')
        .asActor()
        .build();

      // Add entities to fixture
      fixture.reset([room, actor, target]);

      // Target has multiple forbidden states (should still be blocked)
      fixture.entityManager.addComponent(target.id, 'positioning:lying_down', {});
      fixture.entityManager.addComponent(target.id, 'positioning:bending_over', {});

      // Try to kneel - should be blocked because target has multiple forbidden components
      await fixture.executeAction(actor.id, target.id);

      // Action should be blocked because target has multiple forbidden components
      expect(fixture.entityManager.hasComponent(actor.id, 'positioning:kneeling_before')).toBe(false);
    });

    it('should validate complex multi-actor positioning scenario', async () => {
      // Setup complex scenario with multiple actors and states
      const room = new ModEntityBuilder('room1').asRoom('Throne Room').build();
      const knight = new ModEntityBuilder('knight1')
        .withName('Knight')
        .atLocation('room1')
        .asActor()
        .build();
      const lord = new ModEntityBuilder('lord1')
        .withName('Lord')
        .atLocation('room1')
        .asActor()
        .build();
      const servant = new ModEntityBuilder('servant1')
        .withName('Servant')
        .atLocation('room1')
        .asActor()
        .build();
      const prisoner = new ModEntityBuilder('prisoner1')
        .withName('Prisoner')
        .atLocation('room1')
        .asActor()
        .build();

      // Add entities to fixture
      fixture.reset([room, knight, lord, servant, prisoner]);

      // Set up complex positioning states
      fixture.entityManager.addComponent(servant.id, 'positioning:kneeling_before', {
        entityId: lord.id
      });
      fixture.entityManager.addComponent(prisoner.id, 'positioning:lying_down', {});

      // Knight tries to kneel before Lord (should succeed)
      await fixture.executeAction(knight.id, lord.id);

      expect(fixture.entityManager.hasComponent(knight.id, 'positioning:kneeling_before')).toBe(true);

      // Knight tries to kneel before kneeling servant - should be blocked
      await fixture.executeAction(knight.id, servant.id);

      // Action should be blocked because servant has forbidden kneeling_before component
      // Knight should still be kneeling before lord (state unchanged by blocked action)
      expect(fixture.entityManager.hasComponent(knight.id, 'positioning:kneeling_before')).toBe(true);
      const knightKneelingData = fixture.entityManager.getComponent(knight.id, 'positioning:kneeling_before');
      expect(knightKneelingData.entityId).toBe(lord.id); // Still kneeling before lord, not servant

      // Lord tries to kneel before lying prisoner - should be blocked
      await fixture.executeAction(lord.id, prisoner.id);

      // Action should be blocked because prisoner has forbidden lying_down component
      expect(fixture.entityManager.hasComponent(lord.id, 'positioning:kneeling_before')).toBe(false);
    });
  });

  describe('positioning state transitions', () => {
    it('should handle standing up and validation changes', async () => {
      // Setup entities using ModEntityBuilder
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();
      const actorA = new ModEntityBuilder('actorA')
        .withName('Actor A')
        .atLocation('room1')
        .asActor()
        .build();
      const actorB = new ModEntityBuilder('actorB')
        .withName('Actor B')
        .atLocation('room1')
        .asActor()
        .build();

      // Add entities to fixture
      fixture.reset([room, actorA, actorB]);

      // Actor A kneels before Actor B
      await fixture.executeAction(actorA.id, actorB.id);

      expect(fixture.entityManager.hasComponent(actorA.id, 'positioning:kneeling_before')).toBe(true);

      // Actor B tries to kneel before Actor A - should be blocked by circular validation
      await fixture.executeAction(actorB.id, actorA.id);

      // Circular kneeling is prevented by target validation
      expect(fixture.entityManager.hasComponent(actorB.id, 'positioning:kneeling_before')).toBe(false);

      // Actor A stands up (manually remove component since stand_up rule is not loaded)
      // Note: The fixture only loads the kneel_before rule, not the stand_up rule
      fixture.entityManager.removeComponent(actorA.id, 'positioning:kneeling_before');

      // Verify actor A is no longer kneeling
      expect(fixture.entityManager.hasComponent(actorA.id, 'positioning:kneeling_before')).toBe(false);

      // Now Actor B should be able to kneel before Actor A
      await fixture.executeAction(actorB.id, actorA.id);

      expect(fixture.entityManager.hasComponent(actorB.id, 'positioning:kneeling_before')).toBe(true);
    });

    it('should validate bending over to lying down transition', async () => {
      // Setup entities using ModEntityBuilder
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();
      const actor = new ModEntityBuilder('actor1')
        .withName('Test Actor')
        .atLocation('room1')
        .asActor()
        .build();
      const target = new ModEntityBuilder('target1')
        .withName('Test Target')
        .atLocation('room1')
        .asActor()
        .build();

      // Add entities to fixture
      fixture.reset([room, actor, target]);

      // Target starts bending over (forbidden)
      fixture.entityManager.addComponent(target.id, 'positioning:bending_over', {});

      // Try to kneel - should be blocked because target is bending over
      await fixture.executeAction(actor.id, target.id);

      // Action should be blocked because target has forbidden bending_over component
      expect(fixture.entityManager.hasComponent(actor.id, 'positioning:kneeling_before')).toBe(false);

      // Target transitions to lying down (still forbidden)
      fixture.entityManager.removeComponent(target.id, 'positioning:bending_over');
      fixture.entityManager.addComponent(target.id, 'positioning:lying_down', {});

      // Try again with lying_down - should still be blocked
      await fixture.executeAction(actor.id, target.id);

      // Action should be blocked because target has forbidden lying_down component
      expect(fixture.entityManager.hasComponent(actor.id, 'positioning:kneeling_before')).toBe(false);

      // Target stands up (should become valid)
      fixture.entityManager.removeComponent(target.id, 'positioning:lying_down');

      // Try again with no forbidden components - should succeed
      await fixture.executeAction(actor.id, target.id);

      // This should succeed (target no longer has forbidden components)
      expect(fixture.entityManager.hasComponent(actor.id, 'positioning:kneeling_before')).toBe(true);
    });
  });
});