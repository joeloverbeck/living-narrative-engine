// src/tests/core/turnOrder/turnOrderService.noActiveRound.test.js

/**
 * @fileoverview Unit tests for the TurnOrderService class, focusing on
 * method behavior when no round is active (i.e., before startNewRound is called).
 * Parent Ticket: TEST-TURN-ORDER-001.11
 * Ticket ID: TEST-TURN-ORDER-001.11.12
 */

import {describe, it, expect, beforeEach, jest} from '@jest/globals';
import {TurnOrderService} from '../../../src/turns/order/turnOrderService.js';

// Mock ILogger interface
const createMockLogger = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
});

// Mock Entity type for testing
/** @typedef {{ id: string; name?: string; }} Entity */

describe('TurnOrderService (No Active Round)', () => {
    /** @type {ReturnType<typeof createMockLogger>} */
    let mockLogger;
    /** @type {TurnOrderService} */
    let service;

    beforeEach(() => {
        jest.clearAllMocks(); // Clear all mocks before each test

        mockLogger = createMockLogger();
        // Instantiate the service WITHOUT calling startNewRound
        service = new TurnOrderService({logger: mockLogger});

        // Clear the constructor log for cleaner assertion checks in tests
        mockLogger.info.mockClear();
    });

    // --- Test Cases for Methods Called Before startNewRound ---

    it('Test Case 11.12.1: getNextEntity should return null and log a warning', () => {
        // Act
        const result = service.getNextEntity();

        // Assert
        expect(result).toBeNull();
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith('TurnOrderService.getNextEntity: Called when no round is active.');
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.debug).not.toHaveBeenCalled();
        expect(mockLogger.info).not.toHaveBeenCalled();
    });

    it('Test Case 11.12.2: peekNextEntity should return null and not log a warning', () => {
        // Act
        const result = service.peekNextEntity();

        // Assert
        expect(result).toBeNull();
        // No warning is expected for peek when no round is active
        expect(mockLogger.warn).not.toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.debug).not.toHaveBeenCalled();
        expect(mockLogger.info).not.toHaveBeenCalled();
    });

    it('Test Case 11.12.3: isEmpty should return true', () => {
        // Act
        const result = service.isEmpty();

        // Assert
        expect(result).toBe(true);
        expect(mockLogger.warn).not.toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.debug).not.toHaveBeenCalled();
        expect(mockLogger.info).not.toHaveBeenCalled();
    });

    it('Test Case 11.12.4: getCurrentOrder should return an empty, frozen array', () => {
        // Act
        const order = service.getCurrentOrder();

        // Assert
        expect(order).toEqual([]); // Check for empty array
        expect(order).toHaveLength(0);
        expect(Object.isFrozen(order)).toBe(true); // Check if the array is frozen
        expect(mockLogger.warn).not.toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.debug).not.toHaveBeenCalled();
        expect(mockLogger.info).not.toHaveBeenCalled();
    });

    it('Test Case 11.12.5: addEntity should throw an error and log an error', () => {
        // Arrange
        const entityToAdd = {id: 'a', name: 'Test Entity'};
        const expectedErrorMessage = 'Cannot add entity: No round is active.';
        const expectedLogMessage = 'TurnOrderService.addEntity: Cannot add entity, no round is currently active.';

        // Act & Assert
        expect(() => {
            service.addEntity(entityToAdd);
        }).toThrow(expectedErrorMessage);

        // Assert Logging
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(expectedLogMessage);
        expect(mockLogger.warn).not.toHaveBeenCalled();
        expect(mockLogger.debug).not.toHaveBeenCalled();
        expect(mockLogger.info).not.toHaveBeenCalled();
    });

    it('Test Case 11.12.6: removeEntity should not throw, return void, and log a warning', () => {
        // Arrange
        const entityIdToRemove = 'a';
        const expectedLogMessage = `TurnOrderService.removeEntity: Called for entity "${entityIdToRemove}" when no round is active. No action taken.`;

        // Act
        let result;
        expect(() => {
            result = service.removeEntity(entityIdToRemove);
        }).not.toThrow();

        // Assert
        expect(result).toBeUndefined(); // Methods returning void actually return undefined in JS
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith(expectedLogMessage);
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.debug).not.toHaveBeenCalled();
        expect(mockLogger.info).not.toHaveBeenCalled();
    });

}); // End describe('TurnOrderService (No Active Round)')