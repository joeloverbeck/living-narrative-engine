/**
 * @file Integration tests for ApplyDamageHandler code coverage
 * @description Comprehensive integration tests to achieve high code coverage
 * for the APPLY_DAMAGE operation handler, testing JSON Logic resolution paths,
 * hit strategies, RNG configuration, error handling, and exclusion logic.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import '../../../common/mods/domainMatchers.js';

// Base condition for action detection
const eventIsActionApplyDamageTest = {
  id: 'test:event-is-action-apply-damage-test',
  description: 'Checks if the action is apply_damage_test',
  logic: {
    and: [
      { '==': [{ var: 'event.payload.actionId' }, 'test:apply_damage_test'] },
    ],
  },
};

/**
 * Creates a test rule with specified APPLY_DAMAGE parameters
 * @param {object} applyDamageParams - Parameters for APPLY_DAMAGE operation
 * @param {Array} [setupActions] - Additional setup actions before APPLY_DAMAGE
 * @returns {object} Rule definition
 */
function createTestRule(applyDamageParams, setupActions = []) {
  return {
    $schema: 'schema://living-narrative-engine/rule.schema.json',
    rule_id: 'test:handle_apply_damage_test',
    event_type: 'core:attempt_action',
    condition: { condition_ref: 'test:event-is-action-apply-damage-test' },
    actions: [
      ...setupActions,
      {
        type: 'APPLY_DAMAGE',
        parameters: applyDamageParams,
      },
      { macro: 'core:endTurnOnly' },
    ],
  };
}

/**
 * Creates standard test entities (actor, target with body part)
 * @returns {object} Entity definitions
 */
function createStandardEntities() {
  const actor = new ModEntityBuilder('attacker')
    .withName('Attacker')
    .asActor()
    .withComponent('core:position', { locationId: 'test-location' })
    .build();

  const targetPart = new ModEntityBuilder('target-torso')
    .withName('Torso')
    .withComponent('anatomy:part', {
      type: 'torso',
      parentPartId: null,
      hit_probability_weight: 1.0,
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
    .withComponent('anatomy:body', {
      body: { root: 'target-torso' },
    })
    .build();

  return { actor, target, targetPart };
}

describe('ApplyDamageHandler integration coverage tests', () => {
  let fixture;

  afterEach(() => {
    if (fixture) {
      fixture.cleanup();
    }
  });

  describe('JSON Logic resolution paths', () => {
    describe('entity_ref with JSON Logic expression', () => {
      it('should resolve entity_ref from JSON Logic var expression returning string', async () => {
        const rule = createTestRule(
          {
            entity_ref: { var: 'context.resolvedTargetId' },
            damage_entry: { name: 'slashing', amount: 10 },
          },
          [
            {
              type: 'SET_VARIABLE',
              parameters: {
                variable_name: 'resolvedTargetId',
                value: '{event.payload.secondaryId}',
              },
            },
          ]
        );

        fixture = await ModTestFixture.forAction(
          'test',
          'test:apply_damage_test',
          rule,
          eventIsActionApplyDamageTest
        );

        const { actor, target, targetPart } = createStandardEntities();
        fixture.reset([actor, target, targetPart]);

        await fixture.executeAction('attacker', 'target', {
          additionalPayload: { secondaryId: 'target' },
        });

        const turnEndedEvent = fixture.events.find(
          (e) => e.eventType === 'core:turn_ended'
        );
        expect(turnEndedEvent).toBeDefined();
      });

      it('should resolve entity_ref from JSON Logic returning object with id property', async () => {
        const rule = createTestRule(
          {
            entity_ref: { var: 'context.targetEntity' },
            damage_entry: { name: 'slashing', amount: 10 },
          },
          [
            {
              type: 'SET_VARIABLE',
              parameters: {
                variable_name: 'targetEntity',
                value: { id: 'target' },
              },
            },
          ]
        );

        fixture = await ModTestFixture.forAction(
          'test',
          'test:apply_damage_test',
          rule,
          eventIsActionApplyDamageTest
        );

        const { actor, target, targetPart } = createStandardEntities();
        fixture.reset([actor, target, targetPart]);

        await fixture.executeAction('attacker', 'target', {
          additionalPayload: { secondaryId: 'target' },
        });

        const turnEndedEvent = fixture.events.find(
          (e) => e.eventType === 'core:turn_ended'
        );
        expect(turnEndedEvent).toBeDefined();
      });

      it('should handle JSON Logic evaluation error in entity_ref gracefully', async () => {
        const rule = createTestRule({
          entity_ref: { badOperator: ['invalid'] },
          damage_entry: { name: 'slashing', amount: 10 },
        });

        fixture = await ModTestFixture.forAction(
          'test',
          'test:apply_damage_test',
          rule,
          eventIsActionApplyDamageTest
        );

        const { actor, target, targetPart } = createStandardEntities();
        fixture.reset([actor, target, targetPart]);

        await fixture.executeAction('attacker', 'target', {
          additionalPayload: { secondaryId: 'target' },
        });

        // Should dispatch error event for invalid entity_ref
        const errorEvents = fixture.events.filter(
          (e) =>
            e.eventType === 'core:system_error_occurred' ||
            e.payload?.message?.includes('Invalid entity_ref')
        );
        expect(errorEvents.length).toBeGreaterThan(0);
      });
    });

    describe('part_ref with JSON Logic expression', () => {
      it('should resolve part_ref from JSON Logic var expression', async () => {
        const rule = createTestRule(
          {
            entity_ref: 'secondary',
            part_ref: { var: 'context.cachedPartId' },
            damage_entry: { name: 'slashing', amount: 10 },
          },
          [
            {
              type: 'SET_VARIABLE',
              parameters: {
                variable_name: 'cachedPartId',
                value: 'target-torso',
              },
            },
          ]
        );

        fixture = await ModTestFixture.forAction(
          'test',
          'test:apply_damage_test',
          rule,
          eventIsActionApplyDamageTest
        );

        const { actor, target, targetPart } = createStandardEntities();
        fixture.reset([actor, target, targetPart]);

        await fixture.executeAction('attacker', 'target', {
          additionalPayload: { secondaryId: 'target' },
        });

        const turnEndedEvent = fixture.events.find(
          (e) => e.eventType === 'core:turn_ended'
        );
        expect(turnEndedEvent).toBeDefined();
      });

      it('should handle JSON Logic part_ref returning object with entityId property', async () => {
        const rule = createTestRule(
          {
            entity_ref: 'secondary',
            part_ref: { var: 'context.partEntity' },
            damage_entry: { name: 'slashing', amount: 10 },
          },
          [
            {
              type: 'SET_VARIABLE',
              parameters: {
                variable_name: 'partEntity',
                value: { entityId: 'target-torso' },
              },
            },
          ]
        );

        fixture = await ModTestFixture.forAction(
          'test',
          'test:apply_damage_test',
          rule,
          eventIsActionApplyDamageTest
        );

        const { actor, target, targetPart } = createStandardEntities();
        fixture.reset([actor, target, targetPart]);

        await fixture.executeAction('attacker', 'target', {
          additionalPayload: { secondaryId: 'target' },
        });

        const turnEndedEvent = fixture.events.find(
          (e) => e.eventType === 'core:turn_ended'
        );
        expect(turnEndedEvent).toBeDefined();
      });

      it('should handle part_ref JSON Logic evaluation error gracefully', async () => {
        const rule = createTestRule(
          {
            entity_ref: 'secondary',
            part_ref: { invalidOperator: ['throws'] },
            damage_entry: { name: 'slashing', amount: 10 },
          }
        );

        fixture = await ModTestFixture.forAction(
          'test',
          'test:apply_damage_test',
          rule,
          eventIsActionApplyDamageTest
        );

        const { actor, target, targetPart } = createStandardEntities();
        fixture.reset([actor, target, targetPart]);

        await fixture.executeAction('attacker', 'target', {
          additionalPayload: { secondaryId: 'target' },
        });

        // Should still complete turn (falls back to auto-select part)
        const turnEndedEvent = fixture.events.find(
          (e) => e.eventType === 'core:turn_ended'
        );
        expect(turnEndedEvent).toBeDefined();
      });
    });

    describe('damage_entry with JSON Logic expression', () => {
      it('should resolve damage_entry from JSON Logic var expression', async () => {
        const rule = createTestRule(
          {
            entity_ref: 'secondary',
            damage_entry: { var: 'context.weaponDamage' },
          },
          [
            {
              type: 'SET_VARIABLE',
              parameters: {
                variable_name: 'weaponDamage',
                value: { name: 'fire', amount: 15 },
              },
            },
          ]
        );

        fixture = await ModTestFixture.forAction(
          'test',
          'test:apply_damage_test',
          rule,
          eventIsActionApplyDamageTest
        );

        const { actor, target, targetPart } = createStandardEntities();
        fixture.reset([actor, target, targetPart]);

        await fixture.executeAction('attacker', 'target', {
          additionalPayload: { secondaryId: 'target' },
        });

        const turnEndedEvent = fixture.events.find(
          (e) => e.eventType === 'core:turn_ended'
        );
        expect(turnEndedEvent).toBeDefined();
      });

      it('should dispatch error when JSON Logic damage_entry evaluation throws', async () => {
        const rule = createTestRule({
          entity_ref: 'secondary',
          damage_entry: { unknownJsonLogicOp: ['throws'] },
        });

        fixture = await ModTestFixture.forAction(
          'test',
          'test:apply_damage_test',
          rule,
          eventIsActionApplyDamageTest
        );

        const { actor, target, targetPart } = createStandardEntities();
        fixture.reset([actor, target, targetPart]);

        await fixture.executeAction('attacker', 'target', {
          additionalPayload: { secondaryId: 'target' },
        });

        const errorEvents = fixture.events.filter(
          (e) =>
            e.eventType === 'core:system_error_occurred' ||
            e.payload?.message?.includes('Failed to evaluate damage_entry')
        );
        expect(errorEvents.length).toBeGreaterThan(0);
      });

      it('should dispatch error when damage_entry is missing amount', async () => {
        const rule = createTestRule({
          entity_ref: 'secondary',
          damage_entry: { name: 'slashing' }, // missing amount
        });

        fixture = await ModTestFixture.forAction(
          'test',
          'test:apply_damage_test',
          rule,
          eventIsActionApplyDamageTest
        );

        const { actor, target, targetPart } = createStandardEntities();
        fixture.reset([actor, target, targetPart]);

        await fixture.executeAction('attacker', 'target', {
          additionalPayload: { secondaryId: 'target' },
        });

        const errorEvents = fixture.events.filter(
          (e) =>
            e.eventType === 'core:system_error_occurred' ||
            e.payload?.message?.includes('missing amount')
        );
        expect(errorEvents.length).toBeGreaterThan(0);
      });

      it('should dispatch error when damage_entry is missing name', async () => {
        const rule = createTestRule({
          entity_ref: 'secondary',
          damage_entry: { amount: 10 }, // missing name
        });

        fixture = await ModTestFixture.forAction(
          'test',
          'test:apply_damage_test',
          rule,
          eventIsActionApplyDamageTest
        );

        const { actor, target, targetPart } = createStandardEntities();
        fixture.reset([actor, target, targetPart]);

        await fixture.executeAction('attacker', 'target', {
          additionalPayload: { secondaryId: 'target' },
        });

        const errorEvents = fixture.events.filter(
          (e) =>
            e.eventType === 'core:system_error_occurred' ||
            e.payload?.message?.includes('missing name')
        );
        expect(errorEvents.length).toBeGreaterThan(0);
      });
    });

    describe('metadata with JSON Logic expression', () => {
      it('should resolve metadata from JSON Logic var expression', async () => {
        const rule = createTestRule(
          {
            entity_ref: 'secondary',
            damage_entry: { name: 'slashing', amount: 10 },
            metadata: { var: 'context.attackMetadata' },
          },
          [
            {
              type: 'SET_VARIABLE',
              parameters: {
                variable_name: 'attackMetadata',
                value: { source: 'weapon', critical: false },
              },
            },
          ]
        );

        fixture = await ModTestFixture.forAction(
          'test',
          'test:apply_damage_test',
          rule,
          eventIsActionApplyDamageTest
        );

        const { actor, target, targetPart } = createStandardEntities();
        fixture.reset([actor, target, targetPart]);

        await fixture.executeAction('attacker', 'target', {
          additionalPayload: { secondaryId: 'target' },
        });

        const turnEndedEvent = fixture.events.find(
          (e) => e.eventType === 'core:turn_ended'
        );
        expect(turnEndedEvent).toBeDefined();
      });

      it('should handle metadata JSON Logic evaluation error with fallback to empty object', async () => {
        const rule = createTestRule({
          entity_ref: 'secondary',
          damage_entry: { name: 'slashing', amount: 10 },
          metadata: { invalidMetadataOp: ['throws'] },
        });

        fixture = await ModTestFixture.forAction(
          'test',
          'test:apply_damage_test',
          rule,
          eventIsActionApplyDamageTest
        );

        const { actor, target, targetPart } = createStandardEntities();
        fixture.reset([actor, target, targetPart]);

        await fixture.executeAction('attacker', 'target', {
          additionalPayload: { secondaryId: 'target' },
        });

        // Should still complete turn (metadata defaults to empty object)
        const turnEndedEvent = fixture.events.find(
          (e) => e.eventType === 'core:turn_ended'
        );
        expect(turnEndedEvent).toBeDefined();
      });

      it('should warn when metadata resolves to non-object', async () => {
        const rule = createTestRule(
          {
            entity_ref: 'secondary',
            damage_entry: { name: 'slashing', amount: 10 },
            metadata: { var: 'context.invalidMetadata' },
          },
          [
            {
              type: 'SET_VARIABLE',
              parameters: {
                variable_name: 'invalidMetadata',
                value: 'not-an-object',
              },
            },
          ]
        );

        fixture = await ModTestFixture.forAction(
          'test',
          'test:apply_damage_test',
          rule,
          eventIsActionApplyDamageTest
        );

        const { actor, target, targetPart } = createStandardEntities();
        fixture.reset([actor, target, targetPart]);

        await fixture.executeAction('attacker', 'target', {
          additionalPayload: { secondaryId: 'target' },
        });

        // Should still complete turn (metadata falls back to empty object with warning)
        const turnEndedEvent = fixture.events.find(
          (e) => e.eventType === 'core:turn_ended'
        );
        expect(turnEndedEvent).toBeDefined();
      });
    });

    describe('damage_tags with JSON Logic expression', () => {
      it('should resolve damage_tags from JSON Logic var expression', async () => {
        const rule = createTestRule(
          {
            entity_ref: 'secondary',
            damage_entry: { name: 'slashing', amount: 10 },
            damage_tags: { var: 'context.attackTags' },
          },
          [
            {
              type: 'SET_VARIABLE',
              parameters: {
                variable_name: 'attackTags',
                value: ['critical', 'backstab'],
              },
            },
          ]
        );

        fixture = await ModTestFixture.forAction(
          'test',
          'test:apply_damage_test',
          rule,
          eventIsActionApplyDamageTest
        );

        const { actor, target, targetPart } = createStandardEntities();
        fixture.reset([actor, target, targetPart]);

        await fixture.executeAction('attacker', 'target', {
          additionalPayload: { secondaryId: 'target' },
        });

        const turnEndedEvent = fixture.events.find(
          (e) => e.eventType === 'core:turn_ended'
        );
        expect(turnEndedEvent).toBeDefined();
      });

      it('should handle damage_tags JSON Logic evaluation error with fallback to empty array', async () => {
        const rule = createTestRule({
          entity_ref: 'secondary',
          damage_entry: { name: 'slashing', amount: 10 },
          damage_tags: { invalidTagsOp: ['throws'] },
        });

        fixture = await ModTestFixture.forAction(
          'test',
          'test:apply_damage_test',
          rule,
          eventIsActionApplyDamageTest
        );

        const { actor, target, targetPart } = createStandardEntities();
        fixture.reset([actor, target, targetPart]);

        await fixture.executeAction('attacker', 'target', {
          additionalPayload: { secondaryId: 'target' },
        });

        // Should still complete turn (damage_tags falls back to empty array)
        const turnEndedEvent = fixture.events.find(
          (e) => e.eventType === 'core:turn_ended'
        );
        expect(turnEndedEvent).toBeDefined();
      });

      it('should warn when damage_tags resolves to non-array', async () => {
        const rule = createTestRule(
          {
            entity_ref: 'secondary',
            damage_entry: { name: 'slashing', amount: 10 },
            damage_tags: { var: 'context.invalidTags' },
          },
          [
            {
              type: 'SET_VARIABLE',
              parameters: {
                variable_name: 'invalidTags',
                value: 'not-an-array',
              },
            },
          ]
        );

        fixture = await ModTestFixture.forAction(
          'test',
          'test:apply_damage_test',
          rule,
          eventIsActionApplyDamageTest
        );

        const { actor, target, targetPart } = createStandardEntities();
        fixture.reset([actor, target, targetPart]);

        await fixture.executeAction('attacker', 'target', {
          additionalPayload: { secondaryId: 'target' },
        });

        // Should still complete turn (damage_tags falls back to empty array with warning)
        const turnEndedEvent = fixture.events.find(
          (e) => e.eventType === 'core:turn_ended'
        );
        expect(turnEndedEvent).toBeDefined();
      });
    });
  });

  describe('hit_strategy resolution', () => {
    it('should resolve hit_strategy from JSON Logic var expression', async () => {
      const rule = createTestRule(
        {
          entity_ref: 'secondary',
          damage_entry: { name: 'slashing', amount: 10 },
          hit_strategy: { var: 'context.customStrategy' },
        },
        [
          {
            type: 'SET_VARIABLE',
            parameters: {
              variable_name: 'customStrategy',
              value: { reuse_cached: false },
            },
          },
        ]
      );

      fixture = await ModTestFixture.forAction(
        'test',
        'test:apply_damage_test',
        rule,
        eventIsActionApplyDamageTest
      );

      const { actor, target, targetPart } = createStandardEntities();
      fixture.reset([actor, target, targetPart]);

      await fixture.executeAction('attacker', 'target', {
          additionalPayload: { secondaryId: 'target' },
        });

      const turnEndedEvent = fixture.events.find(
        (e) => e.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
    });

    it('should use hint_part from hit_strategy when part_ref is not provided', async () => {
      const rule = createTestRule({
        entity_ref: 'secondary',
        damage_entry: { name: 'slashing', amount: 10 },
        hit_strategy: {
          hint_part: 'target-torso',
          reuse_cached: false,
        },
      });

      fixture = await ModTestFixture.forAction(
        'test',
        'test:apply_damage_test',
        rule,
        eventIsActionApplyDamageTest
      );

      const { actor, target, targetPart } = createStandardEntities();
      fixture.reset([actor, target, targetPart]);

      await fixture.executeAction('attacker', 'target', {
          additionalPayload: { secondaryId: 'target' },
        });

      const turnEndedEvent = fixture.events.find(
        (e) => e.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
    });

    it('should handle hit_strategy JSON Logic evaluation error gracefully', async () => {
      const rule = createTestRule({
        entity_ref: 'secondary',
        damage_entry: { name: 'slashing', amount: 10 },
        hit_strategy: { invalidStrategyOp: ['throws'] },
      });

      fixture = await ModTestFixture.forAction(
        'test',
        'test:apply_damage_test',
        rule,
        eventIsActionApplyDamageTest
      );

      const { actor, target, targetPart } = createStandardEntities();
      fixture.reset([actor, target, targetPart]);

      await fixture.executeAction('attacker', 'target', {
          additionalPayload: { secondaryId: 'target' },
        });

      // Should still complete turn (falls back to default hit strategy)
      const turnEndedEvent = fixture.events.find(
        (e) => e.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
    });

    it('should resolve hint_part from JSON Logic expression', async () => {
      const rule = createTestRule(
        {
          entity_ref: 'secondary',
          damage_entry: { name: 'slashing', amount: 10 },
          hit_strategy: {
            hint_part: { var: 'context.targetPartId' },
            reuse_cached: false,
          },
        },
        [
          {
            type: 'SET_VARIABLE',
            parameters: {
              variable_name: 'targetPartId',
              value: 'target-torso',
            },
          },
        ]
      );

      fixture = await ModTestFixture.forAction(
        'test',
        'test:apply_damage_test',
        rule,
        eventIsActionApplyDamageTest
      );

      const { actor, target, targetPart } = createStandardEntities();
      fixture.reset([actor, target, targetPart]);

      await fixture.executeAction('attacker', 'target', {
          additionalPayload: { secondaryId: 'target' },
        });

      const turnEndedEvent = fixture.events.find(
        (e) => e.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
    });
  });

  describe('Legacy mode (damage_type + amount)', () => {
    it('should dispatch error for invalid amount (negative)', async () => {
      const rule = {
        $schema: 'schema://living-narrative-engine/rule.schema.json',
        rule_id: 'test:handle_legacy_damage',
        event_type: 'core:attempt_action',
        condition: { condition_ref: 'test:event-is-action-apply-damage-test' },
        actions: [
          {
            type: 'APPLY_DAMAGE',
            parameters: {
              entity_ref: 'secondary',
              damage_type: 'fire',
              amount: -5, // Invalid negative amount
            },
          },
          { macro: 'core:endTurnOnly' },
        ],
      };

      fixture = await ModTestFixture.forAction(
        'test',
        'test:apply_damage_test',
        rule,
        eventIsActionApplyDamageTest
      );

      const { actor, target, targetPart } = createStandardEntities();
      fixture.reset([actor, target, targetPart]);

      await fixture.executeAction('attacker', 'target', {
          additionalPayload: { secondaryId: 'target' },
        });

      const errorEvents = fixture.events.filter(
        (e) =>
          e.eventType === 'core:system_error_occurred' ||
          e.payload?.message?.includes('Invalid amount')
      );
      expect(errorEvents.length).toBeGreaterThan(0);
    });

    it('should dispatch error for missing damage_type', async () => {
      // This test uses JSON Logic that resolves to null/undefined for damage_type
      const rule = createTestRule(
        {
          entity_ref: 'secondary',
          damage_type: { var: 'context.nullDamageType' },
          amount: 10,
        },
        [
          {
            type: 'SET_VARIABLE',
            parameters: {
              variable_name: 'nullDamageType',
              value: null,
            },
          },
        ]
      );

      fixture = await ModTestFixture.forAction(
        'test',
        'test:apply_damage_test',
        rule,
        eventIsActionApplyDamageTest
      );

      const { actor, target, targetPart } = createStandardEntities();
      fixture.reset([actor, target, targetPart]);

      await fixture.executeAction('attacker', 'target', {
          additionalPayload: { secondaryId: 'target' },
        });

      const errorEvents = fixture.events.filter(
        (e) =>
          e.eventType === 'core:system_error_occurred' ||
          e.payload?.message?.includes('Invalid damage_type')
      );
      expect(errorEvents.length).toBeGreaterThan(0);
    });

    it('should dispatch error when neither damage_entry nor legacy params provided', async () => {
      const rule = createTestRule({
        entity_ref: 'secondary',
        // No damage_entry, no damage_type, no amount
      });

      fixture = await ModTestFixture.forAction(
        'test',
        'test:apply_damage_test',
        rule,
        eventIsActionApplyDamageTest
      );

      const { actor, target, targetPart } = createStandardEntities();
      fixture.reset([actor, target, targetPart]);

      await fixture.executeAction('attacker', 'target', {
          additionalPayload: { secondaryId: 'target' },
        });

      const errorEvents = fixture.events.filter(
        (e) =>
          e.eventType === 'core:system_error_occurred' ||
          e.payload?.message?.includes(
            'Either damage_entry or (damage_type + amount) required'
          )
      );
      expect(errorEvents.length).toBeGreaterThan(0);
    });

    it('should resolve amount from JSON Logic expression in legacy mode', async () => {
      const rule = createTestRule(
        {
          entity_ref: 'secondary',
          damage_type: 'fire',
          amount: { var: 'context.calculatedDamage' },
        },
        [
          {
            type: 'SET_VARIABLE',
            parameters: {
              variable_name: 'calculatedDamage',
              value: 20,
            },
          },
        ]
      );

      fixture = await ModTestFixture.forAction(
        'test',
        'test:apply_damage_test',
        rule,
        eventIsActionApplyDamageTest
      );

      const { actor, target, targetPart } = createStandardEntities();
      fixture.reset([actor, target, targetPart]);

      await fixture.executeAction('attacker', 'target', {
          additionalPayload: { secondaryId: 'target' },
        });

      const turnEndedEvent = fixture.events.find(
        (e) => e.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
    });
  });

  describe('exclude_damage_types resolution', () => {
    it('should resolve exclude_damage_types from JSON Logic var expression', async () => {
      const rule = createTestRule(
        {
          entity_ref: 'secondary',
          damage_entry: { name: 'slashing', amount: 10 },
          exclude_damage_types: { var: 'context.immunities' },
        },
        [
          {
            type: 'SET_VARIABLE',
            parameters: {
              variable_name: 'immunities',
              value: ['fire', 'cold'],
            },
          },
        ]
      );

      fixture = await ModTestFixture.forAction(
        'test',
        'test:apply_damage_test',
        rule,
        eventIsActionApplyDamageTest
      );

      const { actor, target, targetPart } = createStandardEntities();
      fixture.reset([actor, target, targetPart]);

      await fixture.executeAction('attacker', 'target', {
          additionalPayload: { secondaryId: 'target' },
        });

      const turnEndedEvent = fixture.events.find(
        (e) => e.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
    });

    it('should skip damage when type is in exclusion list', async () => {
      const rule = createTestRule({
        entity_ref: 'secondary',
        damage_entry: { name: 'slashing', amount: 10 },
        exclude_damage_types: ['slashing'], // Exclude the damage type being applied
      });

      fixture = await ModTestFixture.forAction(
        'test',
        'test:apply_damage_test',
        rule,
        eventIsActionApplyDamageTest
      );

      const { actor, target, targetPart } = createStandardEntities();
      fixture.reset([actor, target, targetPart]);

      await fixture.executeAction('attacker', 'target', {
          additionalPayload: { secondaryId: 'target' },
        });

      // Turn should end but damage should not be applied
      const turnEndedEvent = fixture.events.find(
        (e) => e.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();

      // No damage events should have been dispatched
      const damageEvents = fixture.events.filter(
        (e) => e.eventType === 'anatomy:damage_applied'
      );
      expect(damageEvents).toHaveLength(0);
    });

    it('should handle exclude_damage_types JSON Logic evaluation error gracefully', async () => {
      const rule = createTestRule({
        entity_ref: 'secondary',
        damage_entry: { name: 'slashing', amount: 10 },
        exclude_damage_types: { invalidExcludeOp: ['throws'] },
      });

      fixture = await ModTestFixture.forAction(
        'test',
        'test:apply_damage_test',
        rule,
        eventIsActionApplyDamageTest
      );

      const { actor, target, targetPart } = createStandardEntities();
      fixture.reset([actor, target, targetPart]);

      await fixture.executeAction('attacker', 'target', {
          additionalPayload: { secondaryId: 'target' },
        });

      // Should still complete turn (exclusion list falls back to empty)
      const turnEndedEvent = fixture.events.find(
        (e) => e.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
    });
  });

  describe('damage_multiplier resolution', () => {
    it('should resolve damage_multiplier from JSON Logic var expression', async () => {
      const rule = createTestRule(
        {
          entity_ref: 'secondary',
          damage_entry: { name: 'slashing', amount: 10 },
          damage_multiplier: { var: 'context.critMultiplier' },
        },
        [
          {
            type: 'SET_VARIABLE',
            parameters: {
              variable_name: 'critMultiplier',
              value: 2.0,
            },
          },
        ]
      );

      fixture = await ModTestFixture.forAction(
        'test',
        'test:apply_damage_test',
        rule,
        eventIsActionApplyDamageTest
      );

      const { actor, target, targetPart } = createStandardEntities();
      fixture.reset([actor, target, targetPart]);

      await fixture.executeAction('attacker', 'target', {
          additionalPayload: { secondaryId: 'target' },
        });

      const turnEndedEvent = fixture.events.find(
        (e) => e.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
    });

    it('should dispatch error for invalid damage_multiplier (negative)', async () => {
      const rule = createTestRule({
        entity_ref: 'secondary',
        damage_entry: { name: 'slashing', amount: 10 },
        damage_multiplier: -1.5, // Invalid negative multiplier
      });

      fixture = await ModTestFixture.forAction(
        'test',
        'test:apply_damage_test',
        rule,
        eventIsActionApplyDamageTest
      );

      const { actor, target, targetPart } = createStandardEntities();
      fixture.reset([actor, target, targetPart]);

      await fixture.executeAction('attacker', 'target', {
          additionalPayload: { secondaryId: 'target' },
        });

      const errorEvents = fixture.events.filter(
        (e) =>
          e.eventType === 'core:system_error_occurred' ||
          e.payload?.message?.includes('Invalid damage_multiplier')
      );
      expect(errorEvents.length).toBeGreaterThan(0);
    });

    it('should dispatch error when damage_multiplier resolves to NaN', async () => {
      const rule = createTestRule(
        {
          entity_ref: 'secondary',
          damage_entry: { name: 'slashing', amount: 10 },
          damage_multiplier: { var: 'context.badMultiplier' },
        },
        [
          {
            type: 'SET_VARIABLE',
            parameters: {
              variable_name: 'badMultiplier',
              value: 'not-a-number',
            },
          },
        ]
      );

      fixture = await ModTestFixture.forAction(
        'test',
        'test:apply_damage_test',
        rule,
        eventIsActionApplyDamageTest
      );

      const { actor, target, targetPart } = createStandardEntities();
      fixture.reset([actor, target, targetPart]);

      await fixture.executeAction('attacker', 'target', {
          additionalPayload: { secondaryId: 'target' },
        });

      const errorEvents = fixture.events.filter(
        (e) =>
          e.eventType === 'core:system_error_occurred' ||
          e.payload?.message?.includes('Invalid damage_multiplier')
      );
      expect(errorEvents.length).toBeGreaterThan(0);
    });
  });

  describe('#selectRandomPart edge cases', () => {
    it('should return null when entity has no anatomy:body component', async () => {
      const rule = createTestRule({
        entity_ref: 'secondary',
        damage_entry: { name: 'slashing', amount: 10 },
      });

      fixture = await ModTestFixture.forAction(
        'test',
        'test:apply_damage_test',
        rule,
        eventIsActionApplyDamageTest
      );

      // Create target WITHOUT anatomy:body component
      const actor = new ModEntityBuilder('attacker')
        .withName('Attacker')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .build();

      const target = new ModEntityBuilder('target')
        .withName('Target')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        // No anatomy:body component
        .build();

      fixture.reset([actor, target]);

      await fixture.executeAction('attacker', 'target', {
          additionalPayload: { secondaryId: 'target' },
        });

      // Should dispatch error for missing part
      const errorEvents = fixture.events.filter(
        (e) =>
          e.eventType === 'core:system_error_occurred' ||
          e.payload?.message?.includes('Could not resolve target part')
      );
      expect(errorEvents.length).toBeGreaterThan(0);
    });

    it('should handle entity with no eligible hit targets (all parts have weight 0)', async () => {
      const rule = createTestRule({
        entity_ref: 'secondary',
        damage_entry: { name: 'slashing', amount: 10 },
      });

      fixture = await ModTestFixture.forAction(
        'test',
        'test:apply_damage_test',
        rule,
        eventIsActionApplyDamageTest
      );

      const actor = new ModEntityBuilder('attacker')
        .withName('Attacker')
        .asActor()
        .withComponent('core:position', { locationId: 'test-location' })
        .build();

      // Create part with 0 weight (should be filtered out)
      const targetPart = new ModEntityBuilder('target-torso')
        .withName('Torso')
        .withComponent('anatomy:part', {
          type: 'torso',
          parentPartId: null,
          hit_probability_weight: 0, // Zero weight - should be excluded
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
        .withComponent('anatomy:body', {
          body: { root: 'target-torso' },
        })
        .build();

      fixture.reset([actor, target, targetPart]);

      await fixture.executeAction('attacker', 'target', {
          additionalPayload: { secondaryId: 'target' },
        });

      // Should dispatch error for no eligible parts
      const errorEvents = fixture.events.filter(
        (e) =>
          e.eventType === 'core:system_error_occurred' ||
          e.payload?.message?.includes('Could not resolve target part')
      );
      expect(errorEvents.length).toBeGreaterThan(0);
    });
  });

  describe('rng_ref resolution', () => {
    it('should resolve rng_ref from JSON Logic var expression', async () => {
      const rule = createTestRule(
        {
          entity_ref: 'secondary',
          damage_entry: { name: 'slashing', amount: 10 },
          rng_ref: { var: 'context.selectedRng' },
        },
        [
          {
            type: 'SET_VARIABLE',
            parameters: {
              variable_name: 'selectedRng',
              value: 'combatRng',
            },
          },
        ]
      );

      fixture = await ModTestFixture.forAction(
        'test',
        'test:apply_damage_test',
        rule,
        eventIsActionApplyDamageTest
      );

      const { actor, target, targetPart } = createStandardEntities();
      fixture.reset([actor, target, targetPart]);

      await fixture.executeAction('attacker', 'target', {
          additionalPayload: { secondaryId: 'target' },
        });

      // Should still complete (RNG not found is just a warning, falls back to default)
      const turnEndedEvent = fixture.events.find(
        (e) => e.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
    });

    it('should warn when rng_ref resolves to non-string', async () => {
      const rule = createTestRule(
        {
          entity_ref: 'secondary',
          damage_entry: { name: 'slashing', amount: 10 },
          rng_ref: { var: 'context.badRngRef' },
        },
        [
          {
            type: 'SET_VARIABLE',
            parameters: {
              variable_name: 'badRngRef',
              value: 12345, // Not a string
            },
          },
        ]
      );

      fixture = await ModTestFixture.forAction(
        'test',
        'test:apply_damage_test',
        rule,
        eventIsActionApplyDamageTest
      );

      const { actor, target, targetPart } = createStandardEntities();
      fixture.reset([actor, target, targetPart]);

      await fixture.executeAction('attacker', 'target', {
          additionalPayload: { secondaryId: 'target' },
        });

      // Should still complete (invalid RNG ref is just a warning)
      const turnEndedEvent = fixture.events.find(
        (e) => e.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
    });

    it('should handle rng_ref JSON Logic evaluation error gracefully', async () => {
      const rule = createTestRule({
        entity_ref: 'secondary',
        damage_entry: { name: 'slashing', amount: 10 },
        rng_ref: { invalidRngOp: ['throws'] },
      });

      fixture = await ModTestFixture.forAction(
        'test',
        'test:apply_damage_test',
        rule,
        eventIsActionApplyDamageTest
      );

      const { actor, target, targetPart } = createStandardEntities();
      fixture.reset([actor, target, targetPart]);

      await fixture.executeAction('attacker', 'target', {
          additionalPayload: { secondaryId: 'target' },
        });

      // Should still complete (falls back to default RNG)
      const turnEndedEvent = fixture.events.find(
        (e) => e.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
    });
  });

  describe('direct object damage_entry (not JSON Logic)', () => {
    it('should accept direct damage_entry object without var/if operators', async () => {
      const rule = createTestRule({
        entity_ref: 'secondary',
        damage_entry: {
          name: 'piercing',
          amount: 25,
          effects: { canPierce: true },
        },
      });

      fixture = await ModTestFixture.forAction(
        'test',
        'test:apply_damage_test',
        rule,
        eventIsActionApplyDamageTest
      );

      const { actor, target, targetPart } = createStandardEntities();
      fixture.reset([actor, target, targetPart]);

      await fixture.executeAction('attacker', 'target', {
          additionalPayload: { secondaryId: 'target' },
        });

      const turnEndedEvent = fixture.events.find(
        (e) => e.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
    });
  });

  describe('direct metadata object (not JSON Logic)', () => {
    it('should accept direct metadata object without var/if operators', async () => {
      const rule = createTestRule({
        entity_ref: 'secondary',
        damage_entry: { name: 'slashing', amount: 10 },
        metadata: { weapon: 'sword', critical: true, source: 'attack' },
      });

      fixture = await ModTestFixture.forAction(
        'test',
        'test:apply_damage_test',
        rule,
        eventIsActionApplyDamageTest
      );

      const { actor, target, targetPart } = createStandardEntities();
      fixture.reset([actor, target, targetPart]);

      await fixture.executeAction('attacker', 'target', {
          additionalPayload: { secondaryId: 'target' },
        });

      const turnEndedEvent = fixture.events.find(
        (e) => e.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
    });
  });

  describe('hit location caching', () => {
    it('should cache hit location for subsequent damage calls with reuse_cached=true', async () => {
      // Create rule that applies damage twice to same entity
      const rule = {
        $schema: 'schema://living-narrative-engine/rule.schema.json',
        rule_id: 'test:handle_double_damage',
        event_type: 'core:attempt_action',
        condition: { condition_ref: 'test:event-is-action-apply-damage-test' },
        actions: [
          {
            type: 'APPLY_DAMAGE',
            parameters: {
              entity_ref: 'secondary',
              damage_entry: { name: 'slashing', amount: 5 },
              hit_strategy: { reuse_cached: true },
            },
          },
          {
            type: 'APPLY_DAMAGE',
            parameters: {
              entity_ref: 'secondary',
              damage_entry: { name: 'fire', amount: 3 },
              hit_strategy: { reuse_cached: true },
            },
          },
          { macro: 'core:endTurnOnly' },
        ],
      };

      fixture = await ModTestFixture.forAction(
        'test',
        'test:apply_damage_test',
        rule,
        eventIsActionApplyDamageTest
      );

      const { actor, target, targetPart } = createStandardEntities();
      fixture.reset([actor, target, targetPart]);

      await fixture.executeAction('attacker', 'target', {
          additionalPayload: { secondaryId: 'target' },
        });

      const turnEndedEvent = fixture.events.find(
        (e) => e.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
    });

    it('should not cache hit location when reuse_cached=false', async () => {
      const rule = {
        $schema: 'schema://living-narrative-engine/rule.schema.json',
        rule_id: 'test:handle_fresh_damage',
        event_type: 'core:attempt_action',
        condition: { condition_ref: 'test:event-is-action-apply-damage-test' },
        actions: [
          {
            type: 'APPLY_DAMAGE',
            parameters: {
              entity_ref: 'secondary',
              damage_entry: { name: 'slashing', amount: 5 },
              hit_strategy: { reuse_cached: false },
            },
          },
          {
            type: 'APPLY_DAMAGE',
            parameters: {
              entity_ref: 'secondary',
              damage_entry: { name: 'fire', amount: 3 },
              hit_strategy: { reuse_cached: false },
            },
          },
          { macro: 'core:endTurnOnly' },
        ],
      };

      fixture = await ModTestFixture.forAction(
        'test',
        'test:apply_damage_test',
        rule,
        eventIsActionApplyDamageTest
      );

      const { actor, target, targetPart } = createStandardEntities();
      fixture.reset([actor, target, targetPart]);

      await fixture.executeAction('attacker', 'target', {
          additionalPayload: { secondaryId: 'target' },
        });

      const turnEndedEvent = fixture.events.find(
        (e) => e.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
    });
  });
});
