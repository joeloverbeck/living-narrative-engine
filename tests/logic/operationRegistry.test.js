// tests/logic/operationRegistry.test.js

/**
 * @jest-environment node
 */
import {
  describe,
  expect,
  test,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import OperationRegistry from '../../src/logic/operationRegistry.js'; // Adjust path as needed

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../src/interfaces/coreServices.js').ILogger} ILogger */ // Adjusted path assumption
/** @typedef {import('../../src/logic/defs.js').OperationHandler} OperationHandler */ // Adjusted path assumption

// --- Mock Logger ---
/** @type {jest.Mocked<ILogger>} */
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// --- Mock Handlers ---
const mockHandler1 = jest.fn(
  (params, context) => `handler1 executed with ${JSON.stringify(params)}`
);
const mockHandler2 = jest.fn(
  (params, context) => `handler2 executed with ${JSON.stringify(params)}`
);

// --- Console Spies ---
// We need spies to check console output when no logger is injected
let consoleInfoSpy; // <-- Added spy for console.info
let consoleLogSpy;
let consoleWarnSpy;
let consoleErrorSpy;
let consoleDebugSpy; // Note: console.debug might not exist in all environments, handle gracefully
let consoleErrorOriginal; // To store original console.error for the faulty logger test

describe('OperationRegistry', () => {
  beforeEach(() => {
    // Reset mocks and spies before each test
    jest.clearAllMocks();
    mockHandler1.mockClear();
    mockHandler2.mockClear();

    // Set up console spies
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {}); // <-- Setup spy
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {}); // Suppress actual console output
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    // Handle potential absence of console.debug
    if (typeof console.debug === 'function') {
      consoleDebugSpy = jest
        .spyOn(console, 'debug')
        .mockImplementation(() => {});
    } else {
      // If console.debug doesn't exist, spy on console.log as a fallback for debug level
      // Ensure it doesn't conflict with the main consoleLogSpy if needed
      // Note: The #log implementation prefers console[level] first, so console.log is the final fallback.
      // Spying on console.log here for debug is okay if console.debug doesn't exist.
      consoleDebugSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    }
    // Store original console.error for faulty logger test
    consoleErrorOriginal = console.error;
  });

  afterEach(() => {
    // Restore console spies
    consoleInfoSpy.mockRestore(); // <-- Restore spy
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    if (consoleDebugSpy) consoleDebugSpy.mockRestore(); // Restore debug spy if it was created
    // Restore original console.error if it was modified
    console.error = consoleErrorOriginal;
  });

  // --- Constructor Tests ---
  describe('Constructor', () => {
    test('should initialize successfully with a logger', () => {
      const registry = new OperationRegistry({ logger: mockLogger });
      expect(registry).toBeInstanceOf(OperationRegistry);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'OperationRegistry initialized.'
      );
      // Ensure console was NOT used for the primary init message
      expect(consoleInfoSpy).not.toHaveBeenCalledWith(
        'OperationRegistry initialized.'
      ); // <-- Check info spy
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        'OperationRegistry initialized.'
      );
    });

    test('should initialize successfully without a logger (fallback to console)', () => {
      const registry = new OperationRegistry();
      expect(registry).toBeInstanceOf(OperationRegistry);
    });
  });

  // --- register() Tests ---
  describe('register()', () => {
    let registry;
    const operationType = 'TEST_OP';
    const operationTypeWithSpace = '  SPACED_OP  ';
    const trimmedSpacedType = 'SPACED_OP';

    beforeEach(() => {
      // Use logger for most register tests to check specific log levels
      registry = new OperationRegistry({ logger: mockLogger });
      mockLogger.info.mockClear(); // Clear constructor log
    });

    test('should register a new handler successfully', () => {
      expect(() =>
        registry.register(operationType, mockHandler1)
      ).not.toThrow();
      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();

      // Verify internally (using getHandler)
      expect(registry.getHandler(operationType)).toBe(mockHandler1);
    });

    // --- THIS TEST IS NOW FIXED (due to getHandler fix) ---
    test('should register a handler with trimmed whitespace in type', () => {
      expect(() =>
        registry.register(operationTypeWithSpace, mockHandler1)
      ).not.toThrow();
      // Verify retrieval with the trimmed type
      expect(registry.getHandler(trimmedSpacedType)).toBe(mockHandler1);
      // *** FIX: Verify retrieval with the original whitespace type (should now work) ***
      expect(registry.getHandler(operationTypeWithSpace)).toBe(mockHandler1);
    });

    test('should overwrite an existing handler and log a warning', () => {
      registry.register(operationType, mockHandler1); // First registration
      mockLogger.debug.mockClear(); // Clear first debug log

      expect(() =>
        registry.register(operationType, mockHandler2)
      ).not.toThrow(); // Overwrite

      // Check warning log
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `OperationRegistry: Overwriting existing handler for operation type "${operationType}".`
      );

      // Check debug log for the second registration
      expect(mockLogger.debug).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `OperationRegistry: Registered handler for operation type "${operationType}".`
      );

      // Verify the new handler is active
      expect(registry.getHandler(operationType)).toBe(mockHandler2);
      expect(registry.getHandler(operationType)).not.toBe(mockHandler1);
    });

    test('should throw error and log error if operationType is not a string', () => {
      const expectedErrorMsg =
        'OperationRegistry.register: operationType must be a non-empty string.';
      expect(() => registry.register(123, mockHandler1)).toThrow(
        expectedErrorMsg
      );
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg);
      expect(mockLogger.debug).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    test('should throw error and log error if operationType is an empty string', () => {
      const expectedErrorMsg =
        'OperationRegistry.register: operationType must be a non-empty string.';
      expect(() => registry.register('', mockHandler1)).toThrow(
        expectedErrorMsg
      );
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg);
    });

    test('should throw error and log error if operationType is only whitespace', () => {
      const expectedErrorMsg =
        'OperationRegistry.register: operationType must be a non-empty string.';
      expect(() => registry.register('   ', mockHandler1)).toThrow(
        expectedErrorMsg
      );
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg);
    });

    test('should throw error and log error if operationType is null', () => {
      const expectedErrorMsg =
        'OperationRegistry.register: operationType must be a non-empty string.';
      expect(() => registry.register(null, mockHandler1)).toThrow(
        expectedErrorMsg
      );
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg);
    });

    test('should throw error and log error if handler is not a function', () => {
      const operationTypeForError = 'HANDLER_ERROR_OP';
      const expectedErrorMsg = `OperationRegistry.register: handler for type "${operationTypeForError}" must be a function.`;
      expect(() =>
        registry.register(operationTypeForError, 'not a function')
      ).toThrow(expectedErrorMsg);
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg);
    });

    test('should throw error and log error if handler is null', () => {
      const operationTypeForError = 'HANDLER_NULL_OP';
      const expectedErrorMsg = `OperationRegistry.register: handler for type "${operationTypeForError}" must be a function.`;
      expect(() => registry.register(operationTypeForError, null)).toThrow(
        expectedErrorMsg
      );
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg);
    });

    test('should use console.error when throwing without a logger', () => {
      const noLoggerRegistry = new OperationRegistry();
      // Clear spies after constructor (which uses console.info)
      consoleInfoSpy.mockClear();
      consoleErrorSpy.mockClear(); // Clear for the actual test assertion

      const expectedErrorMsg =
        'OperationRegistry.register: operationType must be a non-empty string.';
      expect(() => noLoggerRegistry.register('', mockHandler1)).toThrow(
        expectedErrorMsg
      );
      // #log calls console.error internally before throwing
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expectedErrorMsg);
      expect(mockLogger.error).not.toHaveBeenCalled(); // Ensure mock logger wasn't used
    });

    test('should use console.warn when overwriting without a logger', () => {
      const noLoggerRegistry = new OperationRegistry();
      // Clear spies after constructor (which uses console.info)
      consoleInfoSpy.mockClear();

      noLoggerRegistry.register(operationType, mockHandler1); // Initial register (uses console.debug/log)
      // Clear spies after initial registration
      consoleWarnSpy.mockClear();
      consoleDebugSpy.mockClear(); // Clear debug/log spy too

      expect(() =>
        noLoggerRegistry.register(operationType, mockHandler2)
      ).not.toThrow(); // Overwrite

      // #log calls console.warn internally
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        `OperationRegistry: Overwriting existing handler for operation type "${operationType}".`
      );
      // #log also calls console.debug (or log fallback) for the registration itself
      expect(consoleDebugSpy).toHaveBeenCalledTimes(1);
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        `OperationRegistry: Registered handler for operation type "${operationType}".`
      );
      expect(mockLogger.warn).not.toHaveBeenCalled(); // Ensure mock logger wasn't used
    });
  });

  // --- getHandler() Tests ---
  describe('getHandler()', () => {
    let registry;
    const opType1 = 'GET_OP_1';
    const opType2 = 'GET_OP_2';
    const opTypeWithSpace = '  SPACED_GET  ';
    const trimmedSpacedType = 'SPACED_GET';

    beforeEach(() => {
      registry = new OperationRegistry({ logger: mockLogger });
      registry.register(opType1, mockHandler1);
      registry.register(opType2, mockHandler2);
      registry.register(opTypeWithSpace, mockHandler1); // Register with space
      mockLogger.info.mockClear(); // Clear constructor log
      mockLogger.debug.mockClear(); // Clear registration logs
      mockLogger.warn.mockClear();
    });

    test('should return the correct handler for a registered type', () => {
      const handler = registry.getHandler(opType1);
      expect(handler).toBeDefined();
      expect(handler).toBe(mockHandler1);
      // Optionally execute to double-check
      expect(handler({}, {})).toBe('handler1 executed with {}');
      expect(mockLogger.debug).not.toHaveBeenCalled(); // No debug log for successful find
    });

    test('should return the correct handler for another registered type', () => {
      const handler = registry.getHandler(opType2);
      expect(handler).toBeDefined();
      expect(handler).toBe(mockHandler2);
      expect(handler({ id: 1 }, {})).toBe('handler2 executed with {"id":1}');
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    test('should return the handler registered with whitespace when queried with trimmed type', () => {
      const handler = registry.getHandler(trimmedSpacedType);
      expect(handler).toBeDefined();
      expect(handler).toBe(mockHandler1); // Should be handler1 registered with spaces
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    // --- THIS TEST IS NOW FIXED ---
    test('should return the handler registered with whitespace when queried with whitespace type', () => {
      // getHandler now trims the input key '  SPACED_GET  ' to 'SPACED_GET'
      // before lookup, matching the key used during registration.
      const handler = registry.getHandler(opTypeWithSpace); // Query with the spaces
      expect(handler).toBeDefined(); // *** FIX: Should now be defined ***
      expect(handler).toBe(mockHandler1); // *** FIX: Should now retrieve the correct handler ***
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    test('should return undefined and log debug for an unregistered type', () => {
      const unregisteredType = 'NON_EXISTENT_OP';
      const handler = registry.getHandler(unregisteredType);
      expect(handler).toBeUndefined();
      expect(mockLogger.debug).toHaveBeenCalledTimes(1);
      // Debug log should show the type it looked for (which is trimmed)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `OperationRegistry: No handler found for operation type "${unregisteredType}".`
      );
    });

    test('should return undefined and log debug for an unregistered type with spaces', () => {
      const unregisteredType = '  NON_EXISTENT_SPACED_OP  ';
      const trimmedUnregistered = 'NON_EXISTENT_SPACED_OP';
      const handler = registry.getHandler(unregisteredType);
      expect(handler).toBeUndefined();
      expect(mockLogger.debug).toHaveBeenCalledTimes(1);
      // Debug log should show the *trimmed* type it looked for
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `OperationRegistry: No handler found for operation type "${trimmedUnregistered}".`
      );
    });

    test('should return undefined and log warn for a non-string type', () => {
      const handler = registry.getHandler(12345);
      expect(handler).toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `OperationRegistry.getHandler: Received non-string operationType: ${typeof 12345}. Returning undefined.`
      );
      expect(mockLogger.debug).not.toHaveBeenCalled(); // Should not log debug if type is invalid
    });

    test('should return undefined and log warn for a null type', () => {
      const handler = registry.getHandler(null);
      expect(handler).toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'OperationRegistry.getHandler: Received non-string operationType: object. Returning undefined.'
      ); // typeof null is 'object'
    });

    test('should use console.debug (or log) when handler not found without logger', () => {
      const noLoggerRegistry = new OperationRegistry();
      // Clear spies after constructor (which uses console.info)
      consoleInfoSpy.mockClear();
      consoleDebugSpy.mockClear(); // Clear for assertion

      const unregisteredType = 'NON_EXISTENT_OP';
      const handler = noLoggerRegistry.getHandler(unregisteredType);
      expect(handler).toBeUndefined();

      // Check the appropriate console spy (debug or log fallback)
      expect(consoleDebugSpy).toHaveBeenCalledTimes(1);
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        `OperationRegistry: No handler found for operation type "${unregisteredType}".`
      );
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    test('should use console.warn when type is invalid without logger', () => {
      const noLoggerRegistry = new OperationRegistry();
      // Clear spies after constructor (which uses console.info)
      consoleInfoSpy.mockClear();
      consoleWarnSpy.mockClear(); // Clear for assertion

      const handler = noLoggerRegistry.getHandler(false); // boolean type
      expect(handler).toBeUndefined();

      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        `OperationRegistry.getHandler: Received non-string operationType: ${typeof false}. Returning undefined.`
      );
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });

  // --- Internal #log() Tests (Indirectly tested via public methods) ---
  // These tests confirm the logging mechanism works as expected,
  // especially the fallback behavior.
  describe('Internal Logging (#log)', () => {
    test('should use injected logger methods when available', () => {
      const registry = new OperationRegistry({ logger: mockLogger });
      mockLogger.info.mockClear(); // Clear constructor log

      // Trigger logs via public methods
      registry.register('LOG_TEST_DEBUG', mockHandler1); // Triggers debug
      registry.register('LOG_TEST_DEBUG', mockHandler2); // Triggers warn + debug
      registry.getHandler('NON_EXISTENT'); // Triggers debug
      registry.getHandler(123); // Triggers warn

      try {
        registry.register('', mockHandler1); // Triggers error
      } catch (e) {}
      try {
        registry.register('BAD_HANDLER', null); // Triggers error
      } catch (e) {}

      expect(mockLogger.debug).toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalled();
      // info is only called in constructor, tested separately

      // Ensure console was NOT used for these specific logs
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Registered handler')
      );
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).not.toHaveBeenCalled(); // Also check info spy
    });

    test('should fall back to console methods when logger is not provided', () => {
      const registry = new OperationRegistry(); // No logger
      // Clear spies after constructor call (which uses console.info)
      consoleInfoSpy.mockClear();
      consoleWarnSpy.mockClear();
      consoleErrorSpy.mockClear();
      consoleDebugSpy.mockClear(); // Clears debug or log spy

      // Trigger logs via public methods
      registry.register('LOG_TEST_FALLBACK', mockHandler1); // Triggers console.debug/log
      registry.register('LOG_TEST_FALLBACK', mockHandler2); // Triggers console.warn + console.debug/log
      registry.getHandler('NON_EXISTENT_FALLBACK'); // Triggers console.debug/log
      registry.getHandler(123); // Triggers console.warn

      try {
        registry.register('', mockHandler1); // Triggers console.error
      } catch (e) {}
      try {
        registry.register('BAD_HANDLER_FALLBACK', null); // Triggers console.error
      } catch (e) {}

      expect(consoleDebugSpy).toHaveBeenCalled(); // Or consoleLogSpy if debug doesn't exist
      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleInfoSpy).not.toHaveBeenCalled(); // Constructor used info, but it was cleared

      // Ensure mock logger was NOT used
      expect(mockLogger.debug).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(mockLogger.info).not.toHaveBeenCalled(); // Constructor used console.info
    });

    // --- THIS TEST IS NOW FIXED ---
    test('should handle potential errors within the logger itself (fallback to console)', () => {
      const faultyLogger = {
        // Define mocks that throw errors
        info: jest.fn(() => {
          throw new Error('Logger info failed');
        }),
        warn: jest.fn(() => {
          throw new Error('Logger warn failed');
        }),
        error: jest.fn(() => {
          throw new Error('Logger error failed');
        }),
        debug: jest.fn(() => {
          throw new Error('Logger debug failed');
        }),
      };

      // Spy on console.error *specifically* for this test to check the internal error logging
      // Use mockImplementation to prevent actual error logging during test run if desired
      const consoleErrorInternalSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      // Clear console.log spy before instantiation, as it's used for the final fallback
      consoleLogSpy.mockClear();

      // Instantiation will call faultyLogger.info, triggering the #log catch block
      const registry = new OperationRegistry({ logger: faultyLogger });

      // *** FIX: Check the fallback logs from the constructor call ***
      expect(faultyLogger.info).toHaveBeenCalledTimes(1); // Logger.info was called
      // Check that the internal error handler logged the failure
      expect(consoleErrorInternalSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error occurred in logging utility'),
        expect.any(Error) // Check that an Error object was logged
      );

      // Clear spies again before triggering other log levels
      consoleErrorInternalSpy.mockClear();
      consoleLogSpy.mockClear();
      // Use the correct spy (consoleDebugSpy might be console.log itself if console.debug isn't present)
      consoleDebugSpy.mockClear();

      // Trigger other log levels
      registry.register('FAULTY_REG', mockHandler1); // Tries faultyLogger.debug -> fallback logs
      expect(faultyLogger.debug).toHaveBeenCalledTimes(1);
      expect(consoleErrorInternalSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error occurred'),
        expect.any(Error)
      );
      consoleErrorInternalSpy.mockClear();
      consoleLogSpy.mockClear(); // Reset for next trigger

      registry.register('FAULTY_REG', mockHandler2); // Tries faultyLogger.warn -> fallback, then faultyLogger.debug -> fallback
      expect(faultyLogger.warn).toHaveBeenCalledTimes(1);
      expect(faultyLogger.debug).toHaveBeenCalledTimes(2); // Called again
      expect(consoleErrorInternalSpy).toHaveBeenCalledTimes(2); // warn error + debug error
      consoleErrorInternalSpy.mockClear();
      consoleLogSpy.mockClear();

      registry.getHandler('NON_EXISTENT_FAULTY'); // Tries faultyLogger.debug -> fallback
      expect(faultyLogger.debug).toHaveBeenCalledTimes(3);
      expect(consoleErrorInternalSpy).toHaveBeenCalledTimes(1);
      consoleErrorInternalSpy.mockClear();
      consoleLogSpy.mockClear();

      registry.getHandler(true); // Tries faultyLogger.warn -> fallback
      expect(faultyLogger.warn).toHaveBeenCalledTimes(2);
      expect(consoleErrorInternalSpy).toHaveBeenCalledTimes(1);
      consoleErrorInternalSpy.mockClear();
      consoleLogSpy.mockClear();

      try {
        registry.register('', mockHandler1); // Tries faultyLogger.error -> fallback, then throws
      } catch (e) {
        expect(e.message).toContain('operationType must be a non-empty string');
      }
      expect(faultyLogger.error).toHaveBeenCalledTimes(1);
      expect(consoleErrorInternalSpy).toHaveBeenCalledTimes(2); // Logs the logger error

      // Restore the specific console.error spy for this test
      consoleErrorInternalSpy.mockRestore();
    });
  });
});
