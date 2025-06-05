// src/tests/turns/order/queues/simpleRoundRobinQueue.isEmpty.test.js

/**
 * @file Unit tests for the SimpleRoundRobinQueue class.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { SimpleRoundRobinQueue } from '../../../../src/turns/order/queues/simpleRoundRobinQueue.js'; // Adjust path as needed

// Mock Entity type for testing
// Using a simplified mock type consistent with previous examples in the file
// Note: The ticket references TASK-TURN-ORDER-001.2 which defines the Entity type.
// Assuming Entity requires at least an 'id'.
/** @typedef {{ id: string; name?: string; }} Entity */

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

  // --- Test Suite for isEmpty() and size() Methods (TEST-TURN-ORDER-001.10.5) ---
  describe('isEmpty() and size() Methods Functionality', () => {
    // Test Case 5.1 (Initial State)
    it('Test Case 5.1: should report isEmpty true and size 0 for a new queue', () => {
      // Arrange: queue is new from beforeEach

      // Act & Assert
      expect(queue.isEmpty()).toBe(true);
      expect(queue.size()).toBe(0);
    });

    // Test Case 5.2 (After Add)
    it('Test Case 5.2: should report isEmpty false and size 1 after adding one entity', () => {
      // Arrange
      queue.add(entityA);

      // Act & Assert
      expect(queue.isEmpty()).toBe(false);
      expect(queue.size()).toBe(1);
    });

    // Test Case 5.3 (After Multiple Adds)
    it('Test Case 5.3: should report isEmpty false and size 2 after adding two entities', () => {
      // Arrange
      queue.add(entityA);
      queue.add(entityB);

      // Act & Assert
      expect(queue.isEmpty()).toBe(false);
      expect(queue.size()).toBe(2);
    });

    // Test Case 5.4 (After getNext)
    it('Test Case 5.4: should report correct size and isEmpty after getNext removes one entity', () => {
      // Arrange
      queue.add(entityA);
      queue.add(entityB);
      queue.getNext(); // Remove entityA

      // Act & Assert
      expect(queue.isEmpty()).toBe(false);
      expect(queue.size()).toBe(1); // Should have entityB left
    });

    // Test Case 5.5 (After getNext empties queue)
    it('Test Case 5.5: should report isEmpty true and size 0 after getNext removes the last entity', () => {
      // Arrange
      queue.add(entityA);
      queue.getNext(); // Remove entityA

      // Act & Assert
      expect(queue.isEmpty()).toBe(true);
      expect(queue.size()).toBe(0);
    });

    // Test Case 5.6 (After Remove)
    it('Test Case 5.6: should report correct size and isEmpty after remove() removes one entity', () => {
      // Arrange
      queue.add(entityA);
      queue.add(entityB);
      queue.remove('a'); // Remove entityA

      // Act & Assert
      expect(queue.isEmpty()).toBe(false);
      expect(queue.size()).toBe(1); // Should have entityB left
    });

    // Test Case 5.7 (After Remove empties queue)
    it('Test Case 5.7: should report isEmpty true and size 0 after remove() removes the last entity', () => {
      // Arrange
      queue.add(entityA);
      queue.remove('a'); // Remove entityA

      // Act & Assert
      expect(queue.isEmpty()).toBe(true);
      expect(queue.size()).toBe(0);
    });

    // Test Case 5.8 (After Clear)
    it('Test Case 5.8: should report isEmpty true and size 0 after clear() is called', () => {
      // Arrange
      queue.add(entityA);
      queue.add(entityB);
      queue.clear(); // Clear the queue

      // Act & Assert
      expect(queue.isEmpty()).toBe(true);
      expect(queue.size()).toBe(0);
    });
  }); // End describe('isEmpty() and size() Methods Functionality')

  // TODO: Add other test suites as needed (e.g., for clear(), toArray())
}); // End describe('SimpleRoundRobinQueue')
