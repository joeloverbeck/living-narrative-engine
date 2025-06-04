// src/tests/core/turnOrder/queues/initiativePriorityQueue.tieBreaking.test.js

/**
 * @file Unit tests for the InitiativePriorityQueue class, focusing on priority tie-breaking behavior.
 * Ticket: TEST-TURN-ORDER-001.10.12
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { InitiativePriorityQueue } from '../../../../src/turns/order/queues/initiativePriorityQueue.js'; // Adjust path as needed

// Mock Entity type for testing
/** @typedef {{ id: string; name?: string; }} Entity */ // Simplified mock type

describe('InitiativePriorityQueue', () => {
  /** @type {InitiativePriorityQueue} */
  let queue;
  /** @type {Entity} */
  let entityA;
  /** @type {Entity} */
  let entityB;
  /** @type {Entity} */
  let entityC;

  beforeEach(() => {
    queue = new InitiativePriorityQueue();
    // Priorities: B=15, C=15, A=10
    entityA = { id: 'a', name: 'Entity A - Prio 10' };
    entityB = { id: 'b', name: 'Entity B - Prio 15' };
    entityC = { id: 'c', name: 'Entity C - Prio 15' };
  });

  // --- Test Suite for Priority Tie-Breaking Behavior (TEST-TURN-ORDER-001.10.12) ---
  describe('Priority Tie-Breaking Behavior', () => {
    // Test Case 12.1 (Peek with Tie)
    it('Test Case 12.1: peek() should return one of the highest priority entities when priorities tie', () => {
      // Arrange
      queue.add(entityA, 10);
      queue.add(entityB, 15);
      queue.add(entityC, 15);
      expect(queue.size()).toBe(3); // Pre-condition check

      // Act
      const result = queue.peek();

      // Assert
      // The result must be either B or C (those with priority 15)
      expect([entityB, entityC]).toContain(result);
      expect(queue.size()).toBe(3); // Peek should not change the size
    });

    // Test Case 12.2 (getNext with Tie)
    it('Test Case 12.2: getNext() should return tied entities one after the other, respecting heap behavior', () => {
      // Arrange
      queue.add(entityA, 10);
      queue.add(entityB, 15);
      queue.add(entityC, 15);
      expect(queue.size()).toBe(3); // Pre-condition check

      // Act: Get the first highest priority item
      const result1 = queue.getNext();

      // Assert: result1 must be one of the tied entities
      expect([entityB, entityC]).toContain(result1);
      expect(queue.size()).toBe(2); // Size decreases by 1

      // Act: Get the second highest priority item
      const result2 = queue.getNext();

      // Assert: result2 must be the *other* tied entity
      // Determine the expected second entity based on the first result
      const expectedSecondEntity = result1 === entityB ? entityC : entityB;
      expect(result2).toBe(expectedSecondEntity);
      expect(queue.size()).toBe(1); // Size decreases by 1 again

      // Assert: The remaining entity should be the lowest priority one
      expect(queue.peek()).toBe(entityA);
      expect(queue.size()).toBe(1); // Size remains 1 after peek

      // Final cleanup check (optional but good practice)
      expect(queue.getNext()).toBe(entityA);
      expect(queue.size()).toBe(0);
      expect(queue.isEmpty()).toBe(true);
    });

    // Test Case 12.3 (toArray with Tie)
    it('Test Case 12.3: toArray() should return all active entities, including tied ones, without guaranteed order', () => {
      // Arrange
      queue.add(entityA, 10);
      queue.add(entityB, 15);
      queue.add(entityC, 15);
      expect(queue.size()).toBe(3); // Pre-condition check

      // Act
      const result = queue.toArray();

      // Assert
      // 1. Check the length
      expect(result).toHaveLength(3);

      // 2. Check that all expected entities are present
      // Using arrayContaining ensures presence regardless of order.
      // Note: If duplicates were possible, this wouldn't be sufficient alone.
      expect(result).toEqual(
        expect.arrayContaining([entityA, entityB, entityC])
      );

      // Alternative/additional check using .includes() for clarity
      expect(result.includes(entityA)).toBe(true);
      expect(result.includes(entityB)).toBe(true);
      expect(result.includes(entityC)).toBe(true);

      // Verify queue state is unchanged by toArray
      expect(queue.size()).toBe(3);
      expect([entityB, entityC]).toContain(queue.peek()); // Peek should still work and return B or C
    });
  }); // End describe('Priority Tie-Breaking Behavior')
}); // End describe('InitiativePriorityQueue')
