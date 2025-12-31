// src/tests/turns/order/turnOrderService.roundTransitions.test.js

/**
 * @file Unit tests for the TurnOrderService class, focusing on
 * transitions when calling startNewRound multiple times.
 * Parent Ticket: TEST-TURN-ORDER-001.11
 * Ticket ID: TEST-TURN-ORDER-001.11.13
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

describe('TurnOrderService - Round Transitions', () => {
  /** @type {ReturnType<typeof createMockLogger>} */
  let mockLogger;
  /** @type {TurnOrderService} */
  let service;
  /** @type {jest.Mock<SimpleRoundRobinQueue>} */
  let MockSimpleRoundRobinQueue;

  // Use broader types for instances to avoid Jest's complex mock types issues sometimes
  /** @type {any | null} */
  let mockRRQueueInstance1 = null;
  /** @type {any | null} */
  let mockRRQueueInstance2 = null;
  /** @type {number} */
  let instanceCount = 0;

  beforeEach(() => {
    jest.clearAllMocks(); // Clear all mocks before each test

    mockLogger = createMockLogger();
    service = new TurnOrderService({ logger: mockLogger });
    instanceCount = 0;

    // Store the mocked classes
    MockSimpleRoundRobinQueue = SimpleRoundRobinQueue;

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
        getNext: jest
          .fn()
          .mockImplementation(() =>
            instance._entities.length > 0 ? instance._entities.shift() : null
          ),
        peek: jest
          .fn()
          .mockImplementation(() =>
            instance._entities.length > 0 ? instance._entities[0] : null
          ),
        isEmpty: jest
          .fn()
          .mockImplementation(() => instance._entities.length === 0),
        toArray: jest.fn().mockImplementation(() => [...instance._entities]),
        remove: jest.fn().mockReturnValue(null), // Adjust if needed
        // Dynamic size based on internal mock state
        size: jest.fn().mockImplementation(() => instance._entities.length),
      };
      // Capture instances based on creation order
      instanceCount++;
      if (instanceCount === 1) {
        mockRRQueueInstance1 = instance;
      } else {
        mockRRQueueInstance2 = instance;
      }
      return instance;
    });

    // Clear constructor log if needed for specific tests
    mockLogger.info.mockClear();
  });

  // --- Test Suite for Round Transitions (TEST-TURN-ORDER-001.11.13) ---
  describe('startNewRound Transitions', () => {
    it('Test Case 11.13.1: should correctly transition from one Round Robin round to another', () => {
      // Arrange: First round (Round Robin)
      const entities1 = [{ id: 'a' }];
      const strategy1 = 'round-robin';
      service.startNewRound(entities1, strategy1);

      // Capture the first mock queue instance created
      expect(MockSimpleRoundRobinQueue).toHaveBeenCalledTimes(1);
      expect(mockRRQueueInstance1).not.toBeNull();
      const capturedMockRRQueue1 = mockRRQueueInstance1; // Store reference

      // Verify initial setup (optional, sanity check)
      expect(capturedMockRRQueue1.add).toHaveBeenCalledWith(entities1[0]);
      expect(capturedMockRRQueue1.add).toHaveBeenCalledTimes(1);
      expect(capturedMockRRQueue1.size()).toBe(1); // Check dynamic size worked for round 1

      // Clear mocks *after* first round setup to focus on the transition effects
      MockSimpleRoundRobinQueue.mockClear();
      Object.values(capturedMockRRQueue1).forEach((mockFn) => {
        if (jest.isMockFunction(mockFn)) mockFn.mockClear();
      });

      mockLogger.debug.mockClear();
      mockLogger.info.mockClear();
      mockLogger.warn.mockClear();
      mockLogger.error.mockClear();

      // Arrange: Second round (also Round Robin with different entities)
      const entities2 = [{ id: 'b' }, { id: 'c' }];
      const strategy2 = 'round-robin';

      // Act: Start the second round, triggering the transition
      service.startNewRound(entities2, strategy2);

      // Assert: Transition effects

      // 1. Previous Queue Cleared
      expect(capturedMockRRQueue1.clear).toHaveBeenCalledTimes(1);

      // 2. New Queue (Round Robin) Instantiated
      expect(MockSimpleRoundRobinQueue).toHaveBeenCalledTimes(1);
      expect(mockRRQueueInstance2).not.toBeNull();
      expect(mockRRQueueInstance2).not.toBe(capturedMockRRQueue1); // Ensure it's a different queue instance
      expect(mockRRQueueInstance2.size()).toBe(entities2.length); // Verify dynamic size after adds

      // 3. New Entities Added to New Queue
      expect(mockRRQueueInstance2.add).toHaveBeenCalledTimes(entities2.length);
      expect(mockRRQueueInstance2.add).toHaveBeenCalledWith(entities2[0]); // {id: 'b'}
      expect(mockRRQueueInstance2.add).toHaveBeenCalledWith(entities2[1]); // {id: 'c'}

      // 4. Delegation to New Queue
      const nextEntityFromNewQueue = { id: 'b' };
      mockRRQueueInstance2.getNext.mockReturnValueOnce(nextEntityFromNewQueue);

      const result = service.getNextEntity();
      expect(result).toBe(nextEntityFromNewQueue);
      expect(mockRRQueueInstance2.getNext).toHaveBeenCalledTimes(1);
      expect(capturedMockRRQueue1.getNext).not.toHaveBeenCalled(); // Ensure old queue wasn't called

      mockRRQueueInstance2.peek.mockReturnValueOnce({ id: 'c' }); // 'c' is next
      expect(service.peekNextEntity()).toEqual({ id: 'c' });
      expect(mockRRQueueInstance2.peek).toHaveBeenCalledTimes(1);
      expect(capturedMockRRQueue1.peek).not.toHaveBeenCalled();

      mockRRQueueInstance2.isEmpty.mockReturnValue(false);
      expect(service.isEmpty()).toBe(false);
      expect(mockRRQueueInstance2.isEmpty).toHaveBeenCalledTimes(1);
      expect(capturedMockRRQueue1.isEmpty).not.toHaveBeenCalled();

      const order = [{ id: 'c' }]; // Example order after getting 'b'
      mockRRQueueInstance2.toArray.mockReturnValue(order);
      expect(service.getCurrentOrder()).toEqual(order);
      expect(mockRRQueueInstance2.toArray).toHaveBeenCalledTimes(1);
      expect(capturedMockRRQueue1.toArray).not.toHaveBeenCalled();

      // 5. Logging
      expect(mockLogger.info).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'TurnOrderService: Cleared existing turn queue.'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'TurnOrderService: Initialized SimpleRoundRobinQueue.'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `TurnOrderService: Advancing turn to entity "${nextEntityFromNewQueue.id}".`
      );

      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('Test Case 11.13.2: should throw error when starting a new round with empty entities', () => {
      // Arrange: First round with entities
      const entities1 = [{ id: 'x' }, { id: 'y' }];
      service.startNewRound(entities1, 'round-robin');

      expect(MockSimpleRoundRobinQueue).toHaveBeenCalledTimes(1);
      const capturedMockRRQueue1 = mockRRQueueInstance1;

      // Clear mocks
      MockSimpleRoundRobinQueue.mockClear();
      Object.values(capturedMockRRQueue1).forEach((mockFn) => {
        if (jest.isMockFunction(mockFn)) mockFn.mockClear();
      });
      mockLogger.debug.mockClear();
      mockLogger.error.mockClear();

      // Arrange: Second round with empty entities
      const entities2 = [];

      // Act & Assert
      expect(() => service.startNewRound(entities2, 'round-robin')).toThrow(
        'Entities array must be provided and non-empty.'
      );

      // Previous queue IS cleared because clearCurrentRound() happens before validation
      expect(capturedMockRRQueue1.clear).toHaveBeenCalledTimes(1);

      // Error should be logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        'TurnOrderService.startNewRound: Failed - entities array must be a non-empty array.'
      );
    });
  }); // End describe("startNewRound Transitions")
}); // End describe('TurnOrderService - Round Transitions')
