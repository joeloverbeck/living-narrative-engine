// src/tests/logic/jsonLogicEvaluationService.errors.test.js

/**
 * @jest-environment node
 *
 * @fileoverview This file contains unit tests for the JsonLogicEvaluationService,
 * specifically focusing on error handling scenarios and the handling of non-boolean
 * results returned by the underlying json-logic-js library.
 * It uses a mocked ILogger and spies on `jsonLogic.apply` to simulate these conditions.
 * Corresponds to Ticket: [PARENT_ID].10
 */

import {describe, expect, test, jest, beforeEach, afterEach} from '@jest/globals';
import jsonLogic from 'json-logic-js'; // Import the actual library to spy on

// --- Class Under Test ---
import JsonLogicEvaluationService from '../../logic/jsonLogicEvaluationService.js'; // Adjust path as needed

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */ // Adjust path as needed
/** @typedef {import('../../logic/defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */ // Adjust path as needed
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

// --- Test Suite ---

describe('JsonLogicEvaluationService - Error Handling & Non-Boolean Results ([PARENT_ID].10)', () => {
    /** @type {JsonLogicEvaluationService} */
    let service;
    /** @type {jest.SpyInstance} */
    let applySpy;

    // --- Test Setup & Teardown ---
    beforeEach(() => {
        jest.clearAllMocks(); // Clear mocks before each test
        service = new JsonLogicEvaluationService({logger: mockLogger});

        // IMPORTANT: Set up the spy on jsonLogic.apply here or within the nested describe
        // Spying here means it applies to all tests in this top-level describe.
        // If only needed for the specific error handling block, move it there.
        // For this ticket, the spy is needed for both exception and non-boolean tests.
        applySpy = jest.spyOn(jsonLogic, 'apply');
    });

    afterEach(() => {
        // IMPORTANT: Restore the original implementation after each test
        applySpy.mockRestore();
    });

    // Define dummy rule and context for reuse
    const dummyRule = {"var": "data.value"};
    const dummyContext = {data: {value: 10}};
    const ruleSummary = JSON.stringify(dummyRule).substring(0, 150) + (JSON.stringify(dummyRule).length > 150 ? '...' : '');


    // --- [PARENT_ID].10: Error Handling Tests ---
    describe('Error Handling during jsonLogic.apply', () => {

        test('should return false and log error when jsonLogic.apply throws an exception', () => {
            // Arrange
            const evaluationError = new Error('Evaluation failed!');
            applySpy.mockImplementation(() => {
                throw evaluationError;
            });

            // Act
            const result = service.evaluate(dummyRule, dummyContext);

            // Assert
            expect(result).toBe(false); // Service should return false on evaluation error
            expect(applySpy).toHaveBeenCalledTimes(1);
            expect(applySpy).toHaveBeenCalledWith(dummyRule, dummyContext);
            expect(mockLogger.error).toHaveBeenCalledTimes(1);
            // Verify the error message structure and the logged error object
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`Error evaluating JSON Logic rule: ${ruleSummary}`),
                evaluationError // Check that the original error object is passed
            );
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`Context keys: ${Object.keys(dummyContext || {}).join(', ')}`),
                evaluationError
            );
            // More specific check combining parts:
            expect(mockLogger.error).toHaveBeenCalledWith(
                `Error evaluating JSON Logic rule: ${ruleSummary}. Context keys: ${Object.keys(dummyContext || {}).join(', ')}`,
                evaluationError
            );
        });
    }); // End describe Error Handling during jsonLogic.apply


}); // End describe JsonLogicEvaluationService