// src/tests/core/turnOrder/turnOrderService.addEntity.roundRobin.test.js

/**
 * @fileoverview Unit tests for the TurnOrderService class, focusing on the
 * addEntity method when a 'round-robin' round is active.
 * Parent Ticket: TEST-TURN-ORDER-001.11
 * Ticket: TEST-TURN-ORDER-001.11.9
 */

import {describe, it, expect, beforeEach, jest} from '@jest/globals';
import {TurnOrderService} from '../../../core/turns/order/turnOrderService.js';
import {SimpleRoundRobinQueue} from '../../../core/turns/order/queues/simpleRoundRobinQueue.js'; // Import the actual class for mocking

// Mock the SimpleRoundRobinQueue module
jest.mock('../../../core/turns/order/queues/simpleRoundRobinQueue.js');

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
    /** @type {Entity[]} */
    let initialEntities;
    /** @type {jest.Mocked<InstanceType<typeof SimpleRoundRobinQueue>>>} */
    let mockSimpleQueueInstance; // To hold the mock queue instance

    beforeEach(() => {
        // Clear all previous mock calls and instances before each test
        jest.clearAllMocks();

        // Setup common mocks and instances
        mockLogger = createMockLogger();
        service = new TurnOrderService({logger: mockLogger});
        initialEntities = [{id: 'a', name: 'Alice'}, {id: 'b', name: 'Bob'}];

        // Reset the mock implementation for SimpleRoundRobinQueue before each test
        SimpleRoundRobinQueue.mockImplementation(() => {
            const instance = {
                add: jest.fn(),
                clear: jest.fn(),
                peek: jest.fn(),
                isEmpty: jest.fn().mockReturnValue(true),
                toArray: jest.fn().mockReturnValue([]),
                getNext: jest.fn(),
                remove: jest.fn(),
                size: jest.fn().mockReturnValue(0),
                // Cast to the mocked type to satisfy TypeScript/JSDoc if needed
                // This step might not be strictly necessary in plain JS but helps with clarity
            };
            // Store the instance for later access in tests
            mockSimpleQueueInstance = instance;
            return instance;
        });
    });

    // --- Test Suite for addEntity with active 'round-robin' (TEST-TURN-ORDER-001.11.9) ---
    describe("addEntity ('round-robin' active)", () => {

        // Test Case: Add Entity Mid-Round
        it("Test Case 11.9.1: should delegate adding an entity to SimpleRoundRobinQueue when a round-robin round is active", () => {
            // Arrange: Start a round-robin round
            const strategy = 'round-robin';
            service.startNewRound(initialEntities, strategy);

            // Verify setup: Queue should have been instantiated and populated
            expect(SimpleRoundRobinQueue).toHaveBeenCalledTimes(1);
            expect(mockSimpleQueueInstance).toBeDefined();
            // Important: Need to use the captured mock instance directly
            expect(mockSimpleQueueInstance.add).toHaveBeenCalledTimes(initialEntities.length);
            expect(mockSimpleQueueInstance.add).toHaveBeenNthCalledWith(1, initialEntities[0]);
            expect(mockSimpleQueueInstance.add).toHaveBeenNthCalledWith(2, initialEntities[1]);

            // Clear mocks *after* setup to isolate the addEntity call
            mockSimpleQueueInstance.add.mockClear();
            mockLogger.debug.mockClear();
            mockLogger.info.mockClear();

            const entityToAdd = {id: 'new', name: 'Charlie'};

            // Act: Add the new entity mid-round
            service.addEntity(entityToAdd); // Initiative value ignored for round-robin

            // Assert: Delegation to Queue
            expect(mockSimpleQueueInstance.add).toHaveBeenCalledTimes(1);
            expect(mockSimpleQueueInstance.add).toHaveBeenCalledWith(entityToAdd);
            // SimpleRoundRobinQueue's add method only takes one argument (entity)
            expect(mockSimpleQueueInstance.add).not.toHaveBeenCalledWith(expect.anything(), expect.anything());

            // Assert: Logging
            expect(mockLogger.debug).toHaveBeenCalledTimes(1);
            expect(mockLogger.debug).toHaveBeenCalledWith(`TurnOrderService: Adding entity "${entityToAdd.id}" to the end of the round-robin queue.`);

            expect(mockLogger.info).toHaveBeenCalledTimes(1);
            expect(mockLogger.info).toHaveBeenCalledWith(`TurnOrderService: Entity "${entityToAdd.id}" successfully added to the turn order.`);

            expect(mockLogger.warn).not.toHaveBeenCalled();
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        // Acceptance Criteria Verification:
        it("Acceptance Criteria: addEntity calls add(entity) on the mock SimpleRoundRobinQueue", () => {
            // Arrange
            service.startNewRound(initialEntities, 'round-robin');
            const entityToAdd = {id: 'new'};
            mockSimpleQueueInstance.add.mockClear(); // Clear calls from startNewRound

            // Act
            service.addEntity(entityToAdd);

            // Assert
            expect(mockSimpleQueueInstance.add).toHaveBeenCalledWith(entityToAdd);
            expect(mockSimpleQueueInstance.add).toHaveBeenCalledTimes(1);
        });

        it("Acceptance Criteria: Correct logs are generated", () => {
            // Arrange
            service.startNewRound(initialEntities, 'round-robin');
            const entityToAdd = {id: 'new'};
            mockLogger.debug.mockClear();
            mockLogger.info.mockClear();

            // Act
            service.addEntity(entityToAdd);

            // Assert
            expect(mockLogger.debug).toHaveBeenCalledWith(`TurnOrderService: Adding entity "${entityToAdd.id}" to the end of the round-robin queue.`);
            expect(mockLogger.info).toHaveBeenCalledWith(`TurnOrderService: Entity "${entityToAdd.id}" successfully added to the turn order.`);
        });


    }); // End describe("addEntity ('round-robin' active)")

}); // End describe('TurnOrderService')