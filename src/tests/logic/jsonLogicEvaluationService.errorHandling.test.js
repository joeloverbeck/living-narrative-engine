// src/tests/logic/jsonLogicEvaluationService.errorHandling.test.js

/**
 * @jest-environment node
 */
import { describe, expect, test, jest, beforeEach, afterEach } from '@jest/globals';
import jsonLogic from 'json-logic-js'; // Import the actual library to spy on
import JsonLogicEvaluationService from '../../logic/jsonLogicEvaluationService.js'; // Adjust path as needed

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../logic/defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */
/** @typedef {object} JSONLogicRule */

// --- Mock Dependencies ---

// Mock ILogger (Required by Service)
/** @type {jest.Mocked<ILogger>} */
const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};

// --- Helper Functions for Assertions ---

/**
 * Creates a simplified summary of a JSON Logic rule (e.g., for logging).
 * @param {JSONLogicRule | any} rule The rule object.
 * @returns {string} A string summary.
 */
const getRuleSummary = (rule) => {
    try {
        // Handle null explicitly as stringify returns "null"
        if (rule === null) return 'null';
        // Limit length for brevity in logs
        const str = JSON.stringify(rule);
        // Handle cases where stringify might fail for non-plain objects if used directly
        if (typeof str !== 'string') return '[Unserializable Rule]';
        return str.length > 150 ? str.substring(0, 147) + '...' : str;
    } catch (e) {
        return '[Unserializable Rule]';
    }
};

/**
 * Gets the top-level keys from the context object as a string (e.g., for logging).
 * @param {JsonLogicEvaluationContext | any} context The context object.
 * @returns {string} Comma-separated string of top-level keys.
 */
const getContextKeysString = (context) => {
    // Handle null or non-object context gracefully
    if (!context || typeof context !== 'object') {
        return '';
    }
    return Object.keys(context).join(', ');
};


// --- Test Suite for Error Handling Scenarios ---

describe('JsonLogicEvaluationService - Error Handling (Ticket 2.6.5)', () => {
    let service;
    /** @type {jest.SpyInstance} */
    let applySpy; // To hold the spy for jsonLogic.apply

    // Dummy data for tests where the actual content doesn't matter
    /** @type {JSONLogicRule} */
    const dummyRule = { "==": [1, 1] }; // Simple valid rule structure
    /** @type {JsonLogicEvaluationContext} */
    const dummyContext = {
        event: { type: 'DUMMY', payload: {} },
        actor: null,
        target: null,
        context: { turn: 1 },
        globals: { gameVersion: '1.0' },
        entities: {} // Assuming the basic structure from contextAssembler
    };
    const expectedRuleSummary = getRuleSummary(dummyRule);
    const expectedContextKeysStr = getContextKeysString(dummyContext);


    beforeEach(() => {
        jest.clearAllMocks(); // Clear mocks before each test

        // Instantiate the service with the mock logger
        service = new JsonLogicEvaluationService({ logger: mockLogger });
        mockLogger.info.mockClear(); // Clear constructor log call

        // --- Mock jsonLogic.apply for Error Handling Tests ---
        // Use spyOn to temporarily replace 'apply' within this suite
        applySpy = jest.spyOn(jsonLogic, 'apply');
    });

    afterEach(() => {
        // Restore the original jsonLogic.apply after each test in this suite
        if (applySpy) {
            applySpy.mockRestore();
        }
    });

    // --- Test Case: Exception during evaluation (Refined AC.5.a) ---
    describe('when jsonLogic.apply throws an error', () => {
        const evaluationError = new Error('Evaluation Failed!');

        beforeEach(() => {
            // Configure the mock to throw the predefined error
            applySpy.mockImplementation(() => {
                throw evaluationError;
            });
        });

        test('should return false', () => {
            const result = service.evaluate(dummyRule, dummyContext);
            expect(result).toBe(false);
        });

        test('should call jsonLogic.apply once with the rule and context', () => {
            service.evaluate(dummyRule, dummyContext);
            expect(applySpy).toHaveBeenCalledTimes(1);
            expect(applySpy).toHaveBeenCalledWith(dummyRule, dummyContext);
        });

        // *** CORRECTED ASSERTION ***
        test('should log an error message indicating evaluation failure, including rule/context info and the error', () => {
            service.evaluate(dummyRule, dummyContext);
            expect(mockLogger.error).toHaveBeenCalledTimes(1);
            // Expect the logger to be called with the string message THEN the error object
            expect(mockLogger.error).toHaveBeenCalledWith(
                `Error evaluating JSON Logic rule: ${expectedRuleSummary}. Context keys: ${expectedContextKeysStr}`, // Exact string message format
                evaluationError // The error object as the second argument
            );
        });
    });

    // --- Test Case: Non-boolean return type from evaluation (Refined AC.5.b) ---
    describe('when jsonLogic.apply returns a non-boolean value', () => {
        // Define test cases for various non-boolean types
        const nonBooleanTestCases = [
            { value: 123, type: 'number', description: 'a number (123)' },
            { value: 0, type: 'number', description: 'a number (0)' },
            { value: "unexpected", type: 'string', description: 'a string ("unexpected")' },
            { value: {}, type: 'object', description: 'an object ({})' },
            { value: [], type: 'object', description: 'an array ([])' }, // typeof [] is 'object'
            { value: null, type: 'object', description: 'null' },        // typeof null is 'object'
            { value: undefined, type: 'undefined', description: 'undefined' },
        ];

        // Use test.each to run the same assertions for different non-boolean values
        test.each(nonBooleanTestCases)('should return false and log error when return is $description', ({ value, type }) => {
            // Configure the mock to return the specific non-boolean value
            applySpy.mockReturnValue(value);

            const result = service.evaluate(dummyRule, dummyContext);

            // Assertions
            expect(result).toBe(false); // Should always return false

            expect(applySpy).toHaveBeenCalledTimes(1); // Apply should have been called
            expect(applySpy).toHaveBeenCalledWith(dummyRule, dummyContext);

            // *** CORRECTED ASSERTION ***
            expect(mockLogger.error).toHaveBeenCalledTimes(1); // Error should be logged
            // Expect the logger to be called with ONLY the string message
            expect(mockLogger.error).toHaveBeenCalledWith(
                `JSON Logic evaluation returned non-boolean type (${type}) for rule: ${expectedRuleSummary}. Context keys: ${expectedContextKeysStr}. Returning false.` // Exact string message format
            );
        });
    });

    // --- Test Case: Invalid Inputs Passed to Service (Refined AC.5.c - Optional) ---
    // These tests check how the service handles invalid inputs when passed to jsonLogic.apply
    describe('when evaluate is called with invalid arguments', () => {

        // Test case: Rule is null
        test('should return false and log error if the rule is null', () => {
            const invalidRule = null;
            const invalidRuleSummary = getRuleSummary(invalidRule); // "null"
            const expectedContextKeysStr = getContextKeysString(dummyContext);
            let capturedError = null;

            // Assume jsonLogic.apply or stringify might throw. Mock apply to simulate this.
            applySpy.mockImplementation(() => {
                // Simulate the kind of error json-logic-js might throw for invalid rule
                const err = new TypeError("Invalid rule: null");
                capturedError = err;
                throw err;
            });

            const result = service.evaluate(invalidRule, dummyContext);

            expect(result).toBe(false);
            expect(applySpy).toHaveBeenCalledTimes(1); // apply *should* be called in the current implementation
            expect(applySpy).toHaveBeenCalledWith(invalidRule, dummyContext);

            expect(mockLogger.error).toHaveBeenCalledTimes(1);
            // *** CORRECTED ASSERTION *** (Matches the format of AC.5.a)
            expect(mockLogger.error).toHaveBeenCalledWith(
                `Error evaluating JSON Logic rule: ${invalidRuleSummary}. Context keys: ${expectedContextKeysStr}`, // String message part
                capturedError // The error that was thrown (or similar)
            );
        });

        // Test case: Rule is not an object (e.g., a string)
        test('should return false and log error if the rule is not an object (e.g., a string)', () => {
            const invalidRule = "this is not a rule object";
            const invalidRuleSummary = getRuleSummary(invalidRule); // Will be truncated string
            const expectedContextKeysStr = getContextKeysString(dummyContext);
            let capturedError = null;

            // Assume jsonLogic.apply throws for non-object rules
            applySpy.mockImplementation(() => {
                const err = new TypeError(`Invalid rule: ${invalidRule}`);
                capturedError = err;
                throw err;
            });

            const result = service.evaluate(invalidRule, dummyContext);

            expect(result).toBe(false);
            expect(applySpy).toHaveBeenCalledTimes(1);
            expect(applySpy).toHaveBeenCalledWith(invalidRule, dummyContext);

            expect(mockLogger.error).toHaveBeenCalledTimes(1);
            // *** CORRECTED ASSERTION ***
            expect(mockLogger.error).toHaveBeenCalledWith(
                `Error evaluating JSON Logic rule: ${invalidRuleSummary}. Context keys: ${expectedContextKeysStr}`,
                capturedError
            );
        });

        // Test case: Context is null
        test('should return false and log error if the context is null', () => {
            const invalidContext = null;
            const expectedRuleSummary = getRuleSummary(dummyRule);
            const expectedContextKeysStr = getContextKeysString(invalidContext); // ""
            let capturedError = null;

            // Assume jsonLogic.apply throws for null context
            applySpy.mockImplementation(() => {
                const err = new TypeError("Invalid context: null");
                capturedError = err;
                throw err;
            });

            const result = service.evaluate(dummyRule, invalidContext);

            expect(result).toBe(false);
            expect(applySpy).toHaveBeenCalledTimes(1);
            expect(applySpy).toHaveBeenCalledWith(dummyRule, invalidContext);

            expect(mockLogger.error).toHaveBeenCalledTimes(1);
            // *** CORRECTED ASSERTION ***
            expect(mockLogger.error).toHaveBeenCalledWith(
                `Error evaluating JSON Logic rule: ${expectedRuleSummary}. Context keys: ${expectedContextKeysStr}`, // Context keys will be empty string
                capturedError
            );
        });

        // Test case: Context is not an object (e.g., a number)
        test('should return false and log error if the context is not an object (e.g., a number)', () => {
            const invalidContext = 12345;
            const expectedRuleSummary = getRuleSummary(dummyRule);
            const expectedContextKeysStr = getContextKeysString(invalidContext); // ""
            let capturedError = null;

            // Assume jsonLogic.apply throws for non-object context
            applySpy.mockImplementation(() => {
                const err = new TypeError(`Invalid context: ${invalidContext}`);
                capturedError = err;
                throw err;
            });

            const result = service.evaluate(dummyRule, invalidContext);

            expect(result).toBe(false);
            expect(applySpy).toHaveBeenCalledTimes(1);
            expect(applySpy).toHaveBeenCalledWith(dummyRule, invalidContext);

            expect(mockLogger.error).toHaveBeenCalledTimes(1);
            // *** CORRECTED ASSERTION ***
            expect(mockLogger.error).toHaveBeenCalledWith(
                `Error evaluating JSON Logic rule: ${expectedRuleSummary}. Context keys: ${expectedContextKeysStr}`, // Context keys will be empty string
                capturedError
            );
        });
    });

}); // End describe JsonLogicEvaluationService - Error Handling