// src/tests/logic/operationHandlers/dispatchEventHandler.test.js

/**
 * @jest-environment node
 */
import {describe, expect, test, jest, beforeEach} from '@jest/globals';
import DispatchEventHandler from '../../../logic/operationHandlers/dispatchEventHandler.js'; // Adjust path as needed

// --- JSDoc Imports ---
/** @typedef {import('../../../core/interfaces/coreServices.js').ILogger} ILogger */ // Corrected path assumption
/** @typedef {import('../../../logic/defs.js').ExecutionContext} ExecutionContext */ // Corrected path assumption
/** @typedef {import('../../../core/services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */ // Corrected path assumption
/** @typedef {import('../../../core/eventBus.js').default} EventBus */ // Corrected path assumption

// --- Mock ValidatedEventDispatcher ---
const mockDispatcher = {
    dispatchValidated: jest.fn(),
    // Mock 'dispatch' as well for completeness if testing fallback logic
    dispatch: jest.fn(),
    // Mock listenerCount if needed for EventBus fallback tests
    // listenerCount: jest.fn().mockReturnValue(1),
};

// --- Mock Logger ---
const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};

// --- Mock Execution Context ---
// NOTE: The second argument to execute is now `evaluationContext`, not the full `ExecutionContext`
// Ensure mockContext aligns with what `evaluationContext` actually contains if placeholders are used.
// For these tests focusing on dispatch, the content might not matter deeply unless placeholders are involved.
const mockEvaluationContext = {
    // Based on the default structure often used:
    event: {type: 'RULE_TRIGGER_EVENT', payload: {}},
    actor: null,
    target: null,
    context: {}, // General context variables might live here
    // Add logger here if resolvePath needs it, but prefer injected logger
};


// --- Test Suite ---
describe('DispatchEventHandler', () => {
    /** @type {DispatchEventHandler} */
    let handler;

    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();

        // Mock dispatchValidated to return a resolved promise by default
        mockDispatcher.dispatchValidated.mockResolvedValue(true);
        // Mock dispatch (EventBus fallback) if needed
        // Ensure EventBus mock returns a promise if its implementation does
        mockDispatcher.dispatch.mockResolvedValue(undefined); // Let's make it return a resolved promise

        // Create a new handler instance for isolation, **NOW WITH LOGGER**
        handler = new DispatchEventHandler({dispatcher: mockDispatcher, logger: mockLogger});
    });

    // --- Constructor Tests ---
    test('constructor should throw if dispatcher is missing', () => {
        // Provide the logger, but omit the dispatcher
        expect(() => new DispatchEventHandler({logger: mockLogger})).toThrow('DispatchEventHandler requires a valid ValidatedEventDispatcher (preferred) or EventBus instance.');
        // Test with null dispatcher explicitly
        expect(() => new DispatchEventHandler({
            logger: mockLogger,
            dispatcher: null
        })).toThrow('DispatchEventHandler requires a valid ValidatedEventDispatcher (preferred) or EventBus instance.');

    });

    test('constructor should throw if dispatcher is invalid (missing methods)', () => {
        // Provide the logger, but an invalid dispatcher
        expect(() => new DispatchEventHandler({
            dispatcher: {},
            logger: mockLogger
        })).toThrow('DispatchEventHandler requires a valid ValidatedEventDispatcher (preferred) or EventBus instance.');
        expect(() => new DispatchEventHandler({
            dispatcher: {dispatchValidated: 'not-a-function'},
            logger: mockLogger
        })).toThrow('DispatchEventHandler requires a valid ValidatedEventDispatcher (preferred) or EventBus instance.');
        // Test case where only 'dispatch' is invalid (if relevant)
        expect(() => new DispatchEventHandler({
            dispatcher: {dispatch: 'not-a-function'},
            logger: mockLogger
        })).toThrow('DispatchEventHandler requires a valid ValidatedEventDispatcher (preferred) or EventBus instance.');
    });

    test('constructor should throw if logger is missing', () => {
        // Provide dispatcher, omit logger
        expect(() => new DispatchEventHandler({dispatcher: mockDispatcher})).toThrow('DispatchEventHandler requires a valid ILogger instance.');
        // Provide dispatcher, invalid logger
        expect(() => new DispatchEventHandler({
            dispatcher: mockDispatcher,
            logger: {}
        })).toThrow('DispatchEventHandler requires a valid ILogger instance.');
        expect(() => new DispatchEventHandler({
            dispatcher: mockDispatcher,
            logger: {debug: 'not-a-function'}
        })).toThrow('DispatchEventHandler requires a valid ILogger instance.');
    });

    test('constructor should initialize successfully with valid ValidatedEventDispatcher and Logger', () => {
        // Provide both valid dependencies
        expect(() => new DispatchEventHandler({dispatcher: mockDispatcher, logger: mockLogger})).not.toThrow();
    });

    // Test constructor with valid EventBus (if fallback is intended)
    test('constructor should initialize successfully with valid EventBus and Logger', () => {
        const mockEventBus = {
            dispatch: jest.fn() // Minimum required method for EventBus path
        };
        expect(() => new DispatchEventHandler({dispatcher: mockEventBus, logger: mockLogger})).not.toThrow();
    });


    // --- execute() Tests - Valid Parameters ---
    // Pass mockEvaluationContext as the second argument now
    test('execute should call dispatcher.dispatchValidated with correct eventType and payload', async () => { // Added async for consistency, though not strictly needed here
        const params = {eventType: 'PLAYER_ACTION', payload: {action: 'move', direction: 'north'}};
        handler.execute(params, mockEvaluationContext); // Use evaluationContext

        // Give potential promise callbacks (like .then in dispatchValidated) a chance to run
        await new Promise(resolve => setTimeout(resolve, 0)); // USE setTimeout

        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith('PLAYER_ACTION', {
            action: 'move',
            direction: 'north'
        });
        // Check logs
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Attempting to dispatch event "PLAYER_ACTION"'), expect.anything());
        // Check the success log from the .then() block
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Event "PLAYER_ACTION" dispatched (Validated).'));
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    test('execute should call dispatcher.dispatchValidated with eventType and default empty payload if payload is missing', async () => {
        const params = {eventType: 'GAME_STARTED'}; // No payload property
        handler.execute(params, mockEvaluationContext); // Use evaluationContext
        await new Promise(resolve => setTimeout(resolve, 0)); // USE setTimeout

        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith('GAME_STARTED', {}); // Should default to {}
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Attempting to dispatch event "GAME_STARTED"'), expect.anything());
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Event "GAME_STARTED" dispatched (Validated).'));
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    test('execute should call dispatcher.dispatchValidated with eventType and default empty payload if payload is null', async () => {
        const params = {eventType: 'PLAYER_LOGOUT', payload: null};
        handler.execute(params, mockEvaluationContext); // Use evaluationContext
        await new Promise(resolve => setTimeout(resolve, 0)); // USE setTimeout

        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith('PLAYER_LOGOUT', {}); // Should default to {}
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Attempting to dispatch event "PLAYER_LOGOUT"'), expect.anything());
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Event "PLAYER_LOGOUT" dispatched (Validated).'));
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    test('execute should call dispatcher.dispatchValidated with eventType and default empty payload if payload is undefined', async () => {
        const params = {eventType: 'CONFIG_RELOADED', payload: undefined};
        handler.execute(params, mockEvaluationContext); // Use evaluationContext
        await new Promise(resolve => setTimeout(resolve, 0)); // USE setTimeout

        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith('CONFIG_RELOADED', {}); // Should default to {}
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Attempting to dispatch event "CONFIG_RELOADED"'), expect.anything());
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Event "CONFIG_RELOADED" dispatched (Validated).'));
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    test('execute should trim whitespace from eventType', async () => {
        const params = {eventType: '  SPACED_EVENT  ', payload: {data: 1}};
        handler.execute(params, mockEvaluationContext); // Use evaluationContext
        await new Promise(resolve => setTimeout(resolve, 0)); // USE setTimeout

        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith('SPACED_EVENT', {data: 1}); // Trimmed eventType
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Attempting to dispatch event "SPACED_EVENT"'), expect.anything());
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Event "SPACED_EVENT" dispatched (Validated).'));
    });

    // --- execute() Tests - Invalid Parameters ---
    test('execute should log error and not dispatch if params is null', () => {
        handler.execute(null, mockEvaluationContext); // Use evaluationContext
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid or missing "eventType" parameter'), expect.anything());
        expect(mockDispatcher.dispatchValidated).not.toHaveBeenCalled();
        expect(mockDispatcher.dispatch).not.toHaveBeenCalled(); // Check fallback too
    });

    test('execute should log error and not dispatch if params is empty object', () => {
        handler.execute({}, mockEvaluationContext); // Use evaluationContext
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid or missing "eventType" parameter'), expect.anything());
        expect(mockDispatcher.dispatchValidated).not.toHaveBeenCalled();
        expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    test('execute should log error and not dispatch if eventType is missing', () => {
        const params = {payload: {value: 1}};
        handler.execute(params, mockEvaluationContext); // Use evaluationContext
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid or missing "eventType" parameter'), expect.anything());
        expect(mockDispatcher.dispatchValidated).not.toHaveBeenCalled();
        expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    test('execute should log error and not dispatch if eventType is not a string', () => {
        const params = {eventType: 123, payload: {}};
        handler.execute(params, mockEvaluationContext); // Use evaluationContext
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid or missing "eventType" parameter'), expect.anything());
        expect(mockDispatcher.dispatchValidated).not.toHaveBeenCalled();
        expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    test('execute should log error and not dispatch if eventType is an empty or whitespace string', () => {
        handler.execute({eventType: '', payload: {}}, mockEvaluationContext); // Use evaluationContext
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid or missing "eventType" parameter'), expect.anything());
        expect(mockDispatcher.dispatchValidated).not.toHaveBeenCalled();
        expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
        mockLogger.error.mockClear(); // Clear for next check

        handler.execute({eventType: '   ', payload: {}}, mockEvaluationContext); // Use evaluationContext
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid or missing "eventType" parameter'), expect.anything());
        expect(mockDispatcher.dispatchValidated).not.toHaveBeenCalled();
        expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    test('execute should log warning and dispatch with empty payload if payload is not an object (e.g., string)', async () => {
        const params = {eventType: 'INVALID_PAYLOAD_TYPE', payload: 'this is a string'};
        handler.execute(params, mockEvaluationContext); // Use evaluationContext
        await new Promise(resolve => setTimeout(resolve, 0)); // USE setTimeout

        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining("Invalid 'payload' provided (expected object or null/undefined, got string). Defaulting to empty object {}."),
            expect.anything()
        );
        // Should still attempt dispatch with the default empty object
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith('INVALID_PAYLOAD_TYPE', {});
        expect(mockDispatcher.dispatch).not.toHaveBeenCalled(); // Shouldn't fallback here
        expect(mockLogger.error).not.toHaveBeenCalled();
        // Check success log still happens
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Attempting to dispatch event "INVALID_PAYLOAD_TYPE"'), expect.anything());
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Event "INVALID_PAYLOAD_TYPE" dispatched (Validated).'));

    });

    // --- execute() Tests - Placeholder Resolution (Example) ---
    test('execute should resolve placeholders in payload from evaluationContext', async () => {
        const params = {
            eventType: 'PLACEHOLDER_TEST',
            payload: {
                actorName: '$actor.name',
                eventName: '$event.type',
                customVar: '$context.someValue',
                nonExistent: '$target.nonExistentProperty', // Should resolve to undefined -> keep literal
                notAPlaceholder: 'just a string'
            }
        };
        const contextForPlaceholder = {
            event: {type: 'TEST_EVENT', value: 10},
            actor: {id: 'actor1', name: 'Alice'},
            target: null,
            context: {someValue: 123}
        };

        handler.execute(params, contextForPlaceholder);
        await new Promise(resolve => setTimeout(resolve, 0)); // USE setTimeout

        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith('PLACEHOLDER_TEST', {
            actorName: 'Alice',                 // Resolved from contextForPlaceholder.actor.name
            eventName: 'TEST_EVENT',            // Resolved from contextForPlaceholder.event.type
            customVar: 123,                   // Resolved from contextForPlaceholder.context.someValue
            nonExistent: '$target.nonExistentProperty', // Kept literal as path resolved to undefined
            notAPlaceholder: 'just a string'    // Kept literal
        });
        expect(mockLogger.error).not.toHaveBeenCalled();
        // Check success log still happens
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Attempting to dispatch event "PLACEHOLDER_TEST"'), expect.anything());
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Event "PLACEHOLDER_TEST" dispatched (Validated).'));
    });


    // --- execute() Tests - Error Handling ---

    test('execute should log synchronous error if dispatcher call throws immediately', async () => { // Made async just in case, though error is sync
        const syncError = new Error('Dispatcher sync fail!');
        // Ensure the mock throws synchronously
        mockDispatcher.dispatchValidated.mockImplementationOnce(() => {
            throw syncError;
        });
        const params = {eventType: 'SYNC_FAIL_EVENT', payload: {}};

        // Execute the function
        handler.execute(params, mockEvaluationContext); // Use evaluationContext

        // No async wait needed here as the error is synchronous

        // Check that the dispatch was attempted (and threw)
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
        // Check that the error was logged via the injected logger
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining('Synchronous error occurred when trying to initiate dispatch'),
            expect.objectContaining({error: syncError})
        );
        // Ensure no success/attempt logs happened after the sync error catcher
        expect(mockLogger.debug).toHaveBeenCalledTimes(1); // Only the initial "Attempting..."
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Attempting to dispatch event "SYNC_FAIL_EVENT"'), expect.anything());

    });

    test('execute should log error if async dispatchValidated rejects', async () => {
        const asyncError = new Error('Dispatcher async fail!');
        // Mock dispatchValidated to return a rejected promise
        mockDispatcher.dispatchValidated.mockRejectedValueOnce(asyncError);

        const params = {eventType: 'ASYNC_FAIL_EVENT', payload: {}};

        handler.execute(params, mockEvaluationContext); // Use evaluationContext

        // *** USE setTimeout TO WAIT FOR PROMISE CALLBACKS ***
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
        // Check the first debug log happened
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Attempting to dispatch event "ASYNC_FAIL_EVENT"'), expect.anything());
        // Check if the error logger was called from the .catch block
        expect(mockLogger.error).toHaveBeenCalledTimes(1); // <<< This was failing
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining('Error during async processing of event "ASYNC_FAIL_EVENT" via ValidatedEventDispatcher.'),
            expect.objectContaining({error: asyncError})
        );
        // Ensure the success debug log did NOT happen
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Event "ASYNC_FAIL_EVENT" dispatched (Validated).'));
    });


    // --- execute() Tests - EventBus Fallback ---
    test('execute should use eventBus.dispatch if dispatcher lacks dispatchValidated', async () => {
        const mockEventBus = {
            dispatch: jest.fn().mockResolvedValue(undefined), // Mock EventBus dispatch returns resolved promise
            // Ensure listenerCount is mocked if the code uses it
            listenerCount: jest.fn().mockReturnValue(1) // Mock listener count > 0
        };
        // Create a handler specifically with the mock EventBus
        const busHandler = new DispatchEventHandler({dispatcher: mockEventBus, logger: mockLogger});
        const params = {eventType: 'BUS_EVENT', payload: {id: 1}};

        busHandler.execute(params, mockEvaluationContext); // Use evaluationContext

        // *** USE setTimeout TO WAIT FOR PROMISE CALLBACKS ***
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
        expect(mockEventBus.dispatch).toHaveBeenCalledWith('BUS_EVENT', {id: 1});
        // Check listenerCount was called within the .then() block
        expect(mockEventBus.listenerCount).toHaveBeenCalledWith('BUS_EVENT');
        expect(mockDispatcher.dispatchValidated).not.toHaveBeenCalled(); // Ensure original mock wasn't called

        // Check for the correct debug log
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Attempting to dispatch event "BUS_EVENT"'), expect.anything());
        // Check the success log from the EventBus path's .then block
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Dispatched "BUS_EVENT" to 1 listener(s) via EventBus.'),); // Check specific count

        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalled(); // Should not warn if listeners > 0
    });

    test('execute should log error if async EventBus dispatch rejects', async () => {
        const asyncBusError = new Error('EventBus async fail!');
        const mockEventBus = {
            dispatch: jest.fn().mockRejectedValue(asyncBusError) // Mock EventBus dispatch to reject
            // No need for listenerCount mock if dispatch fails before .then()
        };
        // Create a handler specifically with the mock EventBus
        const busHandler = new DispatchEventHandler({dispatcher: mockEventBus, logger: mockLogger});
        const params = {eventType: 'BUS_ASYNC_FAIL', payload: {}};

        busHandler.execute(params, mockEvaluationContext); // Use evaluationContext

        // *** USE setTimeout TO WAIT FOR PROMISE CALLBACKS ***
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
        // Check the first debug log happened
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Attempting to dispatch event "BUS_ASYNC_FAIL"'), expect.anything());
        // Check if the error logger was called from the .catch block for EventBus
        expect(mockLogger.error).toHaveBeenCalledTimes(1); // <<< This was failing
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining('Error during dispatch of event "BUS_ASYNC_FAIL" via EventBus.'),
            expect.objectContaining({error: asyncBusError})
        );
        // Ensure the success/warning logs did NOT happen
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Dispatched "BUS_ASYNC_FAIL"'));
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    test('execute should log warning if EventBus dispatch succeeds but has no listeners', async () => {
        const mockEventBusNoListeners = {
            dispatch: jest.fn().mockResolvedValue(undefined), // Mock EventBus dispatch succeeds
            listenerCount: jest.fn().mockReturnValue(0) // Mock listener count to be 0
        };
        const busHandler = new DispatchEventHandler({dispatcher: mockEventBusNoListeners, logger: mockLogger});
        const params = {eventType: 'NO_LISTENERS_EVENT', payload: {id: 2}};

        busHandler.execute(params, mockEvaluationContext);

        // *** USE setTimeout TO WAIT FOR PROMISE CALLBACKS ***
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(mockEventBusNoListeners.dispatch).toHaveBeenCalledTimes(1);
        expect(mockEventBusNoListeners.dispatch).toHaveBeenCalledWith('NO_LISTENERS_EVENT', {id: 2});
        // Check listenerCount was called
        expect(mockEventBusNoListeners.listenerCount).toHaveBeenCalledWith('NO_LISTENERS_EVENT');

        // Check that the warning was logged
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith(
            'DispatchEventHandler: No listeners for event "NO_LISTENERS_EVENT".'
        );
        // Check that the attempt debug log still happened
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Attempting to dispatch event "NO_LISTENERS_EVENT"'), expect.anything());
        // Check that the success debug log did NOT happen (because warn happened instead)
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Dispatched "NO_LISTENERS_EVENT" to 0 listener(s) via EventBus.')); // <<< This was failing (incorrectly asserted)
        expect(mockLogger.error).not.toHaveBeenCalled();
    });


});