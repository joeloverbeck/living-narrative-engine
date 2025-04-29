// src/logic/operationHandlers/logHandler.test.js

/**
 * @jest-environment node
 */
import {describe, expect, test, jest, beforeEach} from '@jest/globals';
import LogHandler, {INTERPOLATION_FALLBACK} from '../../../logic/operationHandlers/logHandler.js'; // Adjust path if needed

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

// --- Mock Execution Context ---
/** @type {ExecutionContext} */
const baseMockContext = {
    event: {type: 'TEST_EVENT', payload: {value: 10}},
    actor: {id: 'player1', name: 'Hero', stats: {hp: 100}},
    target: {id: 'enemy1', name: 'Goblin', stats: {hp: 50}},
    logger: mockLogger, // Include logger in context for testing param validation logging
    evaluationContext: { // Primary source for interpolation
        event: {type: 'TEST_EVENT', payload: {value: 10}},
        actor: {id: 'player1', name: 'Hero', stats: {hp: 100}},
        target: {id: 'enemy1', name: 'Goblin', stats: {hp: 50}},
        customVar: 'hello world',
        complexVar: {nested: {value: true}},
        nullVar: null,
        // undefinedVar: undefined // Implicitly undefined
    }
};

// Deep clone helper for context modification in tests
const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

// --- Test Suite ---
describe('LogHandler', () => {
    /** @type {LogHandler} */
    let logHandler;

    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();

        // Create a new handler instance for isolation
        logHandler = new LogHandler({logger: mockLogger});
    });

    // --- Constructor Tests ---
    test('constructor should throw if logger is missing', () => {
        expect(() => new LogHandler({})).toThrow('LogHandler requires a valid ILogger instance with info, warn, error, and debug methods.');
    });

    test('constructor should throw if logger is invalid (missing methods)', () => {
        expect(() => new LogHandler({logger: {info: jest.fn()}})).toThrow('LogHandler requires a valid ILogger instance with info, warn, error, and debug methods.'); // Missing other methods
        expect(() => new LogHandler({logger: 'not a logger'})).toThrow('LogHandler requires a valid ILogger instance with info, warn, error, and debug methods.');
    });

    test('constructor should initialize successfully with valid logger', () => {
        expect(() => new LogHandler({logger: mockLogger})).not.toThrow();
    });

    // --- execute() Tests - Basic Logging ---
    test('execute should log message with level "info" when specified', () => {
        const params = {message: 'Info message test', level: 'info'};
        logHandler.execute(params, baseMockContext);
        expect(mockLogger.info).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).toHaveBeenCalledWith('Info message test');
        expect(mockLogger.warn).not.toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    test('execute should log message with level "warn" when specified', () => {
        const params = {message: 'Warning message test', level: 'warn'};
        logHandler.execute(params, baseMockContext);
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith('Warning message test');
        expect(mockLogger.info).not.toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    test('execute should log message with level "error" when specified', () => {
        const params = {message: 'Error message test', level: 'error'};
        logHandler.execute(params, baseMockContext);
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith('Error message test');
        expect(mockLogger.info).not.toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalled();
        expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    test('execute should log message with level "debug" when specified', () => {
        const params = {message: 'Debug message test', level: 'debug'};
        logHandler.execute(params, baseMockContext);
        expect(mockLogger.debug).toHaveBeenCalledTimes(1);
        expect(mockLogger.debug).toHaveBeenCalledWith('Debug message test');
        expect(mockLogger.info).not.toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test('execute should default to "info" level if level is missing', () => {
        const params = {message: 'Default level test'};
        logHandler.execute(params, baseMockContext);
        expect(mockLogger.info).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).toHaveBeenCalledWith('Default level test');
        expect(mockLogger.warn).not.toHaveBeenCalled(); // No warning if level is missing (uses default directly)
    });

    // --- MODIFIED TEST ---
    test('execute should default to "info" level and log warning if level is invalid', () => {
        const params = {message: 'Invalid level test', level: 'critical'};
        logHandler.execute(params, baseMockContext);

        // Should still log the message as 'info'
        expect(mockLogger.info).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).toHaveBeenCalledWith('Invalid level test');

        // --- MODIFIED: Expect a warning now ---
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining('LogHandler: Invalid log level "critical" provided. Defaulting to "info".'),
            expect.objectContaining({requestedLevel: 'critical'})
        );

        // Should not log as error or debug
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    test('execute should handle case-insensitive levels', () => {
        const params = {message: 'Case test', level: 'DEBUG'};
        logHandler.execute(params, baseMockContext);
        expect(mockLogger.debug).toHaveBeenCalledTimes(1);
        expect(mockLogger.debug).toHaveBeenCalledWith('Case test');
        expect(mockLogger.warn).not.toHaveBeenCalled(); // Valid level, no warning
    });

    // --- execute() Tests - Invalid Parameters ---
    test('execute should log error and not call log methods if params is null', () => {
        logHandler.execute(null, baseMockContext);
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid or missing "message" parameter'), expect.anything());
        expect(mockLogger.info).not.toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalled();
        expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    test('execute should log error and not call log methods if params is empty object', () => {
        logHandler.execute({}, baseMockContext);
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid or missing "message" parameter'), expect.anything());
        expect(mockLogger.info).not.toHaveBeenCalled();
    });

    test('execute should log error and not call log methods if message is missing', () => {
        logHandler.execute({level: 'info'}, baseMockContext);
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid or missing "message" parameter'), expect.anything());
        expect(mockLogger.info).not.toHaveBeenCalled();
    });

    test('execute should log error and not call log methods if message is not a string', () => {
        logHandler.execute({message: 123, level: 'info'}, baseMockContext);
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid or missing "message" parameter'), expect.anything());
        expect(mockLogger.info).not.toHaveBeenCalled();
    });

    test('execute should log error and not call log methods if message is an empty string', () => {
        logHandler.execute({message: '', level: 'info'}, baseMockContext);
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid or missing "message" parameter'), expect.anything());
        expect(mockLogger.info).not.toHaveBeenCalled();
    });


    // --- execute() Tests - Interpolation ---
    test('execute should correctly interpolate top-level variables from evaluationContext', () => {
        const params = {message: 'Actor: {actor.id}, Target: {target.name}, Custom: {customVar}'};
        logHandler.execute(params, baseMockContext);
        expect(mockLogger.info).toHaveBeenCalledWith('Actor: player1, Target: Goblin, Custom: hello world');
    });

    test('execute should correctly interpolate nested variables', () => {
        const params = {message: 'Actor HP: {actor.stats.hp}, Event Value: {event.payload.value}'};
        logHandler.execute(params, baseMockContext);
        expect(mockLogger.info).toHaveBeenCalledWith('Actor HP: 100, Event Value: 10');
    });

    test('execute should correctly interpolate deeply nested variables', () => {
        const params = {message: 'Complex: {complexVar.nested.value}'};
        logHandler.execute(params, baseMockContext);
        expect(mockLogger.info).toHaveBeenCalledWith('Complex: true');
    });

    test('execute should use fallback value for missing top-level variables', () => {
        const params = {message: 'Missing: {undefinedVar}'};
        logHandler.execute(params, baseMockContext);
        // Assuming INTERPOLATION_FALLBACK is 'N/A', and undefinedVar results in 'undefined' string
        expect(mockLogger.info).toHaveBeenCalledWith(`Missing: N/A`);
    });

    test('execute should use fallback value for missing nested properties', () => {
        const params = {message: 'Missing Prop: {actor.stats.mana}'}; // Assuming mana doesn't exist
        logHandler.execute(params, baseMockContext);
        expect(mockLogger.info).toHaveBeenCalledWith(`Missing Prop: ${INTERPOLATION_FALLBACK}`);
    });

    test('execute should use fallback value when accessing property on null/undefined', () => {
        const params = {message: 'Null Var Prop: {nullVar.property}, Target Prop: {target.nonexistent.prop}'};
        logHandler.execute(params, baseMockContext);
        expect(mockLogger.info).toHaveBeenCalledWith(`Null Var Prop: ${INTERPOLATION_FALLBACK}, Target Prop: ${INTERPOLATION_FALLBACK}`);
    });

    test('execute should handle null values correctly (represent as "null")', () => {
        const params = {message: 'Null value: {nullVar}'};
        logHandler.execute(params, baseMockContext);
        expect(mockLogger.info).toHaveBeenCalledWith(`Null value: null`);
    });

    test('execute should handle message with no placeholders', () => {
        const params = {message: 'Plain message, no interpolation.'};
        logHandler.execute(params, baseMockContext);
        expect(mockLogger.info).toHaveBeenCalledWith('Plain message, no interpolation.');
    });

    test('execute should handle placeholders with whitespace', () => {
        const params = {message: 'Spaced: { actor.id }'};
        logHandler.execute(params, baseMockContext);
        expect(mockLogger.info).toHaveBeenCalledWith('Spaced: player1');
    });

    test('execute should handle message with mixed placeholders and text', () => {
        const params = {message: 'Event {event.type} from {actor.name} targeting {target.id}.'};
        logHandler.execute(params, baseMockContext);
        expect(mockLogger.info).toHaveBeenCalledWith('Event TEST_EVENT from Hero targeting enemy1.');
    });

    test('execute should handle adjacent placeholders', () => {
        const params = {message: '{actor.id}{target.id}'};
        logHandler.execute(params, baseMockContext);
        expect(mockLogger.info).toHaveBeenCalledWith('player1enemy1');
    });

    test('execute should handle empty context for interpolation', () => {
        const params = {message: 'Actor: {actor.id}'};
        // Pass context with evaluationContext as empty object
        const emptyEvalContext = {logger: mockLogger, evaluationContext: {}};
        logHandler.execute(params, emptyEvalContext);
        expect(mockLogger.info).toHaveBeenCalledWith(`Actor: ${INTERPOLATION_FALLBACK}`);

        // Pass context as empty object (no evaluationContext property)
        const emptyContext = {logger: mockLogger};
        logHandler.execute(params, emptyContext);
        expect(mockLogger.info).toHaveBeenCalledWith(`Actor: ${INTERPOLATION_FALLBACK}`);
    });


    test('execute should handle context without evaluationContext (fallback to top-level context)', () => {
        const params = {message: 'Event: {event.type}'};
        const contextWithoutEval = {
            event: {type: 'TOP_LEVEL_EVENT'},
            actor: null,
            target: null,
            logger: mockLogger,
            // no evaluationContext
        };
        logHandler.execute(params, contextWithoutEval);
        // It should find event.type in the top-level context
        expect(mockLogger.info).toHaveBeenCalledWith('Event: TOP_LEVEL_EVENT');
    });

    test('execute should JSON stringify object values during interpolation', () => {
        const params = {message: 'Actor Stats: {actor.stats}'};
        logHandler.execute(params, baseMockContext);
        expect(mockLogger.info).toHaveBeenCalledWith(`Actor Stats: ${JSON.stringify(baseMockContext.evaluationContext.actor.stats)}`);
    });

    // --- execute() Tests - Error Handling within Logger ---
    // --- MODIFIED TEST ---
    test('execute should log error to console if logger method throws', () => {
        const error = new Error('Logger failed!');
        mockLogger.info.mockImplementationOnce(() => {
            throw error;
        });
        // Spy on console.error WITHOUT mocking its implementation to see output (optional)
        // const consoleErrorSpy = jest.spyOn(console, 'error');
        // OR mock it to suppress output during test run:
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });
        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {
        }); // Also spy on fallback log

        const params = {message: 'Test logger failure', level: 'info'};
        logHandler.execute(params, baseMockContext);

        // Verify console.error was called due to the logger failure
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        // --- MODIFIED: Expect the actual error object ---
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            expect.stringContaining('LogHandler: Failed to write log message via ILogger instance'),
            expect.objectContaining({
                message: 'Test logger failure',
                originalError: error // Check for the actual Error object
            })
        );

        // Verify the final fallback log to console.log
        expect(consoleLogSpy).toHaveBeenCalledTimes(1);
        expect(consoleLogSpy).toHaveBeenCalledWith('[INFO] Test logger failure');

        // Restore spies
        consoleErrorSpy.mockRestore();
        consoleLogSpy.mockRestore();
    });
});