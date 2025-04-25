// src/tests/logic/systemLogicInterpreter.scenario6.integration.test.js

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../core/eventBus.js').default} EventBus */
/** @typedef {import('../../core/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../logic/jsonLogicEvaluationService.js').default} JsonLogicEvaluationService */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../logic/defs.js').GameEvent} GameEvent */
/** @typedef {import('../../../data/schemas/system-rule.schema.json').SystemRule} SystemRule */
/** @typedef {import('../../../data/schemas/operation.schema.json').Operation} Operation */
/** @typedef {import('../../logic/defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */
/** @typedef {import('../../entities/entity.js').default} Entity */

// --- Class Under Test ---
import SystemLogicInterpreter from '../../logic/systemLogicInterpreter.js';
// Import jest functions directly
import { describe, beforeEach, afterEach, it, expect, jest } from "@jest/globals";
import OperationInterpreter from "../../logic/operationInterpreter";
import OperationRegistry from "../../logic/operationRegistry";

// --- Mock Data Definitions (Constants for Scenario 6) ---

// Mock SystemRule Definition for Scenario 6
const MOCK_RULE_CONTEXT_ACCESS = {
    rule_id: "RULE_SC6_CONTEXT_ACCESS",
    event_type: "CustomEvent", // Match the event name used in the test
    condition: {
        // Condition: Check a specific value within the event payload
        "==": [ { "var": "event.payload.value" }, "expected" ]
    },
    actions: [ { type: 'TEST_LOG_SUCCESS', parameters: { message: "Context access successful!" } } ] // Mock action
};

// Mock Entity Data Definition (Minimal, needed if event payload has actorId/entityId)
const MOCK_ENTITY_FOR_EVENT = {
    id: 'entity-context-test-1',
    components: {
        'info': { description: 'Minimal entity for context assembly' }
    },
    getComponentData: function(type) { return this.components[type]; },
    hasComponent: function(type) { return type in this.components; },
};


// Mock GameEvent Data Definitions for Scenario 6
const MOCK_EVENT_CUSTOM_MATCHING = {
    type: "CustomEvent",
    // Payload matches the condition in MOCK_RULE_CONTEXT_ACCESS
    payload: { entityId: MOCK_ENTITY_FOR_EVENT.id, value: "expected", otherData: 123 }
};

const MOCK_EVENT_CUSTOM_NON_MATCHING = {
    type: "CustomEvent",
    // Payload does NOT match the condition
    payload: { entityId: MOCK_ENTITY_FOR_EVENT.id, value: "wrong", otherData: 456 }
};


// --- Test Suite ---
// AC: Test Suite Exists
describe('SystemLogicInterpreter - Integration Tests - Scenario 6: Context Access (Event Payload)', () => {
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
    /** @type {OperationInterpreter} */ // <-- ADD TYPE DEF
    let operationInterpreter;
    /** @type {jest.SpyInstance} */
    let executeActionsSpy;
    /** @type {SystemLogicInterpreter} */
    let interpreter;
    /** @type {OperationRegistry} */ // <-- ADD TYPE DEF for registry
    let operationRegistry;
    /** @type {Function | null} */
    let capturedEventListener = null;

    // Helper to get recorded calls from the spy
    const getExecuteActionsCalls = () => executeActionsSpy.mock.calls.map(callArgs => ({
        actions: callArgs[0],
        context: callArgs[1],
        scopeDescription: callArgs[2]
    }));

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
                if (eventName === '*') { capturedEventListener = listener; }
            }),
            dispatch: jest.fn(),
            listenerCount: jest.fn().mockReturnValue(1),
        };

        mockDataRegistry = {
            getAllSystemRules: jest.fn().mockReturnValue([]),
            getEntityDefinition: jest.fn(),
        };

        mockJsonLogicEvaluationService = {
            evaluate: jest.fn(), // Behavior configured per test case
        };

        // EntityManager mock configured to return scenario-specific entity if needed
        mockEntityManager = {
            getEntityInstance: jest.fn().mockImplementation((entityId) => {
                if (entityId === MOCK_ENTITY_FOR_EVENT.id) return MOCK_ENTITY_FOR_EVENT;
                return undefined;
            }),
            getComponentData: jest.fn().mockImplementation((entityId, componentTypeId) => {
                const entity = mockEntityManager.getEntityInstance(entityId);
                return entity?.getComponentData(componentTypeId) ?? null;
            }),
            hasComponent: jest.fn().mockImplementation((entityId, componentTypeId) => {
                const entity = mockEntityManager.getEntityInstance(entityId);
                return !!entity?.hasComponent(componentTypeId);
            }),
        };

        // Spy on the real _executeActions method but mock its implementation
        executeActionsSpy = jest.spyOn(SystemLogicInterpreter.prototype, '_executeActions')
            .mockImplementation((actions, context, scope) => {
                // console.log(`_executeActions called for: ${scope}`); // Optional: Log spy calls
            });

        // 0. Instantiate OperationRegistry <-- ADD THIS STEP
        operationRegistry = new OperationRegistry({ logger: mockLogger }); // Optional: pass logger

        // 1. Instantiate OperationInterpreter (it needs logger AND registry) <-- MODIFY THIS STEP
        operationInterpreter = new OperationInterpreter({
            logger: mockLogger,
            registry: operationRegistry // <-- Pass the registry instance
        });

        // 2. Instantiate the interpreter (remains the same)
        interpreter = new SystemLogicInterpreter({ // Line 147 approx.
            logger: mockLogger,
            eventBus: mockEventBus,
            dataRegistry: mockDataRegistry,
            jsonLogicEvaluationService: mockJsonLogicEvaluationService,
            entityManager: mockEntityManager,
            operationInterpreter: operationInterpreter // Pass the correctly instantiated OperationInterpreter
        });

        // Clear constructor log call
        mockLogger.info.mockClear();
        mockLogger.clearLogs();
    });

    afterEach(() => {
        jest.restoreAllMocks();
        if (executeActionsSpy) {
            executeActionsSpy.mockRestore();
        }
        capturedEventListener = null;
    });

    // --- Scenario 6 Test Cases ---

    // Implementation Task: Create describe block for 'Scenario 6: Context Access (Event Payload)' (Done above)

    // Test Case 1 (Matching Payload)
    // AC: Test Clarity
    it('should execute action when event payload matches condition', () => {
        // Arrange
        const rule = MOCK_RULE_CONTEXT_ACCESS;
        const event = MOCK_EVENT_CUSTOM_MATCHING;

        // Implementation Task: Configure mockDataRegistry.getAllSystemRules to return the mock Context Access Rule.
        mockDataRegistry.getAllSystemRules.mockReturnValue([rule]);

        // Implementation Task: Configure mockEntityManager as needed (minimal).
        // (Setup in beforeEach is sufficient as entityId is in payload)

        // Implementation Task: Configure mockJsonLogicEvaluationService.evaluate to return true.
        mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);

        // Act
        // Implementation Task: Instantiate SystemLogicInterpreter. Call initialize().
        interpreter.initialize();
        expect(capturedEventListener).toBeInstanceOf(Function);

        // Implementation Task: Dispatch the mock CustomEvent with matching payload.
        capturedEventListener(event);

        // Assert
        // Implementation Task: Assert mockJsonLogicEvaluationService.evaluate mock toHaveBeenCalledTimes(1) with the correct rule condition and context.
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledTimes(1);

        // Verify the context passed to evaluate contained the event payload correctly
        const expectedContextForEvaluate = expect.objectContaining({
            event: expect.objectContaining({
                type: event.type,
                payload: event.payload // Ensure the full payload is present
            }),
            // Check actor (derived from entityId in this case)
            actor: expect.objectContaining({ id: MOCK_ENTITY_FOR_EVENT.id }),
            target: null, // No targetId in event payload
            context: {},
            globals: {},
            entities: {}
        });
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(
            rule.condition, // The exact condition object
            expectedContextForEvaluate
        );

        // AC: Scenario 6 Pass (Matching Payload) - Assert _executeActions mock was called.
        expect(executeActionsSpy).toHaveBeenCalledTimes(1);
        expect(executeActionsSpy).toHaveBeenCalledWith(
            rule.actions,               // Check actions array
            expectedContextForEvaluate, // Check context passed to actions
            expect.stringContaining(`Rule '${rule.rule_id}'`) // Check scope
        );

        // Implementation Task: Add a comment noting that successful execution implicitly verifies context assembly and basic access.
        // Note: Successful execution of the action implicitly verifies that:
        // 1. The JsonLogicEvaluationContext was assembled correctly by createJsonLogicContext.
        // 2. The 'event.payload' object within the context was accessible to the JsonLogic engine.
        // 3. The specific value 'event.payload.value' was correctly read and compared by the condition.
        // No deeper context inspection is needed for this test case's primary goal.
    });

    // (Optional Bonus) Test Case 2 (Non-Matching Payload)
    // AC: Test Clarity
    it('should NOT execute action when event payload does not match condition', () => {
        // Arrange
        // Implementation Task: Reset mocks (handled by beforeEach/afterEach)
        const rule = MOCK_RULE_CONTEXT_ACCESS;
        const event = MOCK_EVENT_CUSTOM_NON_MATCHING;

        // Implementation Task: Configure mocks as above...
        mockDataRegistry.getAllSystemRules.mockReturnValue([rule]);
        mockEntityManager.getEntityInstance.mockImplementation((entityId) => { // Ensure entity manager setup
            if (entityId === MOCK_ENTITY_FOR_EVENT.id) return MOCK_ENTITY_FOR_EVENT;
            return undefined;
        });

        // Implementation Task: ... but configure mockJsonLogicEvaluationService.evaluate to return false.
        mockJsonLogicEvaluationService.evaluate.mockReturnValue(false);

        // Act
        // Implementation Task: Instantiate SystemLogicInterpreter. Call initialize().
        interpreter.initialize();
        expect(capturedEventListener).toBeInstanceOf(Function);

        // Implementation Task: Dispatch the event with non-matching payload.
        capturedEventListener(event);

        // Assert
        // Implementation Task: Assert mockJsonLogicEvaluationService.evaluate mock toHaveBeenCalledTimes(1).
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledTimes(1);

        // Verify the context passed to evaluate contained the non-matching payload
        const expectedContextForEvaluate = expect.objectContaining({
            event: expect.objectContaining({
                type: event.type,
                payload: event.payload // Ensure the full payload is present
            }),
            actor: expect.objectContaining({ id: MOCK_ENTITY_FOR_EVENT.id }),
            target: null
        });
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(
            rule.condition,
            expectedContextForEvaluate
        );

        // Verify the evaluation *actually* returned false
        const evaluationResult = mockJsonLogicEvaluationService.evaluate.mock.results[0].value;
        expect(evaluationResult).toBe(false);

        // AC: Scenario 6 Pass (Non-Matching Payload - Optional Bonus) - Assert _executeActions mock not.toHaveBeenCalled().
        expect(executeActionsSpy).not.toHaveBeenCalled();

        // Verify skip log was generated
        const skipLog = mockLogger.loggedMessages.find(log =>
            log.level === 'info' && log.message.includes(`Rule '${rule.rule_id}' actions skipped`) && log.message.includes('condition evaluating to false')
        );
        expect(skipLog).toBeDefined();
    });

}); // End Top-Level Describe