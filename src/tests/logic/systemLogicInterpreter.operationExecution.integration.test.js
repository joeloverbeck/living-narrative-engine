// src/tests/logic/systemLogicInterpreter.operationExecution.integration.test.js

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../core/eventBus.js').default} EventBus */
/** @typedef {import('../../core/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../logic/jsonLogicEvaluationService.js').default} JsonLogicEvaluationService */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../logic/operationInterpreter.js').default} OperationInterpreter */
/** @typedef {import('../../../data/schemas/system-rule.schema.json').SystemRule} SystemRule */
/** @typedef {import('../../../data/schemas/entity.schema.json').Entity} Entity */
/** @typedef {import('../../logic/defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */
/** @typedef {import('../../../data/schemas/operation.schema.json').Operation} Operation */ // Added for spy typing


// --- Class Under Test ---
import SystemLogicInterpreter from '../../logic/systemLogicInterpreter.js'; // Adjust path as needed

// --- Dependencies ---
// Import actual classes or stubs as needed for the integration scope
import RealEventBus from '../../core/eventBus.js'; // Adjust path as needed
import RealJsonLogicEvaluationService from '../../logic/jsonLogicEvaluationService.js'; // Adjust path as needed
// Using a stub for OperationInterpreter to isolate SystemLogicInterpreter's interaction
import OperationInterpreterStub from '../../logic/operationInterpreter.js'; // Adjust path - Assuming this is a valid stub/mock

// Import jest functions directly
import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import OperationRegistry from '../../logic/operationRegistry';

// --- Test Data ---
/** @type {SystemRule} */
const testRule_ActionOrder = {
  rule_id: 'TestRule_ActionOrder',
  event_type: 'test:event_action_order',
  actions: [
    { type: 'LOG', parameters: { message: 'First Action - Actor: {actor.id}' } },
    { type: 'LOG', parameters: { message: 'Second Action - Event: {event.type}' } }
  ]
};

// --- Test Suite ---
describe('SystemLogicInterpreter - Operation Execution Integration Test', () => {

  // --- Variable Declarations ---
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
  let mockOperationInterpreter; // Use the stub/mock instance
  /** @type {SystemLogicInterpreter} */
  let systemLogicInterpreter;
  /** @type {OperationRegistry} */ // <-- ADD TYPE DEF for registry
  let operationRegistry;
  /** @type {jest.SpyInstance<void, [Operation, JsonLogicEvaluationContext]>} */
  let executeSpy; // Spy specifically on the 'execute' method of the mock interpreter

  beforeEach(() => {
    // Mock dependencies
    mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
    mockLoggerForOperationInterpreter = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
    eventBusInstance = new RealEventBus(); // Using real event bus for dispatch/subscribe interaction
    mockDataRegistry = { getAllSystemRules: jest.fn() };
    jsonLogicServiceInstance = new RealJsonLogicEvaluationService({ logger: mockLogger }); // Real service for condition evaluation if needed later
    mockEntityManager = { getEntityInstance: jest.fn(), getComponentData: jest.fn() };

    // Configure Mocks for this test scenario
    mockDataRegistry.getAllSystemRules.mockReturnValue([testRule_ActionOrder]);
    const mockActorEntity = { id: 'testActor001' };
    mockEntityManager.getEntityInstance.mockImplementation((entityId) => {
      if (entityId === 'testActor001') return mockActorEntity;
      return undefined;
    });

    // 0. Instantiate OperationRegistry <-- ADD THIS STEP
    //    Use the specific logger intended for the interpreter if desired
    operationRegistry = new OperationRegistry({ logger: mockLoggerForOperationInterpreter });

    // 1. Instantiate the OperationInterpreter (using stub alias) <-- MODIFY THIS STEP
    //    Pass both logger and registry
    mockOperationInterpreter = new OperationInterpreterStub({
      logger: mockLoggerForOperationInterpreter,
      registry: operationRegistry // <-- Pass the registry instance
    });

    // 2. --- AC1: Spy on OperationInterpreter.execute --- (remains the same)
    executeSpy = jest.spyOn(mockOperationInterpreter, 'execute');

    // 3. Instantiate SystemLogicInterpreter (remains the same)
    systemLogicInterpreter = new SystemLogicInterpreter({
      logger: mockLogger,
      eventBus: eventBusInstance,
      dataRegistry: mockDataRegistry,
      jsonLogicEvaluationService: jsonLogicServiceInstance,
      entityManager: mockEntityManager,
      operationInterpreter: mockOperationInterpreter // Inject the correctly instantiated OperationInterpreter
    });

    // --- AC2: Confirmation ---
    // No spy is created on SystemLogicInterpreter.prototype._executeActions in this setup.
  });

  afterEach(() => {
    // Restore all mocks and spies
    jest.restoreAllMocks();
  });

  it('should delegate action execution to OperationInterpreter.execute when a matching rule triggers', async () => {
    // Arrange: Initialize interpreter to load rules and subscribe
    systemLogicInterpreter.initialize();
    expect(mockDataRegistry.getAllSystemRules).toHaveBeenCalled(); // Ensure rules were loaded
    // Spy should not have been called yet
    expect(executeSpy).not.toHaveBeenCalled();

    // Act: Dispatch an event that matches the test rule
    const eventPayload = { actorId: 'testActor001' };
    const eventType = 'test:event_action_order';
    await eventBusInstance.dispatch(eventType, eventPayload); // Use await for async dispatch if applicable

    // Assert: Verify interaction with OperationInterpreter.execute
    // --- AC3: Check Call Count ---
    // Rule has 2 actions, both should be passed to OperationInterpreter
    expect(executeSpy).toHaveBeenCalledTimes(2);

    // --- AC3 & AC4: Check Arguments and Order ---

    // Verify the first call to OperationInterpreter.execute
    expect(executeSpy).toHaveBeenNthCalledWith(1,
      // 1st argument: The first Operation object from the rule
      expect.objectContaining({
        type: 'LOG',
        parameters: { message: 'First Action - Actor: {actor.id}' }
      }),
      // 2nd argument: The evaluation context object
      expect.objectContaining({
        event: expect.objectContaining({ type: eventType, payload: eventPayload }),
        actor: expect.objectContaining({ id: 'testActor001' }),
        target: null, // Target ID wasn't in payload, so context.target should be null
        context: {} // Assuming no complex context derivation in this basic test
      })
    );

    // Verify the second call to OperationInterpreter.execute
    expect(executeSpy).toHaveBeenNthCalledWith(2,
      // 1st argument: The second Operation object from the rule
      expect.objectContaining({
        type: 'LOG',
        parameters: { message: 'Second Action - Event: {event.type}' }
      }),
      // 2nd argument: The same evaluation context object
      expect.objectContaining({
        event: expect.objectContaining({ type: eventType, payload: eventPayload }),
        actor: expect.objectContaining({ id: 'testActor001' }),
        target: null,
        context: {}
      })
    );

    // --- AC5: Implicit ---
    // If the above expectations pass without errors, the test passes.
  });

  // --- Add more tests as needed ---
  // e.g., test cases for:
  // - Rules with conditions (mock jsonLogicServiceInstance.evaluate)
  // - Events with different payloads (actorId, targetId, entityId)
  // - Rules with IF operations (verify conditions evaluated, correct branch actions passed to executeSpy)
  // - Rules with no actions
  // - Events that don't match any rules

});