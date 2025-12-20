/**
 * @file Example integration test using the new rule testing utilities
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import {
  createRuleTestEnvironment,
  createSystemLogicInterpreterWithHandlers,
  generateTestEvents,
} from '../../../common/rules/ruleTestUtilities.js';
import {
  measureRulePerformance,
  generatePerformanceReport,
} from '../../../common/rules/performanceTestingUtils.js';
import followRule from '../../../../data/mods/companionship/rules/follow.rule.json';
import logSuccessAndEndTurn from '../../../../data/mods/core/macros/logSuccessAndEndTurn.macro.json';
import logFailureAndEndTurn from '../../../../data/mods/core/macros/logFailureAndEndTurn.macro.json';
import { expandMacros } from '../../../../src/utils/macroUtils.js';
import CheckFollowCycleHandler from '../../../../src/logic/operationHandlers/checkFollowCycleHandler.js';
import EstablishFollowRelationHandler from '../../../../src/logic/operationHandlers/establishFollowRelationHandler.js';
import QueryComponentHandler from '../../../../src/logic/operationHandlers/queryComponentHandler.js';
import DispatchEventHandler from '../../../../src/logic/operationHandlers/dispatchEventHandler.js';
import GetTimestampHandler from '../../../../src/logic/operationHandlers/getTimestampHandler.js';
import EndTurnHandler from '../../../../src/logic/operationHandlers/endTurnHandler.js';
import SetVariableHandler from '../../../../src/logic/operationHandlers/setVariableHandler.js';
import GetNameHandler from '../../../../src/logic/operationHandlers/getNameHandler.js';
import RebuildLeaderListCacheHandler from '../../../../src/logic/operationHandlers/rebuildLeaderListCacheHandler.js';
import DispatchPerceptibleEventHandler from '../../../../src/logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import { ATTEMPT_ACTION_ID } from '../../../../src/constants/eventIds.js';
import {
  FOLLOWING_COMPONENT_ID,
  LEADING_COMPONENT_ID,
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
  ACTOR_COMPONENT_ID,
} from '../../../../src/constants/componentIds.js';

describe('Example Rule Test with Utilities', () => {
  let testEnv;
  let interpreter;
  let interpreterCleanup;

  beforeEach(() => {
    // Expand macros in the follow rule
    const macroRegistry = {
      get: (type, id) => {
        if (type === 'macros') {
          if (id === 'core:logSuccessAndEndTurn') return logSuccessAndEndTurn;
          if (id === 'core:logFailureAndEndTurn') return logFailureAndEndTurn;
        }
        return undefined;
      },
    };
    const expandedRule = {
      ...followRule,
      actions: expandMacros(followRule.actions, macroRegistry, null),
    };

    // Create test environment with entities
    testEnv = createRuleTestEnvironment({
      entities: [
        {
          id: 'follower1',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Follower' },
            [POSITION_COMPONENT_ID]: { locationId: 'room1' },
            [ACTOR_COMPONENT_ID]: {},
          },
        },
        {
          id: 'leader1',
          components: {
            [NAME_COMPONENT_ID]: { text: 'Leader' },
            [POSITION_COMPONENT_ID]: { locationId: 'room1' },
            [ACTOR_COMPONENT_ID]: {},
          },
        },
      ],
      rules: [expandedRule],
      conditions: {
        'companionship:event-is-action-follow': {
          id: 'companionship:event-is-action-follow',
          description:
            'Checks if the triggering event is for the companionship:follow action.',
          logic: {
            '==': [{ var: 'event.payload.actionId' }, 'companionship:follow'],
          },
        },
      },
    });

    // Create rebuild leader list cache handler
    const rebuildLeaderListCacheHandler = new RebuildLeaderListCacheHandler({
      entityManager: testEnv.entityManager,
      logger: testEnv.logger,
      safeEventDispatcher: testEnv.safeEventDispatcher,
    });

    // Create handlers
    const handlers = {
      CHECK_FOLLOW_CYCLE: new CheckFollowCycleHandler({
        entityManager: testEnv.entityManager,
        logger: testEnv.logger,
        safeEventDispatcher: testEnv.safeEventDispatcher,
      }),
      ESTABLISH_FOLLOW_RELATION: new EstablishFollowRelationHandler({
        entityManager: testEnv.entityManager,
        logger: testEnv.logger,
        safeEventDispatcher: testEnv.safeEventDispatcher,
        rebuildLeaderListCacheHandler,
      }),
      QUERY_COMPONENT: new QueryComponentHandler({
        entityManager: testEnv.entityManager,
        logger: testEnv.logger,
        safeEventDispatcher: testEnv.safeEventDispatcher,
      }),
      GET_NAME: new GetNameHandler({
        entityManager: testEnv.entityManager,
        logger: testEnv.logger,
        safeEventDispatcher: testEnv.safeEventDispatcher,
      }),
      GET_TIMESTAMP: new GetTimestampHandler({ logger: testEnv.logger }),
      DISPATCH_EVENT: new DispatchEventHandler({
        dispatcher: testEnv.eventBus,
        logger: testEnv.logger,
      }),
      END_TURN: new EndTurnHandler({
        safeEventDispatcher: testEnv.safeEventDispatcher,
        logger: testEnv.logger,
      }),
      SET_VARIABLE: new SetVariableHandler({ logger: testEnv.logger }),
      DISPATCH_PERCEPTIBLE_EVENT: new DispatchPerceptibleEventHandler({
        dispatcher: testEnv.safeEventDispatcher,
        logger: testEnv.logger,
        routingPolicyService: {
          validateAndHandle: jest.fn().mockReturnValue(true),
        },
      }),
      // Mock handler for REGENERATE_DESCRIPTION - satisfies fail-fast enforcement
      REGENERATE_DESCRIPTION: {
        execute: jest.fn().mockResolvedValue(undefined),
      },
    };

    // Create interpreter
    const result = createSystemLogicInterpreterWithHandlers(testEnv, handlers);
    interpreter = result.interpreter;
    interpreterCleanup = result.cleanup;
  });

  afterEach(() => {
    if (interpreterCleanup) {
      interpreterCleanup();
    }
    if (testEnv) {
      testEnv.cleanup();
    }
  });

  it('should handle follow action correctly', async () => {
    // Dispatch follow action
    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'follower1',
      actionId: 'companionship:follow',
      targetId: 'leader1',
      originalInput: 'follow leader1',
    });

    // Check results
    const followingData = testEnv.entityManager.getComponentData(
      'follower1',
      FOLLOWING_COMPONENT_ID
    );
    expect(followingData).toEqual({ leaderId: 'leader1' });

    const leadingData = testEnv.entityManager.getComponentData(
      'leader1',
      LEADING_COMPONENT_ID
    );
    expect(leadingData).toEqual({ followers: ['follower1'] });

    // Check captured events
    const eventTypes = testEnv.capturedEvents.map((e) => e.eventType);
    expect(eventTypes).toContain('core:display_successful_action_result');
    expect(eventTypes).toContain('core:turn_ended');
  });

  it('should generate various test events', () => {
    const events = generateTestEvents({
      actorId: 'follower1',
      targetId: 'leader1',
      includeActions: true,
      includeSystemEvents: true,
      includeEdgeCases: true,
    });

    expect(events.length).toBeGreaterThan(5);
    expect(events.some((e) => e.type === 'core:attempt_action')).toBe(true);
    expect(events.some((e) => e.type === 'core:turn_started')).toBe(true);
  });
});
