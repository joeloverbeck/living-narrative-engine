// src/tests/core/turnOrder/turnOrderService.peekNextEntity.test.js

/**
 * @fileoverview Unit tests for the TurnOrderService class, focusing on the
 * peekNextEntity method when a round is active.
 * Parent Ticket: TEST-TURN-ORDER-001.11
 * Ticket ID: TEST-TURN-ORDER-001.11.6
 */

import {describe, it, expect, beforeEach, jest} from '@jest/globals';
import {TurnOrderService} from '../../../core/turnOrder/turnOrderService.js';
import {SimpleRoundRobinQueue} from '../../../core/turnOrder/queues/simpleRoundRobinQueue.js';
import {InitiativePriorityQueue} from '../../../core/turnOrder/queues/initiativePriorityQueue.js';

// Mock the Queue modules
jest.mock('../../../core/turnOrder/queues/simpleRoundRobinQueue.js');
jest.mock('../../../core/turnOrder/queues/initiativePriorityQueue.js');

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
    /** @type {jest.Mocked<SimpleRoundRobinQueue>} */
    let mockSimpleQueueInstance;
    /** @type {jest.Mocked<InitiativePriorityQueue>} */
    let mockInitiativeQueueInstance;
    /** @type {Entity[]} */
    let entities;

    beforeEach(() => {
        jest.clearAllMocks(); // Clear all previous mock calls and instances

        // Setup common mocks and instances
        mockLogger = createMockLogger();
        service = new TurnOrderService({logger: mockLogger});
        entities = [{id: 'entityA', name: 'Alice'}, {id: 'entityB', name: 'Bob'}];

        // Provide mock implementations for the queue constructors
        // These will be instantiated inside startNewRound
        SimpleRoundRobinQueue.mockImplementation(() => {
            mockSimpleQueueInstance = {
                add: jest.fn(),
                remove: jest.fn(),
                getNext: jest.fn(),
                peek: jest.fn(), // Method under test
                isEmpty: jest.fn().mockReturnValue(false),
                clear: jest.fn(),
                size: jest.fn().mockReturnValue(entities.length),
                toArray: jest.fn().mockReturnValue(entities),
            };
            return mockSimpleQueueInstance;
        });

        InitiativePriorityQueue.mockImplementation(() => {
            mockInitiativeQueueInstance = {
                add: jest.fn(),
                remove: jest.fn(),
                getNext: jest.fn(),
                peek: jest.fn(), // Method under test
                isEmpty: jest.fn().mockReturnValue(false),
                clear: jest.fn(),
                size: jest.fn().mockReturnValue(entities.length),
                toArray: jest.fn().mockReturnValue(entities),
            };
            return mockInitiativeQueueInstance;
        });

        // Clear logger calls made during constructor AFTER instantiation
        mockLogger.info.mockClear();
        mockLogger.warn.mockClear();
        mockLogger.error.mockClear();
        mockLogger.debug.mockClear();
    });

    // --- Test Suite for peekNextEntity (Active Round) (TEST-TURN-ORDER-001.11.6) ---
    describe('peekNextEntity (Active Round)', () => {

        // Test Case: Delegate to Round Robin Queue
        it('Test Case 11.6.1: should delegate to the active SimpleRoundRobinQueue and return its peek result', () => {
            // Arrange
            const expectedPeekResult = {id: 'peekRR'};
            service.startNewRound(entities, 'round-robin'); // Instantiates mockSimpleQueueInstance
            expect(mockSimpleQueueInstance).toBeDefined();
            mockSimpleQueueInstance.peek.mockReturnValue(expectedPeekResult);
            mockLogger.info.mockClear(); // Clear logs from startNewRound
            mockLogger.debug.mockClear();

            // Act
            const result = service.peekNextEntity();

            // Assert
            expect(result).toEqual(expectedPeekResult);
            expect(mockSimpleQueueInstance.peek).toHaveBeenCalledTimes(1);
            expect(mockSimpleQueueInstance.peek).toHaveBeenCalledWith(); // Ensure no args passed

            // Ensure the *other* queue type wasn't touched
            expect(InitiativePriorityQueue).not.toHaveBeenCalled();
            if (mockInitiativeQueueInstance) {
                expect(mockInitiativeQueueInstance.peek).not.toHaveBeenCalled();
            }

            // Assert no logs were made by peekNextEntity itself
            expect(mockLogger.info).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();
            expect(mockLogger.error).not.toHaveBeenCalled();
            expect(mockLogger.debug).not.toHaveBeenCalled();
        });

        // Test Case: Delegate to Initiative Queue
        it('Test Case 11.6.2: should delegate to the active InitiativePriorityQueue and return its peek result', () => {
            // Arrange
            const expectedPeekResult = {id: 'peekInit'};
            const initiativeData = new Map([['entityA', 10], ['entityB', 5]]);
            service.startNewRound(entities, 'initiative', initiativeData); // Instantiates mockInitiativeQueueInstance
            expect(mockInitiativeQueueInstance).toBeDefined();
            mockInitiativeQueueInstance.peek.mockReturnValue(expectedPeekResult);
            mockLogger.info.mockClear(); // Clear logs from startNewRound
            mockLogger.debug.mockClear();
            mockLogger.warn.mockClear(); // Clear potential warn from init scoring

            // Act
            const result = service.peekNextEntity();

            // Assert
            expect(result).toEqual(expectedPeekResult);
            expect(mockInitiativeQueueInstance.peek).toHaveBeenCalledTimes(1);
            expect(mockInitiativeQueueInstance.peek).toHaveBeenCalledWith(); // Ensure no args passed

            // Ensure the *other* queue type wasn't touched
            expect(SimpleRoundRobinQueue).not.toHaveBeenCalled();
            if (mockSimpleQueueInstance) {
                expect(mockSimpleQueueInstance.peek).not.toHaveBeenCalled();
            }

            // Assert no logs were made by peekNextEntity itself
            expect(mockLogger.info).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();
            expect(mockLogger.error).not.toHaveBeenCalled();
            expect(mockLogger.debug).not.toHaveBeenCalled();
        });

        // Test Case: Queue Peek Returns Null (Round Robin)
        it('Test Case 11.6.3: should return null when the active round-robin queue peek returns null', () => {
            // Arrange
            service.startNewRound(entities, 'round-robin');
            expect(mockSimpleQueueInstance).toBeDefined();
            mockSimpleQueueInstance.peek.mockReturnValue(null);
            mockLogger.info.mockClear(); // Clear logs from startNewRound
            mockLogger.debug.mockClear();

            // Act
            const result = service.peekNextEntity();

            // Assert
            expect(result).toBeNull();
            expect(mockSimpleQueueInstance.peek).toHaveBeenCalledTimes(1);
            expect(mockSimpleQueueInstance.peek).toHaveBeenCalledWith();

            // Ensure the *other* queue type wasn't touched
            if (mockInitiativeQueueInstance) {
                expect(mockInitiativeQueueInstance.peek).not.toHaveBeenCalled();
            }

            // Assert no logs were made by peekNextEntity itself
            expect(mockLogger.info).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();
            expect(mockLogger.error).not.toHaveBeenCalled();
            expect(mockLogger.debug).not.toHaveBeenCalled();
        });

        // Test Case: Queue Peek Returns Null (Initiative)
        it('Test Case 11.6.4: should return null when the active initiative queue peek returns null', () => {
            // Arrange
            const initiativeData = new Map([['entityA', 10], ['entityB', 5]]);
            service.startNewRound(entities, 'initiative', initiativeData);
            expect(mockInitiativeQueueInstance).toBeDefined();
            mockInitiativeQueueInstance.peek.mockReturnValue(null);
            mockLogger.info.mockClear(); // Clear logs from startNewRound
            mockLogger.debug.mockClear();
            mockLogger.warn.mockClear(); // Clear potential warn from init scoring

            // Act
            const result = service.peekNextEntity();

            // Assert
            expect(result).toBeNull();
            expect(mockInitiativeQueueInstance.peek).toHaveBeenCalledTimes(1);
            expect(mockInitiativeQueueInstance.peek).toHaveBeenCalledWith();

            // Ensure the *other* queue type wasn't touched
            if (mockSimpleQueueInstance) {
                expect(mockSimpleQueueInstance.peek).not.toHaveBeenCalled();
            }

            // Assert no logs were made by peekNextEntity itself
            expect(mockLogger.info).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();
            expect(mockLogger.error).not.toHaveBeenCalled();
            expect(mockLogger.debug).not.toHaveBeenCalled();
        });

        // Test Case: Called when no round is active (already covered by TEST-TURN-ORDER-001.11.2)
        // Adding a test here for completeness within this specific focus, mirroring 11.5.5 for `getNextEntity`.
        it('Test Case 11.6.5: should return null if called when no round is active', () => {
            // Arrange - No round started after beforeEach
            // Clear any stray logs, although beforeEach + clearAllMocks should handle this.
            mockLogger.warn.mockClear();

            // Act
            const result = service.peekNextEntity();

            // Assert
            expect(result).toBeNull();
            // Crucially, ensure no queue constructor or peek was called
            expect(SimpleRoundRobinQueue).not.toHaveBeenCalled();
            expect(InitiativePriorityQueue).not.toHaveBeenCalled();
            if (mockSimpleQueueInstance) expect(mockSimpleQueueInstance.peek).not.toHaveBeenCalled();
            if (mockInitiativeQueueInstance) expect(mockInitiativeQueueInstance.peek).not.toHaveBeenCalled();

            // Assert NO logs were made (unlike getNextEntity, peek is silent when no round)
            expect(mockLogger.info).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();
            expect(mockLogger.error).not.toHaveBeenCalled();
            expect(mockLogger.debug).not.toHaveBeenCalled();
        });

    }); // End describe('peekNextEntity (Active Round)')

}); // End describe('TurnOrderService')