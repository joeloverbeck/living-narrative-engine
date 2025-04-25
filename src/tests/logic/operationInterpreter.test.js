// src/tests/logic/operationInterpreter.test.js

/**
 * @jest-environment node
 */
import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import OperationInterpreter from '../../logic/operationInterpreter.js'; // Adjust path if needed

// --- JSDoc Imports ---
/** @typedef {import('../../logic/defs.js').ExecutionContext} ExecutionContext */ // Assuming definition
/** @typedef {import('../../../data/schemas/operation.schema.json').Operation} Operation */

// --- Mock Dependencies ---
// Manual mock for OperationRegistry to control getHandler behavior
const mockRegistry = {
    getHandler: jest.fn(),
};

// Mock Logger
const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};

// --- Mock Operation Handlers ---
const mockLogHandler = jest.fn();
const mockModifyHandler = jest.fn();
const mockHandlerWithError = jest.fn(() => {
    throw new Error('Handler failed!');
});

// --- Sample Data ---
/** @type {Operation} */
const logOperation = {
    type: 'LOG',
    parameters: { message: 'Test log message', level: 'info' },
    comment: 'A test log operation'
};

/** @type {Operation} */
const modifyOperation = {
    type: 'MODIFY_COMPONENT',
    parameters: { target: 'actor', component: 'health', changes: { value: -10 } }
};

/** @type {Operation} */
const unknownOperation = {
    type: '  UNKNOWN_OP  ', // Include spaces to test trimming
    parameters: {}
};

/** @type {Operation} */
const ifOperation = {
    type: 'IF',
    parameters: {
        condition: { "==": [1, 1] },
        then_actions: [{ type: 'LOG', parameters: { message: 'IF was true' } }]
    }
};

/** @type {Operation} */
const errorOperation = {
    type: 'ERROR_OP',
    parameters: { data: 123 }
};

/** @type {ExecutionContext} */
const mockExecutionContext = {
    event: { type: 'TEST_EVENT', payload: {} },
    actor: { id: 'player', name: 'Hero' },
    target: null,
    context: {},
    // Potentially include references to core services if needed by operationHandlers
    getService: jest.fn(), // Example service getter if ExecutionContext has one
    logger: mockLogger, // Example: context might provide logger access too
};

// --- Test Suite ---
describe('OperationInterpreter', () => {

    /** @type {OperationInterpreter} */
    let interpreter;

    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();

        // Reset mockRegistry.getHandler's mock implementation for safety
        // (though jest.clearAllMocks should handle it)
        mockRegistry.getHandler.mockReset();

        // Create a new interpreter instance for isolation
        interpreter = new OperationInterpreter({
            logger: mockLogger,
            registry: mockRegistry,
        });
        // Clear the init log call
        mockLogger.info.mockClear();
    });

    // --- Constructor Tests ---
    test('constructor should throw if logger is missing or invalid', () => {
        expect(() => new OperationInterpreter({ registry: mockRegistry })).toThrow('ILogger');
        expect(() => new OperationInterpreter({ logger: {}, registry: mockRegistry })).toThrow('ILogger');
    });

    test('constructor should throw if registry is missing or invalid', () => {
        expect(() => new OperationInterpreter({ logger: mockLogger })).toThrow('OperationRegistry');
        expect(() => new OperationInterpreter({ logger: mockLogger, registry: {} })).toThrow('OperationRegistry');
    });

    test('constructor should initialize successfully with valid dependencies', () => {
        // Instantiation happens in beforeEach, check logger was called
        expect(() => new OperationInterpreter({ logger: mockLogger, registry: mockRegistry })).not.toThrow();
        // Check the init log message from the constructor itself
        expect(mockLogger.info).toHaveBeenCalledWith("OperationInterpreter Initialized (using OperationRegistry).");
    });

    // --- execute() Tests ---
    test('execute should call registry.getHandler with trimmed operation type', () => {
        mockRegistry.getHandler.mockReturnValue(undefined); // Ensure it returns something
        interpreter.execute(unknownOperation, mockExecutionContext);
        expect(mockRegistry.getHandler).toHaveBeenCalledTimes(1);
        // Verify it was called with the *trimmed* type
        expect(mockRegistry.getHandler).toHaveBeenCalledWith('UNKNOWN_OP');
    });

    test('execute should call the handler returned by the registry with parameters and context', () => {
        mockRegistry.getHandler.mockReturnValue(mockLogHandler);

        interpreter.execute(logOperation, mockExecutionContext);

        expect(mockRegistry.getHandler).toHaveBeenCalledWith('LOG');
        expect(mockLogHandler).toHaveBeenCalledTimes(1);
        expect(mockLogHandler).toHaveBeenCalledWith(logOperation.parameters, mockExecutionContext);
        expect(mockLogger.error).not.toHaveBeenCalled(); // No errors logged
        expect(mockLogger.debug).toHaveBeenCalledWith('Executing handler for operation type "LOG"...');
        expect(mockLogger.debug).toHaveBeenCalledWith('Handler execution finished successfully for type "LOG".');
    });

    test('execute should log an error and not throw if getHandler returns undefined', () => {
        mockRegistry.getHandler.mockReturnValue(undefined); // Simulate unknown type

        interpreter.execute(unknownOperation, mockExecutionContext);

        expect(mockRegistry.getHandler).toHaveBeenCalledWith('UNKNOWN_OP'); // Called with trimmed type
        expect(mockLogHandler).not.toHaveBeenCalled(); // Ensure no handler was called
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            'Unknown operation type encountered: "UNKNOWN_OP". No handler registered. Skipping execution.'
        );
        // Ensure no other errors were logged related to handler execution
        expect(mockLogger.error).not.toHaveBeenCalledWith(expect.stringContaining('Error executing handler'));
    });

    test('execute should log error if operation object is invalid (null)', () => {
        interpreter.execute(null, mockExecutionContext);
        expect(mockRegistry.getHandler).not.toHaveBeenCalled();
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('invalid operation object'), expect.anything());
    });

    test('execute should log error if operation.type is missing or empty', () => {
        interpreter.execute({ parameters: {} }, mockExecutionContext); // Missing type
        expect(mockRegistry.getHandler).not.toHaveBeenCalled();
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('invalid operation object'), expect.anything());
        mockLogger.error.mockClear();

        interpreter.execute({ type: ' ', parameters: {} }, mockExecutionContext); // Whitespace type
        expect(mockRegistry.getHandler).not.toHaveBeenCalled();
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('invalid operation object'), expect.anything());

    });


    // --- AC Test: IF Handling (Verify no special internal logic) ---
    test('execute should treat IF like any other type (lookup in registry)', () => {
        // Simulate IF not being registered (it shouldn't be for the interpreter)
        mockRegistry.getHandler.mockReturnValue(undefined);

        interpreter.execute(ifOperation, mockExecutionContext);

        // Verify it *tried* to look up 'IF'
        expect(mockRegistry.getHandler).toHaveBeenCalledTimes(1);
        expect(mockRegistry.getHandler).toHaveBeenCalledWith('IF');

        // Verify it logged 'Unknown operation type' because IF wasn't found *in the registry*
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            'Unknown operation type encountered: "IF". No handler registered. Skipping execution.'
        );

        // Verify no handler was actually called
        expect(mockLogHandler).not.toHaveBeenCalled(); // Assuming mockLogHandler wasn't returned
    });

    // --- AC Test: Error Handling for Handler Exceptions ---
    test('execute should catch, log, and not re-throw errors from the handler function', () => {
        const error = new Error('Handler failed!');
        mockHandlerWithError.mockImplementationOnce(() => { throw error; }); // Set specific mock behavior
        mockRegistry.getHandler.mockReturnValue(mockHandlerWithError);

        // Execute should complete without throwing an error itself
        expect(() => {
            interpreter.execute(errorOperation, mockExecutionContext);
        }).not.toThrow();

        // Verify registry and handler were called
        expect(mockRegistry.getHandler).toHaveBeenCalledWith('ERROR_OP');
        expect(mockHandlerWithError).toHaveBeenCalledTimes(1);
        expect(mockHandlerWithError).toHaveBeenCalledWith(errorOperation.parameters, mockExecutionContext);

        // Verify the error was logged
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            'Error executing handler for operation type "ERROR_OP":', // Check message prefix
            error // Check that the original error object was logged
        );

        // Verify the 'unknown type' error was NOT logged
        expect(mockLogger.error).not.toHaveBeenCalledWith(expect.stringContaining('Unknown operation type'));
        // Check debug logs around handler call
        expect(mockLogger.debug).toHaveBeenCalledWith('Executing handler for operation type "ERROR_OP"...');
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('finished successfully'));
    });
});
