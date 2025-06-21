// src/tests/turns/order/turnOrderService.addRemoveEntity.errors.activeRound.test.js

/**
 * @file Unit tests for the TurnOrderService class, focusing on the
 * error handling within the addEntity and removeEntity methods when a round
 * is active and invalid parameters are provided.
 * Parent Ticket: TEST-TURN-ORDER-001.11
 * Ticket ID: TEST-TURN-ORDER-001.11.14
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TurnOrderService } from '../../../../src/turns/order/turnOrderService.js';
import { SimpleRoundRobinQueue } from '../../../../src/turns/order/queues/simpleRoundRobinQueue.js';
import { InitiativePriorityQueue } from '../../../../src/turns/order/queues/initiativePriorityQueue.js';

// Mock the Queue modules completely
jest.mock('../../../../src/turns/order/queues/simpleRoundRobinQueue.js');
jest.mock('../../../../src/turns/order/queues/initiativePriorityQueue.js');

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
  /** @type {jest.Mocked<SimpleRoundRobinQueue | InitiativePriorityQueue>} */
  let mockQueueInstance;

  // Setup function to start a round with a chosen strategy
  const setupActiveRound = (strategy = 'round-robin') => {
    const initialEntities = [{ id: 'p1', name: 'Player 1' }];
    const initiativeData =
      strategy === 'initiative' ? new Map([['p1', 10]]) : undefined;

    // Define the mock queue instance with necessary mocked methods
    mockQueueInstance = {
      add: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn(),
      getNext: jest.fn(),
      peek: jest.fn(),
      isEmpty: jest.fn().mockReturnValue(false),
      size: jest.fn().mockReturnValue(initialEntities.length),
      toArray: jest.fn().mockReturnValue([...initialEntities]), // Return a copy
    };

    // Configure the appropriate mock constructor to return our instance
    if (strategy === 'initiative') {
      InitiativePriorityQueue.mockImplementation(() => mockQueueInstance);
      SimpleRoundRobinQueue.mockImplementation(() => {
        throw new Error(
          'Should not call SimpleRoundRobinQueue constructor in initiative test'
        );
      });
    } else {
      SimpleRoundRobinQueue.mockImplementation(() => mockQueueInstance);
      InitiativePriorityQueue.mockImplementation(() => {
        throw new Error(
          'Should not call InitiativePriorityQueue constructor in round-robin test'
        );
      });
    }

    service = new TurnOrderService({ logger: mockLogger });
    service.startNewRound(initialEntities, strategy, initiativeData);

    // Clear mocks used during setup to isolate test actions
    jest.clearAllMocks(); // Clears constructor calls too
    // Re-apply mock logger to the service instance as jest.clearAllMocks resets service's reference
    service['_TurnOrderService_logger'] = mockLogger; // Access private field for re-assignment post clearAllMocks if needed (adjust based on actual transpiled name or use a setter if available)
    // Alternatively, re-instantiate service here if needed, but clearing calls should be sufficient if logger object reference is stable.

    // Manually clear calls on the specific instance methods and logger if needed after clearAllMocks,
    // though clearAllMocks should handle it. Let's be explicit for clarity:
    Object.values(mockQueueInstance).forEach((mockFn) => {
      if (jest.isMockFunction(mockFn)) {
        mockFn.mockClear();
      }
    });
    Object.values(mockLogger).forEach((mockFn) => mockFn.mockClear());
  };

  // Run tests for both strategies
  ['round-robin', 'initiative'].forEach((strategy) => {
    describe(`addEntity/removeEntity (Error Handling - Active ${strategy} Round)`, () => {
      beforeEach(() => {
        // Reset global mocks before each test suite run
        jest.clearAllMocks();
        mockLogger = createMockLogger();
        // Setup the active round using the current strategy
        setupActiveRound(strategy);
      });

      // --- Test Case: addEntity with Invalid Entity ---
      it(`Test Case 11.14.1 [${strategy}]: should throw error and log if adding an invalid entity when round is active`, () => {
        const invalidInputs = [
          null,
          undefined,
          { name: 'no id object' },
          { id: '' }, // Empty string id
          { id: 123 }, // Non-string id
        ];
        const expectedErrorMsg = 'Cannot add invalid entity.';
        const expectedLogMsg =
          'TurnOrderService.addEntity: Failed - Cannot add invalid entity (missing or invalid id).';

        invalidInputs.forEach((invalidEntity) => {
          // Arrange
          mockLogger.error.mockClear(); // Clear error log for this iteration
          mockQueueInstance.add.mockClear(); // Clear queue add calls for this iteration

          // Act & Assert Error
          expect(() => {
            // @ts-ignore - Intentionally passing invalid types
            service.addEntity(invalidEntity);
          }).toThrow(expectedErrorMsg);

          // Assert Logging
          expect(mockLogger.error).toHaveBeenCalledTimes(1);
          expect(mockLogger.error).toHaveBeenCalledWith(expectedLogMsg);

          // Assert Queue Interaction
          expect(mockQueueInstance.add).not.toHaveBeenCalled();

          // Assert state hasn't changed unexpectedly (optional check)
          expect(mockQueueInstance.size()).toBe(1); // Size should remain as set in setup
        });
      });

      // --- Test Case: removeEntity with Invalid ID ---
      it(`Test Case 11.14.2 [${strategy}]: should throw error and log if removing an entity with an invalid ID when round is active`, () => {
        const invalidIds = [
          null,
          undefined,
          '', // Empty string
          123, // Non-string
          true, // Boolean
          {}, // Object
        ];
        const expectedErrorMsg = 'Invalid entityId format.';
        const expectedLogMsg =
          'TurnOrderService.removeEntity: Failed - Invalid entityId format.';

        invalidIds.forEach((invalidId) => {
          // Arrange
          mockLogger.error.mockClear(); // Clear error log for this iteration
          mockQueueInstance.remove.mockClear(); // Clear queue remove calls for this iteration

          // Act & Assert Error
          expect(() => {
            // @ts-ignore - Intentionally passing invalid types
            service.removeEntity(invalidId);
          }).toThrow(expectedErrorMsg);

          // Assert Logging
          expect(mockLogger.error).toHaveBeenCalledTimes(1);
          expect(mockLogger.error).toHaveBeenCalledWith(expectedLogMsg);

          // Assert Queue Interaction
          expect(mockQueueInstance.remove).not.toHaveBeenCalled();

          // Assert state hasn't changed unexpectedly (optional check)
          expect(mockQueueInstance.size()).toBe(1); // Size should remain as set in setup
        });
      });
    }); // End describe for strategy
  }); // End forEach strategy
}); // End describe('TurnOrderService')
