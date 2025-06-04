// src/tests/core/turnOrder/turnOrderService.isEmpty.activeRound.test.js

/**
 * @file Unit tests for the TurnOrderService class, specifically
 * testing the isEmpty method when a round is active.
 * Parent Ticket: TEST-TURN-ORDER-001.11
 * Ticket ID: TEST-TURN-ORDER-001.11.7
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TurnOrderService } from '../../../src/turns/order/turnOrderService.js';
import { SimpleRoundRobinQueue } from '../../../src/turns/order/queues/simpleRoundRobinQueue.js';
import { InitiativePriorityQueue } from '../../../src/turns/order/queues/initiativePriorityQueue.js';

// Mock the Queue modules
jest.mock('../../../src/turns/order/queues/simpleRoundRobinQueue.js');
jest.mock('../../../src/turns/order/queues/initiativePriorityQueue.js');

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
  /** @type {jest.Mocked<InstanceType<typeof SimpleRoundRobinQueue>>} */
  let mockSimpleQueueInstance;
  /** @type {jest.Mocked<InstanceType<typeof InitiativePriorityQueue>>} */
  let mockInitiativeQueueInstance;

  beforeEach(() => {
    jest.clearAllMocks(); // Clear all mocks before each test

    mockLogger = createMockLogger();
    service = new TurnOrderService({ logger: mockLogger });
    entities = [{ id: 'hero1' }, { id: 'monster1' }];
    initiativeData = new Map([
      ['hero1', 20],
      ['monster1', 10],
    ]);

    // Configure the mock implementations to return instances with mock methods
    // We need to store the instance to check calls *on that instance*.
    SimpleRoundRobinQueue.mockImplementation(() => {
      mockSimpleQueueInstance = {
        add: jest.fn(),
        clear: jest.fn(),
        isEmpty: jest.fn(), // Core mock for this test suite
        peek: jest.fn(),
        getNext: jest.fn(),
        remove: jest.fn(),
        size: jest.fn().mockReturnValue(entities.length), // Assume size reflects added entities for setup
        toArray: jest.fn().mockReturnValue(entities), // Assume toArray reflects added entities
      };
      // Ensure the mock function returns the created mock instance
      // Type assertion needed as mockImplementation signature is broad
      return /** @type {import('../../../src/turns/order/queues/simpleRoundRobinQueue.js').SimpleRoundRobinQueue} */ (
        mockSimpleQueueInstance
      );
    });

    InitiativePriorityQueue.mockImplementation(() => {
      mockInitiativeQueueInstance = {
        add: jest.fn(),
        clear: jest.fn(),
        isEmpty: jest.fn(), // Core mock for this test suite
        peek: jest.fn(),
        getNext: jest.fn(),
        remove: jest.fn(), // Returns null in actual implementation
        size: jest.fn().mockReturnValue(entities.length), // Assume size reflects added entities for setup
        toArray: jest.fn().mockReturnValue(entities), // Assume toArray reflects added entities
      };
      // Ensure the mock function returns the created mock instance
      // Type assertion needed as mockImplementation signature is broad
      return /** @type {import('../../../src/turns/order/queues/initiativePriorityQueue.js').InitiativePriorityQueue} */ (
        mockInitiativeQueueInstance
      );
    });
  });

  // --- Test Suite for isEmpty (Active Round) ---
  describe('isEmpty (Active Round) [TEST-TURN-ORDER-001.11.7]', () => {
    // Test Case: Delegate to Round Robin Queue (Not Empty)
    it('Test Case 11.7.1: should delegate to Round Robin Queue isEmpty and return false when not empty', () => {
      // Arrange
      const strategy = 'round-robin';
      service.startNewRound(entities, strategy); // This creates mockSimpleQueueInstance

      // Ensure the instance was created and configure its isEmpty mock
      expect(mockSimpleQueueInstance).toBeDefined();
      mockSimpleQueueInstance.isEmpty.mockReturnValue(false);

      // Pre-assertion: Ensure the mock hasn't been called yet
      expect(mockSimpleQueueInstance.isEmpty).not.toHaveBeenCalled();

      // Act
      const result = service.isEmpty();

      // Assert
      // 1. Delegation: isEmpty on the correct mock queue instance was called
      expect(mockSimpleQueueInstance.isEmpty).toHaveBeenCalledTimes(1);
      // Ensure the *other* queue's mock was not called
      expect(InitiativePriorityQueue.mock.instances).toHaveLength(0);

      // 2. Return Value: The service returns the value from the mock queue
      expect(result).toBe(false);

      // 3. Logging (Optional but good practice): No specific logs for isEmpty itself
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('isEmpty')
      );
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('isEmpty')
      );
      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    // Test Case: Delegate to Initiative Queue (Empty)
    it('Test Case 11.7.2: should delegate to Initiative Queue isEmpty and return true when empty', () => {
      // Arrange
      const strategy = 'initiative';
      service.startNewRound(entities, strategy, initiativeData); // This creates mockInitiativeQueueInstance

      // Ensure the instance was created and configure its isEmpty mock
      expect(mockInitiativeQueueInstance).toBeDefined();
      mockInitiativeQueueInstance.isEmpty.mockReturnValue(true);

      // Pre-assertion: Ensure the mock hasn't been called yet
      expect(mockInitiativeQueueInstance.isEmpty).not.toHaveBeenCalled();

      // Act
      const result = service.isEmpty();

      // Assert
      // 1. Delegation: isEmpty on the correct mock queue instance was called
      expect(mockInitiativeQueueInstance.isEmpty).toHaveBeenCalledTimes(1);
      // Ensure the *other* queue's mock was not called
      expect(SimpleRoundRobinQueue.mock.instances).toHaveLength(0);

      // 2. Return Value: The service returns the value from the mock queue
      expect(result).toBe(true);

      // 3. Logging (Optional): No specific logs for isEmpty itself
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('isEmpty')
      );
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('isEmpty')
      );
      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    // Test Case: Ensure correct queue is called after changing rounds
    it('Test Case 11.7.3: should delegate to the currently active queue isEmpty after switching strategies', () => {
      // Arrange: Start RR round
      const rrStrategy = 'round-robin';
      service.startNewRound(entities, rrStrategy);
      const firstQueueInstance = mockSimpleQueueInstance; // Capture the first instance
      expect(firstQueueInstance).toBeDefined();
      firstQueueInstance.isEmpty.mockReturnValue(false);

      // Act & Assert (First round)
      expect(service.isEmpty()).toBe(false);
      expect(firstQueueInstance.isEmpty).toHaveBeenCalledTimes(1);

      // Arrange: Start Init round (this clears mocks internally due to beforeEach setup, re-mocking is implicit)
      const initStrategy = 'initiative';
      // Start a *new* round, which will trigger the mockImplementation again
      service.startNewRound(entities, initStrategy, initiativeData);
      const secondQueueInstance = mockInitiativeQueueInstance; // Capture the second instance
      expect(secondQueueInstance).toBeDefined();
      expect(secondQueueInstance).not.toBe(firstQueueInstance); // Verify it's a new instance
      secondQueueInstance.isEmpty.mockReturnValue(true);

      // Clear calls from the first instance check if necessary (though clearMocks should handle this)
      // firstQueueInstance.isEmpty.mockClear(); // Usually not needed with jest.clearAllMocks()

      // Pre-assertion for the second call
      expect(secondQueueInstance.isEmpty).not.toHaveBeenCalled();

      // Act & Assert (Second round)
      const result = service.isEmpty();
      expect(result).toBe(true);
      expect(secondQueueInstance.isEmpty).toHaveBeenCalledTimes(1);

      // Ensure the first queue's mock (if accessible, though it's replaced) wasn't called again
      // This check is tricky because the reference might be stale after the mock implementation runs again.
      // A better check is ensuring the *correct type* of mock instance was used.
      // Here, we rely on the fact that the second call targeted mockInitiativeQueueInstance.
      expect(firstQueueInstance.isEmpty).toHaveBeenCalledTimes(1); // Should still only have 1 call from the first part
    });
  }); // End describe('isEmpty (Active Round)')
}); // End describe('TurnOrderService')
