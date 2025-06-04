// src/tests/core/turnOrder/queues/simpleRoundRobinQueue.toArray.test.js

/**
 * @file Unit tests for the toArray() method of the SimpleRoundRobinQueue class.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { SimpleRoundRobinQueue } from '../../../../src/turns/order/queues/simpleRoundRobinQueue.js'; // Adjust path as needed

// Mock Entity type for testing
// Using a simplified mock type consistent with previous examples
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

  // --- Test Suite for toArray() Method (TEST-TURN-ORDER-001.10.7) ---
  describe('toArray() Method Functionality', () => {
    // Test Case 7.1 (toArray on Empty Queue)
    it('Test Case 7.1: should return an empty array for an empty queue', () => {
      // Arrange: Queue is empty from beforeEach
      expect(queue.isEmpty()).toBe(true); // Pre-condition check

      // Act
      const result = queue.toArray();

      // Assert
      expect(result).toEqual([]);
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(0);
    });

    // Test Case 7.2 (toArray on Single Item Queue)
    it('Test Case 7.2: should return an array with the single item for a queue with one entity', () => {
      // Arrange
      queue.add(entityA);
      expect(queue.size()).toBe(1); // Pre-condition check

      // Act
      const result = queue.toArray();

      // Assert
      expect(result).toEqual([entityA]);
      expect(result.length).toBe(1);
      expect(result[0]).toBe(entityA); // Check reference equality
    });

    // Test Case 7.3 (toArray on Multiple Items - FIFO Order)
    it('Test Case 7.3: should return an array with all items in the correct FIFO order', () => {
      // Arrange
      queue.add(entityA);
      queue.add(entityB);
      queue.add(entityC);
      expect(queue.size()).toBe(3); // Pre-condition check

      // Act
      const result = queue.toArray();

      // Assert
      expect(result).toEqual([entityA, entityB, entityC]);
      expect(result.length).toBe(3);
      expect(result[0]).toBe(entityA);
      expect(result[1]).toBe(entityB);
      expect(result[2]).toBe(entityC);
    });

    // Test Case 7.4 (toArray Returns a Copy)
    it('Test Case 7.4: should return a shallow copy, not a reference to the internal array', () => {
      // Arrange
      queue.add(entityA);
      queue.add(entityB);
      const originalSize = queue.size();
      const originalPeek = queue.peek();
      const originalArray = queue.toArray(); // Get initial state

      // Act
      const arrayCopy = queue.toArray();
      // Modify the returned copy
      arrayCopy.push(entityC); // Modify by adding
      arrayCopy[0] = null; // Modify by changing existing element

      // Assert
      // 1. Check the modified copy
      expect(arrayCopy.length).toBe(originalSize + 1);
      expect(arrayCopy).toEqual([null, entityB, entityC]);

      // 2. Check the original queue is unchanged
      expect(queue.size()).toBe(originalSize); // Size should be the same
      expect(queue.peek()).toBe(originalPeek); // First element should be the same
      expect(queue.toArray()).toEqual(originalArray); // Internal array content should be the same
      expect(queue.toArray()).toEqual([entityA, entityB]); // Explicit check of original content
      expect(queue.toArray()).not.toBe(arrayCopy); // Ensure it's a different array instance
    });

    // Test Case 7.5 (toArray After Operations)
    it('Test Case 7.5: should return the correct array state after various queue operations', () => {
      // Arrange
      queue.add(entityA);
      queue.add(entityB);
      queue.add(entityC); // Queue: [A, B, C]
      queue.getNext(); // Removes A. Queue: [B, C]
      queue.remove('c'); // Removes C. Queue: [B]
      expect(queue.size()).toBe(1); // Pre-condition check
      expect(queue.peek()).toBe(entityB); // Pre-condition check

      // Act
      const result = queue.toArray();

      // Assert
      expect(result).toEqual([entityB]);
      expect(result.length).toBe(1);
      expect(result[0]).toBe(entityB);
    });
  }); // End describe('toArray() Method Functionality')
}); // End describe('SimpleRoundRobinQueue')
