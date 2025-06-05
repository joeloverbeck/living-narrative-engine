// src/tests/turns/order/queues/simpleRoundRobinQueue.peek.test.js

/**
 * @file Unit tests for the SimpleRoundRobinQueue class.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { SimpleRoundRobinQueue } from '../../../../src/turns/order/queues/simpleRoundRobinQueue.js'; // Adjust path as needed

// Mock Entity type for testing
// Using a simplified mock type consistent with previous examples in the file
/** @typedef {{ id: string; name: string; }} Entity */

describe('SimpleRoundRobinQueue', () => {
  /** @type {SimpleRoundRobinQueue} */
  let queue;
  /** @type {Entity} */
  let entityA;
  /** @type {Entity} */
  let entityB;
  /** @type {Entity} */
  let entityC;

  beforeEach(() => {
    queue = new SimpleRoundRobinQueue();
    entityA = { id: 'a', name: 'Entity A' };
    entityB = { id: 'b', name: 'Entity B' };
    entityC = { id: 'c', name: 'Entity C' };
  });

  // --- Test Suite for peek() Method (TEST-TURN-ORDER-001.10.3) ---
  describe('peek() Method Functionality', () => {
    // Test Case 3.1 (Peek Single Item Queue)
    it('Test Case 3.1: should return the entity from a single-item queue without removing it', () => {
      // Arrange
      queue.add(entityA);
      expect(queue.size()).toBe(1); // Pre-condition

      // Act
      const result = queue.peek();

      // Assert
      expect(result).toBe(entityA); // Should be the added entity
      expect(queue.size()).toBe(1); // Size should not change
      expect(queue.toArray()).toEqual([entityA]); // Internal array should be unchanged
      expect(queue.isEmpty()).toBe(false);
    });

    // Test Case 3.2 (Peek Multiple Items - FIFO)
    it('Test Case 3.2: should return the first-added entity from a multi-item queue without removing it', () => {
      // Arrange
      queue.add(entityA);
      queue.add(entityB);
      expect(queue.size()).toBe(2); // Pre-condition

      // Act
      const result = queue.peek();

      // Assert
      expect(result).toBe(entityA); // Should be the first entity added (FIFO)
      expect(queue.size()).toBe(2); // Size should not change
      expect(queue.toArray()).toEqual([entityA, entityB]); // Internal array should be unchanged
    });

    // Test Case 3.3 (Peek Empty Queue)
    it('Test Case 3.3: should return null when peeking into an empty queue', () => {
      // Arrange: queue is empty from beforeEach
      expect(queue.isEmpty()).toBe(true); // Pre-condition

      // Act
      const result = queue.peek();

      // Assert
      expect(result).toBeNull();
      expect(queue.size()).toBe(0);
      expect(queue.isEmpty()).toBe(true);
    });

    // Test Case 3.4 (Peek After getNext)
    it('Test Case 3.4: should return the new front entity after getNext is called', () => {
      // Arrange
      queue.add(entityA);
      queue.add(entityB);
      const removedEntity = queue.getNext(); // Removes entityA
      expect(removedEntity).toBe(entityA); // Sanity check
      expect(queue.size()).toBe(1); // Pre-condition for peek

      // Act
      const result = queue.peek();

      // Assert
      expect(result).toBe(entityB); // Should now be entityB at the front
      expect(queue.size()).toBe(1); // Size remains 1
      expect(queue.toArray()).toEqual([entityB]); // Only B should be left
    });

    // Test Case 3.5 (Multiple Peeks)
    it('Test Case 3.5: should return the same entity on multiple consecutive peeks without changing the queue', () => {
      // Arrange
      queue.add(entityA);
      queue.add(entityB);
      expect(queue.size()).toBe(2); // Pre-condition

      // Act
      const result1 = queue.peek();
      const result2 = queue.peek();

      // Assert
      expect(result1).toBe(entityA); // First peek gets A
      expect(result2).toBe(entityA); // Second peek also gets A
      expect(queue.size()).toBe(2); // Size still 2
      expect(queue.toArray()).toEqual([entityA, entityB]); // Queue unchanged
    });
  }); // End describe('peek() Method Functionality')
}); // End describe('SimpleRoundRobinQueue')
