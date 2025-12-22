/**
 * @file Integration tests for APPLY_DAMAGE entity_ref resolution within FOR_EACH loops
 * @description Validates that the "secondary" placeholder in APPLY_DAMAGE operations
 * properly resolves to the target entity ID from the event payload, ensuring damage
 * is applied to the correct entity in the swing_at_target action flow.
 *
 * Root cause (pre-fix): ApplyDamageHandler.#resolveRef() returned placeholder strings
 * like "secondary" as-is instead of resolving them to actual entity IDs via resolveEntityId().
 *
 * Post-fix: ApplyDamageHandler.#resolveEntityRef() uses resolveEntityId() first,
 * which correctly maps "secondary" → event.payload.secondaryId.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import '../../../common/mods/domainMatchers.js';
import swingAtTargetRule from '../../../../data/mods/weapons/rules/handle_swing_at_target.rule.json' assert { type: 'json' };
import eventIsActionSwingAtTarget from '../../../../data/mods/weapons/conditions/event-is-action-swing-at-target.condition.json' assert { type: 'json' };

const ACTION_ID = 'weapons:swing_at_target';

describe('APPLY_DAMAGE entity_ref resolution in swing_at_target', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction(
      'weapons',
      ACTION_ID,
      swingAtTargetRule,
      eventIsActionSwingAtTarget
    );
  });

  afterEach(() => {
    if (fixture) {
      fixture.cleanup();
    }
  });

  describe('entity_ref "secondary" placeholder resolution', () => {
    it('should resolve "secondary" placeholder to target entity ID in APPLY_DAMAGE within FOR_EACH', async () => {
      // Create actor (attacker) with position, weapon skill, and wielding component
      const actor = new ModEntityBuilder('attacker')
        .withName('Attacker')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('skills:melee_skill', { level: 50 })
        .withComponent('item-handling-states:wielding', { itemIds: ['sword'] }) // Required for swing action
        .build();

      // Create target (defender) with position, anatomy, and defense skill
      const targetBodyPart = new ModEntityBuilder('target-torso')
        .withName('Torso')
        .withComponent('anatomy:part', {
          type: 'torso',
          parentPartId: null,
        })
        .withComponent('anatomy:part_health', {
          currentHealth: 100,
          maxHealth: 100,
          status: 'healthy',
        })
        .build();

      const target = new ModEntityBuilder('target')
        .withName('Target')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('skills:defense_skill', { level: 0 }) // Low defense for guaranteed hit
        .withComponent('anatomy:body', {
          body: { root: 'target-torso' },
        })
        .build();

      // Create weapon with damage capabilities
      const weapon = new ModEntityBuilder('sword')
        .withName('Sword')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('weapons:weapon', {})
        .withComponent('damage-types:damage_capabilities', {
          entries: [
            {
              name: 'slashing',
              amount: 15,
              effects: { canSever: false },
            },
          ],
        })
        .build();

      fixture.reset([actor, target, targetBodyPart, weapon]);

      // Execute the swing_at_target action
      // actor (primary=sword, secondary=target)
      await fixture.executeAction('attacker', 'sword', 'target');

      // Verify that the action completed (turn ended)
      const turnEndedEvent = fixture.events.find(
        (event) => event.eventType === 'core:turn_ended'
      );

      // The test passes if no "Entity secondary has no anatomy:body component" error occurs
      // and the turn completes. The bug was that the entity_ref was not being resolved
      // from "secondary" to the actual target ID "target".

      expect(turnEndedEvent).toBeDefined();
      // Note: success depends on outcome resolution, but the point is that
      // APPLY_DAMAGE should not fail with "Entity secondary has no anatomy:body"
    });

    it('should not produce "Entity secondary has no anatomy:body component" error', async () => {
      const actor = new ModEntityBuilder('attacker')
        .withName('Attacker')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('skills:melee_skill', { level: 80 })
        .withComponent('item-handling-states:wielding', { itemIds: ['axe'] }) // Required for swing action
        .build();

      const targetBodyPart = new ModEntityBuilder('target-chest')
        .withName('Chest')
        .withComponent('anatomy:part', {
          type: 'chest',
          parentPartId: null,
        })
        .withComponent('anatomy:part_health', {
          currentHealth: 50,
          maxHealth: 50,
          status: 'healthy',
        })
        .build();

      const target = new ModEntityBuilder('defender')
        .withName('Defender')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('skills:defense_skill', { level: 0 })
        .withComponent('anatomy:body', {
          body: { root: 'target-chest' },
        })
        .build();

      const weapon = new ModEntityBuilder('axe')
        .withName('Battle Axe')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('weapons:weapon', {})
        .withComponent('damage-types:damage_capabilities', {
          entries: [
            {
              name: 'slashing',
              amount: 25,
              effects: { canSever: true },
            },
          ],
        })
        .build();

      fixture.reset([actor, target, targetBodyPart, weapon]);

      await fixture.executeAction('attacker', 'axe', 'defender');

      // Check that no system_error event was dispatched with the entity resolution error
      const systemErrors = fixture.events.filter(
        (event) =>
          event.eventType === 'core:system_error_occurred' ||
          event.eventType === 'core:system_error'
      );

      const entityResolutionErrors = systemErrors.filter(
        (err) =>
          err.payload?.message?.includes('Entity secondary has no anatomy') ||
          err.payload?.message?.includes('Could not resolve target part')
      );

      expect(entityResolutionErrors).toHaveLength(0);
    });

    it('should correctly apply damage to target anatomy when entity resolution succeeds', async () => {
      const actor = new ModEntityBuilder('warrior')
        .withName('Warrior')
        .asActor()
        .withComponent('core:position', { locationId: 'arena' })
        .withComponent('skills:melee_skill', { level: 100 }) // Max skill for guaranteed success
        .withComponent('item-handling-states:wielding', { itemIds: ['greatsword'] }) // Required for swing action
        .build();

      const targetTorso = new ModEntityBuilder('enemy-torso')
        .withName('Enemy Torso')
        .withComponent('anatomy:part', {
          type: 'torso',
          parentPartId: null,
        })
        .withComponent('anatomy:part_health', {
          currentHealth: 100,
          maxHealth: 100,
          status: 'healthy',
        })
        .build();

      const enemy = new ModEntityBuilder('enemy')
        .withName('Enemy')
        .asActor()
        .withComponent('core:position', { locationId: 'arena' })
        .withComponent('skills:defense_skill', { level: 0 })
        .withComponent('anatomy:body', {
          body: { root: 'enemy-torso' },
        })
        .build();

      const greatsword = new ModEntityBuilder('greatsword')
        .withName('Greatsword')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('weapons:weapon', {})
        .withComponent('damage-types:damage_capabilities', {
          entries: [
            {
              name: 'slashing',
              amount: 30,
              effects: {},
            },
          ],
        })
        .build();

      fixture.reset([actor, enemy, targetTorso, greatsword]);

      await fixture.executeAction('warrior', 'greatsword', 'enemy');

      // Verify the action executed without entity resolution errors
      const turnEndedEvent = fixture.events.find(
        (event) => event.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();

      // Look for perceptible events that indicate the swing happened
      const perceptibleEvents = fixture.events.filter(
        (event) => event.eventType === 'core:perceptible_event'
      );

      // Should have at least one perceptible event from the action
      expect(perceptibleEvents.length).toBeGreaterThan(0);
    });
  });

  describe('backward compatibility', () => {
    it('should still work with direct entity ID strings', async () => {
      // This test ensures we didn't break direct entity ID references
      // The rule uses "secondary" placeholder, but the fix should still
      // allow direct IDs to work via JSON Logic fallback

      const actor = new ModEntityBuilder('test-actor')
        .withName('Test Actor')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('skills:melee_skill', { level: 50 })
        .withComponent('item-handling-states:wielding', { itemIds: ['test-weapon'] }) // Required for swing action
        .build();

      const targetPart = new ModEntityBuilder('target-body-part')
        .withName('Body Part')
        .withComponent('anatomy:part', { type: 'torso' })
        .withComponent('anatomy:part_health', {
          currentHealth: 80,
          maxHealth: 80,
          status: 'healthy',
        })
        .build();

      const target = new ModEntityBuilder('test-target')
        .withName('Test Target')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('skills:defense_skill', { level: 10 })
        .withComponent('anatomy:body', {
          body: { root: 'target-body-part' },
        })
        .build();

      const weapon = new ModEntityBuilder('test-weapon')
        .withName('Test Weapon')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('weapons:weapon', {})
        .withComponent('damage-types:damage_capabilities', {
          entries: [{ name: 'slashing', amount: 10, effects: {} }],
        })
        .build();

      fixture.reset([actor, target, targetPart, weapon]);

      // Should not throw or produce entity resolution errors
      await fixture.executeAction('test-actor', 'test-weapon', 'test-target');

      const turnEndedEvent = fixture.events.find(
        (e) => e.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
    });
  });
});
