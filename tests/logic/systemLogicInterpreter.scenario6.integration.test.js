// src/tests/logic/systemLogicInterpreter.scenario6.integration.test.js

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../src/events/eventBus.js').default} EventBus */
/** @typedef {import('../../src/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../src/logic/jsonLogicEvaluationService.js').default} JsonLogicEvaluationService */
/** @typedef {import('../../src/entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../src/logic/defs.js').GameEvent} GameEvent */
/** @typedef {import('../../data/schemas/rule.schema.json').SystemRule} SystemRule */
// /** @typedef {import('../../logic/defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContextFlat */ // Flat context
// /** @typedef {import('../../logic/defs.js').ExecutionContext} ExecutionContextNested */ // Nested context
/** @typedef {import('../../src/entities/entity.js').default} Entity */

// --- Class Under Test ---
import SystemLogicInterpreter from '../../src/logic/systemLogicInterpreter.js';
import {
  describe,
  beforeEach,
  afterEach,
  it,
  expect,
  jest,
} from '@jest/globals';
import OperationInterpreter from '../../src/logic/operationInterpreter.js'; // Corrected path
import OperationRegistry from '../../src/logic/operationRegistry.js'; // Corrected path

// --- Mock Data Definitions (Constants for Scenario 6) ---
const MOCK_RULE_CONTEXT_ACCESS = {
  rule_id: 'RULE_SC6_CONTEXT_ACCESS',
  event_type: 'CustomEvent',
  condition: { '==': [{ var: 'event.payload.value' }, 'expected'] },
  actions: [
    {
      type: 'TEST_LOG_SUCCESS',
      parameters: { message: 'Context access successful!' },
    },
  ],
};
const MOCK_ENTITY_FOR_EVENT = {
  id: 'entity-context-test-1',
  components: { info: { description: 'Minimal entity for context assembly' } },
  getComponentData: function (type) {
    return this.components[type];
  },
  hasComponent: function (type) {
    return type in this.components;
  },
};
const MOCK_EVENT_CUSTOM_MATCHING = {
  type: 'CustomEvent',
  payload: {
    entityId: MOCK_ENTITY_FOR_EVENT.id,
    value: 'expected',
    otherData: 123,
  },
};
const MOCK_EVENT_CUSTOM_NON_MATCHING = {
  type: 'CustomEvent',
  payload: {
    entityId: MOCK_ENTITY_FOR_EVENT.id,
    value: 'wrong',
    otherData: 456,
  },
};

describe('SystemLogicInterpreter - Integration Tests - Scenario 6: Context Access (Event Payload)', () => {
  let mockLogger;
  let mockEventBus;
  let mockDataRegistry;
  let mockJsonLogicEvaluationService;
  let mockEntityManager;
  let operationInterpreterRealInstance; // Use real instance and spy
  let executeActionsSpy; // Spy on _executeActions
  let interpreter;
  let operationRegistry;
  let capturedEventListener = null;

  // --- REVISED CONTEXT EXPECTATION HELPERS (from previous successful fixes) ---

  // Helper for the FLAT JsonLogicEvaluationContext (direct output of createJsonLogicContext)
  // This is passed to JsonLogicEvaluationService.evaluate.
  // It does NOT have its own 'logger' property from createJsonLogicContext.
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
      entities: expect.any(Object), // createJsonLogicContext from contextAssembler.js adds these
      globals: expect.any(Object), // createJsonLogicContext from contextAssembler.js adds these
      // NO 'logger' property here by default from createJsonLogicContext
    };
  };

  // Helper for the NESTED finalNestedExecutionContext
  // This is passed to OperationInterpreter.execute and SystemLogicInterpreter._executeActions.
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
      logger: topLevelLoggerInstance, // Expect the exact top-level logger instance
      evaluationContext: flatLogicContextForNesting,
    };
  };

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      loggedMessages: [],
      _log(level, message, ...args) {
        this.loggedMessages.push({
          level,
          message,
          args: args.length > 0 ? args : undefined,
        });
      },
      info: jest.fn((m, ...a) => mockLogger._log('info', m, ...a)),
      warn: jest.fn((m, ...a) => mockLogger._log('warn', m, ...a)),
      error: jest.fn((m, ...a) => mockLogger._log('error', m, ...a)),
      debug: jest.fn((m, ...a) => mockLogger._log('debug', m, ...a)),
      clearLogs: () => {
        mockLogger.loggedMessages = [];
      },
    };
    capturedEventListener = null;
    mockEventBus = {
      subscribe: jest.fn((eventName, listener) => {
        if (eventName === '*') capturedEventListener = listener;
      }),
      dispatch: jest.fn(),
      listenerCount: jest.fn().mockReturnValue(1),
    };
    mockDataRegistry = {
      getAllSystemRules: jest.fn().mockReturnValue([]),
      getEntityDefinition: jest.fn(),
    };
    mockJsonLogicEvaluationService = { evaluate: jest.fn() };
    mockEntityManager = {
      getEntityInstance: jest.fn().mockImplementation((entityId) => {
        if (entityId === MOCK_ENTITY_FOR_EVENT.id) return MOCK_ENTITY_FOR_EVENT;
        return undefined;
      }),
      getComponentData: jest.fn(),
      hasComponent: jest.fn(),
    };

    operationRegistry = new OperationRegistry({ logger: mockLogger });
    // We need a real OperationInterpreter to pass to SystemLogicInterpreter
    // but we don't need to spy on its 'execute' for this test, we spy on SLI's '_executeActions'
    operationInterpreterRealInstance = new OperationInterpreter({
      logger: mockLogger,
      operationRegistry: operationRegistry,
    });

    interpreter = new SystemLogicInterpreter({
      logger: mockLogger,
      eventBus: mockEventBus,
      dataRegistry: mockDataRegistry,
      jsonLogicEvaluationService: mockJsonLogicEvaluationService,
      entityManager: mockEntityManager,
      operationInterpreter: operationInterpreterRealInstance,
    });

    // Spy on the real _executeActions method
    executeActionsSpy = jest.spyOn(interpreter, '_executeActions');
    // We can choose to mock its implementation if we don't want its side effects
    // or let the real one run if its effects are desired/benign for this test.
    // For now, let's just spy without changing implementation, assuming actions are simple.
    // If actions are complex or dispatch other events, mockImplementation might be better:
    // .mockImplementation((actions, context, scope) => { /* no-op or simple log */ });

    mockLogger.info.mockClear();
    mockLogger.clearLogs();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    capturedEventListener = null;
  });

  it('should execute action when event payload matches condition', () => {
    const rule = MOCK_RULE_CONTEXT_ACCESS;
    const event = MOCK_EVENT_CUSTOM_MATCHING; // entityId: 'entity-context-test-1'
    mockDataRegistry.getAllSystemRules.mockReturnValue([rule]);
    mockJsonLogicEvaluationService.evaluate.mockReturnValue(true); // Force condition to pass

    interpreter.initialize();
    expect(capturedEventListener).toBeInstanceOf(Function);
    capturedEventListener(event);

    expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledTimes(1);
    // JsonLogicEvaluationService.evaluate receives the FLAT context
    const expectedFlatCtx = createExpectedFlatJsonLogicContext(
      event,
      MOCK_ENTITY_FOR_EVENT,
      null
    );
    expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(
      rule.condition,
      expectedFlatCtx
    );

    expect(executeActionsSpy).toHaveBeenCalledTimes(1);
    // _executeActions (spied method) receives the FULL NESTED context
    const expectedNestedCtx = createExpectedNestedContext(
      event,
      MOCK_ENTITY_FOR_EVENT,
      null,
      mockLogger
    );
    expect(executeActionsSpy).toHaveBeenCalledWith(
      rule.actions,
      expectedNestedCtx, // Use the helper for the NESTED context structure
      expect.stringContaining(`Rule '${rule.rule_id}'`)
    );
  });

  it('should NOT execute action when event payload does not match condition', () => {
    const rule = MOCK_RULE_CONTEXT_ACCESS;
    const event = MOCK_EVENT_CUSTOM_NON_MATCHING; // entityId: 'entity-context-test-1'
    mockDataRegistry.getAllSystemRules.mockReturnValue([rule]);
    mockJsonLogicEvaluationService.evaluate.mockReturnValue(false); // Force condition to fail

    interpreter.initialize();
    expect(capturedEventListener).toBeInstanceOf(Function);
    capturedEventListener(event);

    expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledTimes(1);
    // JsonLogicEvaluationService.evaluate receives the FLAT context
    const expectedFlatCtx = createExpectedFlatJsonLogicContext(
      event,
      MOCK_ENTITY_FOR_EVENT,
      null
    );
    expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(
      rule.condition,
      expectedFlatCtx
    );

    expect(executeActionsSpy).not.toHaveBeenCalled();
    const skipLog = mockLogger.loggedMessages.find(
      (log) =>
        log.level === 'info' &&
        log.message.includes(`Rule '${rule.rule_id}' actions skipped`) &&
        log.message.includes('condition evaluating to false')
    );
    expect(skipLog).toBeDefined();
  });
});
