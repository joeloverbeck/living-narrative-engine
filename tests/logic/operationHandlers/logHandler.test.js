// src/logic/operationHandlers/logHandler.test.js

/**
 * @jest-environment node
 */
import { describe, expect, test, jest, beforeEach } from '@jest/globals';
// Assuming INTERPOLATION_FALLBACK is exported for tests. If not, define it here.
// import LogHandler, { INTERPOLATION_FALLBACK } from '../../../logic/operationHandlers/logHandler.js';
import LogHandler from '../../../src/logic/operationHandlers/logHandler.js'; // Adjust path if needed
const INTERPOLATION_FALLBACK = 'N/A'; // Define fallback if not exported from handler

// --- JSDoc Imports ---
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */

// --- Mock Logger ---
/** @type {jest.Mocked<ILogger>} */
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// --- Mock Execution Context (Reduced relevance as LogHandler doesn't use it for resolution) ---
/** @type {ExecutionContext} */
const baseMockContext = {
  // We still need the logger in the context for the handler's internal error logging
  logger: mockLogger,
  // evaluationContext is no longer directly used by LogHandler's execute method
  // but keep it for conceptual clarity or potential future use in tests if needed.
  evaluationContext: {
    event: { type: 'TEST_EVENT', payload: { value: 10 } },
    actor: { id: 'player1', name: 'Hero', stats: { hp: 100 } },
    target: { id: 'enemy1', name: 'Goblin', stats: { hp: 50 } },
    customVar: 'hello world',
    complexVar: { nested: { value: true } },
    nullVar: null,
  },
};

// --- Test Suite ---
describe('LogHandler', () => {
  /** @type {LogHandler} */
  let logHandler;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    // Create a new handler instance for isolation
    logHandler = new LogHandler({ logger: mockLogger });
  });

  // --- Constructor Tests --- (Keep As Is)
  test('constructor should throw if logger is missing', () => {
    expect(() => new LogHandler({})).toThrow(
      'LogHandler requires a valid ILogger instance with info, warn, error, and debug methods.'
    );
  });
  test('constructor should throw if logger is invalid (missing methods)', () => {
    expect(() => new LogHandler({ logger: { info: jest.fn() } })).toThrow(
      'LogHandler requires a valid ILogger instance with info, warn, error, and debug methods.'
    );
    expect(() => new LogHandler({ logger: 'not a logger' })).toThrow(
      'LogHandler requires a valid ILogger instance with info, warn, error, and debug methods.'
    );
  });
  test('constructor should initialize successfully with valid logger', () => {
    expect(() => new LogHandler({ logger: mockLogger })).not.toThrow();
  });

  // --- execute() Tests - Basic Logging --- (Keep As Is)
  test('execute should log message with level "info" when specified', () => {
    const params = { message: 'Info message test', level: 'info' };
    logHandler.execute(params, baseMockContext);
    expect(mockLogger.info).toHaveBeenCalledTimes(1);
    expect(mockLogger.info).toHaveBeenCalledWith('Info message test');
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.debug).not.toHaveBeenCalled();
  });
  test('execute should log message with level "warn" when specified', () => {
    const params = { message: 'Warning message test', level: 'warn' };
    logHandler.execute(params, baseMockContext);
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn).toHaveBeenCalledWith('Warning message test');
  });
  test('execute should log message with level "error" when specified', () => {
    const params = { message: 'Error message test', level: 'error' };
    logHandler.execute(params, baseMockContext);
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith('Error message test');
  });
  test('execute should log message with level "debug" when specified', () => {
    const params = { message: 'Debug message test', level: 'debug' };
    logHandler.execute(params, baseMockContext);
    expect(mockLogger.debug).toHaveBeenCalledTimes(1);
    expect(mockLogger.debug).toHaveBeenCalledWith('Debug message test');
  });
  test('execute should default to "info" level if level is missing', () => {
    const params = { message: 'Default level test' };
    logHandler.execute(params, baseMockContext);
    expect(mockLogger.info).toHaveBeenCalledTimes(1);
    expect(mockLogger.info).toHaveBeenCalledWith('Default level test');
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });
  test('execute should default to "info" level and log warning if level is invalid', () => {
    const params = { message: 'Invalid level test', level: 'critical' };
    logHandler.execute(params, baseMockContext);
    expect(mockLogger.info).toHaveBeenCalledTimes(1);
    expect(mockLogger.info).toHaveBeenCalledWith('Invalid level test');
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'LogHandler: Invalid log level "critical" provided. Defaulting to "info".'
      ),
      expect.objectContaining({ requestedLevel: 'critical' })
    );
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.debug).not.toHaveBeenCalled();
  });
  test('execute should handle case-insensitive levels', () => {
    const params = { message: 'Case test', level: 'DEBUG' };
    logHandler.execute(params, baseMockContext);
    expect(mockLogger.debug).toHaveBeenCalledTimes(1);
    expect(mockLogger.debug).toHaveBeenCalledWith('Case test');
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  // --- execute() Tests - Invalid Parameters --- (Keep As Is - These Passed Before)
  test('execute should log error and not call log methods if params is null', () => {
    logHandler.execute(null, baseMockContext);
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid or missing "message" parameter'),
      expect.anything()
    );
    expect(mockLogger.info).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockLogger.debug).not.toHaveBeenCalled();
  });
  test('execute should log error and not call log methods if params is empty object', () => {
    logHandler.execute({}, baseMockContext);
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid or missing "message" parameter'),
      expect.anything()
    );
    expect(mockLogger.info).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockLogger.debug).not.toHaveBeenCalled();
  });
  test('execute should log error and not call log methods if message is missing', () => {
    logHandler.execute({ level: 'info' }, baseMockContext);
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid or missing "message" parameter'),
      expect.anything()
    );
    expect(mockLogger.info).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockLogger.debug).not.toHaveBeenCalled();
  });

  // --- MODIFIED: execute() Tests - Handling Message Types ---
  test('execute should convert non-string message to string and log it', () => {
    const params = { message: 123, level: 'info' };
    logHandler.execute(params, baseMockContext);
    // It should NOT log an error
    expect(mockLogger.error).not.toHaveBeenCalled();
    // It SHOULD log the stringified message
    expect(mockLogger.info).toHaveBeenCalledTimes(1);
    expect(mockLogger.info).toHaveBeenCalledWith('123'); // String(123) -> "123"
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockLogger.debug).not.toHaveBeenCalled();
  });

  test('execute should log warning and log message if message is an empty string', () => {
    const params = { message: '', level: 'info' };
    logHandler.execute(params, baseMockContext);
    // It should NOT log an error
    expect(mockLogger.error).not.toHaveBeenCalled();
    // It SHOULD log a warning
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('resolved to an empty string'),
      expect.anything()
    );
    // It SHOULD still log the (empty) message
    expect(mockLogger.info).toHaveBeenCalledTimes(1);
    expect(mockLogger.info).toHaveBeenCalledWith(''); // Logs the empty string
    expect(mockLogger.debug).not.toHaveBeenCalled();
  });

  // --- MODIFIED: execute() Tests - Since Interpolation is Removed ---
  // These tests now verify that LogHandler simply logs the exact string it's given.
  test('execute should log a pre-resolved string containing data', () => {
    // Simulate that resolution happened *before* calling execute
    const resolvedMessage =
      'Actor: player1, Target: Goblin, Custom: hello world';
    const params = { message: resolvedMessage }; // Pass the already resolved string
    logHandler.execute(params, baseMockContext);
    expect(mockLogger.info).toHaveBeenCalledWith(resolvedMessage); // Expect the exact string
  });

  test('execute should log a pre-resolved string with nested data', () => {
    const resolvedMessage = 'Actor HP: 100, Event Value: 10';
    const params = { message: resolvedMessage };
    logHandler.execute(params, baseMockContext);
    expect(mockLogger.info).toHaveBeenCalledWith(resolvedMessage);
  });

  test('execute should log a pre-resolved string with deeply nested data', () => {
    const resolvedMessage = 'Complex: true';
    const params = { message: resolvedMessage };
    logHandler.execute(params, baseMockContext);
    expect(mockLogger.info).toHaveBeenCalledWith(resolvedMessage);
  });

  test('execute should log a pre-resolved string containing fallback value (N/A)', () => {
    // Simulate upstream resolution resulted in fallback
    const resolvedMessage = `Missing: ${INTERPOLATION_FALLBACK}`;
    const params = { message: resolvedMessage };
    logHandler.execute(params, baseMockContext);
    expect(mockLogger.info).toHaveBeenCalledWith(resolvedMessage);
  });

  test('execute should log a pre-resolved string containing multiple fallbacks', () => {
    const resolvedMessage = `Null Var Prop: ${INTERPOLATION_FALLBACK}, Target Prop: ${INTERPOLATION_FALLBACK}`;
    const params = { message: resolvedMessage };
    logHandler.execute(params, baseMockContext);
    expect(mockLogger.info).toHaveBeenCalledWith(resolvedMessage);
  });

  test('execute should log a pre-resolved string representing null ("null")', () => {
    // Simulate upstream resolution resulted in string "null" for a null value placeholder
    const resolvedMessage = `Null value: null`;
    const params = { message: resolvedMessage };
    logHandler.execute(params, baseMockContext);
    expect(mockLogger.info).toHaveBeenCalledWith(resolvedMessage);
  });

  test('execute should log a plain message with no placeholders', () => {
    // This test remains valid as it never had placeholders
    const params = { message: 'Plain message, no interpolation.' };
    logHandler.execute(params, baseMockContext);
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Plain message, no interpolation.'
    );
  });

  test('execute should log a pre-resolved string simulating resolved adjacent placeholders', () => {
    const resolvedMessage = 'player1enemy1';
    const params = { message: resolvedMessage };
    logHandler.execute(params, baseMockContext);
    expect(mockLogger.info).toHaveBeenCalledWith(resolvedMessage);
  });

  test('execute should log a pre-resolved string simulating JSON stringified object', () => {
    // Simulate upstream resolution stringified an object
    const resolvedMessage = `Actor Stats: ${JSON.stringify({ hp: 100 })}`; // Example resolved string
    const params = { message: resolvedMessage };
    logHandler.execute(params, baseMockContext);
    expect(mockLogger.info).toHaveBeenCalledWith(resolvedMessage);
  });

  // --- execute() Tests - Error Handling within Logger --- (Keep As Is)
  test('execute should log error to console if logger method throws', () => {
    const error = new Error('Logger failed!');
    mockLogger.info.mockImplementationOnce(() => {
      throw error;
    });
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const consoleLogSpy = jest
      .spyOn(console, 'log')
      .mockImplementation(() => {});

    const params = { message: 'Test logger failure', level: 'info' };
    logHandler.execute(params, baseMockContext);

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'LogHandler: Failed to write log message via ILogger instance'
      ),
      expect.objectContaining({
        message: 'Test logger failure',
        originalError: error,
      })
    );
    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    expect(consoleLogSpy).toHaveBeenCalledWith('[INFO] Test logger failure');

    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });
});
