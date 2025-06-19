// src/tests/logic/systemLogicInterpreter.integration.test.js

import SystemLogicInterpreter from '../../src/logic/systemLogicInterpreter.js';
import EventBus from '../../src/events/eventBus.js';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import OperationInterpreter from '../../src/logic/operationInterpreter.js'; // Corrected path
import OperationRegistry from '../../src/logic/operationRegistry.js'; // Corrected path

// --- Mock Core Services ---
// mockLogger, mockDataRegistry, mockJsonLogicEvaluationService, mockEntityManager
// definitions remain the same as in your provided file.

// --- RE-DEFINE mockLogger to match the structure used in previous successful tests ---
let mockLogger; // Will be reset in beforeEach

describe('SystemLogicInterpreter Integration Tests', () => {
  let eventBus;
  let operationInterpreterRealInstance; // Use real instance, spy on its execute method
  let operationRegistry;
  let executeSpy;
  let mockLogHandler; // Mock for the LOG operation handler

  // --- Test Rule Definitions (remain the same) ---
  const TEST_ACTION_LOG = {
    type: 'LOG',
    parameters: { message: 'Action Executed!', level: 'warn' },
  };
  const RULE_NO_COND_BASIC = {
    rule_id: 'RULE_NO_COND_BASIC',
    event_type: 'test:event_no_condition',
    actions: [TEST_ACTION_LOG],
  };
  const RULE_COND_TRUE_BASIC = {
    rule_id: 'RULE_COND_TRUE_BASIC',
    event_type: 'test:event_condition_true',
    condition: { '==': [{ var: 'event.payload.value' }, true] },
    actions: [TEST_ACTION_LOG],
  };
  const RULE_COND_FALSE_BASIC = {
    rule_id: 'RULE_COND_FALSE_BASIC',
    event_type: 'test:event_condition_false',
    condition: { '==': [{ var: 'event.payload.value' }, false] },
    actions: [TEST_ACTION_LOG],
  };

  // --- Mock Event Payloads & Entities (remain the same) ---
  const MOCK_PAYLOAD_ACTOR_TARGET = {
    actorId: 'mockActor1',
    targetId: 'mockTarget1',
  };
  const MOCK_ENTITY_ACTOR = {
    id: 'mockActor1',
    name: 'Mock Actor 1',
    definitionId: 'def:actor',
    components: {},
    getComponentData: jest.fn(),
    hasComponent: jest.fn(),
  };
  const MOCK_ENTITY_TARGET = {
    id: 'mockTarget1',
    name: 'Mock Target 1',
    definitionId: 'def:target',
    components: {},
    getComponentData: jest.fn(),
    hasComponent: jest.fn(),
  };

  // --- CONTEXT EXPECTATION HELPERS (copied from previous successful fixes) ---
  const createExpectedFlatJsonLogicContext = (
    event,
    actorEntity,
    targetEntity
  ) => {
    return {
      event: expect.objectContaining({
        type: event.type,
        payload:
          event.payload === undefined || event.payload === null
            ? null
            : expect.objectContaining(event.payload),
      }),
      actor: actorEntity
        ? expect.objectContaining({
            id: actorEntity.id,
            components: expect.any(Object),
          })
        : null,
      target: targetEntity
        ? expect.objectContaining({
            id: targetEntity.id,
            components: expect.any(Object),
          })
        : null,
      context: expect.any(Object),
      entities: expect.any(Object),
      globals: expect.any(Object),
      // No 'logger' property here from createJsonLogicContext's direct return
    };
  };

  const createExpectedNestedContext = (
    event,
    actorEntity,
    targetEntity,
    topLevelLoggerInstance
  ) => {
    const flatLogicContextForNesting = createExpectedFlatJsonLogicContext(
      event,
      actorEntity,
      targetEntity
    );
    return {
      event: expect.objectContaining({
        type: event.type,
        payload:
          event.payload === undefined || event.payload === null
            ? null
            : expect.objectContaining(event.payload),
      }),
      actor: actorEntity
        ? expect.objectContaining({
            id: actorEntity.id,
            components: expect.any(Object),
          })
        : null,
      target: targetEntity
        ? expect.objectContaining({
            id: targetEntity.id,
            components: expect.any(Object),
          })
        : null,
      logger: expect.any(Object),
      evaluationContext: flatLogicContextForNesting,
    };
  };
  // --- END CONTEXT EXPECTATION HELPERS ---

  // Mocks for services that SystemLogicInterpreter depends on directly
  let mockDataRegistry;
  let mockJsonLogicEvaluationService;
  let mockEntityManager;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      // Define mockLogger here so it's accessible to helpers
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      // Add loggedMessages and _log if you need to inspect all log calls for sequence
    };
    mockDataRegistry = { getAllSystemRules: jest.fn() };
    mockJsonLogicEvaluationService = { evaluate: jest.fn() };
    mockEntityManager = {
      getEntityInstance: jest.fn().mockImplementation((entityId) => {
        if (entityId === 'mockActor1') return MOCK_ENTITY_ACTOR;
        if (entityId === 'mockTarget1') return MOCK_ENTITY_TARGET;
        return undefined;
      }),
      getComponentData: jest.fn(),
      hasComponent: jest.fn(),
    };

    eventBus = new EventBus(); // Assuming EventBus doesn't need complex mocking for these tests
    operationRegistry = new OperationRegistry({ logger: mockLogger });
    mockLogHandler = jest.fn();
    operationRegistry.register('LOG', mockLogHandler);

    // Use a real OperationInterpreter instance and spy on its 'execute' method
    operationInterpreterRealInstance = new OperationInterpreter({
      logger: mockLogger,
      operationRegistry: operationRegistry,
    });
    executeSpy = jest.spyOn(operationInterpreterRealInstance, 'execute');
  });

  afterEach(() => {
    if (executeSpy) executeSpy.mockRestore();
    jest.restoreAllMocks();
  });

  /**
   *
   * @param rule
   * @param eventPayload
   * @param evaluateResult
   */
  async function arrangeAndAct(rule, eventPayload, evaluateResult = null) {
    mockDataRegistry.getAllSystemRules.mockReturnValue([rule]);
    if (evaluateResult !== null) {
      mockJsonLogicEvaluationService.evaluate.mockReturnValue(evaluateResult);
    } else {
      mockJsonLogicEvaluationService.evaluate.mockClear();
    }

    // Create interpreter instance inside arrangeAndAct to use fresh mocks for each test call
    const interpreter = new SystemLogicInterpreter({
      logger: mockLogger,
      eventBus: eventBus,
      dataRegistry: mockDataRegistry,
      jsonLogicEvaluationService: mockJsonLogicEvaluationService,
      entityManager: mockEntityManager,
      operationInterpreter: operationInterpreterRealInstance, // Pass the spied-upon instance
    });
    interpreter.initialize();

    const eventType = rule.event_type;
    await eventBus.dispatch(eventType, eventPayload);
    return { eventType, eventPayload };
  }

  it('executes actions when rule has no condition', async () => {
    const eventPayload = MOCK_PAYLOAD_ACTOR_TARGET;
    const { eventType } = await arrangeAndAct(RULE_NO_COND_BASIC, eventPayload);

    expect(mockLogger.error).not.toHaveBeenCalledWith(
      expect.stringContaining('Failed to assemble')
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(`Cached rule '${RULE_NO_COND_BASIC.rule_id}'`)
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringMatching(
        new RegExp(
          `^SystemLogicInterpreter: Received event: ${eventType}\\. Found \\d+ potential rule\\(s\\)\\.$`
        )
      ),
      { payload: eventPayload }
    );
    // These logs should now be present and match
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `[Event: ${eventType}] Assembling execution context via createNestedExecutionContext... (ActorID: ${eventPayload.actorId}, TargetID: ${eventPayload.targetId})`
      )
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `[Event: ${eventType}] createNestedExecutionContext returned a valid ExecutionContext.`
      )
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `[Event: ${eventType}] Final ExecutionContext (nested structure) assembled successfully.`
      )
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `[Rule ${RULE_NO_COND_BASIC.rule_id}] No condition defined or condition is empty. Defaulting to passed.`
      )
    );

    expect(executeSpy).toHaveBeenCalledTimes(1);
    const expectedNestedCtx = createExpectedNestedContext(
      { type: eventType, payload: eventPayload },
      MOCK_ENTITY_ACTOR,
      MOCK_ENTITY_TARGET,
      mockLogger
    );
    expect(executeSpy).toHaveBeenCalledWith(
      RULE_NO_COND_BASIC.actions[0],
      expectedNestedCtx
    );

    expect(mockLogHandler).toHaveBeenCalledTimes(1);
    expect(mockLogHandler).toHaveBeenCalledWith(
      TEST_ACTION_LOG.parameters,
      expectedNestedCtx
    );
    expect(mockJsonLogicEvaluationService.evaluate).not.toHaveBeenCalled();
  });

  it('executes actions when rule condition evaluates to true', async () => {
    const eventPayload = { ...MOCK_PAYLOAD_ACTOR_TARGET, value: true };
    const { eventType } = await arrangeAndAct(
      RULE_COND_TRUE_BASIC,
      eventPayload,
      true
    );

    expect(mockLogger.error).not.toHaveBeenCalledWith(
      expect.stringContaining('Failed to assemble')
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(`Cached rule '${RULE_COND_TRUE_BASIC.rule_id}'`)
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringMatching(
        new RegExp(
          `^SystemLogicInterpreter: Received event: ${eventType}\\. Found \\d+ potential rule\\(s\\)\\.$`
        )
      ),
      { payload: eventPayload }
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `[Event: ${eventType}] Assembling execution context via createNestedExecutionContext...`
      )
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `[Event: ${eventType}] Final ExecutionContext (nested structure) assembled successfully.`
      )
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `[Rule ${RULE_COND_TRUE_BASIC.rule_id}] Condition found. Evaluating using jsonLogicDataForEval...`
      )
    );

    const expectedFlatCtx = createExpectedFlatJsonLogicContext(
      { type: eventType, payload: eventPayload },
      MOCK_ENTITY_ACTOR,
      MOCK_ENTITY_TARGET
    );
    expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(
      RULE_COND_TRUE_BASIC.condition,
      expectedFlatCtx
    );
    expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledTimes(1);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `[Rule ${RULE_COND_TRUE_BASIC.rule_id}] Condition evaluation raw result: true`
      )
    );

    expect(executeSpy).toHaveBeenCalledTimes(1);
    const expectedNestedCtx = createExpectedNestedContext(
      { type: eventType, payload: eventPayload },
      MOCK_ENTITY_ACTOR,
      MOCK_ENTITY_TARGET,
      mockLogger
    );
    expect(executeSpy).toHaveBeenCalledWith(
      RULE_COND_TRUE_BASIC.actions[0],
      expectedNestedCtx
    );

    expect(mockLogHandler).toHaveBeenCalledTimes(1);
    expect(mockLogHandler).toHaveBeenCalledWith(
      TEST_ACTION_LOG.parameters,
      expectedNestedCtx
    );
  });

  it('does NOT execute actions when rule condition evaluates to false', async () => {
    const eventPayload = { ...MOCK_PAYLOAD_ACTOR_TARGET, value: true }; // value is true
    const { eventType } = await arrangeAndAct(
      RULE_COND_FALSE_BASIC,
      eventPayload,
      false
    ); // condition expects false, evaluate returns false

    expect(mockLogger.error).not.toHaveBeenCalledWith(
      expect.stringContaining('Failed to assemble')
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(`Cached rule '${RULE_COND_FALSE_BASIC.rule_id}'`)
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringMatching(
        new RegExp(
          `^SystemLogicInterpreter: Received event: ${eventType}\\. Found \\d+ potential rule\\(s\\)\\.$`
        )
      ),
      { payload: eventPayload }
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `[Event: ${eventType}] Assembling execution context via createNestedExecutionContext...`
      )
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `[Event: ${eventType}] Final ExecutionContext (nested structure) assembled successfully.`
      )
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `[Rule ${RULE_COND_FALSE_BASIC.rule_id}] Condition found. Evaluating using jsonLogicDataForEval...`
      )
    );

    const expectedFlatCtx = createExpectedFlatJsonLogicContext(
      { type: eventType, payload: eventPayload },
      MOCK_ENTITY_ACTOR,
      MOCK_ENTITY_TARGET
    );
    expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(
      RULE_COND_FALSE_BASIC.condition,
      expectedFlatCtx
    );
    expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledTimes(1);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `[Rule ${RULE_COND_FALSE_BASIC.rule_id}] Condition evaluation raw result: false`
      )
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `Rule '${RULE_COND_FALSE_BASIC.rule_id}' actions skipped for event '${RULE_COND_FALSE_BASIC.event_type}' due to condition evaluating to false.`
      )
    );
    expect(executeSpy).not.toHaveBeenCalled();
    expect(mockLogHandler).not.toHaveBeenCalled();
  });
});
