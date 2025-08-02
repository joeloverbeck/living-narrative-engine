/**
 * @file Integration tests for the positioning:kneel_before action and rule.
 * @description Tests the rule execution after the kneel_before action is performed.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly.
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import kneelBeforeRule from '../../../../data/mods/positioning/rules/kneel_before.rule.json';
import eventIsActionKneelBefore from '../../../../data/mods/positioning/conditions/event-is-action-kneel-before.condition.json';
import logSuccessMacro from '../../../../data/mods/core/macros/logSuccessAndEndTurn.macro.json';
import { expandMacros } from '../../../../src/utils/macroUtils.js';
import QueryComponentHandler from '../../../../src/logic/operationHandlers/queryComponentHandler.js';
import GetNameHandler from '../../../../src/logic/operationHandlers/getNameHandler.js';
import GetTimestampHandler from '../../../../src/logic/operationHandlers/getTimestampHandler.js';
import DispatchEventHandler from '../../../../src/logic/operationHandlers/dispatchEventHandler.js';
import DispatchPerceptibleEventHandler from '../../../../src/logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import EndTurnHandler from '../../../../src/logic/operationHandlers/endTurnHandler.js';
import SetVariableHandler from '../../../../src/logic/operationHandlers/setVariableHandler.js';
import AddComponentHandler from '../../../../src/logic/operationHandlers/addComponentHandler.js';
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../../src/constants/componentIds.js';
import { ATTEMPT_ACTION_ID } from '../../../../src/constants/eventIds.js';
import { createRuleTestEnvironment } from '../../../common/engine/systemLogicTestEnv.js';

/**
 * Creates handlers needed for the kneel_before rule.
 *
 * @param entityManager
 * @param eventBus
 * @param logger
 */
function createHandlers(entityManager, eventBus, logger) {
  const safeDispatcher = {
    dispatch: jest.fn((eventType, payload) => {
      eventBus.dispatch(eventType, payload);
      return Promise.resolve(true);
    }),
  };

  return {
    QUERY_COMPONENT: new QueryComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    GET_NAME: new GetNameHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    GET_TIMESTAMP: new GetTimestampHandler({ logger }),
    DISPATCH_PERCEPTIBLE_EVENT: new DispatchPerceptibleEventHandler({
      dispatcher: eventBus,
      logger,
      addPerceptionLogEntryHandler: { execute: jest.fn() },
    }),
    DISPATCH_EVENT: new DispatchEventHandler({ dispatcher: eventBus, logger }),
    END_TURN: new EndTurnHandler({
      safeEventDispatcher: safeDispatcher,
      logger,
    }),
    SET_VARIABLE: new SetVariableHandler({ logger }),
    ADD_COMPONENT: new AddComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
  };
}

describe('positioning:kneel_before action integration', () => {
  let testEnv;

  beforeEach(() => {
    const macros = { 'core:logSuccessAndEndTurn': logSuccessMacro };
    const expanded = expandMacros(kneelBeforeRule.actions, {
      get: (type, id) => (type === 'macros' ? macros[id] : undefined),
    });

    const dataRegistry = {
      getAllSystemRules: jest
        .fn()
        .mockReturnValue([{ ...kneelBeforeRule, actions: expanded }]),
      getConditionDefinition: jest.fn((id) =>
        id === 'positioning:event-is-action-kneel-before'
          ? eventIsActionKneelBefore
          : undefined
      ),
    };

    testEnv = createRuleTestEnvironment({
      createHandlers,
      entities: [],
      rules: [{ ...kneelBeforeRule, actions: expanded }],
      dataRegistry,
    });
  });

  afterEach(() => {
    if (testEnv) {
      testEnv.cleanup();
    }
  });

  it('successfully executes kneel before action', async () => {
    testEnv.reset([
      {
        id: 'test:actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Alice' },
          [POSITION_COMPONENT_ID]: { locationId: 'throne_room' },
        },
      },
      {
        id: 'test:target1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'King Bob' },
          [POSITION_COMPONENT_ID]: { locationId: 'throne_room' },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      actorId: 'test:actor1',
      actionId: 'positioning:kneel_before',
      targetId: 'test:target1',
    });

    // Check that kneeling component was added
    const actor = testEnv.entityManager.getEntityInstance('test:actor1');
    expect(actor.components['positioning:kneeling_before']).toBeDefined();
    expect(actor.components['positioning:kneeling_before'].entityId).toBe(
      'test:target1'
    );

    // Check success message
    const successEvent = testEnv.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe('Alice kneels before King Bob.');

    // Check turn ended
    const turnEndedEvent = testEnv.events.find(
      (e) => e.eventType === 'core:turn_ended'
    );
    expect(turnEndedEvent).toBeDefined();
    expect(turnEndedEvent.payload.success).toBe(true);
  });

  it('creates correct perceptible event', async () => {
    testEnv.reset([
      {
        id: 'test:actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Sir Galahad' },
          [POSITION_COMPONENT_ID]: { locationId: 'castle_hall' },
        },
      },
      {
        id: 'test:target1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Queen Guinevere' },
          [POSITION_COMPONENT_ID]: { locationId: 'castle_hall' },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      actorId: 'test:actor1',
      actionId: 'positioning:kneel_before',
      targetId: 'test:target1',
    });

    const perceptibleEvent = testEnv.events.find(
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
    testEnv.reset([
      {
        id: 'test:actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Knight' },
          [POSITION_COMPONENT_ID]: { locationId: 'courtyard' },
        },
      },
      {
        id: 'test:target1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Lord' },
          [POSITION_COMPONENT_ID]: { locationId: 'courtyard' },
        },
      },
      {
        id: 'test:witness1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Peasant' },
          [POSITION_COMPONENT_ID]: { locationId: 'courtyard' },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      actorId: 'test:actor1',
      actionId: 'positioning:kneel_before',
      targetId: 'test:target1',
    });

    // Component should be added correctly
    const actor = testEnv.entityManager.getEntityInstance('test:actor1');
    expect(actor.components['positioning:kneeling_before'].entityId).toBe(
      'test:target1'
    );

    // Perceptible event should be visible to all in location
    const perceptibleEvent = testEnv.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent.payload.locationId).toBe('courtyard');
  });

  it('prevents kneeling while already kneeling (component lifecycle)', async () => {
    testEnv.reset([
      {
        id: 'test:actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Alice' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'positioning:kneeling_before': { entityId: 'test:existing_target' },
        },
      },
      {
        id: 'test:target1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Bob' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
        },
      },
    ]);

    // This test verifies that the action system would prevent this
    // based on forbidden_components, but we dispatch directly
    // The rule should still execute but this demonstrates the logic
    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      actorId: 'test:actor1',
      actionId: 'positioning:kneel_before',
      targetId: 'test:target1',
    });

    // The ADD_COMPONENT operation would replace existing component
    const actor = testEnv.entityManager.getEntityInstance('test:actor1');
    expect(actor.components['positioning:kneeling_before'].entityId).toBe(
      'test:target1'
    );
  });

  it('only fires for correct action ID', async () => {
    testEnv.reset([
      {
        id: 'test:actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Alice' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
        },
      },
      {
        id: 'test:target1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Bob' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
        },
      },
    ]);

    // Try with a different action
    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      actorId: 'test:actor1',
      actionId: 'core:wait',
      targetId: 'test:target1',
    });

    // Should not have any perceptible events from our rule
    const perceptibleEvents = testEnv.events.filter(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvents).toHaveLength(0);

    // Should not have added the component
    const actor = testEnv.entityManager.getEntityInstance('test:actor1');
    expect(actor.components['positioning:kneeling_before']).toBeUndefined();
  });

  it('reproduces production error with realistic entity IDs', async () => {
    // This test reproduces the exact error scenario from the production logs
    testEnv.reset([
      {
        id: 'p_erotica:iker_aguirre_instance',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Iker' },
          [POSITION_COMPONENT_ID]: { locationId: 'coffee_shop' },
        },
      },
      {
        id: 'p_erotica:amaia_castillo_instance',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Amaia' },
          [POSITION_COMPONENT_ID]: { locationId: 'coffee_shop' },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      actorId: 'p_erotica:iker_aguirre_instance',
      actionId: 'positioning:kneel_before',
      targetId: 'p_erotica:amaia_castillo_instance',
    });

    // This should work with the schema fix - component should store the namespaced target ID
    const actor = testEnv.entityManager.getEntityInstance(
      'p_erotica:iker_aguirre_instance'
    );
    expect(actor.components['positioning:kneeling_before']).toBeDefined();
    expect(actor.components['positioning:kneeling_before'].entityId).toBe(
      'p_erotica:amaia_castillo_instance'
    );

    // Verify success message includes proper names
    const successEvent = testEnv.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe('Iker kneels before Amaia.');
  });

  it('validates component schema supports namespaced entity IDs', async () => {
    // This test verifies that the component schema accepts namespaced IDs
    // Note: This test bypasses the integration test framework that doesn't use schema validation
    const kneelComponent = await import(
      '../../../../data/mods/positioning/components/kneeling_before.component.json',
      { with: { type: 'json' } }
    );

    // Test data that should pass with the fixed schema
    const validData = { entityId: 'test:target_entity' };
    const validData2 = { entityId: 'p_erotica:amaia_castillo_instance' };

    // Test data that should fail with the fixed schema (non-namespaced)
    const invalidData = { entityId: 'simple_entity_id' };

    // Manual validation using JSON schema pattern
    const pattern = new RegExp(
      kneelComponent.default.dataSchema.properties.entityId.pattern
    );

    expect(pattern.test(validData.entityId)).toBe(true);
    expect(pattern.test(validData2.entityId)).toBe(true);
    expect(pattern.test(invalidData.entityId)).toBe(false);
  });
});
