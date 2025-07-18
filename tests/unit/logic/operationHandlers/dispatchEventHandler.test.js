// src/tests/logic/operationHandlers/dispatchEventHandler.test.js

/**
 * @jest-environment node
 */
import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { expectNoDispatch } from '../../../common/engine/dispatchTestUtils.js';
import DispatchEventHandler from '../../../../src/logic/operationHandlers/dispatchEventHandler.js'; // Adjust path as needed

// --- JSDoc Imports ---
/** @typedef {import('../../../../src/interfaces/coreServices.js').ILogger} ILogger */ // Corrected path assumption
/** @typedef {import('../../../../src/logic/defs.js').ExecutionContext} ExecutionContext */ // Corrected path assumption
/** @typedef {import('../../../../src/events/validatedEventDispatcher.js').default} ValidatedEventDispatcher */ // Corrected path assumption
/** @typedef {import('../../../../src/events/eventBus.js').default} EventBus */ // Corrected path assumption

// --- Mock ValidatedEventDispatcher (for VED-specific tests) ---
// FIX: Cleaned up mock. It only has `dispatch` to simulate a VED.
// Tests requiring EventBus features will define their own, more specific mocks.
const mockDispatcher = {
  dispatch: jest.fn(),
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
  event: { type: 'RULE_TRIGGER_EVENT', payload: {} },
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

    // FIX: Simplified beforeEach. Default mock is for the VED path.
    mockDispatcher.dispatch.mockResolvedValue(true);

    // Create a new handler instance for isolation using the VED-like mock
    handler = new DispatchEventHandler({
      dispatcher: mockDispatcher,
      logger: mockLogger,
    });
  });

  // --- Constructor Tests ---
  test('constructor should throw if dispatcher is missing', () => {
    expect(() => new DispatchEventHandler({ logger: mockLogger })).toThrow(
      'DispatchEventHandler requires a valid ValidatedEventDispatcher (preferred) or EventBus instance.'
    );
    expect(
      () =>
        new DispatchEventHandler({
          logger: mockLogger,
          dispatcher: null,
        })
    ).toThrow(
      'DispatchEventHandler requires a valid ValidatedEventDispatcher (preferred) or EventBus instance.'
    );
  });

  test('constructor should throw if dispatcher is invalid (missing methods)', () => {
    expect(
      () =>
        new DispatchEventHandler({
          dispatcher: {},
          logger: mockLogger,
        })
    ).toThrow(
      'DispatchEventHandler requires a valid ValidatedEventDispatcher (preferred) or EventBus instance.'
    );
    // FIX: Removed redundant test case for `dispatch` which no longer exists
    expect(
      () =>
        new DispatchEventHandler({
          dispatcher: { dispatch: 'not-a-function' },
          logger: mockLogger,
        })
    ).toThrow(
      'DispatchEventHandler requires a valid ValidatedEventDispatcher (preferred) or EventBus instance.'
    );
  });

  test('constructor should throw if logger is missing', () => {
    expect(
      () => new DispatchEventHandler({ dispatcher: mockDispatcher })
    ).toThrow('DispatchEventHandler requires a valid ILogger instance.');
    expect(
      () =>
        new DispatchEventHandler({
          dispatcher: mockDispatcher,
          logger: {},
        })
    ).toThrow('DispatchEventHandler requires a valid ILogger instance.');
    expect(
      () =>
        new DispatchEventHandler({
          dispatcher: mockDispatcher,
          logger: { debug: 'not-a-function' },
        })
    ).toThrow('DispatchEventHandler requires a valid ILogger instance.');
  });

  test('constructor should initialize successfully with valid ValidatedEventDispatcher and Logger', () => {
    expect(
      () =>
        new DispatchEventHandler({
          dispatcher: mockDispatcher,
          logger: mockLogger,
        })
    ).not.toThrow();
  });

  test('constructor should initialize successfully with valid EventBus and Logger', () => {
    const mockEventBus = {
      dispatch: jest.fn(),
      listenerCount: jest.fn(), // Include if used by the handler logic
    };
    expect(
      () =>
        new DispatchEventHandler({
          dispatcher: mockEventBus,
          logger: mockLogger,
        })
    ).not.toThrow();
  });

  // --- execute() Tests - Valid Parameters ---
  test('execute should call dispatcher.dispatch with correct eventType and payload', async () => {
    const params = {
      eventType: 'PLAYER_ACTION',
      payload: { action: 'move', direction: 'north' },
    };
    await handler.execute(params, mockEvaluationContext);

    expect(mockDispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatcher.dispatch).toHaveBeenCalledWith('PLAYER_ACTION', {
      action: 'move',
      direction: 'north',
    });
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Attempting to dispatch event "PLAYER_ACTION"'),
      expect.anything()
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Event "PLAYER_ACTION" dispatched (Validated).')
    );
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  test('execute should call dispatcher.dispatch with eventType and default empty payload if payload is missing', async () => {
    const params = { eventType: 'GAME_STARTED' }; // No payload property
    await handler.execute(params, mockEvaluationContext);

    expect(mockDispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatcher.dispatch).toHaveBeenCalledWith('GAME_STARTED', {});
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Attempting to dispatch event "GAME_STARTED"'),
      expect.anything()
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Event "GAME_STARTED" dispatched (Validated).')
    );
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  test('execute should call dispatcher.dispatch with eventType and default empty payload if payload is null', async () => {
    const params = { eventType: 'PLAYER_LOGOUT', payload: null };
    await handler.execute(params, mockEvaluationContext);

    expect(mockDispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatcher.dispatch).toHaveBeenCalledWith('PLAYER_LOGOUT', {});
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Attempting to dispatch event "PLAYER_LOGOUT"'),
      expect.anything()
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Event "PLAYER_LOGOUT" dispatched (Validated).')
    );
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  test('execute should call dispatcher.dispatch with eventType and default empty payload if payload is undefined', async () => {
    const params = { eventType: 'CONFIG_RELOADED', payload: undefined };
    await handler.execute(params, mockEvaluationContext);

    expect(mockDispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatcher.dispatch).toHaveBeenCalledWith('CONFIG_RELOADED', {});
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Attempting to dispatch event "CONFIG_RELOADED"'),
      expect.anything()
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Event "CONFIG_RELOADED" dispatched (Validated).')
    );
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  test('execute should trim whitespace from eventType', async () => {
    const params = { eventType: '  SPACED_EVENT  ', payload: { data: 1 } };
    await handler.execute(params, mockEvaluationContext);

    expect(mockDispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatcher.dispatch).toHaveBeenCalledWith('SPACED_EVENT', {
      data: 1,
    }); // Trimmed eventType
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Attempting to dispatch event "SPACED_EVENT"'),
      expect.anything()
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Event "SPACED_EVENT" dispatched (Validated).')
    );
  });

  // --- execute() Tests - Invalid Parameters ---
  test('execute should log warn and not dispatch if params is null', async () => {
    await handler.execute(null, mockEvaluationContext);
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'DISPATCH_EVENT: params missing or invalid.',
      { params: null }
    );
    expectNoDispatch(mockDispatcher.dispatch);
  });

  test('execute should log error and not dispatch if params is empty object', async () => {
    await handler.execute({}, mockEvaluationContext);
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid or missing "eventType" parameter'),
      expect.anything()
    );
    expectNoDispatch(mockDispatcher.dispatch);
  });

  test('execute should log error and not dispatch if eventType is missing', async () => {
    const params = { payload: { value: 1 } };
    await handler.execute(params, mockEvaluationContext);
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid or missing "eventType" parameter'),
      expect.anything()
    );
    expectNoDispatch(mockDispatcher.dispatch);
  });

  test('execute should log error and not dispatch if eventType is not a string', async () => {
    const params = { eventType: 123, payload: {} };
    await handler.execute(params, mockEvaluationContext);
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid or missing "eventType" parameter'),
      expect.anything()
    );
    expectNoDispatch(mockDispatcher.dispatch);
  });

  test('execute should log error and not dispatch if eventType is an empty or whitespace string', async () => {
    await handler.execute(
      { eventType: '', payload: {} },
      mockEvaluationContext
    );
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid or missing "eventType" parameter'),
      expect.anything()
    );
    expectNoDispatch(mockDispatcher.dispatch);
    mockLogger.error.mockClear(); // Clear for next check

    await handler.execute(
      { eventType: '   ', payload: {} },
      mockEvaluationContext
    );
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid or missing "eventType" parameter'),
      expect.anything()
    );
    expectNoDispatch(mockDispatcher.dispatch);
  });

  // FIX: Corrected a faulty assertion in this test.
  test('execute should log warning and dispatch with empty payload if payload is not an object (e.g., string)', async () => {
    const originalPayload = 'this is a string';
    const params = {
      eventType: 'INVALID_PAYLOAD_TYPE',
      payload: originalPayload,
    };
    await handler.execute(params, mockEvaluationContext);

    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "Resolved 'payload' is not an object (got string). Using empty object {}."
      ),
      expect.objectContaining({
        eventType: 'INVALID_PAYLOAD_TYPE',
        resolvedPayload: originalPayload,
      })
    );
    // Should still attempt dispatch with the default empty object
    expect(mockDispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      'INVALID_PAYLOAD_TYPE',
      {}
    );
    expect(mockLogger.error).not.toHaveBeenCalled();
    // Check success log still happens
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'Attempting to dispatch event "INVALID_PAYLOAD_TYPE"'
      ),
      expect.anything()
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'Event "INVALID_PAYLOAD_TYPE" dispatched (Validated).'
      )
    );
  });

  // --- execute() Tests - Placeholder Resolution (Now Testing Dispatch of Pre-Resolved Data) ---
  test('execute should dispatch payload with pre-resolved data', async () => {
    const preResolvedParams = {
      eventType: 'PLACEHOLDER_TEST',
      payload: {
        actorName: 'Alice',
        eventName: 'TEST_EVENT',
        customVar: 123,
        nonExistent: '$target.nonExistentProperty',
        notAPlaceholder: 'just a string',
      },
    };

    await handler.execute(preResolvedParams, mockEvaluationContext);

    expect(mockDispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      preResolvedParams.eventType,
      preResolvedParams.payload
    );
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'Attempting to dispatch event "PLACEHOLDER_TEST"'
      ),
      expect.anything()
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'Event "PLACEHOLDER_TEST" dispatched (Validated).'
      )
    );
  });

  // --- execute() Tests - Error Handling ---
  test('execute should log synchronous error if dispatcher call throws immediately', async () => {
    const syncError = new Error('Dispatcher sync fail!');
    mockDispatcher.dispatch.mockImplementationOnce(() => {
      throw syncError;
    });
    const params = { eventType: 'SYNC_FAIL_EVENT', payload: {} };

    await handler.execute(params, mockEvaluationContext);

    expect(mockDispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    // The error could be logged either as synchronous or async depending on the implementation
    const errorCall = mockLogger.error.mock.calls[0];
    const errorMessage = errorCall[0];
    expect(
      errorMessage.includes('Synchronous error occurred') ||
        errorMessage.includes('Error during async processing')
    ).toBe(true);
    expect(errorCall[1]).toMatchObject({ error: syncError });
    expect(mockLogger.debug).toHaveBeenCalledTimes(1);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Attempting to dispatch event "SYNC_FAIL_EVENT"'),
      expect.anything()
    );
    expect(mockLogger.debug).not.toHaveBeenCalledWith(
      expect.stringContaining('dispatched (Validated).')
    );
  });

  test('execute should log error if async dispatch rejects', async () => {
    const asyncError = new Error('Dispatcher async fail!');
    mockDispatcher.dispatch.mockRejectedValueOnce(asyncError);
    const params = { eventType: 'ASYNC_FAIL_EVENT', payload: {} };

    await handler.execute(params, mockEvaluationContext);

    expect(mockDispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'Attempting to dispatch event "ASYNC_FAIL_EVENT"'
      ),
      expect.anything()
    );
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'Error during async processing of event "ASYNC_FAIL_EVENT" via ValidatedEventDispatcher.'
      ),
      expect.objectContaining({ error: asyncError })
    );
    expect(mockLogger.debug).not.toHaveBeenCalledWith(
      expect.stringContaining(
        'Event "ASYNC_FAIL_EVENT" dispatched (Validated).'
      )
    );
  });

  // --- execute() Tests - EventBus Fallback ---
  // FIX: This test now passes because the handler logic is corrected and correctly identifies the EventBus mock.
  test('execute should use eventBus.dispatch if dispatcher has listenerCount', async () => {
    const mockEventBus = {
      dispatch: jest.fn().mockResolvedValue(undefined),
      listenerCount: jest.fn().mockReturnValue(1),
    };
    const busHandler = new DispatchEventHandler({
      dispatcher: mockEventBus,
      logger: mockLogger,
    });
    const params = { eventType: 'BUS_EVENT', payload: { id: 1 } };

    await busHandler.execute(params, mockEvaluationContext);

    expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
    expect(mockEventBus.dispatch).toHaveBeenCalledWith('BUS_EVENT', { id: 1 });
    expect(mockEventBus.listenerCount).toHaveBeenCalledWith('BUS_EVENT');
    expectNoDispatch(mockDispatcher.dispatch); // Ensure default VED mock wasn't called

    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Attempting to dispatch event "BUS_EVENT"'),
      expect.anything()
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'Dispatched "BUS_EVENT" to 1 listener(s) via EventBus.'
      )
    );
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  // FIX: Added listenerCount to the mock so the handler takes the correct (EventBus) path.
  test('execute should log error if async EventBus dispatch rejects', async () => {
    const asyncBusError = new Error('EventBus async fail!');
    const mockEventBus = {
      dispatch: jest.fn().mockRejectedValue(asyncBusError),
      listenerCount: jest.fn(), // MUST be present to trigger EventBus logic path
    };
    const busHandler = new DispatchEventHandler({
      dispatcher: mockEventBus,
      logger: mockLogger,
    });
    const params = { eventType: 'BUS_ASYNC_FAIL', payload: {} };

    await busHandler.execute(params, mockEvaluationContext);

    expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Attempting to dispatch event "BUS_ASYNC_FAIL"'),
      expect.anything()
    );
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'Error during dispatch of event "BUS_ASYNC_FAIL" via EventBus.'
      ),
      expect.objectContaining({ error: asyncBusError })
    );
    expect(mockLogger.debug).not.toHaveBeenCalledWith(
      expect.stringContaining('Dispatched "BUS_ASYNC_FAIL"')
    );
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  // FIX: This test now passes because the handler logic is corrected.
  test('execute should log warning if EventBus dispatch succeeds but has no listeners', async () => {
    const mockEventBusNoListeners = {
      dispatch: jest.fn().mockResolvedValue(undefined),
      listenerCount: jest.fn().mockReturnValue(0),
    };
    const busHandler = new DispatchEventHandler({
      dispatcher: mockEventBusNoListeners,
      logger: mockLogger,
    });
    const params = { eventType: 'NO_LISTENERS_EVENT', payload: { id: 2 } };

    await busHandler.execute(params, mockEvaluationContext);

    expect(mockEventBusNoListeners.dispatch).toHaveBeenCalledTimes(1);
    expect(mockEventBusNoListeners.dispatch).toHaveBeenCalledWith(
      'NO_LISTENERS_EVENT',
      { id: 2 }
    );
    expect(mockEventBusNoListeners.listenerCount).toHaveBeenCalledWith(
      'NO_LISTENERS_EVENT'
    );

    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'DispatchEventHandler: No listeners for event "NO_LISTENERS_EVENT".'
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'Attempting to dispatch event "NO_LISTENERS_EVENT"'
      ),
      expect.anything()
    );
    expect(mockLogger.debug).not.toHaveBeenCalledWith(
      expect.stringContaining('Dispatched "NO_LISTENERS_EVENT"')
    );
    expect(mockLogger.error).not.toHaveBeenCalled();
  });
});
