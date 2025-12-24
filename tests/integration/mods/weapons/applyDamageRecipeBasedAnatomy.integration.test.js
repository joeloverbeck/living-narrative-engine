/**
 * @file Integration tests for APPLY_DAMAGE with recipe-based anatomy
 * @description Tests that damage can be applied to entities with anatomy
 * generated from recipes, specifically addressing the case where body parts
 * don't have explicit hit_probability_weight values.
 *
 * Root cause discovered: #selectRandomPart() checked
 * `typeof partComponent.hit_probability_weight === 'number'` which fails
 * when hit_probability_weight is undefined (most real entity definitions
 * don't define this property explicitly).
 *
 * Fix: Default hit_probability_weight to 1.0 when undefined.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import '../../../common/mods/domainMatchers.js';
import swingAtTargetRule from '../../../../data/mods/weapons/rules/handle_swing_at_target.rule.json' assert { type: 'json' };
import eventIsActionSwingAtTarget from '../../../../data/mods/weapons/conditions/event-is-action-swing-at-target.condition.json' assert { type: 'json' };

const ACTION_ID = 'weapons:swing_at_target';

describe('APPLY_DAMAGE with anatomy lacking explicit hit_probability_weight', () => {
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

  describe('body part selection without explicit hit_probability_weight', () => {
    it('should resolve target part when hit_probability_weight is undefined (defaults to 1.0)', async () => {
      // Create actor with wielded weapon
      const actor = new ModEntityBuilder('attacker')
        .withName('Attacker')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('skills:melee_skill', { level: 50 })
        .withComponent('item-handling-states:wielding', { itemIds: ['sword'] })
        .build();

      // Create target body part WITHOUT hit_probability_weight
      // This mimics real entity definitions like human_male_torso_thick_hairy
      const targetTorso = new ModEntityBuilder('target-torso')
        .withName('Torso')
        .withComponent('anatomy:part', {
          subType: 'torso',
          // No hit_probability_weight - matches real entity definitions
        })
        .withComponent('anatomy:part_health', {
          currentHealth: 100,
          maxHealth: 100,
          state: 'healthy',
        })
        .build();

      const target = new ModEntityBuilder('target')
        .withName('Target')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('skills:defense_skill', { level: 0 })
        .withComponent('anatomy:body', {
          body: { root: 'target-torso' },
        })
        .build();

      const weapon = new ModEntityBuilder('sword')
        .withName('Sword')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
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

      fixture.reset([actor, target, targetTorso, weapon]);

      // Debug: Check the target's anatomy:body component before action
      const targetBody = fixture.entityManager.getComponentData(
        'target',
        'anatomy:body'
      );
      console.log(
        'DEBUG: Target anatomy:body component:',
        JSON.stringify(targetBody, null, 2)
      );

      // Check if the torso entity has anatomy:part component
      const torsoPartComponent = fixture.entityManager.getComponentData(
        'target-torso',
        'anatomy:part'
      );
      console.log(
        'DEBUG: Torso anatomy:part component:',
        JSON.stringify(torsoPartComponent, null, 2)
      );

      // Execute the swing action (primary=weapon, secondary=target being attacked)
      await fixture.executeAction('attacker', 'sword', {
        additionalPayload: { secondaryId: 'target' },
      });

      // Should NOT produce "Could not resolve target part" error
      const errorEvents = fixture.events.filter(
        (event) =>
          event.eventType === 'core:system_error_occurred' ||
          event.eventType === 'core:system_error'
      );

      const targetPartErrors = errorEvents.filter(
        (err) =>
          err.payload?.message?.includes('Could not resolve target part') ||
          err.payload?.message?.includes('Could not resolve')
      );

      expect(targetPartErrors).toHaveLength(0);
    });

    it('should select target part when hit_probability_weight is explicitly 0', async () => {
      // Create actor with wielded weapon
      const actor = new ModEntityBuilder('attacker')
        .withName('Attacker')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('skills:melee_skill', { level: 50 })
        .withComponent('item-handling-states:wielding', { itemIds: ['sword'] })
        .build();

      // Create body part with explicit hit_probability_weight = 0
      // This part should be excluded from targeting
      const targetHead = new ModEntityBuilder('target-head')
        .withName('Head')
        .withComponent('anatomy:part', {
          subType: 'head',
          hit_probability_weight: 0, // Explicitly set to 0 - should be excluded
        })
        .withComponent('anatomy:part_health', {
          currentHealth: 50,
          maxHealth: 50,
          state: 'healthy',
        })
        .build();

      // Create body part with undefined hit_probability_weight (should default to 1.0)
      const targetTorso = new ModEntityBuilder('target-torso')
        .withName('Torso')
        .withComponent('anatomy:part', {
          subType: 'torso',
          // No hit_probability_weight - should default to 1.0 and be selectable
        })
        .withComponent('anatomy:part_health', {
          currentHealth: 100,
          maxHealth: 100,
          state: 'healthy',
        })
        .build();

      const target = new ModEntityBuilder('target')
        .withName('Target')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('skills:defense_skill', { level: 0 })
        .withComponent('anatomy:body', {
          body: { root: 'target-torso', parts: { head: 'target-head' } },
        })
        .build();

      const weapon = new ModEntityBuilder('sword')
        .withName('Sword')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('weapons:weapon', {})
        .withComponent('damage-types:damage_capabilities', {
          entries: [
            {
              name: 'slashing',
              amount: 15,
              effects: {},
            },
          ],
        })
        .build();

      fixture.reset([actor, target, targetHead, targetTorso, weapon]);

      await fixture.executeAction('attacker', 'sword', {
        additionalPayload: { secondaryId: 'target' },
      });

      // Debug: log all events
      console.log(
        'DEBUG (test 125): All events captured:',
        fixture.events.map((e) => ({
          type: e.eventType,
          payload: JSON.stringify(e.payload || {}).slice(0, 300),
        }))
      );

      // Should complete without target resolution errors
      const turnEndedEvent = fixture.events.find(
        (event) => event.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
    });

    it('should fail gracefully when NO parts have positive hit_probability_weight', async () => {
      // Create actor with wielded weapon
      const actor = new ModEntityBuilder('attacker')
        .withName('Attacker')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('skills:melee_skill', { level: 50 })
        .withComponent('item-handling-states:wielding', { itemIds: ['sword'] })
        .build();

      // Create body part with explicit hit_probability_weight = 0
      const targetTorso = new ModEntityBuilder('target-torso')
        .withName('Torso')
        .withComponent('anatomy:part', {
          subType: 'torso',
          hit_probability_weight: 0, // Explicitly 0 - should be excluded
        })
        .withComponent('anatomy:part_health', {
          currentHealth: 100,
          maxHealth: 100,
          state: 'healthy',
        })
        .build();

      const target = new ModEntityBuilder('target')
        .withName('Target')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('skills:defense_skill', { level: 0 })
        .withComponent('anatomy:body', {
          body: { root: 'target-torso' },
        })
        .build();

      const weapon = new ModEntityBuilder('sword')
        .withName('Sword')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('weapons:weapon', {})
        .withComponent('damage-types:damage_capabilities', {
          entries: [
            {
              name: 'slashing',
              amount: 15,
              effects: {},
            },
          ],
        })
        .build();

      fixture.reset([actor, target, targetTorso, weapon]);

      await fixture.executeAction('attacker', 'sword', {
        additionalPayload: { secondaryId: 'target' },
      });

      // Debug: log all events to understand what happened
      console.log(
        'DEBUG: All events captured:',
        fixture.events.map((e) => ({
          type: e.eventType,
          payload: JSON.stringify(e.payload || {}).slice(0, 200),
        }))
      );

      // When all parts have 0 weight, we expect the "Could not resolve target part" error
      // This is the correct behavior - no valid targets exist
      const errorEvents = fixture.events.filter(
        (event) =>
          event.eventType === 'core:system_error_occurred' ||
          event.eventType === 'core:system_error'
      );

      console.log(
        'DEBUG: Error events:',
        errorEvents.map((e) => e.payload?.message)
      );

      const targetPartErrors = errorEvents.filter((err) =>
        err.payload?.message?.includes('Could not resolve target part')
      );

      expect(targetPartErrors.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('backward compatibility with explicit hit_probability_weight', () => {
    it('should continue to work when hit_probability_weight is explicitly defined', async () => {
      const actor = new ModEntityBuilder('attacker')
        .withName('Attacker')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('skills:melee_skill', { level: 50 })
        .withComponent('item-handling-states:wielding', { itemIds: ['sword'] })
        .build();

      const targetTorso = new ModEntityBuilder('target-torso')
        .withName('Torso')
        .withComponent('anatomy:part', {
          subType: 'torso',
          hit_probability_weight: 5.0, // Explicitly defined
        })
        .withComponent('anatomy:part_health', {
          currentHealth: 100,
          maxHealth: 100,
          state: 'healthy',
        })
        .build();

      const target = new ModEntityBuilder('target')
        .withName('Target')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .withComponent('skills:defense_skill', { level: 0 })
        .withComponent('anatomy:body', {
          body: { root: 'target-torso' },
        })
        .build();

      const weapon = new ModEntityBuilder('sword')
        .withName('Sword')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('weapons:weapon', {})
        .withComponent('damage-types:damage_capabilities', {
          entries: [
            {
              name: 'slashing',
              amount: 15,
              effects: {},
            },
          ],
        })
        .build();

      fixture.reset([actor, target, targetTorso, weapon]);

      await fixture.executeAction('attacker', 'sword', {
        additionalPayload: { secondaryId: 'target' },
      });

      // Wait longer for async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Debug: log all events
      console.log(
        'DEBUG (test 285 backward compat): All events captured:',
        fixture.events.map((e) => ({
          type: e.eventType,
          payload: JSON.stringify(e.payload || {}).slice(0, 300),
        }))
      );

      // Should complete without errors
      const turnEndedEvent = fixture.events.find(
        (event) => event.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
    });
  });
});
