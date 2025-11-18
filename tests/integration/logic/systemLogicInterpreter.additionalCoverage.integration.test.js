import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import SystemLogicInterpreter from '../../../src/logic/systemLogicInterpreter.js';
import EventBus from '../../../src/events/eventBus.js';
import OperationRegistry from '../../../src/logic/operationRegistry.js';
import OperationInterpreter from '../../../src/logic/operationInterpreter.js';
import jsonLogic from 'json-logic-js';
import JsonLogicEvaluationService, * as jsonLogicServiceModule from '../../../src/logic/jsonLogicEvaluationService.js';
import * as conditionRefResolver from '../../../src/utils/conditionRefResolver.js';
import * as contextAssembler from '../../../src/logic/contextAssembler.js';
import * as actionSequenceModule from '../../../src/logic/actionSequence.js';
import { ATTEMPT_ACTION_ID } from '../../../src/constants/eventIds.js';

/**
 *
 */
function createLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

/**
 *
 * @param rules
 * @param options
 */
function createInterpreterWithRules(rules, options = {}) {
  const logger = options.logger ?? createLogger();
  const eventBus = options.eventBus ?? new EventBus({ logger });
  const dataRegistry = options.dataRegistry ?? {
    getAllSystemRules: jest.fn(() => rules),
  };

  const jsonLogic =
    options.jsonLogic ??
    new JsonLogicEvaluationService({
      logger,
      gameDataRepository: {
        getConditionDefinition: jest.fn(() => null),
      },
    });

  const entities = options.entities ?? {};
  const entityManager =
    options.entityManager ?? {
      getEntityInstance: jest.fn((id) => entities[id] ?? null),
      getComponentData: jest.fn(),
      hasComponent: jest.fn(() => false),
      getAllComponentTypesForEntity: jest.fn(() => []),
    };

  const operationRegistry =
    options.operationRegistry ?? new OperationRegistry({ logger });

  const logHandler =
    options.logHandler ??
    jest.fn(async () => ({ success: true }));

  if (!options.operationRegistry) {
    operationRegistry.register('LOG', async (params, ctx) => {
      logHandler(params, ctx);
      return { success: true };
    });
  }

  const operationInterpreter =
    options.operationInterpreter ??
    new OperationInterpreter({ logger, operationRegistry });

  const bodyGraphService =
    options.bodyGraphService ?? {
      hasPartWithComponentValue: jest.fn().mockReturnValue({ found: false }),
    };

  const interpreter = new SystemLogicInterpreter({
    logger,
    eventBus,
    dataRegistry,
    jsonLogicEvaluationService: jsonLogic,
    entityManager,
    operationInterpreter,
    bodyGraphService,
  });

  return {
    interpreter,
    logger,
    eventBus,
    dataRegistry,
    jsonLogic,
    entityManager,
    operationRegistry,
    operationInterpreter,
    bodyGraphService,
    logHandler,
  };
}

/**
 *
 * @param mockFn
 * @param substring
 */
function expectLogContains(mockFn, substring) {
  const messages = mockFn.mock.calls.map((call) => call[0]);
  expect(
    messages.some(
      (entry) => typeof entry === 'string' && entry.includes(substring)
    )
  ).toBe(true);
}

describe('SystemLogicInterpreter additional integration coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('guards initialize and unsubscribes on shutdown when no rules are available', () => {
    const { interpreter, logger, eventBus, dataRegistry } =
      createInterpreterWithRules([]);
    const subscribeSpy = jest.spyOn(eventBus, 'subscribe');
    const unsubscribeSpy = jest.spyOn(eventBus, 'unsubscribe');

    interpreter.initialize();

    expect(dataRegistry.getAllSystemRules).toHaveBeenCalled();
    expect(subscribeSpy).not.toHaveBeenCalled();
    expectLogContains(
      logger.warn,
      'No system rules loaded – interpreter will remain idle.'
    );

    interpreter.initialize();
    expectLogContains(logger.warn, 'SystemLogicInterpreter already initialized.');

    interpreter.shutdown();

    expect(unsubscribeSpy).toHaveBeenCalledWith('*', expect.any(Function));
    expectLogContains(logger.debug, 'SystemLogicInterpreter: shut down.');

    unsubscribeSpy.mockClear();
    interpreter.shutdown();
    expect(unsubscribeSpy).not.toHaveBeenCalled();
  });

  it('processEvent converts event payloads and exits early when no cached rules match', async () => {
    const rules = [
      {
        rule_id: 'other-rule',
        event_type: 'other:event',
        actions: [{ type: 'LOG', parameters: { message: 'unused' } }],
      },
    ];
    const { interpreter, logger } = createInterpreterWithRules(rules);

    interpreter.initialize();

    await interpreter.processEvent({
      eventType: 'missing:event',
      payload: { actorId: 'actor-z' },
    });

    expectLogContains(
      logger.debug,
      '🎯 [SystemLogicInterpreter] No rules found for event type: missing:event'
    );
  });

  it('resolves rule references and recovers when reference resolution fails', async () => {
    const specialRule = {
      rule_id: 'handle_sit_down_at_distance',
      event_type: 'special:event',
      actions: [{ type: 'LOG', parameters: { message: 'special' } }],
    };
    const brokenRule = {
      rule_id: 'broken_rule',
      event_type: 'broken:event',
      condition: { condition_ref: 'missing' },
      actions: [{ type: 'LOG', parameters: { message: 'broken' } }],
    };

    const resolveSpy = jest
      .spyOn(conditionRefResolver, 'resolveConditionRefs')
      .mockImplementation((rule, registry, logger) => {
        if (rule.rule_id === 'broken_rule') {
          throw new Error('missing condition');
        }
        return rule;
      });

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const entityFixtures = {
      'actor-1': {
        id: 'actor-1',
        components: {},
        getComponentData: jest.fn(),
        hasComponent: jest.fn(),
      },
      'target-1': {
        id: 'target-1',
        components: {},
        getComponentData: jest.fn(),
        hasComponent: jest.fn(),
      },
    };

    const { interpreter, logger, eventBus } = createInterpreterWithRules(
      [specialRule, brokenRule],
      { entities: entityFixtures }
    );
    const subscribeSpy = jest.spyOn(eventBus, 'subscribe');

    interpreter.initialize();

    expect(resolveSpy).toHaveBeenCalled();
    expectLogContains(
      logger.error,
      "Failed to resolve condition references in rule 'broken_rule': missing condition"
    );
    expect(subscribeSpy).toHaveBeenCalledWith('*', expect.any(Function));

    await interpreter.processEvent({
      eventType: 'special:event',
      payload: { actorId: 'actor-1', targetId: 'target-1' },
    });

    expectLogContains(
      logger.debug,
      "[DEBUG] #loadAndCacheRules - RAW rule 'handle_sit_down_at_distance' from dataRegistry:"
    );

    consoleSpy.mockRestore();
    resolveSpy.mockRestore();
  });

  it('merges ATTEMPT_ACTION rules, resolves targets from multi-target payloads, and forwards trace data', async () => {
    const actor = {
      id: 'hero',
      components: {},
      getComponentData: jest.fn(),
      hasComponent: jest.fn(),
    };
    const target = {
      id: 'friend',
      components: {},
      getComponentData: jest.fn(),
      hasComponent: jest.fn(),
    };

    const rules = [
      {
        rule_id: 'specific_attempt',
        event_type: ATTEMPT_ACTION_ID,
        condition: {
          '==': [{ var: 'event.payload.actionId' }, 'action:target'],
        },
        actions: [{ type: 'LOG', parameters: { message: 'specific' } }],
      },
      {
        rule_id: 'general_attempt',
        event_type: ATTEMPT_ACTION_ID,
        actions: [{ type: 'LOG', parameters: { message: 'general' } }],
      },
    ];

    const logHandler = jest.fn(async () => ({ success: true }));
    const { interpreter, entityManager, logger } = createInterpreterWithRules(
      rules,
      {
        entities: { hero: actor, friend: target },
        logHandler,
      }
    );

    interpreter.initialize();

    const trace = {
      captureOperationStart: jest.fn(),
      captureOperationResult: jest.fn(),
    };

    await interpreter.processEvent({
      eventType: ATTEMPT_ACTION_ID,
      payload: {
        actorId: 'hero',
        targets: { primary: 'friend' },
        actionId: 'action:target',
        trace,
      },
    });

    await interpreter.processEvent({
      eventType: ATTEMPT_ACTION_ID,
      payload: {
        actorId: 'hero',
        targets: { primary: { entityId: 'friend' } },
        actionId: 'action:target',
        trace,
      },
    });

    expect(logHandler).toHaveBeenCalledTimes(4);
    expect(entityManager.getEntityInstance).toHaveBeenCalledWith('friend');
    expectLogContains(
      logger.debug,
      '🔍 [SystemLogicInterpreter] Trace object found in event payload, passing to execution context'
    );
  });

  it('skips ATTEMPT_ACTION rules when only action-specific entries exist and the actionId is missing', async () => {
    const rules = [
      {
        rule_id: 'specific_only',
        event_type: ATTEMPT_ACTION_ID,
        condition: {
          '==': [{ var: 'event.payload.actionId' }, 'special'],
        },
        actions: [{ type: 'LOG', parameters: { message: 'specific' } }],
      },
    ];

    const { interpreter, logger } = createInterpreterWithRules(rules);
    interpreter.initialize();

    await interpreter.processEvent({
      eventType: ATTEMPT_ACTION_ID,
      payload: { actorId: 'hero' },
    });

    expectLogContains(
      logger.debug,
      '🎯 [SystemLogicInterpreter] No matching rules for event: core:attempt_action'
    );
  });

  it('logs when rules contain no executable actions', async () => {
    const rules = [
      {
        rule_id: 'no-actions',
        event_type: 'noActions:event',
        actions: null,
      },
    ];

    const { interpreter, logger } = createInterpreterWithRules(rules);
    interpreter.initialize();

    await interpreter.processEvent({
      eventType: 'noActions:event',
      payload: {},
    });

    expectLogContains(
      logger.debug,
      "[DEBUG] #processRule - NO ACTIONS to execute for rule 'no-actions' - rule.actions is not a non-empty array"
    );
    expectLogContains(
      logger.debug,
      '⚠️ [SystemLogicInterpreter] Rule no-actions: No actions to execute'
    );
  });

  it('reports when action execution fails inside _executeActions', async () => {
    const rules = [
      {
        rule_id: 'failing-actions',
        event_type: 'failing:event',
        actions: [{ type: 'LOG', parameters: { message: 'fail' } }],
      },
    ];

    const sequenceSpy = jest
      .spyOn(actionSequenceModule, 'executeActionSequence')
      .mockImplementation(async () => {
        throw new Error('sequence boom');
      });

    const { interpreter, logger } = createInterpreterWithRules(rules);
    interpreter.initialize();

    await interpreter.processEvent({
      eventType: 'failing:event',
      payload: {},
    });

    expectLogContains(
      logger.error,
      '❌ [SystemLogicInterpreter] Rule failing-actions: Error during action sequence:'
    );

    sequenceSpy.mockRestore();
  });

  it('logs and aborts when nested execution context assembly fails', async () => {
    const rules = [
      {
        rule_id: 'context-error',
        event_type: 'context:event',
        actions: [{ type: 'LOG', parameters: { message: 'unused' } }],
      },
    ];

    const contextSpy = jest
      .spyOn(contextAssembler, 'createNestedExecutionContext')
      .mockImplementation(() => {
        throw new Error('context boom');
      });

    const { interpreter, logger } = createInterpreterWithRules(rules);
    interpreter.initialize();

    await interpreter.processEvent({
      eventType: 'context:event',
      payload: {},
    });

    expectLogContains(
      logger.error,
      '❌ [SystemLogicInterpreter] Failed to build JsonLogic context for event'
    );

    contextSpy.mockRestore();
  });

  it('skips rule actions when condition evaluation reports an error', async () => {
    const rules = [
      {
        rule_id: 'error-condition',
        event_type: 'errorCondition:event',
        condition: { var: 'event.payload.flag' },
        actions: [{ type: 'LOG', parameters: { message: 'skip' } }],
      },
    ];

    const evalSpy = jest
      .spyOn(jsonLogicServiceModule, 'evaluateConditionWithLogging')
      .mockReturnValue({ result: false, errored: true, error: new Error('oops') });

    const { interpreter, logger } = createInterpreterWithRules(rules);
    interpreter.initialize();

    await interpreter.processEvent({
      eventType: 'errorCondition:event',
      payload: {},
    });

    expectLogContains(
      logger.debug,
      "Rule 'error-condition' actions skipped for event 'errorCondition:event' due to error during condition evaluation."
    );
    expect(evalSpy).toHaveBeenCalled();
  });

  it('executes the custom hasBodyPartWithComponentValue json-logic operation', async () => {
    const handler = jest.fn(() => true);
    const originalAddOperation = jsonLogic.add_operation.bind(jsonLogic);
    let capturedOperation;
    const addOperationSpy = jest
      .spyOn(jsonLogic, 'add_operation')
      .mockImplementation((name, fn) => {
        if (name === 'hasBodyPartWithComponentValue') {
          capturedOperation = fn;
        }
        return originalAddOperation(name, fn);
      });

    const { interpreter, operationRegistry } = createInterpreterWithRules([]);
    operationRegistry.register('HAS_BODY_PART_WITH_COMPONENT_VALUE', handler);

    interpreter.initialize();

    const evaluationData = {
      bodyContext: { bodyPartId: 'torso', component: 'core:muscle', value: 'strong' },
      targetArgs: { actorId: 'hero' },
    };
    expect(capturedOperation).toBeInstanceOf(Function);
    const result = await capturedOperation(
      [evaluationData.bodyContext, evaluationData.targetArgs],
      evaluationData
    );

    expect(result).toBe(true);
    expect(handler).toHaveBeenCalledWith(
      [evaluationData.bodyContext, evaluationData.targetArgs],
      expect.objectContaining({ evaluationContext: evaluationData })
    );

    // The handler executes and returns `true`, and the operation interpreter
    // propagates that result back to JsonLogic.
    expect(handler).toHaveReturnedWith(true);

    addOperationSpy.mockRestore();
  });
});
