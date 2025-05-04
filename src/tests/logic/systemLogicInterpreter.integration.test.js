// src/tests/logic/systemLogicInterpreter.integration.test.js

import SystemLogicInterpreter from '../../logic/systemLogicInterpreter.js';
import EventBus from '../../core/eventBus.js'; // Adjust path if necessary
// Assuming contextAssembler is needed for context creation logic used internally
// import { createJsonLogicContext } from '../../logic/contextAssembler.js'; // Not directly used in this test, but keep if needed indirectly
import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals'; // Sorted imports
import OperationInterpreter from '../../logic/operationInterpreter';
import OperationRegistry from '../../logic/operationRegistry';

// --- Mock Core Services ---
const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};

const mockDataRegistry = {
    getAllSystemRules: jest.fn(),
};

const mockJsonLogicEvaluationService = {
    evaluate: jest.fn(),
};

const mockEntityManager = {
    getEntityInstance: jest.fn(),
    getComponentData: jest.fn(),
    hasComponent: jest.fn()
};

// --- Test Suite ---

describe('SystemLogicInterpreter Integration Tests', () => {
    let eventBus;
    let mockOperationInterpreter; // Mock OperationInterpreter for these tests
    /** @type {OperationRegistry} */ // <-- ADD TYPE DEF for registry
    let operationRegistry;
    let executeSpy;             // Spy for OperationInterpreter.execute
    /** @type {jest.Mock} */    // <-- ADD TYPE DEF for mock handler
    let mockLogHandler;         // Mock handler for LOG operations

    // --- Test Rule Definitions ---
    const TEST_ACTION_LOG = {type: 'LOG', parameters: {message: 'Action Executed!', level: 'warn'}};
    const RULE_NO_COND_BASIC = {
        rule_id: 'RULE_NO_COND_BASIC',
        event_type: 'test:event_no_condition',
        actions: [TEST_ACTION_LOG]
    };
    const RULE_COND_TRUE_BASIC = {
        rule_id: 'RULE_COND_TRUE_BASIC',
        event_type: 'test:event_condition_true',
        condition: {'==': [{var: 'event.payload.value'}, true]},
        actions: [TEST_ACTION_LOG]
    };
    const RULE_COND_FALSE_BASIC = {
        rule_id: 'RULE_COND_FALSE_BASIC',
        event_type: 'test:event_condition_false',
        condition: {'==': [{var: 'event.payload.value'}, false]},
        actions: [TEST_ACTION_LOG]
    };

    // --- Mock Event Payloads & Entities ---
    const MOCK_PAYLOAD_ACTOR_TARGET = {actorId: 'mockActor1', targetId: 'mockTarget1'};
    const MOCK_ENTITY_ACTOR = {id: 'mockActor1', name: 'Mock Actor 1', definitionId: 'def:actor'};
    const MOCK_ENTITY_TARGET = {id: 'mockTarget1', name: 'Mock Target 1', definitionId: 'def:target'};


    beforeEach(() => {
        // Clear mocks before each test
        jest.clearAllMocks();

        // Setup services needed across tests but without test-specific state
        eventBus = new EventBus();

        mockEntityManager.getEntityInstance.mockImplementation((entityId) => {
            if (entityId === 'mockActor1') return MOCK_ENTITY_ACTOR;
            if (entityId === 'mockTarget1') return MOCK_ENTITY_TARGET;
            return undefined;
        });

        // 0. Instantiate OperationRegistry <-- ADD THIS STEP
        operationRegistry = new OperationRegistry({logger: mockLogger});

        // +++ FIX: Register a mock handler for LOG +++
        mockLogHandler = jest.fn(); // Create a simple mock handler function
        operationRegistry.register('LOG', mockLogHandler);
        // +++++++++++++++++++++++++++++++++++++++++++++

        // 1. Create OperationInterpreter instance (needs logger AND registry) <-- MODIFY THIS STEP
        //    Variable name is mockOperationInterpreter in this file
        mockOperationInterpreter = new OperationInterpreter({
            logger: mockLogger,
            operationRegistry: operationRegistry // <-- Pass the registry instance (now with LOG handler)
        });
        executeSpy = jest.spyOn(mockOperationInterpreter, 'execute');

    });

    afterEach(() => {
        // Ensure spies created in beforeEach are restored
        if (executeSpy) executeSpy.mockRestore();
        jest.restoreAllMocks(); // Clean up all mocks
    });


    // Helper function to run common arrange/act steps
    async function arrangeAndAct(rule, eventPayload, evaluateResult = null) {
        // 1. Set up the mocks specific to this test case
        mockDataRegistry.getAllSystemRules.mockReturnValue([rule]);
        if (evaluateResult !== null) {
            mockJsonLogicEvaluationService.evaluate.mockReturnValue(evaluateResult);
        } else {
            // Ensure evaluate mock is clean if not used, avoid leftover return values
            mockJsonLogicEvaluationService.evaluate.mockClear();
        }

        // 2. Create and initialize the interpreter AFTER mocks are set
        const interpreter = new SystemLogicInterpreter({
            logger: mockLogger,
            eventBus: eventBus, // Use the real EventBus from beforeEach
            dataRegistry: mockDataRegistry,
            jsonLogicEvaluationService: mockJsonLogicEvaluationService,
            entityManager: mockEntityManager,
            operationInterpreter: mockOperationInterpreter // Use the mocked interpreter from beforeEach
        });

        interpreter.initialize(); // Initialize will now use the correctly mocked dataRegistry

        // 3. Act: Dispatch the event CORRECTLY
        const eventType = rule.event_type;
        await eventBus.dispatch(eventType, eventPayload); // Pass type and payload separately

        // Return details needed for assertions
        return {eventType, eventPayload};
    }

    it('executes actions when rule has no condition', async () => {
        const eventPayload = MOCK_PAYLOAD_ACTOR_TARGET;
        const {eventType} = await arrangeAndAct(RULE_NO_COND_BASIC, eventPayload);

        // Assert
        expect(mockLogger.error).not.toHaveBeenCalledWith(
            expect.stringContaining('Failed to assemble') // Check context assembly errors
        );

        // Check logs related to rule finding and context assembly
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Cached rule '${RULE_NO_COND_BASIC.rule_id}'`));

        // *** CORRECTED LOG ASSERTION for Received Event ***
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringMatching(new RegExp(`^Received event: ${eventType}\\. Found \\d+ potential rule\\(s\\)\\.$`)), // Match the message string
            {payload: eventPayload} // Expect the second argument to be an object with the payload
        );
        // ************************************************

        // Check specific debug messages about context and condition
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`[Event: ${eventType}] Assembling shared JsonLogic context...`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`[Event: ${eventType}] Shared context assembled successfully.`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`[Rule ${RULE_NO_COND_BASIC.rule_id}] No condition defined or condition is empty. Defaulting to passed.`));

        // Verify OperationInterpreter.execute was called correctly
        expect(executeSpy).toHaveBeenCalledTimes(1);
        expect(executeSpy).toHaveBeenCalledWith(
            expect.objectContaining({type: 'LOG'}), // Check the operation object passed
            expect.objectContaining({ // Check important parts of the shared context
                event: {type: eventType, payload: eventPayload},
                actor: expect.objectContaining({id: MOCK_ENTITY_ACTOR.id}),
                target: expect.objectContaining({id: MOCK_ENTITY_TARGET.id}),
                context: expect.any(Object) // Ensure the mutable context part exists
            })
        );

        // Also verify the registered mock handler was called (since executeSpy should call it now)
        expect(mockLogHandler).toHaveBeenCalledTimes(1);
        expect(mockLogHandler).toHaveBeenCalledWith(
            TEST_ACTION_LOG.parameters, // Handler receives resolved parameters
            expect.objectContaining({ // Context passed to the handler
                event: {type: eventType, payload: eventPayload},
                actor: expect.objectContaining({id: MOCK_ENTITY_ACTOR.id}),
                target: expect.objectContaining({id: MOCK_ENTITY_TARGET.id}),
                context: expect.any(Object)
            })
        );


        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`<--- Finished action sequence for: Rule '${RULE_NO_COND_BASIC.rule_id}'`));

        // Check that evaluate was NOT called for no-condition rule
        expect(mockJsonLogicEvaluationService.evaluate).not.toHaveBeenCalled();
    });

    it('executes actions when rule condition evaluates to true', async () => {
        const eventPayload = {...MOCK_PAYLOAD_ACTOR_TARGET, value: true};
        // Mock evaluate to return true for this specific test case
        const {eventType} = await arrangeAndAct(RULE_COND_TRUE_BASIC, eventPayload, true);

        // Assert
        expect(mockLogger.error).not.toHaveBeenCalledWith(
            expect.stringContaining('Failed to assemble') // Check context assembly errors
        );

        // Check logs related to rule finding and context assembly
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Cached rule '${RULE_COND_TRUE_BASIC.rule_id}'`));

        // *** CORRECTED LOG ASSERTION for Received Event ***
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringMatching(new RegExp(`^Received event: ${eventType}\\. Found \\d+ potential rule\\(s\\)\\.$`)), // Match the message string
            {payload: eventPayload} // Expect the second argument to be an object with the payload
        );
        // ************************************************

        // Check specific debug messages about context and condition evaluation
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`[Event: ${eventType}] Assembling shared JsonLogic context...`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`[Event: ${eventType}] Shared context assembled successfully.`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`[Rule ${RULE_COND_TRUE_BASIC.rule_id}] Condition found. Evaluating using shared context...`));

        // Check evaluate was called with the correct context structure
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(
            RULE_COND_TRUE_BASIC.condition,
            expect.objectContaining({
                event: {type: eventType, payload: eventPayload},
                actor: expect.objectContaining({id: MOCK_ENTITY_ACTOR.id, components: expect.anything()}),
                target: expect.objectContaining({id: MOCK_ENTITY_TARGET.id, components: expect.anything()}),
                context: expect.any(Object) // Ensure the mutable context part exists
            })
        );
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledTimes(1);
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`[Rule ${RULE_COND_TRUE_BASIC.rule_id}] Condition evaluation raw result: true`));

        // Verify OperationInterpreter.execute was called correctly
        expect(executeSpy).toHaveBeenCalledTimes(1); // Check execute was called
        expect(executeSpy).toHaveBeenCalledWith(
            expect.objectContaining({type: 'LOG'}), // The action object
            expect.objectContaining({ // Check important parts of the shared context
                event: {type: eventType, payload: eventPayload},
                actor: expect.objectContaining({id: MOCK_ENTITY_ACTOR.id}),
                target: expect.objectContaining({id: MOCK_ENTITY_TARGET.id}),
                context: expect.any(Object)
            })
        );

        // Verify the mock handler was called
        expect(mockLogHandler).toHaveBeenCalledTimes(1);
        expect(mockLogHandler).toHaveBeenCalledWith(
            TEST_ACTION_LOG.parameters,
            expect.objectContaining({
                event: {type: eventType, payload: eventPayload},
                actor: expect.objectContaining({id: MOCK_ENTITY_ACTOR.id}),
                target: expect.objectContaining({id: MOCK_ENTITY_TARGET.id}),
                context: expect.any(Object)
            })
        );

        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`<--- Finished action sequence for: Rule '${RULE_COND_TRUE_BASIC.rule_id}'`));
    });

    it('does NOT execute actions when rule condition evaluates to false', async () => {
        const eventPayload = {...MOCK_PAYLOAD_ACTOR_TARGET, value: true}; // Event payload value is true
        // Rule condition expects false: { '==': [{ var: 'event.payload.value' }, false] }
        // Mock evaluate to return false for this specific test case
        const {eventType} = await arrangeAndAct(RULE_COND_FALSE_BASIC, eventPayload, false);

        // Assert
        expect(mockLogger.error).not.toHaveBeenCalledWith(
            expect.stringContaining('Failed to assemble') // Check context assembly errors
        );

        // Check logs related to rule finding and context assembly
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Cached rule '${RULE_COND_FALSE_BASIC.rule_id}'`));

        // *** CORRECTED LOG ASSERTION for Received Event ***
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringMatching(new RegExp(`^Received event: ${eventType}\\. Found \\d+ potential rule\\(s\\)\\.$`)), // Match the message string
            {payload: eventPayload} // Expect the second argument to be an object with the payload
        );
        // ************************************************

        // Check specific debug messages about context and condition evaluation
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`[Event: ${eventType}] Assembling shared JsonLogic context...`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`[Event: ${eventType}] Shared context assembled successfully.`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`[Rule ${RULE_COND_FALSE_BASIC.rule_id}] Condition found. Evaluating using shared context...`));

        // Check evaluate was called with the correct context structure
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(
            RULE_COND_FALSE_BASIC.condition,
            expect.objectContaining({
                event: {type: eventType, payload: eventPayload},
                actor: expect.objectContaining({id: MOCK_ENTITY_ACTOR.id, components: expect.anything()}),
                target: expect.objectContaining({id: MOCK_ENTITY_TARGET.id, components: expect.anything()}),
                context: expect.any(Object) // Ensure the mutable context part exists
            })
        );
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledTimes(1);
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`[Rule ${RULE_COND_FALSE_BASIC.rule_id}] Condition evaluation raw result: false`));

        // Check that condition *did not* pass and actions were skipped
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining(`[Rule ${RULE_COND_FALSE_BASIC.rule_id}] Condition passed`));
        // Check the specific skip log message
        expect(mockLogger.info).toHaveBeenCalledWith(
            expect.stringContaining(`Rule '${RULE_COND_FALSE_BASIC.rule_id}' actions skipped for event '${RULE_COND_FALSE_BASIC.event_type}' due to condition evaluating to false.`)
        );

        // Check that action sequence logs were NOT generated and executeSpy was NOT called
        expect(executeSpy).not.toHaveBeenCalled(); // Verify OperationInterpreter.execute wasn't called
        expect(mockLogHandler).not.toHaveBeenCalled(); // Verify the mock handler wasn't called either
        expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining(`<--- Finished action sequence for: Rule '${RULE_COND_FALSE_BASIC.rule_id}'`));
    });

});