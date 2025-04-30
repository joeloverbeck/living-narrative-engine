// src/tests/core/turnOrder/turnOrderService.roundTransitions.test.js

/**
 * @fileoverview Unit tests for the TurnOrderService class, focusing on
 * transitions between different strategies when calling startNewRound multiple times.
 * Parent Ticket: TEST-TURN-ORDER-001.11
 * Ticket ID: TEST-TURN-ORDER-001.11.13
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

describe('TurnOrderService - Round Transitions', () => {
    /** @type {ReturnType<typeof createMockLogger>} */
    let mockLogger;
    /** @type {TurnOrderService} */
    let service;
    /** @type {jest.Mock<SimpleRoundRobinQueue>} */
    let MockSimpleRoundRobinQueue;
    /** @type {jest.Mock<InitiativePriorityQueue>} */
    let MockInitiativePriorityQueue;

    // Use broader types for instances to avoid Jest's complex mock types issues sometimes
    /** @type {any | null} */
    let mockRRQueueInstance = null;
    /** @type {any | null} */
    let mockInitQueueInstance = null;

    beforeEach(() => {
        jest.clearAllMocks(); // Clear all mocks before each test

        mockLogger = createMockLogger();
        service = new TurnOrderService({logger: mockLogger});

        // Store the mocked classes
        MockSimpleRoundRobinQueue = SimpleRoundRobinQueue;
        MockInitiativePriorityQueue = InitiativePriorityQueue;

        // Reset the mock implementation for SimpleRoundRobinQueue
        MockSimpleRoundRobinQueue.mockImplementation(() => {
            const instance = {
                _entities: [], // Internal state for dynamic size
                add: jest.fn().mockImplementation((entity) => {
                    instance._entities.push(entity);
                }),
                clear: jest.fn().mockImplementation(() => {
                    instance._entities = [];
                }),
                getNext: jest.fn().mockImplementation(() => instance._entities.length > 0 ? instance._entities.shift() : null),
                peek: jest.fn().mockImplementation(() => instance._entities.length > 0 ? instance._entities[0] : null),
                isEmpty: jest.fn().mockImplementation(() => instance._entities.length === 0),
                toArray: jest.fn().mockImplementation(() => [...instance._entities]),
                remove: jest.fn().mockReturnValue(null), // Adjust if needed
                // Dynamic size based on internal mock state
                size: jest.fn().mockImplementation(() => instance._entities.length),
            };
            mockRRQueueInstance = instance; // Capture the instance
            return instance;
        });

        // Reset the mock implementation for InitiativePriorityQueue
        MockInitiativePriorityQueue.mockImplementation(() => {
            let entityCount = 0; // Counter for dynamic size
            const instance = {
                // Track adds for dynamic size
                add: jest.fn().mockImplementation(() => {
                    entityCount++;
                }),
                // Reset count on clear
                clear: jest.fn().mockImplementation(() => {
                    entityCount = 0;
                }),
                getNext: jest.fn().mockReturnValue(null), // Default return
                peek: jest.fn().mockReturnValue(null),
                // Base isEmpty on dynamic count
                isEmpty: jest.fn().mockImplementation(() => entityCount === 0),
                toArray: jest.fn().mockReturnValue([]),
                remove: jest.fn().mockReturnValue(null), // Always null for Initiative queue mock
                // Dynamic size based on add/clear calls
                size: jest.fn().mockImplementation(() => entityCount),
                _queue: {length: 0, data: []}, // Mock internal state minimally if needed
                _removedEntityIds: new Set(),
            };
            mockInitQueueInstance = instance; // Capture the instance
            return instance;
        });

        // Clear constructor log if needed for specific tests
        mockLogger.info.mockClear();
    });

    // --- Test Suite for Round Transitions (TEST-TURN-ORDER-001.11.13) ---
    describe('startNewRound Transitions', () => {

        it('Test Case 11.13.1: should correctly transition from Round Robin to Initiative', () => {
            // Arrange: First round (Round Robin)
            const entities1 = [{id: 'a'}];
            const strategy1 = 'round-robin';
            service.startNewRound(entities1, strategy1);

            // Capture the first mock queue instance created
            expect(MockSimpleRoundRobinQueue).toHaveBeenCalledTimes(1);
            expect(mockRRQueueInstance).not.toBeNull();
            const capturedMockRRQueue = mockRRQueueInstance; // Store reference

            // Verify initial setup (optional, sanity check)
            expect(capturedMockRRQueue.add).toHaveBeenCalledWith(entities1[0]);
            expect(capturedMockRRQueue.add).toHaveBeenCalledTimes(1);
            expect(capturedMockRRQueue.size()).toBe(1); // Check dynamic size worked for round 1

            // Clear mocks *after* first round setup to focus on the transition effects
            MockSimpleRoundRobinQueue.mockClear();
            Object.values(capturedMockRRQueue).forEach(mockFn => {
                if (jest.isMockFunction(mockFn)) mockFn.mockClear();
            });
            // Reset internal state of captured mock if necessary (clear already does this for RR)
            // capturedMockRRQueue._entities = []; // Redundant due to mockImplementation of clear

            MockInitiativePriorityQueue.mockClear(); // Ensure this wasn't called yet
            mockLogger.debug.mockClear();
            mockLogger.info.mockClear();
            mockLogger.warn.mockClear();
            mockLogger.error.mockClear();


            // Arrange: Second round (Initiative)
            const entities2 = [{id: 'b'}, {id: 'c'}];
            const strategy2 = 'initiative';
            const initiativeData2 = new Map([['b', 10], ['c', 20]]); // c has higher priority

            // Act: Start the second round, triggering the transition
            // The internal call to .size() for logging will now use the dynamic mock implementation
            service.startNewRound(entities2, strategy2, initiativeData2);

            // Assert: Transition effects

            // 1. Previous Queue Cleared
            expect(capturedMockRRQueue.clear).toHaveBeenCalledTimes(1);

            // 2. New Queue (Initiative) Instantiated
            expect(MockInitiativePriorityQueue).toHaveBeenCalledTimes(1);
            expect(MockInitiativePriorityQueue).toHaveBeenCalledWith(); // Check constructor call
            expect(mockInitQueueInstance).not.toBeNull();
            expect(mockInitQueueInstance).not.toBe(capturedMockRRQueue); // Ensure it's a different queue instance
            expect(mockInitQueueInstance.size()).toBe(entities2.length); // Verify dynamic size after adds

            // 3. Internal Service State (Strategy) - Checked indirectly

            // 4. New Entities Added to New Queue (Initiative)
            expect(mockInitQueueInstance.add).toHaveBeenCalledTimes(entities2.length);
            expect(mockInitQueueInstance.add).toHaveBeenCalledWith(entities2[0], initiativeData2.get('b')); // {id: 'b'}, 10
            expect(mockInitQueueInstance.add).toHaveBeenCalledWith(entities2[1], initiativeData2.get('c')); // {id: 'c'}, 20

            // 5. Delegation to New Queue
            const nextEntityFromInit = {id: 'c'}; // Expect 'c' due to higher priority (TinyQueue logic)
            // We need to configure getNext *after* the instance exists but *before* we call service.getNextEntity
            mockInitQueueInstance.getNext.mockReturnValueOnce(nextEntityFromInit);

            const result = service.getNextEntity(); // <<< Generates the 3rd Debug Log
            expect(result).toBe(nextEntityFromInit);
            expect(mockInitQueueInstance.getNext).toHaveBeenCalledTimes(1);
            expect(capturedMockRRQueue.getNext).not.toHaveBeenCalled(); // Ensure old queue wasn't called

            mockInitQueueInstance.peek.mockReturnValueOnce({id: 'b'}); // Assuming 'b' is next
            expect(service.peekNextEntity()).toEqual({id: 'b'});
            expect(mockInitQueueInstance.peek).toHaveBeenCalledTimes(1);
            expect(capturedMockRRQueue.peek).not.toHaveBeenCalled();

            // Need to reset isEmpty's implementation after adds if using dynamic count
            mockInitQueueInstance.isEmpty.mockReturnValue(false); // Or use the dynamic impl: expect(mockInitQueueInstance.isEmpty()).toBe(false);
            expect(service.isEmpty()).toBe(false);
            expect(mockInitQueueInstance.isEmpty).toHaveBeenCalledTimes(1); // Called once by service.isEmpty()
            expect(capturedMockRRQueue.isEmpty).not.toHaveBeenCalled();

            const order = [{id: 'c'}, {id: 'b'}]; // Example order
            mockInitQueueInstance.toArray.mockReturnValue(order);
            expect(service.getCurrentOrder()).toEqual(order);
            expect(mockInitQueueInstance.toArray).toHaveBeenCalledTimes(1);
            expect(capturedMockRRQueue.toArray).not.toHaveBeenCalled();


            // 6. Logging (Focus on logs during the *second* startNewRound call + subsequent calls in Assert block)
            // Check the specific INFO calls *after* the mocks were cleared
            expect(mockLogger.info).toHaveBeenCalledTimes(4); // Start, Clear, Populate, Success
            expect(mockLogger.info).toHaveBeenNthCalledWith(1, `TurnOrderService: Starting new round with strategy "${strategy2}".`);
            expect(mockLogger.info).toHaveBeenNthCalledWith(2, 'TurnOrderService: Current round state cleared.'); // From clearCurrentRound
            expect(mockLogger.info).toHaveBeenNthCalledWith(3, `TurnOrderService: Populated InitiativePriorityQueue with ${entities2.length} entities.`);
            expect(mockLogger.info).toHaveBeenNthCalledWith(4, `TurnOrderService: New round successfully started with ${entities2.length} active entities.`);

            // Check the specific DEBUG calls *after* the mocks were cleared
            // Expected: Clear existing queue, Init new queue, Advance turn
            expect(mockLogger.debug).toHaveBeenCalledTimes(3); // <<< FIXED: Adjusted count
            expect(mockLogger.debug).toHaveBeenCalledWith('TurnOrderService: Cleared existing turn queue.'); // Call 1 (from startNewRound -> clearCurrentRound)
            expect(mockLogger.debug).toHaveBeenCalledWith('TurnOrderService: Initialized InitiativePriorityQueue.'); // Call 2 (from startNewRound)
            expect(mockLogger.debug).toHaveBeenCalledWith(`TurnOrderService: Advancing turn to entity "${nextEntityFromInit.id}".`); // Call 3 (from getNextEntity call in Assert #5)


            expect(mockLogger.warn).not.toHaveBeenCalled();
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        // Add more transition tests as needed

    }); // End describe("startNewRound Transitions")

}); // End describe('TurnOrderService - Round Transitions')