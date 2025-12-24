/**
 * @file Minimal debug test for take_from_container rule matching
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import takeFromContainerRule from '../../../../data/mods/containers/rules/handle_take_from_container.rule.json' assert { type: 'json' };
import eventIsActionTakeFromContainer from '../../../../data/mods/containers/conditions/event-is-action-take-from-container.condition.json' assert { type: 'json' };

describe('DEBUG: take_from_container rule matching', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'containers',
      'containers:take_from_container',
      takeFromContainerRule,
      eventIsActionTakeFromContainer
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('minimal scenario - does rule match?', async () => {
    // DEBUG: Log what condition was loaded
    console.log('\n=== LOADED CONDITION ===');
    console.log(JSON.stringify(eventIsActionTakeFromContainer, null, 2));

    // DEBUG: Log what rule was loaded
    console.log('\n=== LOADED RULE ===');
    console.log('Rule ID:', takeFromContainerRule.rule_id);
    console.log('Event Type:', takeFromContainerRule.event_type);
    console.log(
      'Condition:',
      JSON.stringify(takeFromContainerRule.condition, null, 2)
    );

    // Setup minimal scenario
    const room = new ModEntityBuilder('room1').asRoom('Room').build();
    const actor = new ModEntityBuilder('actor1')
      .withName('Actor')
      .atLocation('room1')
      .asActor()
      .withComponent('inventory:inventory', {
        items: [],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .build();
    const container = new ModEntityBuilder('container1')
      .withName('Container')
      .atLocation('room1')
      .withComponent('containers-core:container', {
        contents: ['item1'],
        capacity: { maxWeight: 50, maxItems: 10 },
        isOpen: true,
      })
      .build();
    const item = new ModEntityBuilder('item1')
      .withName('Item')
      .withComponent('items-core:item', {})
      .withComponent('items-core:portable', {})
      .withComponent('core:weight', { weight: 0.5 })
      .build();

    testFixture.reset([room, actor, container, item]);

    // DEBUG: Check what rules are registered
    console.log('\n=== REGISTERED RULES ===');
    const rules = testFixture.testEnv.dataRegistry.getAllSystemRules();
    console.log('Number of rules:', rules.length);
    rules.forEach((r, i) => {
      console.log(`Rule ${i}:`, {
        rule_id: r.rule_id,
        event_type: r.event_type,
        condition: r.condition,
      });
    });

    // DEBUG: Check if getConditionDefinition is actually being called
    const originalGetConditionDef =
      testFixture.testEnv.dataRegistry.getConditionDefinition;
    testFixture.testEnv.dataRegistry.getConditionDefinition = jest.fn((id) => {
      console.log('\n=== getConditionDefinition CALLED ===');
      console.log('Requested ID:', id);
      const result = originalGetConditionDef(id);
      console.log('Returned:', result ? 'FOUND' : 'NOT FOUND');
      if (result) {
        console.log('Returned ID:', result.id);
        console.log('Has logic:', !!result.logic);
        console.log('Logic:', JSON.stringify(result.logic, null, 2));
      }
      return result;
    });

    // DEBUG: Check how the rule's actions array looks
    console.log('\n=== RULE ACTIONS ARRAY ===');
    console.log('Number of actions:', takeFromContainerRule.actions.length);
    takeFromContainerRule.actions.forEach((action, idx) => {
      console.log(`Action ${idx}:`, {
        type: action.type,
        hasCondition: !!action.condition,
        hasParameters: !!action.parameters,
        hasThenActions: !!action.then_actions,
        hasElseActions: !!action.else_actions,
      });
    });

    // DEBUG: Check operation interpreter execution
    const originalExecute = testFixture.testEnv.operationInterpreter.execute;
    testFixture.testEnv.operationInterpreter.execute = jest.fn(
      async (operation, context) => {
        console.log('\n=== Operation.execute CALLED ===');
        console.log('Operation type:', operation.type);
        console.log(
          'Operation params:',
          JSON.stringify(operation.parameters || {}, null, 2)
        );
        try {
          const result = await originalExecute.call(
            testFixture.testEnv.operationInterpreter,
            operation,
            context
          );
          console.log('Operation result:', result);
          console.log(
            'Context after operation:',
            JSON.stringify(context, null, 2)
          );
          return result;
        } catch (err) {
          console.log('Operation FAILED:', err.message);
          throw err;
        }
      }
    );

    // Execute action
    await testFixture.executeAction('actor1', 'container1', {
      additionalPayload: {
        secondaryId: 'item1',
      },
    });

    // Wait for event processing (SystemLogicInterpreter processes events asynchronously)
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Log ALL events including error events
    console.log(
      '\n=== ALL EVENTS (INCLUDING ERRORS) ===\n',
      testFixture.events.map((e, i) => ({
        index: i,
        type: e.eventType,
        payload: e.payload,
        isError: e.eventType.includes('error') || e.eventType.includes('Error'),
      }))
    );

    // Check for system error events specifically
    const errorEvents = testFixture.events.filter(
      (e) =>
        e.eventType === 'core:system_error_occurred' ||
        e.eventType.toLowerCase().includes('error')
    );
    if (errorEvents.length > 0) {
      console.log('\n=== ERROR EVENTS ===');
      errorEvents.forEach((e) => console.log(JSON.stringify(e, null, 2)));
    }

    // Check entity states after execution
    console.log('\n=== ENTITY STATES AFTER EXECUTION ===');
    const containerAfter =
      testFixture.entityManager.getEntityInstance('container1');
    const actorAfter = testFixture.entityManager.getEntityInstance('actor1');
    console.log(
      'Container contents:',
      containerAfter.components['containers-core:container'].contents
    );
    console.log(
      'Actor inventory:',
      actorAfter.components['inventory:inventory'].items
    );

    // Check if rule executed (should have more than just attempt_action)
    console.log('\n=== EVENT COUNT ===');
    console.log('Total events dispatched:', testFixture.events.length);
    console.log(
      'Expected: >1 (attempt_action + operations)',
      'Got:',
      testFixture.events.length
    );

    // The test will PASS if the item was moved (rule executed successfully)
    expect(containerAfter.components['containers-core:container'].contents).toEqual([]);
    expect(actorAfter.components['inventory:inventory'].items).toContain('item1');
  });
});
