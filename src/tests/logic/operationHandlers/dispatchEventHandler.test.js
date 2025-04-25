// src/tests/logic/operationHandlers/dispatchEventHandler.test.js

/**
 * @jest-environment node
 */
import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import DispatchEventHandler from '../../../logic/operationHandlers/dispatchEventHandler.js'; // Adjust path as needed

// --- JSDoc Imports ---
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../../core/services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../../core/eventBus.js').default} EventBus */ // For mock interface clarity

// --- Mock ValidatedEventDispatcher ---
// We only mock the method we expect to be called.
// It needs to return a Promise for dispatchValidated.
const mockDispatcher = {
  dispatchValidated: jest.fn(),
  // Add publish for testing EventBus fallback if needed, but prioritize dispatchValidated
  // publish: jest.fn(),
};

// --- Mock Logger ---
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// --- Mock Execution Context ---
/** @type {ExecutionContext} */
const mockContext = {
  event: { type: 'RULE_TRIGGER_EVENT', payload: {} },
  actor: null,
  target: null,
  logger: mockLogger,
  evaluationContext: {},
  // Add other context properties if needed by the handler indirectly ( unlikely here )
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

    // Create a new handler instance for isolation
    handler = new DispatchEventHandler({ dispatcher: mockDispatcher });
  });

  // --- Constructor Tests ---
  test('constructor should throw if dispatcher is missing', () => {
    expect(() => new DispatchEventHandler({})).toThrow('DispatchEventHandler requires a valid ValidatedEventDispatcher (preferred) or EventBus instance.');
  });

  test('constructor should throw if dispatcher is invalid (missing methods)', () => {
    expect(() => new DispatchEventHandler({ dispatcher: {} })).toThrow('DispatchEventHandler requires a valid ValidatedEventDispatcher (preferred) or EventBus instance.');
    expect(() => new DispatchEventHandler({ dispatcher: { dispatchValidated: 'not-a-function' } })).toThrow('DispatchEventHandler requires a valid ValidatedEventDispatcher (preferred) or EventBus instance.');
  });

  test('constructor should initialize successfully with valid ValidatedEventDispatcher', () => {
    expect(() => new DispatchEventHandler({ dispatcher: mockDispatcher })).not.toThrow();
  });

  // --- execute() Tests - Valid Parameters ---
  test('execute should call dispatcher.dispatchValidated with correct eventType and payload', () => {
    const params = { eventType: 'PLAYER_ACTION', payload: { action: 'move', direction: 'north' } };
    handler.execute(params, mockContext);

    expect(mockDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
    expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith('PLAYER_ACTION', { action: 'move', direction: 'north' });
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Attempting to dispatch event "PLAYER_ACTION"'), expect.anything());
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  test('execute should call dispatcher.dispatchValidated with eventType and default empty payload if payload is missing', () => {
    const params = { eventType: 'GAME_STARTED' }; // No payload property
    handler.execute(params, mockContext);

    expect(mockDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
    expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith('GAME_STARTED', {}); // Should default to {}
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  test('execute should call dispatcher.dispatchValidated with eventType and default empty payload if payload is null', () => {
    const params = { eventType: 'PLAYER_LOGOUT', payload: null };
    handler.execute(params, mockContext);

    expect(mockDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
    expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith('PLAYER_LOGOUT', {}); // Should default to {}
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  test('execute should call dispatcher.dispatchValidated with eventType and default empty payload if payload is undefined', () => {
    const params = { eventType: 'CONFIG_RELOADED', payload: undefined };
    handler.execute(params, mockContext);

    expect(mockDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
    expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith('CONFIG_RELOADED', {}); // Should default to {}
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  test('execute should trim whitespace from eventType', () => {
    const params = { eventType: '  SPACED_EVENT  ', payload: { data: 1 } };
    handler.execute(params, mockContext);

    expect(mockDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
    expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith('SPACED_EVENT', { data: 1 }); // Trimmed eventType
  });

  // --- execute() Tests - Invalid Parameters ---
  test('execute should log error and not dispatch if params is null', () => {
    handler.execute(null, mockContext);
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid or missing "eventType" parameter'), expect.anything());
    expect(mockDispatcher.dispatchValidated).not.toHaveBeenCalled();
  });

  test('execute should log error and not dispatch if params is empty object', () => {
    handler.execute({}, mockContext);
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid or missing "eventType" parameter'), expect.anything());
    expect(mockDispatcher.dispatchValidated).not.toHaveBeenCalled();
  });

  test('execute should log error and not dispatch if eventType is missing', () => {
    const params = { payload: { value: 1 } };
    handler.execute(params, mockContext);
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid or missing "eventType" parameter'), expect.anything());
    expect(mockDispatcher.dispatchValidated).not.toHaveBeenCalled();
  });

  test('execute should log error and not dispatch if eventType is not a string', () => {
    const params = { eventType: 123, payload: {} };
    handler.execute(params, mockContext);
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid or missing "eventType" parameter'), expect.anything());
    expect(mockDispatcher.dispatchValidated).not.toHaveBeenCalled();
  });

  test('execute should log error and not dispatch if eventType is an empty or whitespace string', () => {
    handler.execute({ eventType: '', payload: {} }, mockContext);
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid or missing "eventType" parameter'), expect.anything());
    expect(mockDispatcher.dispatchValidated).not.toHaveBeenCalled();
    mockLogger.error.mockClear(); // Clear for next check

    handler.execute({ eventType: '   ', payload: {} }, mockContext);
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid or missing "eventType" parameter'), expect.anything());
    expect(mockDispatcher.dispatchValidated).not.toHaveBeenCalled();
  });

  test('execute should log warning and dispatch with empty payload if payload is not an object (e.g., string)', () => {
    const params = { eventType: 'INVALID_PAYLOAD_TYPE', payload: 'this is a string' };
    handler.execute(params, mockContext);

    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Invalid 'payload' provided (expected object or null/undefined, got string). Defaulting to empty object {}."),
      expect.anything()
    );
    // Should still attempt dispatch with the default empty object
    expect(mockDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
    expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith('INVALID_PAYLOAD_TYPE', {});
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  // --- execute() Tests - Error Handling ---

  test('execute should log error if context logger is missing', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); // Suppress console output during test
    const params = { eventType: 'ANY_EVENT', payload: {} };
    const invalidContext = { ...mockContext, logger: null };

    handler.execute(params, invalidContext);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('DispatchEventHandler: Critical - Missing or invalid logger in execution context.'),
      expect.anything()
    );
    expect(mockDispatcher.dispatchValidated).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  test('execute should log synchronous error if dispatcher call throws immediately', () => {
    const syncError = new Error('Dispatcher sync fail!');
    mockDispatcher.dispatchValidated.mockImplementationOnce(() => {
      throw syncError;
    });
    const params = { eventType: 'SYNC_FAIL_EVENT', payload: {}};

    handler.execute(params, mockContext);

    expect(mockDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Synchronous error occurred when trying to initiate dispatch'),
      expect.objectContaining({ error: syncError })
    );
  });

  // Note: Testing the async .catch() block fully requires async test utilities or careful promise handling.
  // This test verifies the initial call and the expected debug log.
  test('execute initiates async dispatch and logs attempt', () => {
    const params = { eventType: 'ASYNC_TEST', payload: {}};
    handler.execute(params, mockContext);

    expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith('ASYNC_TEST', {});
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Attempting to dispatch event "ASYNC_TEST"'), expect.anything());
    // We don't await, so we can't easily test the async log messages here without more complex test setup
  });

  // Optional: Test EventBus fallback if the constructor is adapted
  // test('execute should call eventBus.publish if dispatcher lacks dispatchValidated', () => {
  //     const mockEventBus = { publish: jest.fn() };
  //     const busHandler = new DispatchEventHandler({ dispatcher: mockEventBus });
  //     const params = { eventType: 'BUS_EVENT', payload: { id: 1 } };

  //     busHandler.execute(params, mockContext);

  //     expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
  //     expect(mockEventBus.publish).toHaveBeenCalledWith('BUS_EVENT', { id: 1 });
  //     expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('published via EventBus'));
  //     expect(mockLogger.error).not.toHaveBeenCalled();
  // });
});