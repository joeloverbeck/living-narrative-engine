// src/tests/core/turnOrder/turnOrderService.startNewRound.roundRobin.test.js

/**
 * @fileoverview Unit tests for the TurnOrderService class, focusing on the
 * startNewRound method with the 'round-robin' strategy.
 * Parent Ticket: TEST-TURN-ORDER-001.11
 * Ticket: TEST-TURN-ORDER-001.11.2
 */

import {describe, it, expect, beforeEach, jest} from '@jest/globals';
import {TurnOrderService} from '../../../src/turns/order/turnOrderService.js';
import {SimpleRoundRobinQueue} from '../../../src/turns/order/queues/simpleRoundRobinQueue.js'; // Import the actual class for mocking

// --- Mock Setup ---

// Mock the SimpleRoundRobinQueue module
jest.mock('../../../src/turns/order/queues/simpleRoundRobinQueue.js');

// Create persistent mock functions for queue methods *once*
const mockAdd = jest.fn();
const mockClear = jest.fn();
const mockPeek = jest.fn();
const mockIsEmpty = jest.fn();
const mockToArray = jest.fn();
const mockGetNext = jest.fn();
const mockRemove = jest.fn();
const mockSize = jest.fn();

// Mock ILogger interface
const createMockLogger = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
});

// Mock Entity type for testing
/** @typedef {{ id: string; name?: string; }} Entity */ // Simplified mock type


// --- Test Suite ---

describe('TurnOrderService', () => {
    /** @type {ReturnType<typeof createMockLogger>} */
    let mockLogger;
    /** @type {TurnOrderService} */
    let service;
    /** @type {Entity[]} */
    let entities;

    beforeEach(() => {
        // Clear all previous mock calls and instances before *each test*
        // This includes the persistent mocks and the constructor mock itself
        jest.clearAllMocks(); // Clears constructor mock calls/instances and all jest.fn() inside it IF RECREATED EACH TIME
        mockAdd.mockClear();
        mockClear.mockClear();
        mockPeek.mockClear();
        mockIsEmpty.mockClear().mockReturnValue(true); // Reset default mock behavior
        mockToArray.mockClear().mockReturnValue([]);   // Reset default mock behavior
        mockGetNext.mockClear();
        mockRemove.mockClear();
        mockSize.mockClear().mockReturnValue(0);    // Reset default mock behavior


        // Setup common mocks and instances
        mockLogger = createMockLogger();
        service = new TurnOrderService({logger: mockLogger});
        entities = [{id: 'a', name: 'Alice'}, {id: 'b', name: 'Bob'}];

        // Configure the mock implementation to return the *persistent* mocks
        // Now, every instance created will use the *same* underlying mock functions.
        SimpleRoundRobinQueue.mockImplementation(() => {
            return {
                add: mockAdd,
                clear: mockClear,
                peek: mockPeek,
                isEmpty: mockIsEmpty,
                toArray: mockToArray,
                getNext: mockGetNext,
                remove: mockRemove,
                size: mockSize, // Use the persistent mock size function
            };
        });
    });

    // --- Test Suite for startNewRound with 'round-robin' (TEST-TURN-ORDER-001.11.2) ---
    describe("startNewRound ('round-robin')", () => {

        // Test Case: Basic Round Robin Start
        it("Test Case 11.2.1: should correctly initialize a round-robin turn order", () => {
            // Arrange
            const strategy = 'round-robin';
            // `service` and `entities` are already arranged in beforeEach
            mockSize.mockReturnValue(entities.length); // Set size *after* adds for logging check

            // Act
            service.startNewRound(entities, strategy);

            // Assert

            // 1. Queue Instantiation and Type
            expect(SimpleRoundRobinQueue).toHaveBeenCalledTimes(1);
            expect(SimpleRoundRobinQueue).toHaveBeenCalledWith();
            // Get the instance created in *this test*
            expect(SimpleRoundRobinQueue.mock.instances.length).toBe(1);
            const mockQueueInstance = SimpleRoundRobinQueue.mock.instances[0]; // Instance created during Act phase

            // 2. Entities Added to Queue (Assert against the persistent mock)
            // <<< This assertion should now pass >>>
            expect(mockAdd).toHaveBeenCalledTimes(entities.length);
            expect(mockAdd).toHaveBeenNthCalledWith(1, entities[0]);
            expect(mockAdd).toHaveBeenNthCalledWith(2, entities[1]);
            // Ensure it wasn't called with extra arguments (priority)
            expect(mockAdd).not.toHaveBeenCalledWith(expect.anything(), expect.anything());

            // 3. Internal Service State (Inferred via behavior - check persistent mocks)
            service.peekNextEntity();
            expect(mockPeek).toHaveBeenCalledTimes(1);

            service.getCurrentOrder();
            expect(mockToArray).toHaveBeenCalledTimes(1);

            service.isEmpty();
            expect(mockIsEmpty).toHaveBeenCalledTimes(1);

            // Test addEntity AFTER startNewRound
            const newEntity = {id: 'c'};
            const expectedTotalAdds = entities.length + 1;
            mockSize.mockReturnValue(expectedTotalAdds); // Update size for logging check
            service.addEntity(newEntity);
            // <<< This assertion should now pass >>>
            expect(mockAdd).toHaveBeenCalledTimes(expectedTotalAdds);
            expect(mockAdd).toHaveBeenNthCalledWith(3, newEntity); // Check the 3rd call specifically

            // 4. Logging
            // Base logs (constructor is excluded as it's in beforeEach)
            expect(mockLogger.info).toHaveBeenCalledWith(`TurnOrderService: Starting new round with strategy "${strategy}".`);
            expect(mockLogger.info).toHaveBeenCalledWith('TurnOrderService: Current round state cleared.'); // From clearCurrentRound
            expect(mockLogger.info).toHaveBeenCalledWith(`TurnOrderService: Populated SimpleRoundRobinQueue with ${entities.length} entities.`); // From startNewRound
            expect(mockLogger.info).toHaveBeenCalledWith(`TurnOrderService: New round successfully started with ${entities.length} active entities.`); // From startNewRound (uses size())
            expect(mockLogger.info).toHaveBeenCalledWith(`TurnOrderService: Entity "${newEntity.id}" successfully added to the turn order.`); // From addEntity

            // Debug logs
            expect(mockLogger.debug).not.toHaveBeenCalledWith('TurnOrderService: Cleared existing turn queue.'); // Correct: No queue existed before this round's clearCurrentRound
            expect(mockLogger.debug).toHaveBeenCalledWith('TurnOrderService: Initialized SimpleRoundRobinQueue.'); // From startNewRound
            expect(mockLogger.debug).toHaveBeenCalledWith(`TurnOrderService: Adding entity "${newEntity.id}" to the end of the round-robin queue.`); // From addEntity
            expect(mockLogger.debug).toHaveBeenCalledTimes(2); // init + add

            expect(mockLogger.warn).not.toHaveBeenCalled();
            expect(mockLogger.error).not.toHaveBeenCalled();

            // Check size mock calls specifically
            expect(mockSize).toHaveBeenCalledTimes(1); // Only called once for the log in startNewRound
        });

        // Test Case: Verify clearCurrentRound effects
        it("Test Case 11.2.2: should clear any existing queue before starting a new round-robin round", () => {
            // Arrange: Start a first round to populate the queue
            const firstEntities = [{id: 'prev1'}, {id: 'prev2'}];
            const firstStrategy = 'round-robin';
            mockSize.mockReturnValue(firstEntities.length); // Set size for first round
            service.startNewRound(firstEntities, firstStrategy);

            // Verify initial state if needed (optional)
            expect(SimpleRoundRobinQueue).toHaveBeenCalledTimes(1);
            expect(mockAdd).toHaveBeenCalledTimes(firstEntities.length);
            expect(mockLogger.info).toHaveBeenCalledWith(`TurnOrderService: New round successfully started with ${firstEntities.length} active entities.`);
            // Retrieve the first instance if needed for clarity, although we'll assert on shared mocks
            const firstMockQueueInstance = SimpleRoundRobinQueue.mock.instances[0];

            // --- Clear mocks *between stages* of THIS test ---
            // We want to isolate assertions to the *second* startNewRound call.
            // Clear the *shared* mocks' call history.
            mockAdd.mockClear();
            mockClear.mockClear();
            mockPeek.mockClear();
            mockIsEmpty.mockClear().mockReturnValue(true); // Reset default mock behavior
            mockToArray.mockClear().mockReturnValue([]);   // Reset default mock behavior
            mockGetNext.mockClear();
            mockRemove.mockClear();
            mockSize.mockClear().mockReturnValue(0);    // Reset default mock behavior
            mockLogger.debug.mockClear();
            mockLogger.info.mockClear();
            mockLogger.warn.mockClear();
            mockLogger.error.mockClear();
            // DO NOT clear the constructor mock (SimpleRoundRobinQueue.mockClear()) here,
            // as we need to track the *second* instantiation.

            // Arrange for the second round
            const secondEntities = [{id: 'newA'}, {id: 'newB'}, {id: 'newC'}];
            const secondStrategy = 'round-robin';
            mockSize.mockReturnValue(secondEntities.length); // Set size for second round logging check

            // Act: Start the second round
            service.startNewRound(secondEntities, secondStrategy);

            // Assert

            // 1. Previous Queue Cleared (Assert against the persistent mock)
            // clearCurrentRound is called at the start of startNewRound
            // <<< This assertion should now pass >>>
            expect(mockClear).toHaveBeenCalledTimes(1);

            // 2. New Queue Instantiation
            expect(SimpleRoundRobinQueue).toHaveBeenCalledTimes(2); // Constructor called once in first Arrange, once in second Act
            expect(SimpleRoundRobinQueue.mock.instances.length).toBe(2); // Total instances created overall
            const secondMockQueueInstance = SimpleRoundRobinQueue.mock.instances[1]; // Get the second instance
            expect(secondMockQueueInstance).not.toBe(firstMockQueueInstance); // Ensure it's a different instance object

            // 3. New Entities Added to New Queue (Assert against the persistent mock)
            // <<< This assertion should now pass >>>
            expect(mockAdd).toHaveBeenCalledTimes(secondEntities.length);
            expect(mockAdd).toHaveBeenNthCalledWith(1, secondEntities[0]);
            expect(mockAdd).toHaveBeenNthCalledWith(2, secondEntities[1]);
            expect(mockAdd).toHaveBeenNthCalledWith(3, secondEntities[2]);

            // 4. Logging (Focus on logs for the *second* call)
            expect(mockLogger.info).toHaveBeenCalledWith(`TurnOrderService: Starting new round with strategy "${secondStrategy}".`);
            expect(mockLogger.info).toHaveBeenCalledWith('TurnOrderService: Current round state cleared.'); // Logged by clearCurrentRound during *second* call
            expect(mockLogger.info).toHaveBeenCalledWith(`TurnOrderService: Populated SimpleRoundRobinQueue with ${secondEntities.length} entities.`);
            expect(mockLogger.info).toHaveBeenCalledWith(`TurnOrderService: New round successfully started with ${secondEntities.length} active entities.`); // Uses size()
            expect(mockLogger.info).toHaveBeenCalledTimes(4); // Make sure no other info logs fired

            // Debug logs for the *second* call
            // This clear log *should* have fired because #currentQueue was not null before clearCurrentRound was called
            expect(mockLogger.debug).toHaveBeenCalledWith('TurnOrderService: Cleared existing turn queue.');
            expect(mockLogger.debug).toHaveBeenCalledWith('TurnOrderService: Initialized SimpleRoundRobinQueue.');
            expect(mockLogger.debug).toHaveBeenCalledTimes(2); // Both debug logs expected this time

            // Check size mock calls specifically for the second phase
            expect(mockSize).toHaveBeenCalledTimes(1); // Only for the final log in the second startNewRound
        });

        // --- Other Test Cases (Should be unaffected or potentially benefit from clearer mocking) ---

        // Test Case: Empty Entities Array (should throw error handled by startNewRound)
        it("Test Case 11.2.3: should throw error if entities array is empty", () => {
            // Arrange
            const strategy = 'round-robin';
            const emptyEntities = [];

            // Act & Assert
            expect(() => {
                service.startNewRound(emptyEntities, strategy);
            }).toThrow('Entities array must be provided and non-empty.');

            // Verify no queue was instantiated or populated
            expect(SimpleRoundRobinQueue).not.toHaveBeenCalled();
            expect(mockAdd).not.toHaveBeenCalled(); // Check persistent mock

            // Verify logs
            expect(mockLogger.error).toHaveBeenCalledTimes(1);
            expect(mockLogger.error).toHaveBeenCalledWith('TurnOrderService.startNewRound: Failed - entities array must be a non-empty array.');
            // Check logs from clearCurrentRound (called before error)
            expect(mockLogger.info).toHaveBeenCalledWith(`TurnOrderService: Starting new round with strategy "${strategy}".`);
            expect(mockLogger.info).toHaveBeenCalledWith('TurnOrderService: Current round state cleared.');
            // Check population/init logs were not called
            expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Populated SimpleRoundRobinQueue'));
            expect(mockLogger.debug).not.toHaveBeenCalledWith('TurnOrderService: Initialized SimpleRoundRobinQueue.');
            // Verify the specific debug log for clearing an *existing* queue was NOT called, as none existed.
            expect(mockLogger.debug).not.toHaveBeenCalledWith('TurnOrderService: Cleared existing turn queue.');
        });

        // Test Case: Invalid Entities Array (should throw error handled by startNewRound)
        it("Test Case 11.2.4: should throw error if entities array contains invalid entries", () => {
            // Arrange
            const strategy = 'round-robin';
            // @ts-ignore - Intentionally creating invalid data for testing
            const invalidEntities = [{id: 'a'}, {name: 'no id'}, {id: 'c'}];

            // Act & Assert
            expect(() => {
                service.startNewRound(invalidEntities, strategy);
            }).toThrow('Entities array contains invalid entities.');

            // Verify no queue was instantiated or populated
            expect(SimpleRoundRobinQueue).not.toHaveBeenCalled();
            expect(mockAdd).not.toHaveBeenCalled(); // Check persistent mock

            // Verify logs
            expect(mockLogger.error).toHaveBeenCalledTimes(1);
            expect(mockLogger.error).toHaveBeenCalledWith('TurnOrderService.startNewRound: Failed - entities array contains invalid entities (missing or invalid id).');
            // Check logs from clearCurrentRound (called before error)
            expect(mockLogger.info).toHaveBeenCalledWith(`TurnOrderService: Starting new round with strategy "${strategy}".`);
            expect(mockLogger.info).toHaveBeenCalledWith('TurnOrderService: Current round state cleared.');
            // Check population/init logs were not called
            expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Populated SimpleRoundRobinQueue'));
            expect(mockLogger.debug).not.toHaveBeenCalledWith('TurnOrderService: Initialized SimpleRoundRobinQueue.');
            // Verify the specific debug log for clearing an *existing* queue was NOT called, as none existed.
            expect(mockLogger.debug).not.toHaveBeenCalledWith('TurnOrderService: Cleared existing turn queue.');
        });


    }); // End describe("startNewRound ('round-robin')")

}); // End describe('TurnOrderService')