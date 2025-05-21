// src/tests/core/turnOrder/turnOrderService.startNewRound.initiative.test.js

/**
 * @fileoverview Unit tests for the TurnOrderService class, focusing on the
 * startNewRound method with the 'initiative' strategy.
 * Parent Ticket: TEST-TURN-ORDER-001.11
 * Ticket: TEST-TURN-ORDER-001.11.3
 */

import {describe, it, expect, beforeEach, jest} from '@jest/globals';
import {TurnOrderService} from '../../../src/turns/order/turnOrderService.js';
import {InitiativePriorityQueue} from '../../../src/turns/order/queues/initiativePriorityQueue.js'; // Import the actual class for mocking

// Mock the InitiativePriorityQueue module
jest.mock('../../../src/turns/order/queues/initiativePriorityQueue.js');

// Mock ILogger interface
const createMockLogger = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
});

// Mock Entity type for testing
/** @typedef {{ id: string; name?: string; }} Entity */ // Simplified mock type

describe('TurnOrderService', () => {
    /** @type {ReturnType<typeof createMockLogger>} */
    let mockLogger;
    /** @type {TurnOrderService} */
    let service;

    // --- Variables to hold mock functions and instances ---
    let mockAddFn, mockClearFn, mockPeekFn, mockIsEmptyFn, mockToArrayFn, mockGetNextFn, mockRemoveFn, mockSizeFn;
    let mockQueueInstances; // Array to store the objects returned by the mock constructor

    beforeEach(() => {
        // Clear all mock call history (constructor and module level)
        jest.clearAllMocks();
        mockQueueInstances = []; // Reset our manual instance tracker for each test

        // Create fresh mock functions for each test run
        mockAddFn = jest.fn();
        mockClearFn = jest.fn();
        mockPeekFn = jest.fn();
        mockIsEmptyFn = jest.fn().mockReturnValue(true); // Default to empty after clear
        mockToArrayFn = jest.fn().mockReturnValue([]);    // Default to empty after clear
        mockGetNextFn = jest.fn();
        mockRemoveFn = jest.fn();
        mockSizeFn = jest.fn().mockReturnValue(0); // Default return value

        mockLogger = createMockLogger();
        service = new TurnOrderService({logger: mockLogger});

        // Configure the mock implementation for InitiativePriorityQueue
        InitiativePriorityQueue.mockImplementation(() => {
            // Create the instance object using the shared mock functions
            const instance = {
                add: mockAddFn,
                clear: mockClearFn,
                peek: mockPeekFn,
                isEmpty: mockIsEmptyFn,
                toArray: mockToArrayFn,
                getNext: mockGetNextFn,
                remove: mockRemoveFn,
                size: mockSizeFn,
            };
            // Track the created instance object manually
            mockQueueInstances.push(instance);
            return instance;
        });
    });

    // --- Test Suite for startNewRound with 'initiative' (TEST-TURN-ORDER-001.11.3) ---
    describe("startNewRound ('initiative')", () => {

        // Test Case: Basic Initiative Start
        it("Test Case 11.3.1: should correctly initialize an initiative-based turn order", () => {
            // Arrange
            const strategy = 'initiative';
            const entities = [{id: 'a'}, {id: 'b'}];
            const initiativeData = new Map([['a', 15], ['b', 10]]);
            // --- Set mock size return value BEFORE Act ---
            mockSizeFn.mockReturnValue(entities.length);

            // Act
            service.startNewRound(entities, strategy, initiativeData);

            // Assert

            // 1. Queue Instantiation and Type
            expect(InitiativePriorityQueue).toHaveBeenCalledTimes(1);
            expect(InitiativePriorityQueue).toHaveBeenCalledWith();
            expect(mockQueueInstances.length).toBe(1);

            // 2. Entities Added to Queue with Correct Priority
            expect(mockAddFn).toHaveBeenCalledTimes(entities.length);
            expect(mockAddFn).toHaveBeenNthCalledWith(1, entities[0], 15);
            expect(mockAddFn).toHaveBeenNthCalledWith(2, entities[1], 10);

            // 4. Logging (Check logs generated *during* startNewRound)
            expect(mockLogger.info).toHaveBeenCalledWith(`TurnOrderService: Starting new round with strategy "${strategy}".`);
            expect(mockLogger.info).toHaveBeenCalledWith('TurnOrderService: Current round state cleared.');
            expect(mockLogger.info).toHaveBeenCalledWith(`TurnOrderService: Populated InitiativePriorityQueue with ${entities.length} entities.`);
            expect(mockSizeFn).toHaveBeenCalled();
            expect(mockLogger.info).toHaveBeenCalledWith(`TurnOrderService: New round successfully started with ${entities.length} active entities.`);

            // Debug logs from startNewRound
            expect(mockLogger.debug).not.toHaveBeenCalledWith('TurnOrderService: Cleared existing turn queue.');
            expect(mockLogger.debug).toHaveBeenCalledWith('TurnOrderService: Initialized InitiativePriorityQueue.');
            // Check *specific* calls during startNewRound BEFORE triggering more logs
            expect(mockLogger.debug).toHaveBeenCalledTimes(1); // <<< MOVED CHECK HERE

            // Other logs from startNewRound
            expect(mockLogger.warn).not.toHaveBeenCalled();
            expect(mockLogger.error).not.toHaveBeenCalled();


            // 3. Internal Service State (Inferred via behavior - AFTER checking startNewRound logs)
            service.peekNextEntity();
            expect(mockPeekFn).toHaveBeenCalledTimes(1);
            // This call will generate an additional debug log
            service.addEntity({id: 'c'}, 5);
            expect(mockAddFn).toHaveBeenCalledTimes(entities.length + 1); // Total calls to add
            expect(mockAddFn).toHaveBeenCalledWith({id: 'c'}, 5);
            // Verify the addEntity debug log happened if needed (optional)
            expect(mockLogger.debug).toHaveBeenCalledWith('TurnOrderService: Adding entity "c" with initiative 5 to the current round.');
            // Total debug calls are now 2
            expect(mockLogger.debug).toHaveBeenCalledTimes(2);

        });

        // Test Case: Initiative with Missing/Invalid Individual Priority
        it("Test Case 11.3.2: should handle missing or invalid initiative scores, defaulting to 0 and logging warnings", () => {
            // Arrange
            const strategy = 'initiative';
            const entities = [{id: 'a'}, {id: 'b'}, {id: 'c'}, {id: 'd'}];
            const initiativeData = new Map([['a', 15], ['c', null], ['d', 5]]); // 'b' missing, 'c' invalid
            // --- Set mock size return value BEFORE Act ---
            mockSizeFn.mockReturnValue(entities.length);

            // Act
            service.startNewRound(entities, strategy, initiativeData);

            // Assert

            // 1. Queue Instantiation
            expect(InitiativePriorityQueue).toHaveBeenCalledTimes(1);
            expect(mockQueueInstances.length).toBe(1);

            // 2. Entities Added with Correct/Defaulted Priorities
            expect(mockAddFn).toHaveBeenCalledTimes(entities.length);
            expect(mockAddFn).toHaveBeenCalledWith(entities[0], 15);
            expect(mockAddFn).toHaveBeenCalledWith(entities[1], 0);
            expect(mockAddFn).toHaveBeenCalledWith(entities[2], 0);
            expect(mockAddFn).toHaveBeenCalledWith(entities[3], 5);

            // 3. Logging - Warnings for missing/invalid scores
            expect(mockLogger.warn).toHaveBeenCalledTimes(2);
            expect(mockLogger.warn).toHaveBeenCalledWith('TurnOrderService.startNewRound (initiative): Entity "b" missing valid initiative score. Defaulting to 0.');
            expect(mockLogger.warn).toHaveBeenCalledWith('TurnOrderService.startNewRound (initiative): Entity "c" missing valid initiative score. Defaulting to 0.');

            // 5. Logging - Other logs (Check logs generated *during* startNewRound)
            expect(mockLogger.info).toHaveBeenCalledWith(`TurnOrderService: Starting new round with strategy "${strategy}".`);
            expect(mockLogger.info).toHaveBeenCalledWith('TurnOrderService: Current round state cleared.');
            expect(mockLogger.info).toHaveBeenCalledWith(`TurnOrderService: Populated InitiativePriorityQueue with ${entities.length} entities.`);
            expect(mockSizeFn).toHaveBeenCalled();
            expect(mockLogger.info).toHaveBeenCalledWith(`TurnOrderService: New round successfully started with ${entities.length} active entities.`);

            // Debug logs from startNewRound
            expect(mockLogger.debug).toHaveBeenCalledWith('TurnOrderService: Initialized InitiativePriorityQueue.');
            // Check *specific* calls during startNewRound BEFORE triggering more logs
            expect(mockLogger.debug).toHaveBeenCalledTimes(1); // <<< MOVED CHECK HERE

            // Check other startNewRound logs
            expect(mockLogger.error).not.toHaveBeenCalled();


            // 4. Internal Service State (Inferred via behavior - AFTER checking startNewRound logs)
            service.peekNextEntity();
            expect(mockPeekFn).toHaveBeenCalledTimes(1);
            // This call will generate an additional debug log
            service.addEntity({id: 'e'}, 20);
            expect(mockAddFn).toHaveBeenCalledTimes(entities.length + 1);
            expect(mockAddFn).toHaveBeenCalledWith({id: 'e'}, 20);
            // Verify the addEntity debug log happened if needed (optional)
            expect(mockLogger.debug).toHaveBeenCalledWith('TurnOrderService: Adding entity "e" with initiative 20 to the current round.');
            // Total debug calls are now 2
            expect(mockLogger.debug).toHaveBeenCalledTimes(2);
        });

        // Test Case: Invalid/Missing initiativeData map (No changes needed here)
        it("Test Case 11.3.3: should throw error if initiativeData is missing or invalid when strategy is 'initiative'", () => {
            // Arrange
            const strategy = 'initiative';
            const entities = [{id: 'a'}];

            // Act & Assert - Missing initiativeData
            expect(() => {
                service.startNewRound(entities, strategy); // No initiativeData provided
            }).toThrow('Valid initiativeData Map is required for the "initiative" strategy.');

            // Verify logs for missing data case
            expect(mockLogger.error).toHaveBeenCalledWith('TurnOrderService.startNewRound (initiative): Failed - initiativeData Map is required and must not be empty.');
            expect(mockLogger.info).toHaveBeenCalledWith(`TurnOrderService: Starting new round with strategy "${strategy}".`); // Called before validation
            expect(mockLogger.info).toHaveBeenCalledWith('TurnOrderService: Current round state cleared.'); // Called before validation
            expect(InitiativePriorityQueue).not.toHaveBeenCalled(); // Queue not instantiated


            // Arrange - Invalid initiativeData (not a Map)
            const invalidInitiativeData = [{id: 'a', score: 10}]; // Array instead of Map
            mockLogger.error.mockClear(); // Clear previous error log

            // Act & Assert - Invalid initiativeData type
            expect(() => {
                // @ts-ignore - Intentionally passing invalid type
                service.startNewRound(entities, strategy, invalidInitiativeData);
            }).toThrow('Valid initiativeData Map is required for the "initiative" strategy.');

            // Verify logs for invalid data type case
            expect(mockLogger.error).toHaveBeenCalledWith('TurnOrderService.startNewRound (initiative): Failed - initiativeData Map is required and must not be empty.');
            expect(InitiativePriorityQueue).not.toHaveBeenCalled();

            // Arrange - Empty initiativeData Map
            const emptyInitiativeData = new Map();
            mockLogger.error.mockClear(); // Clear previous error log

            // Act & Assert - Empty initiativeData Map
            expect(() => {
                service.startNewRound(entities, strategy, emptyInitiativeData);
            }).toThrow('Valid initiativeData Map is required for the "initiative" strategy.');

            // Verify logs for empty map case
            expect(mockLogger.error).toHaveBeenCalledWith('TurnOrderService.startNewRound (initiative): Failed - initiativeData Map is required and must not be empty.');
            expect(InitiativePriorityQueue).not.toHaveBeenCalled(); // Queue not instantiated

        });

        // Test Case: Verify clearCurrentRound effects before initiative round (No changes needed here - already passing)
        it("Test Case 11.3.4: should clear any existing queue before starting a new initiative round", () => {
            // --- First Round ---
            // Arrange: Start a first round
            const firstEntities = [{id: 'prev1'}];
            const firstStrategy = 'initiative';
            const firstData = new Map([['prev1', 5]]);
            // Set size mock for the FIRST round's final log
            mockSizeFn.mockReturnValue(firstEntities.length);
            // Act: Start first round
            service.startNewRound(firstEntities, firstStrategy, firstData);

            // Verify first round setup
            expect(InitiativePriorityQueue).toHaveBeenCalledTimes(1);
            expect(mockQueueInstances.length).toBe(1);
            expect(mockAddFn).toHaveBeenCalledTimes(firstEntities.length);
            expect(mockLogger.info).toHaveBeenCalledWith(`TurnOrderService: New round successfully started with ${firstEntities.length} active entities.`); // Check first round final log

            // Clear mock function call counts *manually* before the second Act phase
            mockAddFn.mockClear();
            mockClearFn.mockClear();
            mockPeekFn.mockClear();
            mockIsEmptyFn.mockClear();
            mockToArrayFn.mockClear();
            mockGetNextFn.mockClear();
            mockRemoveFn.mockClear();
            mockSizeFn.mockClear(); // Clear size call count too

            mockLogger.debug.mockClear();
            mockLogger.info.mockClear(); // Clear log history for focused assertion on second round logs

            // --- Second Round ---
            // Arrange for the second round
            const secondEntities = [{id: 'newA'}, {id: 'newB'}];
            const secondStrategy = 'initiative';
            const secondData = new Map([['newA', 20], ['newB', 10]]);
            // --- Set mock size return value for the SECOND round BEFORE Act ---
            mockSizeFn.mockReturnValue(secondEntities.length);

            // Act: Start the second round
            service.startNewRound(secondEntities, secondStrategy, secondData);

            // Assert

            // 1. Previous Queue Cleared
            expect(mockClearFn).toHaveBeenCalledTimes(1); // Check shared clear function call

            // 2. New Queue Instantiation
            expect(InitiativePriorityQueue).toHaveBeenCalledTimes(2); // Total constructor calls
            expect(mockQueueInstances.length).toBe(2);
            expect(mockQueueInstances[1]).not.toBe(mockQueueInstances[0]); // Different instance objects

            // 3. New Entities Added to New Queue
            expect(mockAddFn).toHaveBeenCalledTimes(secondEntities.length); // Check add calls since last clear
            expect(mockAddFn).toHaveBeenNthCalledWith(1, secondEntities[0], 20);
            expect(mockAddFn).toHaveBeenNthCalledWith(2, secondEntities[1], 10);

            // 4. Logging (Focus on logs for the *second* call since logger was cleared)
            expect(mockLogger.info).toHaveBeenCalledWith(`TurnOrderService: Starting new round with strategy "${secondStrategy}".`);
            expect(mockLogger.info).toHaveBeenCalledWith('TurnOrderService: Current round state cleared.');
            expect(mockLogger.info).toHaveBeenCalledWith(`TurnOrderService: Populated InitiativePriorityQueue with ${secondEntities.length} entities.`);
            // Check the final log for the second round
            expect(mockSizeFn).toHaveBeenCalled(); // Ensure size was called again
            expect(mockLogger.info).toHaveBeenCalledWith(`TurnOrderService: New round successfully started with ${secondEntities.length} active entities.`); // Should pass now


            // Debug logs for the *second* call
            expect(mockLogger.debug).toHaveBeenCalledWith('TurnOrderService: Cleared existing turn queue.');
            expect(mockLogger.debug).toHaveBeenCalledWith('TurnOrderService: Initialized InitiativePriorityQueue.');
            expect(mockLogger.debug).toHaveBeenCalledTimes(2);
        });

    }); // End describe("startNewRound ('initiative')")

}); // End describe('TurnOrderService')