// src/tests/turns/order/turnOrderService.getNextEntity.test.js

/**
 * @file Unit tests for the TurnOrderService class, focusing on the
 * getNextEntity method when a round is active.
 * Parent Ticket: TEST-TURN-ORDER-001.11
 * Ticket ID: TEST-TURN-ORDER-001.11.5
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TurnOrderService } from '../../../../src/turns/order/turnOrderService.js';
import { SimpleRoundRobinQueue } from '../../../../src/turns/order/queues/simpleRoundRobinQueue.js';
import { InitiativePriorityQueue } from '../../../../src/turns/order/queues/initiativePriorityQueue.js';

// Mock the Queue modules
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
    service = new TurnOrderService({ logger: mockLogger });
    entities = [
      { id: 'a', name: 'Alice' },
      { id: 'b', name: 'Bob' },
    ];

    // Provide mock implementations for the queue constructors
    // These will be instantiated inside startNewRound
    SimpleRoundRobinQueue.mockImplementation(() => {
      mockSimpleQueueInstance = {
        add: jest.fn(),
        remove: jest.fn(),
        getNext: jest.fn(),
        peek: jest.fn(),
        isEmpty: jest.fn().mockReturnValue(false),
        clear: jest.fn(),
        size: jest.fn().mockReturnValue(entities.length),
        toArray: jest.fn().mockReturnValue(entities),
        // Add other methods as needed if they get called indirectly
      };
      return mockSimpleQueueInstance;
    });

    InitiativePriorityQueue.mockImplementation(() => {
      mockInitiativeQueueInstance = {
        add: jest.fn(),
        remove: jest.fn(),
        getNext: jest.fn(),
        peek: jest.fn(),
        isEmpty: jest.fn().mockReturnValue(false),
        clear: jest.fn(),
        size: jest.fn().mockReturnValue(entities.length),
        toArray: jest.fn().mockReturnValue(entities),
        // Add other methods as needed
      };
      return mockInitiativeQueueInstance;
    });

    // Clear logger calls made during constructor AFTER instantiation
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
    mockLogger.debug.mockClear();
  });

  // --- Test Suite for getNextEntity (Active Round) (TEST-TURN-ORDER-001.11.5) ---
  describe('getNextEntity (Active Round)', () => {
    // Test Case: Delegate to Round Robin Queue
    it('Test Case 11.5.1: should delegate to the active SimpleRoundRobinQueue', () => {
      // Arrange
      const expectedEntity = { id: 'nextRR' };
      service.startNewRound(entities, 'round-robin'); // Instantiates mockSimpleQueueInstance
      // Ensure the mock instance was created before configuring it
      expect(mockSimpleQueueInstance).toBeDefined();
      mockSimpleQueueInstance.getNext.mockReturnValue(expectedEntity);
      // --- Correction: Clear logs *after* arrange and *before* act ---
      mockLogger.debug.mockClear();
      mockLogger.info.mockClear();
      mockLogger.warn.mockClear();
      mockLogger.error.mockClear();

      // Act
      const result = service.getNextEntity();

      // Assert
      expect(result).toEqual(expectedEntity);
      expect(mockSimpleQueueInstance.getNext).toHaveBeenCalledTimes(1);
      // Ensure the *other* queue type wasn't touched
      expect(InitiativePriorityQueue).not.toHaveBeenCalled();
      if (mockInitiativeQueueInstance) {
        // Check only if the other mock instance exists (it shouldn't)
        expect(mockInitiativeQueueInstance.getNext).not.toHaveBeenCalled();
      }
      expect(mockLogger.debug).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `TurnOrderService: Advancing turn to entity "${expectedEntity.id}".`
      );
      // Now these checks should pass as we cleared logs before the 'Act' phase
      expect(mockLogger.info).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    // Test Case: Delegate to Initiative Queue
    it('Test Case 11.5.2: should delegate to the active InitiativePriorityQueue', () => {
      // Arrange
      const expectedEntity = { id: 'nextInit' };
      const initiativeData = new Map([
        ['a', 10],
        ['b', 5],
      ]);
      service.startNewRound(entities, 'initiative', initiativeData); // Instantiates mockInitiativeQueueInstance
      // Ensure the mock instance was created
      expect(mockInitiativeQueueInstance).toBeDefined();
      mockInitiativeQueueInstance.getNext.mockReturnValue(expectedEntity);
      // --- Correction: Clear logs *after* arrange and *before* act ---
      mockLogger.debug.mockClear();
      mockLogger.info.mockClear();
      mockLogger.warn.mockClear();
      mockLogger.error.mockClear();

      // Act
      const result = service.getNextEntity();

      // Assert
      expect(result).toEqual(expectedEntity);
      expect(mockInitiativeQueueInstance.getNext).toHaveBeenCalledTimes(1);
      // Ensure the *other* queue type wasn't touched
      expect(SimpleRoundRobinQueue).not.toHaveBeenCalled();
      if (mockSimpleQueueInstance) {
        // Check only if the other mock instance exists (it shouldn't)
        expect(mockSimpleQueueInstance.getNext).not.toHaveBeenCalled();
      }
      expect(mockLogger.debug).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `TurnOrderService: Advancing turn to entity "${expectedEntity.id}".`
      );
      // Now these checks should pass as we cleared logs before the 'Act' phase
      expect(mockLogger.info).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    // Test Case: Queue Returns Null (End of Round - Round Robin)
    it('Test Case 11.5.3: should return null and log info when round-robin queue returns null', () => {
      // Arrange
      service.startNewRound(entities, 'round-robin');
      expect(mockSimpleQueueInstance).toBeDefined();
      mockSimpleQueueInstance.getNext.mockReturnValue(null);
      // --- Correction: Clear logs *after* arrange and *before* act ---
      mockLogger.info.mockClear();
      mockLogger.debug.mockClear();
      mockLogger.warn.mockClear();
      mockLogger.error.mockClear();

      // Act
      const result = service.getNextEntity();

      // Assert
      expect(result).toBeNull();
      expect(mockSimpleQueueInstance.getNext).toHaveBeenCalledTimes(1);
      if (mockInitiativeQueueInstance) {
        expect(mockInitiativeQueueInstance.getNext).not.toHaveBeenCalled();
      }
      expect(mockLogger.debug).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'TurnOrderService: getNextEntity returned null (queue is likely empty).'
      );
      // The advancing turn debug is not called
      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    // Test Case: Queue Returns Null (End of Round - Initiative)
    it('Test Case 11.5.4: should return null and log info when initiative queue returns null', () => {
      // Arrange
      const initiativeData = new Map([
        ['a', 10],
        ['b', 5],
      ]);
      service.startNewRound(entities, 'initiative', initiativeData);
      expect(mockInitiativeQueueInstance).toBeDefined();
      mockInitiativeQueueInstance.getNext.mockReturnValue(null);
      // --- Correction: Clear logs *after* arrange and *before* act ---
      mockLogger.info.mockClear();
      mockLogger.debug.mockClear();
      mockLogger.warn.mockClear();
      mockLogger.error.mockClear();

      // Act
      const result = service.getNextEntity();

      // Assert
      expect(result).toBeNull();
      expect(mockInitiativeQueueInstance.getNext).toHaveBeenCalledTimes(1);
      if (mockSimpleQueueInstance) {
        expect(mockSimpleQueueInstance.getNext).not.toHaveBeenCalled();
      }
      expect(mockLogger.debug).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'TurnOrderService: getNextEntity returned null (queue is likely empty).'
      );
      // The advancing turn debug is not called
      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    // Test Case: Called when no round is active (implicitly handled by 11.5)
    // Already covered by TEST-TURN-ORDER-001.11.1 tests for `getNextEntity` (no round active state).
    // However, adding a simple check here for completeness within this specific focus.
    it('Test Case 11.5.5: should return null and log warning if called when no round is active', () => {
      // Arrange - No round started after beforeEach
      // No need to clear here as beforeEach already did. We just need to make sure
      // warn is clear if previous tests somehow polluted it (though clearAllMocks should prevent this)
      mockLogger.warn.mockClear();

      // Act
      const result = service.getNextEntity();

      // Assert
      expect(result).toBeNull();
      // Crucially, ensure no queue constructor or getNext was called
      expect(SimpleRoundRobinQueue).not.toHaveBeenCalled();
      expect(InitiativePriorityQueue).not.toHaveBeenCalled();
      if (mockSimpleQueueInstance)
        expect(mockSimpleQueueInstance.getNext).not.toHaveBeenCalled();
      if (mockInitiativeQueueInstance)
        expect(mockInitiativeQueueInstance.getNext).not.toHaveBeenCalled();

      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'TurnOrderService.getNextEntity: Called when no round is active.'
      );
      expect(mockLogger.info).not.toHaveBeenCalled();
      expect(mockLogger.debug).not.toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  }); // End describe('getNextEntity (Active Round)')
}); // End describe('TurnOrderService')
