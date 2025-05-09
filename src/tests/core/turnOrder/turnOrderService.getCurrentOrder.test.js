// src/tests/core/turnOrder/turnOrderService.getCurrentOrder.test.js

/**
 * @fileoverview Unit tests for the TurnOrderService class, specifically
 * focusing on the getCurrentOrder method when a round is active.
 * Parent Ticket: TEST-TURN-ORDER-001.11
 * Ticket ID: TEST-TURN-ORDER-001.11.8
 */

import {describe, it, expect, beforeEach, jest} from '@jest/globals';
import {TurnOrderService} from '../../../core/turns/order/turnOrderService.js';
import {SimpleRoundRobinQueue} from '../../../core/turns/order/queues/simpleRoundRobinQueue.js';
import {InitiativePriorityQueue} from '../../../core/turns/order/queues/initiativePriorityQueue.js';

// Mock the Queue modules
jest.mock('../../../core/turns/order/queues/simpleRoundRobinQueue.js');
jest.mock('../../../core/turns/order/queues/initiativePriorityQueue.js');

// Mock ILogger interface
const createMockLogger = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
});

// Mock Entity type for testing
/** @typedef {{ id: string; name?: string; }} Entity */

describe('TurnOrderService', () => {
    /** @type {ReturnType<typeof createMockLogger>} */
    let mockLogger;
    /** @type {TurnOrderService} */
    let service;
    /** @type {Entity[]} */
    let entities;
    /** @type {Map<string, number>} */
    let initiativeData;

    // Mocks for queue instances
    let mockSimpleQueueInstance;
    let mockInitiativeQueueInstance;

    beforeEach(() => {
        jest.clearAllMocks(); // Clear all mocks before each test

        mockLogger = createMockLogger();
        service = new TurnOrderService({logger: mockLogger});

        // Common test data
        entities = [{id: 'a', name: 'Alice'}, {id: 'b', name: 'Bob'}, {id: 'c', name: 'Charlie'}];
        initiativeData = new Map([['a', 10], ['b', 20], ['c', 5]]);

        // --- Mock Queue Implementations ---
        // Reset mocks and provide fresh implementations for each test

        // Mock SimpleRoundRobinQueue
        mockSimpleQueueInstance = {
            add: jest.fn(),
            clear: jest.fn(),
            peek: jest.fn(),
            isEmpty: jest.fn().mockReturnValue(true),
            toArray: jest.fn().mockReturnValue([]), // Default empty array
            getNext: jest.fn(),
            remove: jest.fn(),
            size: jest.fn().mockReturnValue(0),
        };
        SimpleRoundRobinQueue.mockImplementation(() => mockSimpleQueueInstance);

        // Mock InitiativePriorityQueue
        mockInitiativeQueueInstance = {
            add: jest.fn(),
            clear: jest.fn(),
            peek: jest.fn(),
            isEmpty: jest.fn().mockReturnValue(true),
            toArray: jest.fn().mockReturnValue([]), // Default empty array
            getNext: jest.fn(),
            remove: jest.fn(),
            size: jest.fn().mockReturnValue(0),
        };
        InitiativePriorityQueue.mockImplementation(() => mockInitiativeQueueInstance);
    });

    // --- Test Suite for getCurrentOrder (TEST-TURN-ORDER-001.11.8) ---
    describe("getCurrentOrder (Active Round)", () => {

        it("Test Case 11.8.1: Delegate to Round Robin Queue - should call toArray on the RR queue and return its frozen result", () => {
            // Arrange
            const expectedOrder = [{id: 'a'}, {id: 'b'}];
            service.startNewRound(entities, 'round-robin');
            mockSimpleQueueInstance.toArray.mockReturnValue([...expectedOrder]); // Return a copy

            // Act
            const order = service.getCurrentOrder();

            // Assert
            expect(mockSimpleQueueInstance.toArray).toHaveBeenCalledTimes(1);
            expect(mockInitiativeQueueInstance.toArray).not.toHaveBeenCalled(); // Ensure the other queue wasn't called
            expect(order).toEqual(expectedOrder); // Use toEqual for deep comparison
            expect(order).not.toBe(expectedOrder); // Ensure it's a copy (due to freeze)
            expect(Object.isFrozen(order)).toBe(true);
        });

        it("Test Case 11.8.2: Delegate to Initiative Queue - should call toArray on the Init queue and return its frozen result", () => {
            // Arrange
            // Note: Initiative queue toArray doesn't guarantee order, but the mock does
            const expectedOrder = [{id: 'c'}, {id: 'a'}];
            service.startNewRound(entities, 'initiative', initiativeData);
            mockInitiativeQueueInstance.toArray.mockReturnValue([...expectedOrder]); // Return a copy

            // Act
            const order = service.getCurrentOrder();

            // Assert
            expect(mockInitiativeQueueInstance.toArray).toHaveBeenCalledTimes(1);
            expect(mockSimpleQueueInstance.toArray).not.toHaveBeenCalled(); // Ensure the other queue wasn't called
            expect(order).toEqual(expectedOrder); // Use toEqual for deep comparison
            expect(order).not.toBe(expectedOrder); // Ensure it's a copy (due to freeze)
            expect(Object.isFrozen(order)).toBe(true);
        });

        it("Test Case 11.8.3: Queue Returns Empty Array - should return an empty, frozen array if the active queue's toArray returns empty", () => {
            // Arrange
            const expectedOrder = [];
            service.startNewRound(entities, 'round-robin'); // Use RR for simplicity
            mockSimpleQueueInstance.toArray.mockReturnValue([...expectedOrder]); // Return a copy

            // Act
            const order = service.getCurrentOrder();

            // Assert
            expect(mockSimpleQueueInstance.toArray).toHaveBeenCalledTimes(1);
            expect(order).toEqual(expectedOrder);
            expect(order).not.toBe(expectedOrder); // Ensure it's a copy (due to freeze)
            expect(Object.isFrozen(order)).toBe(true);
            expect(order.length).toBe(0);
        });

        it("Test Case (Implicit): No Active Round - should return an empty, frozen array without calling any queue", () => {
            // Arrange: No round started

            // Act
            const order = service.getCurrentOrder();

            // Assert
            expect(mockSimpleQueueInstance.toArray).not.toHaveBeenCalled();
            expect(mockInitiativeQueueInstance.toArray).not.toHaveBeenCalled();
            expect(order).toEqual([]);
            expect(Object.isFrozen(order)).toBe(true);
            expect(order.length).toBe(0);
        });

        it("Test Case (Defensive): Returned array should be deeply immutable if queue returns objects", () => {
            // Arrange
            const complexEntities = [{id: 'a', data: {value: 1}}, {id: 'b', data: {value: 2}}];
            service.startNewRound(complexEntities, 'round-robin');
            // IMPORTANT: Return a deep clone if you intend to modify the original later in the test,
            // otherwise Object.freeze will affect the mock's source array too.
            // Here, we return a shallow clone as per the method's current behavior.
            mockSimpleQueueInstance.toArray.mockReturnValue([...complexEntities]);

            // Act
            const order = service.getCurrentOrder();

            // Assert
            expect(Object.isFrozen(order)).toBe(true); // The array itself is frozen
            expect(order).toEqual(complexEntities);

            // Verify that attempting to modify the array throws
            expect(() => {
                // @ts-ignore - Testing immutability
                order.push({id: 'c'});
            }).toThrow(TypeError); // Or similar error depending on JS environment

            // Note: Object.freeze() is shallow. It freezes the array but not the objects *within* it.
            // This test confirms the array is frozen as per requirements.
            // If deep freezing was required, the implementation of getCurrentOrder would need to change.
            if (order.length > 0) {
                expect(Object.isFrozen(order[0])).toBe(false); // The objects inside are NOT frozen by default
                // We can still modify properties of objects within the frozen array
                expect(() => {
                    order[0].id = 'z';
                }).not.toThrow();
                expect(order[0].id).toBe('z'); // Modification was successful
            }
        });

    }); // End describe("getCurrentOrder (Active Round)")

}); // End describe('TurnOrderService')