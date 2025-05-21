// src/tests/logic/operationHandlers/dispatchEventHandler.test.js

/**
 * @jest-environment node
 */
import {describe, expect, test, jest, beforeEach} from '@jest/globals';
import DispatchEventHandler from '../../../src/logic/operationHandlers/dispatchEventHandler.js'; // Adjust path as needed

// --- JSDoc Imports ---
/** @typedef {import('../../../src/interfaces/coreServices.js').ILogger} ILogger */ // Corrected path assumption
/** @typedef {import('../../../src/logic/defs.js').ExecutionContext} ExecutionContext */ // Corrected path assumption
/** @typedef {import('../../../core/services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */ // Corrected path assumption
/** @typedef {import('../../../src/events/eventBus.js').default} EventBus */ // Corrected path assumption

// --- Mock ValidatedEventDispatcher ---
const mockDispatcher = {
    dispatchValidated: jest.fn(),
    // Mock 'dispatch' as well for completeness if testing fallback logic
    dispatch: jest.fn(),
    // Mock listenerCount if needed for EventBus fallback tests
    listenerCount: jest.fn().mockReturnValue(1),
};

// --- Mock Logger ---
const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};

// --- Mock Execution Context ---
// This context is passed but not used for *resolution* within DispatchEventHandler anymore.
// It might be needed if the underlying dispatcher uses it.
const mockEvaluationContext = {
    event: {type: 'RULE_TRIGGER_EVENT', payload: {}},
    actor: null,
    target: null,
    context: {},
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
        mockDispatcher.dispatch.mockResolvedValue(undefined); // EventBus dispatch often returns void/undefined
        mockDispatcher.listenerCount.mockReturnValue(1); // Default listener count for EventBus path

        // Create a new handler instance for isolation
        handler = new DispatchEventHandler({dispatcher: mockDispatcher, logger: mockLogger});
    });

    // --- Constructor Tests ---
    test('constructor should throw if dispatcher is missing', () => {
        expect(() => new DispatchEventHandler({logger: mockLogger})).toThrow('DispatchEventHandler requires a valid ValidatedEventDispatcher (preferred) or EventBus instance.');
        expect(() => new DispatchEventHandler({
            logger: mockLogger,
            dispatcher: null
        })).toThrow('DispatchEventHandler requires a valid ValidatedEventDispatcher (preferred) or EventBus instance.');
    });

    test('constructor should throw if dispatcher is invalid (missing methods)', () => {
        expect(() => new DispatchEventHandler({
            dispatcher: {},
            logger: mockLogger
        })).toThrow('DispatchEventHandler requires a valid ValidatedEventDispatcher (preferred) or EventBus instance.');
        expect(() => new DispatchEventHandler({
            dispatcher: {dispatchValidated: 'not-a-function'},
            logger: mockLogger
        })).toThrow('DispatchEventHandler requires a valid ValidatedEventDispatcher (preferred) or EventBus instance.');
        expect(() => new DispatchEventHandler({
            dispatcher: {dispatch: 'not-a-function'},
            logger: mockLogger
        })).toThrow('DispatchEventHandler requires a valid ValidatedEventDispatcher (preferred) or EventBus instance.');
    });

    test('constructor should throw if logger is missing', () => {
        expect(() => new DispatchEventHandler({dispatcher: mockDispatcher})).toThrow('DispatchEventHandler requires a valid ILogger instance.');
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
        expect(() => new DispatchEventHandler({dispatcher: mockDispatcher, logger: mockLogger})).not.toThrow();
    });

    test('constructor should initialize successfully with valid EventBus and Logger', () => {
        const mockEventBus = {
            dispatch: jest.fn(),
            listenerCount: jest.fn() // Include if used by the handler logic
        };
        expect(() => new DispatchEventHandler({dispatcher: mockEventBus, logger: mockLogger})).not.toThrow();
    });


    // --- execute() Tests - Valid Parameters ---
    test('execute should call dispatcher.dispatchValidated with correct eventType and payload', async () => {
        const params = {eventType: 'PLAYER_ACTION', payload: {action: 'move', direction: 'north'}};
        handler.execute(params, mockEvaluationContext);

        await new Promise(resolve => setTimeout(resolve, 0)); // Allow async .then/.catch to run

        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith('PLAYER_ACTION', {
            action: 'move',
            direction: 'north'
        });
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Attempting to dispatch event "PLAYER_ACTION"'), expect.anything());
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Event "PLAYER_ACTION" dispatched (Validated).'));
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    test('execute should call dispatcher.dispatchValidated with eventType and default empty payload if payload is missing', async () => {
        const params = {eventType: 'GAME_STARTED'}; // No payload property
        handler.execute(params, mockEvaluationContext);
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith('GAME_STARTED', {});
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Attempting to dispatch event "GAME_STARTED"'), expect.anything());
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Event "GAME_STARTED" dispatched (Validated).'));
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    test('execute should call dispatcher.dispatchValidated with eventType and default empty payload if payload is null', async () => {
        const params = {eventType: 'PLAYER_LOGOUT', payload: null};
        handler.execute(params, mockEvaluationContext);
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith('PLAYER_LOGOUT', {});
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Attempting to dispatch event "PLAYER_LOGOUT"'), expect.anything());
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Event "PLAYER_LOGOUT" dispatched (Validated).'));
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    test('execute should call dispatcher.dispatchValidated with eventType and default empty payload if payload is undefined', async () => {
        const params = {eventType: 'CONFIG_RELOADED', payload: undefined};
        handler.execute(params, mockEvaluationContext);
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith('CONFIG_RELOADED', {});
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Attempting to dispatch event "CONFIG_RELOADED"'), expect.anything());
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Event "CONFIG_RELOADED" dispatched (Validated).'));
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    // *** TEST FIX: This should now pass because trimming is done in the handler ***
    test('execute should trim whitespace from eventType', async () => {
        const params = {eventType: '  SPACED_EVENT  ', payload: {data: 1}};
        handler.execute(params, mockEvaluationContext);
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith('SPACED_EVENT', {data: 1}); // Trimmed eventType
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Attempting to dispatch event "SPACED_EVENT"'), expect.anything());
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Event "SPACED_EVENT" dispatched (Validated).'));
    });

    // --- execute() Tests - Invalid Parameters ---
    test('execute should log error and not dispatch if params is null', () => {
        handler.execute(null, mockEvaluationContext);
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid or missing "eventType" parameter'), expect.anything());
        expect(mockDispatcher.dispatchValidated).not.toHaveBeenCalled();
        expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    test('execute should log error and not dispatch if params is empty object', () => {
        handler.execute({}, mockEvaluationContext);
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid or missing "eventType" parameter'), expect.anything());
        expect(mockDispatcher.dispatchValidated).not.toHaveBeenCalled();
        expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    test('execute should log error and not dispatch if eventType is missing', () => {
        const params = {payload: {value: 1}};
        handler.execute(params, mockEvaluationContext);
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid or missing "eventType" parameter'), expect.anything());
        expect(mockDispatcher.dispatchValidated).not.toHaveBeenCalled();
        expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    test('execute should log error and not dispatch if eventType is not a string', () => {
        const params = {eventType: 123, payload: {}};
        handler.execute(params, mockEvaluationContext);
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid or missing "eventType" parameter'), expect.anything());
        expect(mockDispatcher.dispatchValidated).not.toHaveBeenCalled();
        expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    test('execute should log error and not dispatch if eventType is an empty or whitespace string', () => {
        handler.execute({eventType: '', payload: {}}, mockEvaluationContext);
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid or missing "eventType" parameter'), expect.anything());
        expect(mockDispatcher.dispatchValidated).not.toHaveBeenCalled();
        expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
        mockLogger.error.mockClear(); // Clear for next check

        handler.execute({eventType: '   ', payload: {}}, mockEvaluationContext);
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        // The check now happens *after* trimming, so the specific message might change slightly if you adjusted it
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid or missing "eventType" parameter'), expect.anything());
        expect(mockDispatcher.dispatchValidated).not.toHaveBeenCalled();
        expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    // *** TEST FIX: Make assertion slightly more specific, although expect.anything() should have worked ***
    test('execute should log warning and dispatch with empty payload if payload is not an object (e.g., string)', async () => {
        const originalPayload = 'this is a string';
        const params = {eventType: 'INVALID_PAYLOAD_TYPE', payload: originalPayload};
        handler.execute(params, mockEvaluationContext);
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        // Check the logged warning and context object more specifically
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining("Resolved 'payload' is not an object (got string). Using empty object {}."),
            expect.objectContaining({ // Use objectContaining for more robust check
                eventType: 'INVALID_PAYLOAD_TYPE',
                resolvedPayload: originalPayload // Check that the original invalid payload was logged
            })
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

    // --- execute() Tests - Placeholder Resolution (Now Testing Dispatch of Pre-Resolved Data) ---
    // *** TEST FIX: Update test to reflect that the handler expects pre-resolved data ***
    test('execute should dispatch payload with pre-resolved data', async () => {
        // Define the data *as it should be* after resolution happened *before* this handler
        const preResolvedParams = {
            eventType: 'PLACEHOLDER_TEST',
            payload: {
                actorName: 'Alice',                 // Value resolved previously
                eventName: 'TEST_EVENT',            // Value resolved previously
                customVar: 123,                   // Value resolved previously
                nonExistent: '$target.nonExistentProperty', // Assuming unresolved placeholders are kept literal
                notAPlaceholder: 'just a string'    // Literal string remains
            }
        };

        // Pass the pre-resolved data to the handler.
        // mockEvaluationContext is passed but not used for resolution *within* this handler.
        handler.execute(preResolvedParams, mockEvaluationContext);
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
        // Verify the handler passed the pre-resolved data directly to the dispatcher
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith(
            preResolvedParams.eventType, // Should be 'PLACEHOLDER_TEST'
            preResolvedParams.payload    // Should be the object with already resolved values
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
        // Check logs still happen
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Attempting to dispatch event "PLACEHOLDER_TEST"'), expect.anything());
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Event "PLACEHOLDER_TEST" dispatched (Validated).'));
    });


    // --- execute() Tests - Error Handling ---
    test('execute should log synchronous error if dispatcher call throws immediately', () => { // No async needed if error is sync
        const syncError = new Error('Dispatcher sync fail!');
        mockDispatcher.dispatchValidated.mockImplementationOnce(() => {
            throw syncError;
        });
        const params = {eventType: 'SYNC_FAIL_EVENT', payload: {}};

        handler.execute(params, mockEvaluationContext);

        // No async wait needed here

        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining('Synchronous error occurred when trying to initiate dispatch'),
            expect.objectContaining({error: syncError})
        );
        // Only the initial "Attempting..." debug log should occur
        expect(mockLogger.debug).toHaveBeenCalledTimes(1);
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Attempting to dispatch event "SYNC_FAIL_EVENT"'), expect.anything());
        // Ensure success log did NOT happen
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('dispatched (Validated).'));
    });

    test('execute should log error if async dispatchValidated rejects', async () => {
        const asyncError = new Error('Dispatcher async fail!');
        mockDispatcher.dispatchValidated.mockRejectedValueOnce(asyncError);
        const params = {eventType: 'ASYNC_FAIL_EVENT', payload: {}};

        handler.execute(params, mockEvaluationContext);

        await new Promise(resolve => setTimeout(resolve, 0)); // Wait for promise rejection

        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Attempting to dispatch event "ASYNC_FAIL_EVENT"'), expect.anything());
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining('Error during async processing of event "ASYNC_FAIL_EVENT" via ValidatedEventDispatcher.'),
            expect.objectContaining({error: asyncError})
        );
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Event "ASYNC_FAIL_EVENT" dispatched (Validated).'));
    });


    // --- execute() Tests - EventBus Fallback ---
    test('execute should use eventBus.dispatch if dispatcher lacks dispatchValidated', async () => {
        const mockEventBus = {
            dispatch: jest.fn().mockResolvedValue(undefined), // Mock EventBus dispatch
            listenerCount: jest.fn().mockReturnValue(1) // Mock listener count > 0
        };
        const busHandler = new DispatchEventHandler({dispatcher: mockEventBus, logger: mockLogger});
        const params = {eventType: 'BUS_EVENT', payload: {id: 1}};

        busHandler.execute(params, mockEvaluationContext);

        await new Promise(resolve => setTimeout(resolve, 0)); // Wait for promise resolution

        expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
        expect(mockEventBus.dispatch).toHaveBeenCalledWith('BUS_EVENT', {id: 1});
        // Check listenerCount was called within the .then() block
        expect(mockEventBus.listenerCount).toHaveBeenCalledWith('BUS_EVENT');
        expect(mockDispatcher.dispatchValidated).not.toHaveBeenCalled(); // Ensure original mock wasn't called

        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Attempting to dispatch event "BUS_EVENT"'), expect.anything());
        // Check the success log from the EventBus path's .then block
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Dispatched "BUS_EVENT" to 1 listener(s) via EventBus.'));
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    test('execute should log error if async EventBus dispatch rejects', async () => {
        const asyncBusError = new Error('EventBus async fail!');
        const mockEventBus = {
            dispatch: jest.fn().mockRejectedValue(asyncBusError) // Mock EventBus dispatch to reject
            // No listenerCount mock needed if dispatch fails before .then()
        };
        const busHandler = new DispatchEventHandler({dispatcher: mockEventBus, logger: mockLogger});
        const params = {eventType: 'BUS_ASYNC_FAIL', payload: {}};

        busHandler.execute(params, mockEvaluationContext);

        await new Promise(resolve => setTimeout(resolve, 0)); // Wait for promise rejection

        expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Attempting to dispatch event "BUS_ASYNC_FAIL"'), expect.anything());
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining('Error during dispatch of event "BUS_ASYNC_FAIL" via EventBus.'),
            expect.objectContaining({error: asyncBusError})
        );
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

        await new Promise(resolve => setTimeout(resolve, 0)); // Wait for promise resolution

        expect(mockEventBusNoListeners.dispatch).toHaveBeenCalledTimes(1);
        expect(mockEventBusNoListeners.dispatch).toHaveBeenCalledWith('NO_LISTENERS_EVENT', {id: 2});
        expect(mockEventBusNoListeners.listenerCount).toHaveBeenCalledWith('NO_LISTENERS_EVENT');

        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith(
            'DispatchEventHandler: No listeners for event "NO_LISTENERS_EVENT".'
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Attempting to dispatch event "NO_LISTENERS_EVENT"'), expect.anything());
        // Check that the specific success debug log did NOT happen
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Dispatched "NO_LISTENERS_EVENT" to 0 listener(s) via EventBus.'));
        expect(mockLogger.error).not.toHaveBeenCalled();
    });
});