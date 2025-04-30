// src/tests/core/turnOrder/turnOrderService.removeEntity.test.js

/**
 * @fileoverview Unit tests for the TurnOrderService class, focusing on the
 * removeEntity method during an active round.
 * Parent Ticket: TEST-TURN-ORDER-001.11
 * Ticket ID: TEST-TURN-ORDER-001.11.11
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
    /** @type {Entity[]} */
    let entitiesRR;
    /** @type {Entity[]} */
    let entitiesInit;
    /** @type {Map<string, number>} */
    let initiativeData;
    let mockSimpleQueueInstance;
    let mockInitiativeQueueInstance;

    beforeEach(() => {
        jest.clearAllMocks(); // Clear all mocks before each test

        mockLogger = createMockLogger();
        service = new TurnOrderService({logger: mockLogger}); // Constructor logs once

        entitiesRR = [{id: 'rrA'}, {id: 'rrB'}, {id: 'rrC'}];
        entitiesInit = [{id: 'initA'}, {id: 'initB'}, {id: 'initC'}];
        initiativeData = new Map([['initA', 10], ['initB', 20], ['initC', 5]]);

        // Reset mock implementations for queues
        SimpleRoundRobinQueue.mockImplementation(() => {
            mockSimpleQueueInstance = {
                add: jest.fn(),
                clear: jest.fn(),
                remove: jest.fn(), // Default mock, will be overridden in tests
                getNext: jest.fn(),
                peek: jest.fn(),
                isEmpty: jest.fn().mockReturnValue(false), // Assume not empty after init
                size: jest.fn().mockReturnValue(entitiesRR.length),
                toArray: jest.fn().mockReturnValue(entitiesRR),
            };
            return mockSimpleQueueInstance;
        });

        InitiativePriorityQueue.mockImplementation(() => {
            mockInitiativeQueueInstance = {
                add: jest.fn(),
                clear: jest.fn(),
                remove: jest.fn(), // Default mock, will be overridden in tests
                getNext: jest.fn(),
                peek: jest.fn(),
                isEmpty: jest.fn().mockReturnValue(false),
                size: jest.fn().mockReturnValue(entitiesInit.length),
                toArray: jest.fn().mockReturnValue(entitiesInit),
            };
            return mockInitiativeQueueInstance;
        });
    });

    // --- Test Suite for removeEntity (TEST-TURN-ORDER-001.11.11) ---
    describe('removeEntity (Active Round)', () => {

        // Test Case: Round Robin - Found
        it('Test Case 11.11.1: should call remove on the Round Robin queue and log success if entity is found', () => {
            // Arrange
            service.startNewRound(entitiesRR, 'round-robin');
            const entityIdToRemove = 'rrB';
            const removedEntity = {id: entityIdToRemove};
            mockSimpleQueueInstance.remove.mockReturnValue(removedEntity); // Configure mock return
            mockLogger.info.mockClear(); // Clear logs after setup
            mockLogger.warn.mockClear();
            mockLogger.debug.mockClear();

            // Act
            service.removeEntity(entityIdToRemove);

            // Assert
            // 1. Queue Interaction
            expect(mockSimpleQueueInstance.remove).toHaveBeenCalledTimes(1);
            expect(mockSimpleQueueInstance.remove).toHaveBeenCalledWith(entityIdToRemove);

            // 2. Logging
            expect(mockLogger.info).toHaveBeenCalledTimes(1);
            expect(mockLogger.info).toHaveBeenCalledWith(
                `TurnOrderService: Entity "${entityIdToRemove}" processed for removal (actual removal may be lazy depending on queue type).`
            );
            expect(mockLogger.warn).not.toHaveBeenCalled();
            expect(mockLogger.debug).toHaveBeenCalledTimes(1);
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `TurnOrderService: Attempting to remove entity "${entityIdToRemove}" from the turn order.`
            );
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        // Test Case: Round Robin - Not Found
        it('Test Case 11.11.2: should call remove on the Round Robin queue and log warning if entity is not found', () => {
            // Arrange
            service.startNewRound(entitiesRR, 'round-robin');
            const entityIdToRemove = 'missingRR';
            mockSimpleQueueInstance.remove.mockReturnValue(null); // Configure mock return
            mockLogger.info.mockClear(); // Clear logs after setup
            mockLogger.warn.mockClear();
            mockLogger.debug.mockClear();

            // Act
            service.removeEntity(entityIdToRemove);

            // Assert
            // 1. Queue Interaction
            expect(mockSimpleQueueInstance.remove).toHaveBeenCalledTimes(1);
            expect(mockSimpleQueueInstance.remove).toHaveBeenCalledWith(entityIdToRemove);

            // 2. Logging
            expect(mockLogger.warn).toHaveBeenCalledTimes(1);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `TurnOrderService.removeEntity: Entity "${entityIdToRemove}" not found in the current turn order queue.`
            );
            // The specific "processed for removal" info log should NOT be called when remove returns null for RR
            expect(mockLogger.info).not.toHaveBeenCalledWith(
                expect.stringContaining('processed for removal')
            );
            expect(mockLogger.debug).toHaveBeenCalledTimes(1);
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `TurnOrderService: Attempting to remove entity "${entityIdToRemove}" from the turn order.`
            );
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        // Test Case: Initiative - Found (Lazy Removal)
        it('Test Case 11.11.3: should call remove on the Initiative queue and log success (despite null return) due to lazy removal', () => {
            // Arrange
            service.startNewRound(entitiesInit, 'initiative', initiativeData);
            const entityIdToRemove = 'initA';
            // InitiativeQueue's remove returns null for lazy strategy
            mockInitiativeQueueInstance.remove.mockReturnValue(null);
            mockLogger.info.mockClear(); // Clear logs after setup
            mockLogger.warn.mockClear();
            mockLogger.debug.mockClear();

            // Act
            service.removeEntity(entityIdToRemove);

            // Assert
            // 1. Queue Interaction
            expect(mockInitiativeQueueInstance.remove).toHaveBeenCalledTimes(1);
            expect(mockInitiativeQueueInstance.remove).toHaveBeenCalledWith(entityIdToRemove);

            // 2. Logging
            // Info log IS expected, because the service logs the attempt
            expect(mockLogger.info).toHaveBeenCalledTimes(1);
            expect(mockLogger.info).toHaveBeenCalledWith(
                `TurnOrderService: Entity "${entityIdToRemove}" processed for removal (actual removal may be lazy depending on queue type).`
            );
            // Warn log for "not found" is NOT expected, because null IS expected from initiative queue remove
            expect(mockLogger.warn).not.toHaveBeenCalledWith(
                expect.stringContaining('not found in the current turn order queue')
            );
            expect(mockLogger.debug).toHaveBeenCalledTimes(1);
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `TurnOrderService: Attempting to remove entity "${entityIdToRemove}" from the turn order.`
            );
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        // Test Case: No Active Round
        it('Test Case 11.11.4: should log a warning and take no action if called when no round is active', () => {
            // Arrange
            const entityIdToRemove = 'anyId';
            mockLogger.warn.mockClear(); // Clear logs after setup
            mockLogger.info.mockClear();
            mockLogger.debug.mockClear();

            // Act
            service.removeEntity(entityIdToRemove);

            // Assert
            // 1. Queue Interaction (Should not happen)
            // Need to access the mock prototypes or check if constructor was called
            expect(SimpleRoundRobinQueue).not.toHaveBeenCalled();
            expect(InitiativePriorityQueue).not.toHaveBeenCalled();
            // More directly, check if any remove method was called (it shouldn't exist yet)
            // This requires checking if the mocks were instantiated and *then* if remove was called,
            // but since no round was started, the internal #currentQueue is null.

            // 2. Logging
            expect(mockLogger.warn).toHaveBeenCalledTimes(1);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `TurnOrderService.removeEntity: Called for entity "${entityIdToRemove}" when no round is active. No action taken.`
            );
            expect(mockLogger.info).not.toHaveBeenCalled(); // No info log expected
            expect(mockLogger.debug).not.toHaveBeenCalled(); // No debug log expected
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        // Test Case: Invalid Entity ID
        it('Test Case 11.11.5: should throw an error and log if entityId is invalid', () => {
            // Arrange
            service.startNewRound(entitiesRR, 'round-robin'); // Start any round
            const invalidIds = ['', null, undefined, 123];
            const expectedErrorMsg = 'Invalid entityId provided for removal.';
            const expectedLogMsg = 'TurnOrderService.removeEntity: Failed - Invalid entityId provided.';
            mockLogger.info.mockClear(); // Clear logs after setup
            mockLogger.warn.mockClear();
            mockLogger.debug.mockClear();
            mockLogger.error.mockClear();


            invalidIds.forEach(invalidId => {
                // Act & Assert
                expect(() => {
                    // @ts-ignore - Intentionally passing invalid types
                    service.removeEntity(invalidId);
                }).toThrow(expectedErrorMsg);

                // Assert Logging
                expect(mockLogger.error).toHaveBeenCalledTimes(1);
                expect(mockLogger.error).toHaveBeenCalledWith(expectedLogMsg);
                // Should not attempt to call queue's remove or log debug/info/warn
                expect(mockSimpleQueueInstance.remove).not.toHaveBeenCalled();
                expect(mockLogger.debug).not.toHaveBeenCalled();
                expect(mockLogger.info).not.toHaveBeenCalled();
                expect(mockLogger.warn).not.toHaveBeenCalled();

                // Clear for next iteration
                mockLogger.error.mockClear();
            });
        });

        // Test Case: Queue remove method throws an error
        it('Test Case 11.11.6: should log the error and re-throw if the underlying queue remove method throws', () => {
            // Arrange
            service.startNewRound(entitiesRR, 'round-robin');
            const entityIdToRemove = 'rrA';
            const queueError = new Error('Queue failed to remove!');
            mockSimpleQueueInstance.remove.mockImplementation(() => {
                throw queueError;
            });
            mockLogger.info.mockClear(); // Clear logs after setup
            mockLogger.warn.mockClear();
            mockLogger.debug.mockClear();
            mockLogger.error.mockClear();

            // Act & Assert
            expect(() => {
                service.removeEntity(entityIdToRemove);
            }).toThrow(queueError); // Should re-throw the original error

            // Assert Logging
            expect(mockLogger.error).toHaveBeenCalledTimes(1);
            expect(mockLogger.error).toHaveBeenCalledWith(
                `TurnOrderService.removeEntity: Error while trying to remove entity "${entityIdToRemove}": ${queueError.message}`,
                queueError // Check that the original error object is passed for context
            );
            expect(mockSimpleQueueInstance.remove).toHaveBeenCalledTimes(1); // Verify it was called
            expect(mockLogger.debug).toHaveBeenCalledTimes(1); // Debug log for attempt should still happen
            expect(mockLogger.info).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });


    }); // End describe('removeEntity (Active Round)')

}); // End describe('TurnOrderService')