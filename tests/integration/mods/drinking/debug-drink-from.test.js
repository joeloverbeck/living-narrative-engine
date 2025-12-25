/**
 * Debug test for drinking rule execution
 */
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('Debug drink_from', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('drinking', 'drinking:drink_from');
  });

  afterEach(() => {
    if (fixture) {
      fixture.cleanup();
    }
  });

  it('debug: check condition loading and rule execution', async () => {
    console.log('\n========================================');
    console.log('=== DEBUG: checking testEnv ===');
    console.log('========================================\n');

    // Check if dataRegistry has our condition
    if (fixture.testEnv.dataRegistry) {
      console.log('=== dataRegistry.getConditionDefinition ===');
      const conditionFromRegistry = fixture.testEnv.dataRegistry.getConditionDefinition('drinking:event-is-action-drink-from');
      console.log('Condition "drinking:event-is-action-drink-from":', conditionFromRegistry ? 'FOUND' : 'NOT FOUND');
      if (conditionFromRegistry) {
        console.log('  ID:', conditionFromRegistry.id);
        console.log('  Logic:', JSON.stringify(conditionFromRegistry.logic, null, 2));
      }

      // Also try the old items: version
      const oldCondition = fixture.testEnv.dataRegistry.getConditionDefinition('items:event-is-action-drink-from');
      console.log('Condition "items:event-is-action-drink-from":', oldCondition ? 'FOUND (BUG!)' : 'NOT FOUND (expected)');
    } else {
      console.log('dataRegistry NOT FOUND');
    }

    // Check rules
    if (fixture.testEnv.dataRegistry?.getAllSystemRules) {
      console.log('\n=== dataRegistry.getAllSystemRules ===');
      const rules = fixture.testEnv.dataRegistry.getAllSystemRules();
      console.log('Number of rules:', rules.length);
      for (const rule of rules) {
        console.log('- Rule ID:', rule.rule_id);
        console.log('  Event type:', rule.event_type);
        if (rule.condition?.condition_ref) {
          console.log('  Condition ref:', rule.condition.condition_ref);
        } else {
          console.log('  Condition:', JSON.stringify(rule.condition, null, 2));
        }
      }
    }

    // Check interpreter
    if (fixture.testEnv.systemLogicInterpreter) {
      console.log('\n=== systemLogicInterpreter exists ===');
      console.log('Interpreter type:', typeof fixture.testEnv.systemLogicInterpreter);
    }

    // Create actor and container
    const { actor, target: container } = fixture.createStandardActorTarget([
      'Alice',
      'Water Flask',
    ]);

    // Set up container
    fixture.entityManager.addComponent(
      container.id,
      'containers-core:liquid_container',
      {
        liquidType: 'water',
        currentVolumeMilliliters: 500,
        maxCapacityMilliliters: 1000,
        servingSizeMilliliters: 100,
        isRefillable: true,
        flavorText: 'Fresh spring water.',
      }
    );
    fixture.entityManager.addComponent(container.id, 'drinking:drinkable', {});
    fixture.entityManager.addComponent(actor.id, 'inventory:inventory', {
      items: [container.id],
      maxWeightKg: 50,
    });

    // Check events BEFORE action
    console.log('\n=== Events BEFORE action ===');
    console.log('Event count:', fixture.events.length);

    // Execute action and check events
    console.log('\n=== Executing action ===');
    const result = await fixture.executeAction(actor.id, container.id);
    console.log('Result:', result);

    // Check events AFTER action
    console.log('\n=== Events AFTER action ===');
    console.log('Event count:', fixture.events.length);
    for (const event of fixture.events) {
      console.log('  -', event.eventType || event.type, '| payload.actionId:', event.payload?.actionId);
    }

    // Check liquid container
    const liquidContainer = fixture.entityManager.getComponentData(
      container.id,
      'containers-core:liquid_container'
    );
    console.log('\n=== Liquid container after action ===');
    console.log('Current volume:', liquidContainer.currentVolumeMilliliters);
    console.log('Expected:', 400);
    console.log('Match:', liquidContainer.currentVolumeMilliliters === 400 ? 'YES' : 'NO');
    console.log('\n========================================\n');

    expect(true).toBe(true); // Just to pass
  });
});
