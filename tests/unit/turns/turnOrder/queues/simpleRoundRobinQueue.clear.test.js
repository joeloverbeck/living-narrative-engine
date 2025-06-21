// src/tests/turns/order/queues/simpleRoundRobinQueue.clear.test.js

/**
 * @file Unit tests for the clear() method of the SimpleRoundRobinQueue class.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { SimpleRoundRobinQueue } from '../../../../../src/turns/order/queues/simpleRoundRobinQueue.js'; // Adjust path as needed

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

  beforeEach(() => {
    queue = new SimpleRoundRobinQueue();
    entityA = { id: 'a', name: 'Entity A' };
    entityB = { id: 'b', name: 'Entity B' };
  });

  // --- Test Suite for clear() Method (TEST-TURN-ORDER-001.10.6) ---
  describe('clear() Method Functionality', () => {
    // Test Case 6.1 (Clear Non-Empty Queue)
    it('Test Case 6.1: should correctly empty a non-empty queue', () => {
      // Arrange
      queue.add(entityA);
      queue.add(entityB);
      expect(queue.size()).toBe(2); // Pre-condition check
      expect(queue.isEmpty()).toBe(false); // Pre-condition check

      // Act
      queue.clear();

      // Assert
      expect(queue.size()).toBe(0);
      expect(queue.isEmpty()).toBe(true);
      expect(queue.peek()).toBeNull();
      expect(queue.getNext()).toBeNull(); // Calling getNext on an empty queue should return null
      expect(queue.toArray()).toEqual([]);
    });

    // Test Case 6.2 (Clear Empty Queue)
    it('Test Case 6.2: should have no effect on an already empty queue', () => {
      // Arrange
      expect(queue.size()).toBe(0); // Pre-condition check
      expect(queue.isEmpty()).toBe(true); // Pre-condition check

      // Act
      queue.clear();

      // Assert
      expect(queue.size()).toBe(0);
      expect(queue.isEmpty()).toBe(true);
      expect(queue.peek()).toBeNull();
      expect(queue.getNext()).toBeNull(); // Calling getNext on an empty queue should return null
      expect(queue.toArray()).toEqual([]);
    });
  }); // End describe('clear() Method Functionality')
}); // End describe('SimpleRoundRobinQueue')
