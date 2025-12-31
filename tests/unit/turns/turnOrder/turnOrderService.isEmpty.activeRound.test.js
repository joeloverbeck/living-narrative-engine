// src/tests/turns/order/turnOrderService.isEmpty.activeRound.test.js

/**
 * @file Unit tests for the TurnOrderService class, specifically
 * testing the isEmpty method when a round is active.
 * Parent Ticket: TEST-TURN-ORDER-001.11
 * Ticket ID: TEST-TURN-ORDER-001.11.7
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TurnOrderService } from '../../../../src/turns/order/turnOrderService.js';
import { SimpleRoundRobinQueue } from '../../../../src/turns/order/queues/simpleRoundRobinQueue.js';

// Mock the Queue modules
jest.mock('../../../../src/turns/order/queues/simpleRoundRobinQueue.js');

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
  /** @type {jest.Mocked<InstanceType<typeof SimpleRoundRobinQueue>>} */
  let mockSimpleQueueInstance;

  beforeEach(() => {
    jest.clearAllMocks(); // Clear all mocks before each test

    mockLogger = createMockLogger();
    service = new TurnOrderService({ logger: mockLogger });
    entities = [{ id: 'hero1' }, { id: 'monster1' }];

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
      return /** @type {import('../../../../src/turns/order/queues/simpleRoundRobinQueue.js').SimpleRoundRobinQueue} */ (
        mockSimpleQueueInstance
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

    // Test Case: Round Robin Queue isEmpty returns true when empty
    it('Test Case 11.7.2: should delegate to Round Robin Queue isEmpty and return true when empty', () => {
      // Arrange
      const strategy = 'round-robin';
      service.startNewRound(entities, strategy);

      // Ensure the instance was created and configure its isEmpty mock
      expect(mockSimpleQueueInstance).toBeDefined();
      mockSimpleQueueInstance.isEmpty.mockReturnValue(true);

      // Pre-assertion: Ensure the mock hasn't been called yet (after configuring)
      mockSimpleQueueInstance.isEmpty.mockClear();

      // Act
      const result = service.isEmpty();

      // Assert
      expect(mockSimpleQueueInstance.isEmpty).toHaveBeenCalledTimes(1);
      expect(result).toBe(true);

      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('isEmpty')
      );
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('isEmpty')
      );
      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  }); // End describe('isEmpty (Active Round)')
}); // End describe('TurnOrderService')
