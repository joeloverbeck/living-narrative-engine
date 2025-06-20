// src/tests/turns/order/turnOrderService.startNewRound.errors.test.js

/**
 * @file Unit tests for the TurnOrderService class, focusing on the
 * error handling within the startNewRound method for invalid inputs.
 * Parent Ticket: TEST-TURN-ORDER-001.11
 * Ticket ID: TEST-TURN-ORDER-001.11.4
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TurnOrderService } from '../../../../src/turns/order/turnOrderService.js';
// We don't strictly *need* the queue mocks for errors thrown *before*
// instantiation, but it's good practice to have them minimally mocked
// in case logic changes or for the unsupported strategy case.
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

  beforeEach(() => {
    jest.clearAllMocks(); // Clear all mocks before each test

    mockLogger = createMockLogger();
    // Constructor logs "TurnOrderService initialized." here
    service = new TurnOrderService({ logger: mockLogger });
    // IMPORTANT: Reset the mock call count *after* instantiation
    // if we only want to count logs within the test action itself.
    // However, for 11.4.5, we *do* want to count the constructor log.
    // The forEach loops handle clearing internally.
  });

  // --- Test Suite for startNewRound Error Handling (TEST-TURN-ORDER-001.11.4) ---
  describe('startNewRound (Error Handling)', () => {
    // Test Case: Invalid entities (Null/Undefined/Empty)
    it('Test Case 11.4.1: should throw error and log if entities array is null, undefined, or empty', () => {
      const strategy = 'round-robin'; // Strategy doesn't matter for this validation
      const expectedErrorMsg = 'Entities array must be provided and non-empty.';
      const expectedLogMsg =
        'TurnOrderService.startNewRound: Failed - entities array must be a non-empty array.';
      const inputs = [null, undefined, []];

      inputs.forEach((invalidEntities) => {
        // Arrange
        mockLogger.error.mockClear(); // Clear log mock for each iteration
        mockLogger.debug.mockClear();
        mockLogger.warn.mockClear(); // Also clear warn

        // Act & Assert
        expect(() => {
          // @ts-ignore - Intentionally passing invalid types
          service.startNewRound(invalidEntities, strategy);
        }).toThrow(expectedErrorMsg);

        // Assert Logging
        // Error logged BEFORE catch block
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(expectedLogMsg);

        // Assert internal state remained cleared
        // Debug log for clearing *existing* queue should NOT be called
        expect(mockLogger.debug).not.toHaveBeenCalledWith(
          'TurnOrderService: Cleared existing turn queue.'
        );

        // Check public methods reflect cleared state
        expect(service.isEmpty()).toBe(true);
        expect(service.peekNextEntity()).toBeNull();
        expect(service.getCurrentOrder()).toEqual([]);
        // Adding/Removing should fail as no round is active
        expect(() => service.addEntity({ id: 'test' })).toThrow(
          'Cannot add entity: No round is active.'
        );
        // removeEntity logs a warning but doesn't throw if no round active
        service.removeEntity('test');
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('when no round is active')
        );

        // Assert Queue constructors were not called
        expect(SimpleRoundRobinQueue).not.toHaveBeenCalled();
        expect(InitiativePriorityQueue).not.toHaveBeenCalled();
      });
    });

    // Test Case: Invalid entities (Contains Invalid Item)
    it('Test Case 11.4.2: should throw error and log if entities array contains invalid items', () => {
      // Arrange
      const strategy = 'round-robin';
      // @ts-ignore - Intentionally creating invalid data
      const invalidEntities = [
        { id: 'a' },
        { name: 'no id' },
        { id: '' },
        null,
      ];
      const expectedErrorMsg = 'Entities array contains invalid entities.';
      const expectedLogMsg =
        'TurnOrderService.startNewRound: Failed - entities array contains invalid entities (missing or invalid id).';
      // Clear constructor log before Act
      mockLogger.info.mockClear();

      // Act & Assert
      expect(() => {
        service.startNewRound(invalidEntities, strategy);
      }).toThrow(expectedErrorMsg);

      // Assert Logging
      // Error logged BEFORE catch block
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(expectedLogMsg);

      // Debug log for clearing *existing* queue should NOT be called
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        'TurnOrderService: Cleared existing turn queue.'
      );

      // Check state
      expect(service.isEmpty()).toBe(true);
      expect(service.peekNextEntity()).toBeNull();
      expect(service.getCurrentOrder()).toEqual([]);

      // Assert Queue constructors were not called
      expect(SimpleRoundRobinQueue).not.toHaveBeenCalled();
      expect(InitiativePriorityQueue).not.toHaveBeenCalled();
    });

    // Test Case: Invalid initiativeData (Missing for Initiative)
    it("Test Case 11.4.3: should throw error and log if strategy is 'initiative' and initiativeData is missing", () => {
      // Arrange
      const strategy = 'initiative';
      const entities = [{ id: 'a' }];
      const expectedErrorMsg =
        'Valid initiativeData Map is required for the "initiative" strategy.';
      const expectedSpecificLogMsg =
        'TurnOrderService.startNewRound (initiative): Failed - initiativeData Map is required and must not be empty.';
      const expectedCatchLogMsg = `TurnOrderService.startNewRound: Error during queue population for strategy "${strategy}": ${expectedErrorMsg}`;
      const inputs = [undefined, null]; // Test both undefined and null

      inputs.forEach((invalidData) => {
        // Arrange
        mockLogger.error.mockClear(); // Clear log mock for each iteration
        mockLogger.debug.mockClear();

        // Act & Assert
        expect(() => {
          service.startNewRound(entities, strategy, invalidData);
        }).toThrow(expectedErrorMsg);

        // Assert Logging
        // Error logged TWICE: once specifically, once in catch block
        expect(mockLogger.error).toHaveBeenCalledTimes(2);
        // Check the first specific log
        expect(mockLogger.error).toHaveBeenCalledWith(expectedSpecificLogMsg);
        // Check the second log from the catch block
        expect(mockLogger.error).toHaveBeenCalledWith(
          expectedCatchLogMsg,
          expect.any(Error)
        );

        expect(mockLogger.debug).not.toHaveBeenCalledWith(
          'TurnOrderService: Cleared existing turn queue.'
        ); // Still no *existing* queue cleared
        expect(service.isEmpty()).toBe(true);
        expect(service.peekNextEntity()).toBeNull();
        expect(service.getCurrentOrder()).toEqual([]);

        // Assert Queue constructor was not called
        expect(InitiativePriorityQueue).not.toHaveBeenCalled();
      });
    });

    // Test Case: Invalid initiativeData (Not a Map/Empty Map)
    it("Test Case 11.4.4: should throw error and log if strategy is 'initiative' and initiativeData is not a valid Map or is empty", () => {
      // Arrange
      const strategy = 'initiative';
      const entities = [{ id: 'a' }];
      const expectedErrorMsg =
        'Valid initiativeData Map is required for the "initiative" strategy.';
      const expectedSpecificLogMsg =
        'TurnOrderService.startNewRound (initiative): Failed - initiativeData Map is required and must not be empty.';
      const expectedCatchLogMsg = `TurnOrderService.startNewRound: Error during queue population for strategy "${strategy}": ${expectedErrorMsg}`;
      const inputs = [{}, new Map(), { get: 'not a function' }, []]; // Test object, empty map, invalid map-like, array

      inputs.forEach((invalidData) => {
        // Arrange
        mockLogger.error.mockClear(); // Clear log mock for each iteration
        mockLogger.debug.mockClear();

        // Act & Assert
        expect(() => {
          // @ts-ignore - Intentionally passing invalid types
          service.startNewRound(entities, strategy, invalidData);
        }).toThrow(expectedErrorMsg);

        // Assert Logging
        // Error logged TWICE: once specifically, once in catch block
        expect(mockLogger.error).toHaveBeenCalledTimes(2);
        // Check the first specific log
        expect(mockLogger.error).toHaveBeenCalledWith(expectedSpecificLogMsg);
        // Check the second log from the catch block
        expect(mockLogger.error).toHaveBeenCalledWith(
          expectedCatchLogMsg,
          expect.any(Error)
        );

        expect(mockLogger.debug).not.toHaveBeenCalledWith(
          'TurnOrderService: Cleared existing turn queue.'
        );
        expect(service.isEmpty()).toBe(true);
        expect(service.peekNextEntity()).toBeNull();
        expect(service.getCurrentOrder()).toEqual([]);

        // Assert Queue constructor was not called
        expect(InitiativePriorityQueue).not.toHaveBeenCalled();
      });
    });

    // Test Case: Unsupported strategy
    it('Test Case 11.4.5: should throw error and log if the strategy is unsupported', () => {
      // Arrange
      const unsupportedStrategy = 'unknown-strategy';
      const entities = [{ id: 'a' }];
      const expectedErrorMsg = `Unsupported turn order strategy: ${unsupportedStrategy}`;
      const expectedSpecificLogMsg = `TurnOrderService.startNewRound: Failed - Unsupported turn order strategy "${unsupportedStrategy}".`;
      const expectedCatchLogMsg = `TurnOrderService.startNewRound: Error during queue population for strategy "${unsupportedStrategy}": ${expectedErrorMsg}`;
      // NO mock clear here, so constructor log is included

      // Act & Assert
      expect(() => {
        service.startNewRound(entities, unsupportedStrategy);
      }).toThrow(expectedErrorMsg);

      // Assert Logging
      // Error logged TWICE: once specifically, once in catch block
      expect(mockLogger.error).toHaveBeenCalledTimes(2);
      // Check the first specific log
      expect(mockLogger.error).toHaveBeenCalledWith(expectedSpecificLogMsg);
      // Check the second log from the catch block
      expect(mockLogger.error).toHaveBeenCalledWith(
        expectedCatchLogMsg,
        expect.any(Error)
      );

      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        'TurnOrderService: Cleared existing turn queue.'
      );

      // Check public methods reflect cleared state
      expect(service.isEmpty()).toBe(true);
      expect(service.peekNextEntity()).toBeNull();
      expect(service.getCurrentOrder()).toEqual([]);
      // Adding/Removing should fail as no round is active
      expect(() => service.addEntity({ id: 'test' })).toThrow(
        'Cannot add entity: No round is active.'
      );
      // removeEntity logs a warning but doesn't throw if no round active
      service.removeEntity('test');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('when no round is active')
      );

      // Assert Queue constructors were not called (error happens in switch default)
      expect(SimpleRoundRobinQueue).not.toHaveBeenCalled();
      expect(InitiativePriorityQueue).not.toHaveBeenCalled();

      // Additional check: The service attempts to set #currentStrategy before the switch,
      // but it should be reset to null in the default case (error path), AND reset again
      // by the second clearCurrentRound call in the catch block.
      // The check above already confirms addEntity throws correctly.
    });
  }); // End describe("startNewRound (Error Handling)")
}); // End describe('TurnOrderService')
