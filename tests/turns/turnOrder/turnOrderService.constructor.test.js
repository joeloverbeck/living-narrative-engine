// src/tests/code/turnOrder/turnOrderService.constructor.test.js

/**
 * @fileoverview Unit tests for the TurnOrderService class, focusing on constructor logic.
 * Ticket: TEST-TURN-ORDER-001.11.1
 */

import {describe, it, expect, beforeEach, jest} from '@jest/globals';
import {TurnOrderService} from '../../../src/turns/order/turnOrderService.js'; // Adjust path as needed
// Assuming ILogger interface definition (or use a simplified mock structure)
// For testing, we don't need the actual interface, just an object matching the expected structure.

// Mock ILogger interface
const createMockLogger = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(), // Assuming debug might be used elsewhere, include for completeness
});

describe('TurnOrderService', () => {
    // --- Test Suite for Constructor Logic (TEST-TURN-ORDER-001.11.1) ---
    describe('Constructor Logic', () => {
        /** @type {ReturnType<typeof createMockLogger>} */
        let mockLogger;

        beforeEach(() => {
            mockLogger = createMockLogger();
        });

        // Test Case: Valid Logger
        it('Test Case 11.1.1: should initialize correctly with a valid logger', () => {
            // Arrange
            const validLogger = mockLogger;

            // Act
            let serviceInstance;
            const act = () => {
                serviceInstance = new TurnOrderService({logger: validLogger});
            };

            // Assert
            expect(act).not.toThrow();
            expect(serviceInstance).toBeInstanceOf(TurnOrderService);

            // Verify initial internal state (indirectly where necessary)
            // Direct access to private fields (#currentQueue, #currentStrategy) isn't possible from tests.
            // We verify they are initialized to null by checking methods that depend on them.
            expect(serviceInstance.isEmpty()).toBe(true); // isEmpty returns true if #currentQueue is null
            expect(serviceInstance.peekNextEntity()).toBeNull(); // peekNextEntity returns null if #currentQueue is null
            expect(serviceInstance.getCurrentOrder()).toEqual(Object.freeze([])); // getCurrentOrder returns [] if #currentQueue is null
            // No direct way to check #currentStrategy, but its initialization alongside #currentQueue is implied by the above checks.

            // Verify logger interaction
            expect(validLogger.info).toHaveBeenCalledTimes(1);
            expect(validLogger.info).toHaveBeenCalledWith('TurnOrderService initialized.');
            // Ensure other log levels weren't called during construction
            expect(validLogger.warn).not.toHaveBeenCalled();
            expect(validLogger.error).not.toHaveBeenCalled();
            expect(validLogger.debug).not.toHaveBeenCalled();
        });

        // Test Case: Missing Logger (undefined)
        it('Test Case 11.1.2: should throw an error if the logger dependency is missing (undefined)', () => {
            // Arrange: No logger provided

            // Act & Assert
            expect(() => {
                new TurnOrderService({logger: undefined});
            }).toThrow(Error);
            expect(() => {
                new TurnOrderService({logger: undefined});
            }).toThrow('TurnOrderService requires a valid ILogger instance (info, error, warn methods).');
        });

        // Test Case: Missing Logger ({})
        it('Test Case 11.1.3: should throw an error if the logger dependency is missing (empty object)', () => {
            // Arrange: Empty dependencies object

            // Act & Assert
            expect(() => {
                // @ts-ignore // Suppress TypeScript error for testing invalid input
                new TurnOrderService({});
            }).toThrow(Error);
            expect(() => {
                // @ts-ignore // Suppress TypeScript error for testing invalid input
                new TurnOrderService({});
            }).toThrow('TurnOrderService requires a valid ILogger instance (info, error, warn methods).');
        });


        // Test Case: Invalid Logger (Missing Methods - e.g., missing warn)
        it('Test Case 11.1.4: should throw an error if the provided logger is invalid (missing methods)', () => {
            // Arrange
            const invalidLogger = {
                info: jest.fn(),
                error: jest.fn(),
                // debug: jest.fn(), // Also missing debug, but check focuses on warn
                // Missing 'warn' method
            };

            // Act & Assert
            expect(() => {
                // @ts-ignore // Suppress TypeScript error for testing invalid input
                new TurnOrderService({logger: invalidLogger});
            }).toThrow(Error);
            expect(() => {
                // @ts-ignore // Suppress TypeScript error for testing invalid input
                new TurnOrderService({logger: invalidLogger});
            }).toThrow('TurnOrderService requires a valid ILogger instance (info, error, warn methods).');

            // Ensure the valid methods weren't called if constructor threw early
            expect(invalidLogger.info).not.toHaveBeenCalled();
            expect(invalidLogger.error).not.toHaveBeenCalled();
        });

        // Test Case: Invalid Logger (Methods are not functions)
        it('Test Case 11.1.5: should throw an error if the provided logger has non-function methods', () => {
            // Arrange
            const invalidLogger = {
                info: jest.fn(),
                warn: 'not a function', // Invalid type
                error: jest.fn(),
                debug: jest.fn(),
            };

            // Act & Assert
            expect(() => {
                // @ts-ignore // Suppress TypeScript error for testing invalid input
                new TurnOrderService({logger: invalidLogger});
            }).toThrow(Error);
            expect(() => {
                // @ts-ignore // Suppress TypeScript error for testing invalid input
                new TurnOrderService({logger: invalidLogger});
            }).toThrow('TurnOrderService requires a valid ILogger instance (info, error, warn methods).');

            // Ensure the valid methods weren't called if constructor threw early
            expect(invalidLogger.info).not.toHaveBeenCalled();
            expect(invalidLogger.error).not.toHaveBeenCalled();
        });


    }); // End describe('Constructor Logic')
}); // End describe('TurnOrderService')