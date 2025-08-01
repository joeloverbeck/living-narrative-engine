/**
 * @file Integration tests for the intimacy:adjust_clothing multi-target action
 * @description Tests the complete flow of the adjust_clothing action from
 * discovery through rule execution, verifying enhanced event payload with
 * resolved target IDs
 */

import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../../src/constants/componentIds.js';
import { ATTEMPT_ACTION_ID } from '../../../../src/constants/eventIds.js';
import { createRuleTestEnvironment } from '../../../common/engine/systemLogicTestEnv.js';
import QueryComponentHandler from '../../../../src/logic/operationHandlers/queryComponentHandler.js';
import GetNameHandler from '../../../../src/logic/operationHandlers/getNameHandler.js';
import GetTimestampHandler from '../../../../src/logic/operationHandlers/getTimestampHandler.js';
import DispatchEventHandler from '../../../../src/logic/operationHandlers/dispatchEventHandler.js';
import DispatchPerceptibleEventHandler from '../../../../src/logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import EndTurnHandler from '../../../../src/logic/operationHandlers/endTurnHandler.js';
import SetVariableHandler from '../../../../src/logic/operationHandlers/setVariableHandler.js';
import CommandProcessor from '../../../../src/commands/commandProcessor.js';
import ConsoleLogger from '../../../../src/logging/consoleLogger.js';

/**
 * Creates handlers needed for adjust_clothing rule testing
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
  };
}

describe('intimacy:adjust_clothing multi-target action integration', () => {
  let testEnv;
  let commandProcessor;
  let eventDispatchService;
  let capturedEvents;

  beforeEach(() => {
    capturedEvents = [];

    // Mock the adjust_clothing rule that would process the event
    const adjustClothingRule = {
      id: 'intimacy:handle_adjust_clothing',
      name: 'Handle Adjust Clothing',
      description: 'Processes the adjust_clothing action',
      conditions: [
        {
          if: {
            '==': [{ var: 'event.actionId' }, 'intimacy:adjust_clothing'],
          },
        },
      ],
      actions: [
        {
          type: 'GET_NAME',
          params: { entityId: { var: 'event.actorId' } },
          assign: 'actorName',
        },
        {
          type: 'GET_NAME',
          params: { entityId: { var: 'event.primaryId' } },
          assign: 'targetName',
        },
        {
          type: 'GET_NAME',
          params: { entityId: { var: 'event.secondaryId' } },
          assign: 'clothingName',
        },
        {
          type: 'DISPATCH_PERCEPTIBLE_EVENT',
          params: {
            eventType: 'core:display_successful_action_result',
            payload: {
              message: {
                cat: [
                  { var: 'actorName' },
                  ' adjusts ',
                  { var: 'targetName' },
                  "'s ",
                  { var: 'clothingName' },
                  '.',
                ],
              },
              actorId: { var: 'event.actorId' },
              targetId: { var: 'event.primaryId' },
              clothingId: { var: 'event.secondaryId' },
            },
            location: { var: 'actor.locationId' },
            visibility: 'visible',
          },
        },
        {
          type: 'END_TURN',
          params: {
            actorId: { var: 'event.actorId' },
            success: true,
          },
        },
      ],
    };

    const dataRegistry = {
      getAllSystemRules: jest.fn().mockReturnValue([adjustClothingRule]),
      getConditionDefinition: jest.fn(),
    };

    testEnv = createRuleTestEnvironment({
      createHandlers,
      entities: [],
      rules: [adjustClothingRule],
      dataRegistry,
    });

    // Create command processor with event capture
    const logger = new ConsoleLogger('DEBUG');
    logger.debug = jest.fn();
    logger.info = jest.fn();
    logger.warn = jest.fn();
    logger.error = jest.fn();

    // Mock event dispatch service that captures events
    eventDispatchService = {
      dispatchWithErrorHandling: jest
        .fn()
        .mockImplementation((eventId, payload) => {
          capturedEvents.push({ eventId, payload });
          // Also dispatch to test environment's event bus
          testEnv.eventBus.dispatch(eventId, payload);
          return Promise.resolve(true);
        }),
    };

    const safeEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(true),
    };

    commandProcessor = new CommandProcessor({
      logger,
      safeEventDispatcher,
      eventDispatchService,
    });
  });

  afterEach(() => {
    if (testEnv) {
      testEnv.cleanup();
    }
  });

  it('dispatches enhanced event payload for adjust_clothing with resolved entity IDs', async () => {
    // Setup entities
    testEnv.reset([
      {
        id: 'amaia_castillo_instance',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Amaia Castillo' },
          [POSITION_COMPONENT_ID]: { locationId: 'bedroom' },
          'intimacy:closeness': {
            partners: ['p_erotica:iker_aguirre_instance'],
          },
        },
      },
      {
        id: 'p_erotica:iker_aguirre_instance',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Iker Aguirre' },
          [POSITION_COMPONENT_ID]: { locationId: 'bedroom' },
          'intimacy:closeness': { partners: ['amaia_castillo_instance'] },
          'clothing:equipped': {
            torso_upper: ['fd6a1e00-36b7-47cc-bdb2-4b65473614eb'],
          },
        },
      },
      {
        id: 'fd6a1e00-36b7-47cc-bdb2-4b65473614eb',
        components: {
          [NAME_COMPONENT_ID]: { text: 'denim trucker jacket' },
          'clothing:clothing': {
            slot: 'torso_upper',
            wornBy: 'p_erotica:iker_aguirre_instance',
          },
        },
      },
    ]);

    // Simulate the output from action discovery/formatting pipeline
    const actor = { id: 'amaia_castillo_instance' };
    const turnAction = {
      actionDefinitionId: 'intimacy:adjust_clothing',
      commandString: "adjust Iker Aguirre's denim trucker jacket",
      resolvedParameters: {
        isMultiTarget: true,
        targetIds: {
          primary: ['p_erotica:iker_aguirre_instance'],
          secondary: ['fd6a1e00-36b7-47cc-bdb2-4b65473614eb'],
        },
      },
    };

    // Dispatch the action through CommandProcessor
    const result = await commandProcessor.dispatchAction(actor, turnAction);

    // Verify command was successful
    expect(result.success).toBe(true);
    expect(result.actionResult.actionId).toBe('intimacy:adjust_clothing');

    // Verify enhanced payload was dispatched
    expect(capturedEvents.length).toBe(1);
    const { eventId, payload } = capturedEvents[0];

    expect(eventId).toBe(ATTEMPT_ACTION_ID);

    // Verify enhanced payload structure
    expect(payload).toMatchObject({
      eventName: ATTEMPT_ACTION_ID,
      actorId: 'amaia_castillo_instance',
      actionId: 'intimacy:adjust_clothing',
      originalInput: "adjust Iker Aguirre's denim trucker jacket",

      // Legacy fields for backward compatibility
      targetId: 'p_erotica:iker_aguirre_instance',
      primaryId: 'p_erotica:iker_aguirre_instance',
      secondaryId: 'fd6a1e00-36b7-47cc-bdb2-4b65473614eb',
      tertiaryId: null,

      // Comprehensive targets object
      targets: {
        primary: {
          entityId: 'p_erotica:iker_aguirre_instance',
          placeholder: 'primary',
          description: 'p_erotica:iker_aguirre_instance',
          resolvedFromContext: false,
        },
        secondary: {
          entityId: 'fd6a1e00-36b7-47cc-bdb2-4b65473614eb',
          placeholder: 'secondary',
          description: 'fd6a1e00-36b7-47cc-bdb2-4b65473614eb',
          resolvedFromContext: true,
          contextSource: 'primary',
        },
      },

      // Metadata
      resolvedTargetCount: 2,
      hasContextDependencies: true,
    });

    // For this test, we're focusing on the event payload enhancement
    // The rule processing is tested separately in rule-specific tests
    // The key achievement is that the enhanced payload is now available
    // for rules to use, fixing the "Unnamed Character" issue
  });

  it('handles adjust_clothing with missing secondary target gracefully', async () => {
    // Setup entities without clothing
    testEnv.reset([
      {
        id: 'actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Actor' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
        },
      },
      {
        id: 'target1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Target' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
        },
      },
    ]);

    const actor = { id: 'actor1' };
    const turnAction = {
      actionDefinitionId: 'intimacy:adjust_clothing',
      commandString: 'adjust clothing',
      resolvedParameters: {
        isMultiTarget: true,
        targetIds: {
          primary: ['target1'],
          // Note: no secondary target (no clothing found)
        },
      },
    };

    const result = await commandProcessor.dispatchAction(actor, turnAction);

    // Should still succeed but with reduced payload
    expect(result.success).toBe(true);

    const { payload } = capturedEvents[0];

    // Should have primary but no secondary
    expect(payload.primaryId).toBe('target1');
    expect(payload.secondaryId).toBeNull();

    // Should only have primary in targets
    expect(payload.targets).toBeDefined();
    expect(payload.targets.primary).toBeDefined();
    expect(payload.targets.secondary).toBeUndefined();

    expect(payload.resolvedTargetCount).toBe(1);
    expect(payload.hasContextDependencies).toBe(false);
  });

  it('maintains backward compatibility for rules expecting targetId', async () => {
    // This test verifies that the legacy targetId field is populated
    // for backward compatibility with existing rules

    const actor = { id: 'actor1' };
    const turnAction = {
      actionDefinitionId: 'intimacy:adjust_clothing',
      commandString: 'adjust clothing',
      resolvedParameters: {
        isMultiTarget: true,
        targetIds: {
          primary: ['primary_target_123'],
          secondary: ['secondary_target_456'],
        },
      },
    };

    await commandProcessor.dispatchAction(actor, turnAction);

    // Verify legacy targetId field is populated with primary target
    const { payload } = capturedEvents[0];
    expect(payload.targetId).toBe('primary_target_123');

    // Also verify all the enhanced fields are present
    expect(payload.primaryId).toBe('primary_target_123');
    expect(payload.secondaryId).toBe('secondary_target_456');
    expect(payload.targets).toBeDefined();
    expect(payload.targets.primary.entityId).toBe('primary_target_123');
    expect(payload.targets.secondary.entityId).toBe('secondary_target_456');
  });
});
