/**
 * @file Integration test to reproduce and verify fix for stand_up perceptible event issue.
 * @description This test reproduces the issue where stand_up perceptible events are not delivered
 * to other actors in the location due to invalid perceptionType validation.
 */

import {
  describe,
  it,
  beforeEach,
  expect,
  jest,
  afterEach,
} from '@jest/globals';
import standUpRule from '../../../../data/mods/positioning/rules/stand_up.rule.json';
import eventIsActionStandUp from '../../../../data/mods/positioning/conditions/event-is-action-stand-up.condition.json';
import logSuccessMacro from '../../../../data/mods/core/macros/logSuccessAndEndTurn.macro.json';
import perceptibleEventSchema from '../../../../data/mods/core/events/perceptible_event.event.json';
import { expandMacros } from '../../../../src/utils/macroUtils.js';
import QueryComponentHandler from '../../../../src/logic/operationHandlers/queryComponentHandler.js';
import GetNameHandler from '../../../../src/logic/operationHandlers/getNameHandler.js';
import GetTimestampHandler from '../../../../src/logic/operationHandlers/getTimestampHandler.js';
import DispatchEventHandler from '../../../../src/logic/operationHandlers/dispatchEventHandler.js';
import AddPerceptionLogEntryHandler from '../../../../src/logic/operationHandlers/addPerceptionLogEntryHandler.js';
import EndTurnHandler from '../../../../src/logic/operationHandlers/endTurnHandler.js';
import SetVariableHandler from '../../../../src/logic/operationHandlers/setVariableHandler.js';
import RemoveComponentHandler from '../../../../src/logic/operationHandlers/removeComponentHandler.js';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
  PERCEPTION_LOG_COMPONENT_ID,
} from '../../../../src/constants/componentIds.js';
import { ATTEMPT_ACTION_ID } from '../../../../src/constants/eventIds.js';
import { createRuleTestEnvironment } from '../../../common/engine/systemLogicTestEnv.js';

/**
 * Creates handlers needed for the stand_up rule with real AddPerceptionLogEntryHandler.
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
    DISPATCH_EVENT: new DispatchEventHandler({ dispatcher: eventBus, logger }),
    END_TURN: new EndTurnHandler({
      safeEventDispatcher: safeDispatcher,
      logger,
    }),
    SET_VARIABLE: new SetVariableHandler({ logger }),
    REMOVE_COMPONENT: new RemoveComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    // Real handler for perception log entries
    ADD_PERCEPTION_LOG_ENTRY: new AddPerceptionLogEntryHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
  };
}

describe('positioning:stand_up perceptible event fix', () => {
  let testEnv;
  let ajv;
  let validatePerceptibleEvent;

  beforeEach(() => {
    // Set up AJV validator for perceptible events
    ajv = new Ajv({ strict: false, allErrors: true });
    addFormats(ajv);

    // Add common schema for reference resolution
    const commonSchema = {
      $id: 'schema://living-narrative-engine/common.schema.json',
      definitions: {
        namespacedId: {
          type: 'string',
          pattern: '^[a-zA-Z0-9_:-]+$',
        },
        nullableNamespacedId: {
          oneOf: [{ $ref: '#/definitions/namespacedId' }, { type: 'null' }],
        },
      },
    };
    ajv.addSchema(commonSchema, commonSchema.$id);

    validatePerceptibleEvent = ajv.compile(
      perceptibleEventSchema.payloadSchema
    );

    const macros = { 'core:logSuccessAndEndTurn': logSuccessMacro };
    const expanded = expandMacros(standUpRule.actions, {
      get: (type, id) => (type === 'macros' ? macros[id] : undefined),
    });

    const dataRegistry = {
      getAllSystemRules: jest.fn().mockReturnValue([
        { ...standUpRule, actions: expanded },
        // Add the perceptible event logging rule
        {
          rule_id: 'log_perceptible_events',
          event_type: 'core:perceptible_event',
          actions: [
            {
              type: 'ADD_PERCEPTION_LOG_ENTRY',
              parameters: {
                location_id: '{event.payload.locationId}',
                entry: {
                  descriptionText: '{event.payload.descriptionText}',
                  timestamp: '{event.payload.timestamp}',
                  perceptionType: '{event.payload.perceptionType}',
                  actorId: '{event.payload.actorId}',
                  targetId: '{event.payload.targetId}',
                  involvedEntities: '{event.payload.involvedEntities}',
                },
                originating_actor_id: '{event.payload.actorId}',
              },
            },
          ],
        },
      ]),
      getConditionDefinition: jest.fn((id) =>
        id === 'positioning:event-is-action-stand-up'
          ? eventIsActionStandUp
          : undefined
      ),
    };

    testEnv = createRuleTestEnvironment({
      createHandlers,
      entities: [],
      rules: [
        { ...standUpRule, actions: expanded },
        {
          rule_id: 'log_perceptible_events',
          event_type: 'core:perceptible_event',
          actions: [
            {
              type: 'ADD_PERCEPTION_LOG_ENTRY',
              parameters: {
                location_id: '{event.payload.locationId}',
                entry: {
                  descriptionText: '{event.payload.descriptionText}',
                  timestamp: '{event.payload.timestamp}',
                  perceptionType: '{event.payload.perceptionType}',
                  actorId: '{event.payload.actorId}',
                  targetId: '{event.payload.targetId}',
                  involvedEntities: '{event.payload.involvedEntities}',
                },
                originating_actor_id: '{event.payload.actorId}',
              },
            },
          ],
        },
      ],
      dataRegistry,
    });
  });

  afterEach(() => {
    if (testEnv) {
      testEnv.cleanup();
    }
  });

  it('verifies the perceptible event validation now passes after fix', async () => {
    // Create actor and witness entities
    testEnv.reset([
      {
        id: 'test:actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Alice' },
          [POSITION_COMPONENT_ID]: { locationId: 'throne_room' },
          'positioning:kneeling_before': { entityId: 'test:king' },
        },
      },
      {
        id: 'test:witness1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Bob' },
          [POSITION_COMPONENT_ID]: { locationId: 'throne_room' },
          [PERCEPTION_LOG_COMPONENT_ID]: { logEntries: [], maxEntries: 50 },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'test:actor1',
      actionId: 'positioning:stand_up',
      targetId: 'none',
      originalInput: 'stand up',
    });

    // Find the perceptible event that was dispatched
    const perceptibleEvent = testEnv.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );

    expect(perceptibleEvent).toBeDefined();

    // Validate the perceptible event against the schema
    const isValid = validatePerceptibleEvent(perceptibleEvent.payload);

    if (!isValid) {
      console.log('Validation errors:', validatePerceptibleEvent.errors);
    }

    // This should now pass after the fix
    expect(isValid).toBe(true);
    expect(validatePerceptibleEvent.errors).toBeNull();

    // Verify the corrected values
    expect(perceptibleEvent.payload.perceptionType).toBe('action_self_general');
    expect(perceptibleEvent.payload.targetId).toBe(null);

    // Verify that witness DOES receive the perceptible log entry
    const witness = testEnv.entityManager.getEntityInstance('test:witness1');
    const logEntries =
      witness.components[PERCEPTION_LOG_COMPONENT_ID]?.logEntries || [];

    // Should have one entry now because the validation passes
    expect(logEntries).toHaveLength(1);
    expect(logEntries[0].descriptionText).toBe(
      'Alice stands up from their kneeling position.'
    );
    expect(logEntries[0].perceptionType).toBe('action_self_general');
  });

  it('validates perceptionType enum values from schema', () => {
    const validTypes =
      perceptibleEventSchema.payloadSchema.properties.perceptionType.enum;

    expect(validTypes).not.toContain('action_general'); // Invalid
    expect(validTypes).toContain('action_self_general'); // Valid for self-actions
    expect(validTypes).toContain('action_target_general'); // Valid for target-actions
  });

  it('demonstrates valid payload structure with corrected perceptionType', () => {
    // Create a mock payload with the corrected perceptionType
    const correctedPayload = {
      eventName: 'core:perceptible_event',
      locationId: 'throne_room',
      descriptionText: 'Alice stands up from their kneeling position.',
      timestamp: new Date().toISOString(),
      perceptionType: 'action_self_general', // Corrected value
      actorId: 'test:actor1',
      targetId: null, // Using null instead of "none"
      involvedEntities: [],
      contextualData: {},
    };

    const isValid = validatePerceptibleEvent(correctedPayload);

    if (!isValid) {
      console.log('Validation errors:', validatePerceptibleEvent.errors);
    }

    // This should pass with the corrected values
    expect(isValid).toBe(true);
    expect(correctedPayload.perceptionType).toBe('action_self_general');
    expect(correctedPayload.targetId).toBe(null);
  });
});
