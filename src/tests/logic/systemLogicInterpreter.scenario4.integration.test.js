// src/tests/logic/systemLogicInterpreter.scenario4.integration.test.js

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../core/eventBus.js').default} EventBus */
/** @typedef {import('../../core/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../logic/jsonLogicEvaluationService.js').default} JsonLogicEvaluationService */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../logic/defs.js').GameEvent} GameEvent */
/** @typedef {import('../../../data/schemas/rule.schema.json').SystemRule} SystemRule */
/** @typedef {import('../../logic/defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../logic/operationInterpreter.js').default} OperationInterpreter */ // <-- ADDED TYPE DEF for clarity

// --- Class Under Test ---
import SystemLogicInterpreter from '../../logic/systemLogicInterpreter.js';
// Import jest functions directly
import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import OperationInterpreter from '../../logic/operationInterpreter';
import OperationRegistry from '../../logic/operationRegistry';

// --- Mock Data Definitions (Constants) ---

// Mock SystemRule Definition for Scenario 4
const MOCK_RULE_INVALID_CONDITION = {
  rule_id: 'RULE_INVALID_CONDITION_SC4', // Unique ID for clarity
  event_type: 'DoorOpened', // Match the event name used in the test
  condition: { 'invalidOperator': [1, 2] }, // Intentionally malformed JSON Logic
  actions: [ { type: 'TEST_UPDATE_DOOR_STATE', parameters: { state: 'closed_error' } } ] // Mock action representing update_door_state
};

// Mock Entity Data Definitions (Minimal, reusable from other tests)
const MOCK_PLAYER = {
  id: 'player-door-opener',
  components: {
    'status': { state: 'idle' }
  },
  getComponentData: function(type) { return this.components[type]; },
  hasComponent: function(type) { return type in this.components; },
};

// Mock GameEvent Data Definition for Scenario 4
const MOCK_EVENT_DOOR_OPENED = {
  type: 'DoorOpened',
  payload: { actorId: MOCK_PLAYER.id, doorId: 'door-invalid-logic' }
};


// --- Test Suite ---

describe('SystemLogicInterpreter - Integration Tests - Scenario 4: Invalid Condition', () => {
  /** @type {ILogger} */
  let mockLogger;
  /** @type {EventBus} */
  let mockEventBus;
  /** @type {IDataRegistry} */
  let mockDataRegistry;
  /** @type {JsonLogicEvaluationService} */
  let mockJsonLogicEvaluationService;
  /** @type {EntityManager} */
  let mockEntityManager;
  /** @type {OperationInterpreter} */ // <-- TYPE DEF for instance
  let operationInterpreter;
  /** @type {jest.SpyInstance} */ // <-- TYPE DEF for the spy
  let operationInterpreterExecuteSpy; // <-- RENAMED & FOCUSED SPY (AC1)
  /** @type {OperationRegistry} */ // <-- ADD TYPE DEF for registry
  let operationRegistry;
  /** @type {SystemLogicInterpreter} */
  let interpreter;
  /** @type {Function | null} */
  let capturedEventListener = null;

  beforeEach(() => {
    // --- Mock Implementations (Standard setup adapted from Ticket 4/other tests) ---
    mockLogger = {
      info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
      loggedMessages: [],
      _log(level, message, ...args) { this.loggedMessages.push({ level, message, args: args.length > 0 ? args : undefined }); },
      info: jest.fn((m, ...a) => mockLogger._log('info', m, ...a)), warn: jest.fn((m, ...a) => mockLogger._log('warn', m, ...a)),
      error: jest.fn((m, ...a) => mockLogger._log('error', m, ...a)), debug: jest.fn((m, ...a) => mockLogger._log('debug', m, ...a)),
      clearLogs: () => { mockLogger.loggedMessages = []; }
    };

    capturedEventListener = null;
    mockEventBus = {
      subscribe: jest.fn((eventName, listener) => {
        if (eventName === '*') {
          capturedEventListener = listener;
        }
      }),
      dispatch: jest.fn(),
      listenerCount: jest.fn().mockReturnValue(1),
    };

    mockDataRegistry = {
      getAllSystemRules: jest.fn().mockReturnValue([]),
      getEntityDefinition: jest.fn(),
    };

    mockJsonLogicEvaluationService = {
      evaluate: jest.fn(), // Configured per test
    };

    mockEntityManager = {
      getEntityInstance: jest.fn().mockImplementation((entityId) => {
        if (entityId === MOCK_PLAYER.id) return MOCK_PLAYER;
        return undefined;
      }),
      getComponentData: jest.fn().mockImplementation((entityId, componentTypeId) => {
        const entity = mockEntityManager.getEntityInstance(entityId);
        return entity?.getComponentData ? entity.getComponentData(componentTypeId) : entity?.components?.[componentTypeId] ?? null;
      }),
      hasComponent: jest.fn().mockImplementation((entityId, componentTypeId) => {
        const entity = mockEntityManager.getEntityInstance(entityId);
        return !!(entity?.hasComponent ? entity.hasComponent(componentTypeId) : entity?.components?.[componentTypeId]);
      }),
    };

    // --- Refactoring Changes Start ---

    // 0. Instantiate OperationRegistry <-- ADD THIS STEP
    operationRegistry = new OperationRegistry({ logger: mockLogger });

    // 1. Instantiate OperationInterpreter (needs logger AND registry) <-- MODIFY THIS STEP
    operationInterpreter = new OperationInterpreter({
      logger: mockLogger,
      operationRegistry: operationRegistry // <-- Pass the registry instance
    });

    // 2. Spy specifically on the `execute` method (remains the same)
    operationInterpreterExecuteSpy = jest.spyOn(operationInterpreter, 'execute');
    operationInterpreterExecuteSpy.mockImplementation(() => { /* No-op mock */ });

    // 3. Remove the spy on the internal _executeActions method (remains the same)
    // ...

    // 4. Instantiate the interpreter (remains the same)
    interpreter = new SystemLogicInterpreter({
      logger: mockLogger,
      eventBus: mockEventBus,
      dataRegistry: mockDataRegistry,
      jsonLogicEvaluationService: mockJsonLogicEvaluationService,
      entityManager: mockEntityManager,
      operationInterpreter: operationInterpreter // Pass the correctly instantiated OperationInterpreter
    });

    // --- Refactoring Changes End ---

    // Clear initial constructor log
    mockLogger.info.mockClear();
    mockLogger.clearLogs();
  });

  afterEach(() => {
    jest.restoreAllMocks(); // This restores the operationInterpreterExecuteSpy as well
    // The explicit restore for the removed _executeActions spy is no longer needed (AC2)
    capturedEventListener = null;
  });

  // --- Scenario 4 Test Case ---
  describe('Scenario 4: Invalid Condition', () => {
    it('should skip actions and log error when condition evaluation fails', () => {
      // Arrange
      const rule = MOCK_RULE_INVALID_CONDITION;
      const event = MOCK_EVENT_DOOR_OPENED;
      const evaluationError = new Error('Invalid JSON Logic syntax: unknown operator "invalidOperator"'); // Example error

      // Configure mockDataRegistry
      mockDataRegistry.getAllSystemRules.mockReturnValue([rule]);

      // Configure mockJsonLogicEvaluationService to throw an error
      mockJsonLogicEvaluationService.evaluate.mockImplementation(() => {
        throw evaluationError;
      });

      // MockEntityManager already configured in beforeEach

      // Act
      interpreter.initialize(); // Load rules & subscribe
      expect(capturedEventListener).toBeInstanceOf(Function); // Ensure listener captured
      capturedEventListener(event); // Dispatch the mock DoorOpened event

      // Assert
      // Assert evaluate mock was called once with the invalid rule condition and context
      expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledTimes(1);
      const expectedContextForEvaluate = expect.objectContaining({
        event: expect.objectContaining({ type: event.type, payload: event.payload }),
        actor: expect.objectContaining({ id: MOCK_PLAYER.id }),
        target: null, // No targetId in event payload
        context: {},
        globals: {},
        entities: {}
      });
      expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(
        rule.condition,
        expectedContextForEvaluate
      );

      // --- Refactoring Changes Start ---
      // AC: Action Skipped - Assert OperationInterpreter.execute mock was NOT called (AC3)
      // Because the condition evaluation failed *before* actions would be delegated.
      expect(operationInterpreterExecuteSpy).not.toHaveBeenCalled();
      // The check for the internal _executeActions is removed (AC2)
      // --- Refactoring Changes End ---


      // Retrieve captured logs from the mockLogger
      const logs = mockLogger.loggedMessages;

      // AC: Error Logged - Verify error log message
      const errorLog = logs.find(log => log.level === 'error' && log.message.includes('Error during condition evaluation'));
      expect(errorLog).toBeDefined();
      expect(errorLog.message).toContain(`[Rule ${rule.rule_id}] Error during condition evaluation. Treating condition as FALSE.`);
      expect(errorLog.args).toBeDefined();
      expect(errorLog.args[0]).toBe(evaluationError); // Check if the actual error object was passed

      // AC: Error Logged (Related) - Verify info log message for skipping due to error
      const expectedSkipLogMessage = `Rule '${rule.rule_id}' actions skipped for event '${event.type}' due to error during condition evaluation.`;
      const skipLog = logs.find(log => log.level === 'info' && log.message === expectedSkipLogMessage);
      expect(skipLog).toBeDefined();
      expect(skipLog.level).toBe('info');

      // AC4: Assertions validate correct operations/context
      // -> In this case, the crucial validation is that *no* operations were executed
      //    due to the context (condition evaluation error). This is checked by
      //    `expect(operationInterpreterExecuteSpy).not.toHaveBeenCalled()`.
      //    The `mockJsonLogicEvaluationService.evaluate` assertion validates the
      //    context *up to* the point of failure.

      // AC5: All tests pass - This will be verified when running the test suite.
    });
  });

}); // End Top-Level Describe