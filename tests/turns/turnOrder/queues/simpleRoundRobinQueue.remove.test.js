// src/tests/core/turnOrder/queues/simpleRoundRobinQueue.remove.test.js

/**
 * @file Unit tests for the SimpleRoundRobinQueue class.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { SimpleRoundRobinQueue } from '../../../../src/turns/order/queues/simpleRoundRobinQueue.js'; // Adjust path as needed

// Mock Entity type for testing
/** @typedef {{ id: string; name: string; }} Entity */ // Simplified mock type consistent with others

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

  // --- Test Suite for remove() Method (TEST-TURN-ORDER-001.10.4) ---
  describe('remove() Method Functionality', () => {
    // Test Case 4.1 (Remove First Item)
    it('Test Case 4.1: should remove the first item by ID and return it', () => {
      // Arrange
      queue.add(entityA);
      queue.add(entityB);
      expect(queue.size()).toBe(2); // Pre-condition

      // Act
      const result = queue.remove('a');

      // Assert
      expect(result).toBe(entityA); // Correct entity returned
      expect(queue.size()).toBe(1); // Size decreased
      expect(queue.peek()).toBe(entityB); // B is now at the front
      expect(queue.toArray()).toEqual([entityB]); // Only B remains
    });

    // Test Case 4.2 (Remove Middle Item)
    it('Test Case 4.2: should remove a middle item by ID and return it', () => {
      // Arrange
      queue.add(entityA);
      queue.add(entityB);
      queue.add(entityC);
      expect(queue.size()).toBe(3); // Pre-condition

      // Act
      const result = queue.remove('b');

      // Assert
      expect(result).toBe(entityB); // Correct entity returned
      expect(queue.size()).toBe(2); // Size decreased
      expect(queue.peek()).toBe(entityA); // A is still at the front
      expect(queue.toArray()).toEqual([entityA, entityC]); // A and C remain in order
    });

    // Test Case 4.3 (Remove Last Item)
    it('Test Case 4.3: should remove the last item by ID and return it', () => {
      // Arrange
      queue.add(entityA);
      queue.add(entityB);
      expect(queue.size()).toBe(2); // Pre-condition

      // Act
      const result = queue.remove('b');

      // Assert
      expect(result).toBe(entityB); // Correct entity returned
      expect(queue.size()).toBe(1); // Size decreased
      expect(queue.peek()).toBe(entityA); // A is still at the front
      expect(queue.toArray()).toEqual([entityA]); // Only A remains
    });

    // Test Case 4.4 (Remove Only Item)
    it('Test Case 4.4: should remove the only item by ID and return it, leaving the queue empty', () => {
      // Arrange
      queue.add(entityA);
      expect(queue.size()).toBe(1); // Pre-condition

      // Act
      const result = queue.remove('a');

      // Assert
      expect(result).toBe(entityA); // Correct entity returned
      expect(queue.size()).toBe(0); // Size is now 0
      expect(queue.isEmpty()).toBe(true); // Queue is empty
      expect(queue.peek()).toBeNull(); // Peek returns null
      expect(queue.toArray()).toEqual([]); // Array is empty
    });

    // Test Case 4.5 (Remove Non-Existent ID)
    it('Test Case 4.5: should return null when trying to remove a non-existent ID', () => {
      // Arrange
      queue.add(entityA);
      queue.add(entityB);
      expect(queue.size()).toBe(2); // Pre-condition

      // Act
      const result = queue.remove('c');

      // Assert
      expect(result).toBeNull(); // Should return null
      expect(queue.size()).toBe(2); // Size should remain unchanged
      expect(queue.peek()).toBe(entityA); // A is still at the front
      expect(queue.toArray()).toEqual([entityA, entityB]); // Queue content unchanged
    });

    // Test Case 4.6 (Remove From Empty Queue)
    it('Test Case 4.6: should return null when trying to remove from an empty queue', () => {
      // Arrange: queue is empty from beforeEach
      expect(queue.isEmpty()).toBe(true); // Pre-condition

      // Act
      const result = queue.remove('a');

      // Assert
      expect(result).toBeNull(); // Should return null
      expect(queue.size()).toBe(0); // Size remains 0
      expect(queue.isEmpty()).toBe(true); // Still empty
    });

    // Test Case 4.7 (Remove with Invalid ID - null)
    it('Test Case 4.7a: should return null when trying to remove with a null ID and not throw', () => {
      // Arrange
      queue.add(entityA);
      expect(queue.size()).toBe(1); // Pre-condition

      // Act
      let result = null;
      expect(() => {
        // @ts-ignore // Suppress TypeScript error for testing invalid input
        result = queue.remove(null);
      }).not.toThrow(); // Implementation should not throw

      // Assert
      expect(result).toBeNull(); // findIndex won't match null, so returns null
      expect(queue.size()).toBe(1); // Size remains unchanged
      expect(queue.toArray()).toEqual([entityA]); // Queue content unchanged
    });

    // Test Case 4.7 (Remove with Invalid ID - undefined)
    it('Test Case 4.7b: should return null when trying to remove with an undefined ID and not throw', () => {
      // Arrange
      queue.add(entityA);
      expect(queue.size()).toBe(1); // Pre-condition

      // Act
      let result = null;
      expect(() => {
        // @ts-ignore // Suppress TypeScript error for testing invalid input
        result = queue.remove(undefined);
      }).not.toThrow(); // Implementation should not throw

      // Assert
      expect(result).toBeNull(); // findIndex won't match undefined, so returns null
      expect(queue.size()).toBe(1); // Size remains unchanged
      expect(queue.toArray()).toEqual([entityA]); // Queue content unchanged
    });
  }); // End describe('remove() Method Functionality')
}); // End describe('SimpleRoundRobinQueue')
