// src/tests/logic/systemLogicInterpreter.operationExecution.integration.test.js

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../src/events/eventBus.js').default} EventBus */
/** @typedef {import('../../src/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../src/logic/jsonLogicEvaluationService.js').default} JsonLogicEvaluationService */
/** @typedef {import('../../src/entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../src/logic/operationInterpreter.js').default} OperationInterpreter */
/** @typedef {import('../../data/schemas/rule.schema.json').SystemRule} SystemRule */
/** @typedef {import('../../data/schemas/entity.schema.json').Entity} Entity */
/** @typedef {import('../../src/logic/defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */
/** @typedef {import('../../data/schemas/operation.schema.json').Operation} Operation */

// --- Class Under Test ---
import SystemLogicInterpreter from '../../src/logic/systemLogicInterpreter.js';

// --- Dependencies ---
import RealEventBus from '../../src/events/eventBus.js';
import RealJsonLogicEvaluationService from '../../src/logic/jsonLogicEvaluationService.js';
import OperationInterpreterStub from '../../src/logic/operationInterpreter.js'; // Assuming this is the intended path for the stub

// Import jest functions directly
import {
  describe,
  beforeEach,
  afterEach,
  it,
  expect,
  jest,
} from '@jest/globals';
import OperationRegistry from '../../src/logic/operationRegistry.js';

// --- Test Data ---
/** @type {SystemRule} */
const testRule_ActionOrder = {
  rule_id: 'TestRule_ActionOrder',
  event_type: 'test:event_action_order',
  actions: [
    {
      type: 'LOG',
      parameters: { message: 'First Action - Actor: {actor.id}' },
    },
    {
      type: 'LOG',
      parameters: { message: 'Second Action - Event: {event.type}' },
    },
  ],
};

/** @type {SystemRule} */
const testRule_IfDelegation = {
  rule_id: 'TestRule_IF',
  event_type: 'test:event_if',
  actions: [
    {
      type: 'IF',
      parameters: {
        condition: { '==': [1, 1] },
        then_actions: [{ type: 'LOG', parameters: { message: 'inside IF' } }],
      },
    },
  ],
};

// --- Test Suite ---
describe('SystemLogicInterpreter - Operation Execution Integration Test', () => {
  /** @type {jest.Mocked<ILogger>} */
  let mockLogger;
  /** @type {jest.Mocked<ILogger>} */
  let mockLoggerForOperationInterpreter;
  /** @type {RealEventBus} */
  let eventBusInstance;
  /** @type {jest.Mocked<IDataRegistry>} */
  let mockDataRegistry;
  /** @type {RealJsonLogicEvaluationService} */
  let jsonLogicServiceInstance;
  /** @type {jest.Mocked<EntityManager>} */
  let mockEntityManager;
  /** @type {OperationInterpreterStub} */
  let mockOperationInterpreterInstance; // Renamed for clarity
  /** @type {SystemLogicInterpreter} */
  let systemLogicInterpreter;
  /** @type {OperationRegistry} */
  let operationRegistry;
  /** @type {jest.SpyInstance<void, [Operation, JsonLogicEvaluationContext]>} */ // Context type might need adjustment based on actual OperationInterpreter signature
  let executeSpy;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      loggedMessages: [],
      _log: jest.fn(),
      clearLogs: jest.fn(),
    };
    mockLoggerForOperationInterpreter = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      loggedMessages: [],
      _log: jest.fn(),
      clearLogs: jest.fn(),
    };

    eventBusInstance = new RealEventBus();
    mockDataRegistry = { getAllSystemRules: jest.fn() };
    jsonLogicServiceInstance = new RealJsonLogicEvaluationService({
      logger: mockLogger,
    });

    // Simplified mockActorEntity for this test, assuming createComponentAccessor handles it
    const mockActorEntity = {
      id: 'testActor001',
      // components property might be added by createComponentAccessor if not present.
      // If createComponentAccessor expects these, they should be mocked:
      // getComponentData: jest.fn(),
      // hasComponent: jest.fn()
    };
    mockEntityManager = {
      getEntityInstance: jest.fn().mockImplementation((entityId) => {
        if (entityId === 'testActor001') return mockActorEntity;
        return undefined;
      }),
      // These are often called by createComponentAccessor, ensure they return valid defaults
      getComponentData: jest.fn().mockReturnValue(null),
      hasComponent: jest.fn().mockReturnValue(false),
    };

    mockDataRegistry.getAllSystemRules.mockReturnValue([testRule_ActionOrder]);

    operationRegistry = new OperationRegistry({
      logger: mockLoggerForOperationInterpreter,
    });
    mockOperationInterpreterInstance = new OperationInterpreterStub({
      logger: mockLoggerForOperationInterpreter,
      operationRegistry: operationRegistry,
    });

    executeSpy = jest.spyOn(mockOperationInterpreterInstance, 'execute');

    systemLogicInterpreter = new SystemLogicInterpreter({
      logger: mockLogger,
      eventBus: eventBusInstance,
      dataRegistry: mockDataRegistry,
      jsonLogicEvaluationService: jsonLogicServiceInstance,
      entityManager: mockEntityManager,
      operationInterpreter: mockOperationInterpreterInstance,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should delegate action execution to OperationInterpreter.execute when a matching rule triggers', async () => {
    systemLogicInterpreter.initialize();
    expect(mockDataRegistry.getAllSystemRules).toHaveBeenCalled();
    expect(executeSpy).not.toHaveBeenCalled();

    const eventPayload = { actorId: 'testActor001' };
    const eventType = 'test:event_action_order';
    await eventBusInstance.dispatch(eventType, eventPayload);

    expect(executeSpy).toHaveBeenCalledTimes(2);

    // Define the structure for the NESTED evaluationContext
    // This matches the content of `jsonLogicDataForEvaluation`
    const expectedJsonLogicContext = expect.objectContaining({
      event: expect.objectContaining({
        type: eventType,
        payload: eventPayload,
      }),
      actor: expect.objectContaining({
        id: 'testActor001',
        components: expect.any(Object), // createComponentAccessor likely adds a components proxy
      }),
      target: null,
      context: {},
      globals: {}, // Present in received evaluationContext
      entities: {}, // Present in received evaluationContext
      // logger is NOT in the received evaluationContext based on previous test outputs
    });

    // Define the structure for the argument to OperationInterpreter.execute
    // This matches `finalNestedExecutionContext`
    const expectedContextForOperationInterpreter = expect.objectContaining({
      event: expect.objectContaining({
        type: eventType,
        payload: eventPayload,
      }), // Top-level
      actor: expect.objectContaining({
        id: 'testActor001',
        components: expect.any(Object), // Top-level actor is also processed by createComponentAccessor
      }), // Top-level
      target: null, // Top-level
      logger: expect.any(Object), // Top-level logger from SystemLogicInterpreter itself
      evaluationContext: expectedJsonLogicContext,
    });

    // Verify the first call
    expect(executeSpy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        type: 'LOG',
        parameters: { message: 'First Action - Actor: {actor.id}' },
      }),
      expectedContextForOperationInterpreter // Use the corrected nested structure
    );

    // Verify the second call
    expect(executeSpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        type: 'LOG',
        parameters: { message: 'Second Action - Event: {event.type}' },
      }),
      expectedContextForOperationInterpreter // Context should be the same for subsequent actions of the same rule
    );
  });

  it('delegates IF operations to OperationInterpreter.execute', async () => {
    mockDataRegistry.getAllSystemRules.mockReturnValue([testRule_IfDelegation]);

    systemLogicInterpreter.initialize();

    const eventPayload = { actorId: 'testActor001' };
    const eventType = 'test:event_if';
    await eventBusInstance.dispatch(eventType, eventPayload);

    // Only the IF operation itself should trigger execute since no handler is registered
    expect(executeSpy).toHaveBeenCalledTimes(1);
    expect(executeSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'IF' }),
      expect.any(Object)
    );
  });
});
