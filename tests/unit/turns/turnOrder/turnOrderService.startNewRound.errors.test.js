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
    });

    // Test Case: Unsupported strategy
    it('Test Case 11.4.5: should throw error and log if the strategy is unsupported', () => {
      // Arrange
      const unsupportedStrategy = 'unknown-strategy';
      const entities = [{ id: 'a' }];
      const expectedErrorMsg = `Unsupported turn order strategy: ${unsupportedStrategy}`;
      const expectedSpecificLogMsg = `TurnOrderService.startNewRound: Failed - Unsupported turn order strategy "${unsupportedStrategy}".`;
      // NO mock clear here, so constructor log is included

      // Act & Assert
      expect(() => {
        service.startNewRound(entities, unsupportedStrategy);
      }).toThrow(expectedErrorMsg);

      // Assert Logging
      // Error logged twice: once at detection, once in catch block
      expect(mockLogger.error).toHaveBeenCalledTimes(2);
      // Check the specific log for unsupported strategy
      expect(mockLogger.error).toHaveBeenCalledWith(expectedSpecificLogMsg);
      // Check the catch block also logged with error details
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error during queue population'),
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

      // Assert Queue constructors were not called (error happens before queue creation)
      expect(SimpleRoundRobinQueue).not.toHaveBeenCalled();

      // Additional check: The service attempts to set #currentStrategy before the switch,
      // but it should be reset to null in the default case (error path), AND reset again
      // by the second clearCurrentRound call in the catch block.
      // The check above already confirms addEntity throws correctly.
    });
  }); // End describe("startNewRound (Error Handling)")
}); // End describe('TurnOrderService')
