// src/tests/turns/order/queues/initiativePriorityQueue.clear.test.js

/**
 * @file Unit tests for the InitiativePriorityQueue class, focusing on the clear() method.
 * Ticket: TEST-TURN-ORDER-001.10.15
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { InitiativePriorityQueue } from '../../../../../src/turns/order/queues/initiativePriorityQueue.js'; // Adjust path as needed

// Mock Entity type for testing
/** @typedef {{ id: string; name?: string; }} Entity */ // Simplified mock type

describe('InitiativePriorityQueue', () => {
  /** @type {InitiativePriorityQueue} */
  let queue;
  /** @type {Entity} */
  let entityA;
  /** @type {Entity} */
  let entityB;

  beforeEach(() => {
    queue = new InitiativePriorityQueue();
    entityA = { id: 'a', name: 'Entity A' };
    entityB = { id: 'b', name: 'Entity B' };
  });

  // --- Test Suite for clear() Method Functionality (TEST-TURN-ORDER-001.10.15) ---
  describe('clear() Method Functionality', () => {
    // Test Case 15.1 (Clear Non-Empty Queue)
    it('Test Case 15.1: should reset a non-empty queue to its initial state', () => {
      // Arrange
      queue.add(entityA, 10);
      queue.add(entityB, 5);
      expect(queue.size()).toBe(2); // Pre-condition: Queue has items

      // Act
      queue.clear();

      // Assert
      expect(queue.size()).toBe(0);
      expect(queue.isEmpty()).toBe(true);
      expect(queue.peek()).toBeNull();
      expect(queue.getNext()).toBeNull();
      expect(queue.toArray()).toEqual([]);
      // Indirectly checks if #removedEntityIds is cleared because size() depends on it.
      // If we add an item after clear, it should work normally.
      queue.add(entityA, 1);
      expect(queue.size()).toBe(1);
      expect(queue.peek()).toBe(entityA);
    });

    // Test Case 15.2 (Clear Queue with Removed Items)
    it('Test Case 15.2: should reset a queue containing lazily removed items', () => {
      // Arrange
      queue.add(entityA, 10);
      queue.add(entityB, 5);
      queue.remove('a'); // Lazily remove entityA
      expect(queue.size()).toBe(1); // Pre-condition: Queue has one active item and one removed item
      // Verify internal state (indirectly) before clear
      expect(queue.peek()).toBe(entityB); // Should skip 'a'

      // Act
      queue.clear();

      // Assert
      expect(queue.size()).toBe(0);
      expect(queue.isEmpty()).toBe(true);
      expect(queue.peek()).toBeNull();
      expect(queue.getNext()).toBeNull();
      expect(queue.toArray()).toEqual([]);
      // Indirectly checks if #removedEntityIds is cleared.
      // If we add 'a' back after clear, it shouldn't be treated as removed.
      queue.add(entityA, 15);
      expect(queue.size()).toBe(1);
      expect(queue.peek()).toBe(entityA);
    });

    // Test Case 15.3 (Clear Empty Queue)
    it('Test Case 15.3: should have no effect on an already empty queue', () => {
      // Arrange
      expect(queue.size()).toBe(0); // Pre-condition: Queue is empty
      expect(queue.isEmpty()).toBe(true);

      // Act
      queue.clear();

      // Assert
      expect(queue.size()).toBe(0);
      expect(queue.isEmpty()).toBe(true);
      expect(queue.peek()).toBeNull();
      expect(queue.getNext()).toBeNull();
      expect(queue.toArray()).toEqual([]);
    });
  }); // End describe('clear() Method Functionality')
}); // End describe('InitiativePriorityQueue')
