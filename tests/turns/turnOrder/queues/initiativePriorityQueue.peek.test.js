// src/tests/core/turnOrder/queues/initiativePriorityQueue.peek.test.js

/**
 * @file Unit tests for the InitiativePriorityQueue class, focusing on the peek() method.
 * Ticket: TEST-TURN-ORDER-001.10.10
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
    entityA = { id: 'a', name: 'Entity A' };
    entityB = { id: 'b', name: 'Entity B' };
    entityC = { id: 'c', name: 'Entity C' };
  });

  // --- Test Suite for peek() Method Functionality (TEST-TURN-ORDER-001.10.10) ---
  describe('peek() Method Functionality', () => {
    // Test Case 10.1 (Peek Single Item Queue)
    it('Test Case 10.1: should return the highest priority entity without removal from a single-item queue', () => {
      // Arrange
      queue.add(entityA, 10);
      expect(queue.size()).toBe(1); // Ensure setup is correct

      // Act
      const result = queue.peek();

      // Assert
      expect(result).toBe(entityA);
      expect(queue.size()).toBe(1); // Size should remain unchanged
      // Verify it wasn't removed
      expect(queue.getNext()).toBe(entityA);
      expect(queue.size()).toBe(0);
    });

    // Test Case 10.2 (Peek Multiple Items - Priority)
    it('Test Case 10.2: should return the highest priority entity from a multi-item queue without removal', () => {
      // Arrange
      queue.add(entityA, 5); // Lower priority
      queue.add(entityB, 15); // Higher priority
      expect(queue.size()).toBe(2);

      // Act
      const result = queue.peek();

      // Assert
      expect(result).toBe(entityB); // B has higher priority
      expect(queue.size()).toBe(2); // Size should remain unchanged
      // Verify B wasn't removed and is still the next item
      expect(queue.getNext()).toBe(entityB);
      expect(queue.size()).toBe(1);
    });

    // Test Case 10.3 (Peek Empty Queue)
    it('Test Case 10.3: should return null when peeking into an empty queue', () => {
      // Arrange: Queue is empty via beforeEach
      expect(queue.size()).toBe(0);
      expect(queue.isEmpty()).toBe(true);

      // Act
      const result = queue.peek();

      // Assert
      expect(result).toBeNull();
      expect(queue.size()).toBe(0); // Size remains 0
      expect(queue.isEmpty()).toBe(true); // Still empty
    });

    // Test Case 10.4 (Multiple Peeks)
    it('Test Case 10.4: should return the same entity on multiple consecutive peeks without changing the queue', () => {
      // Arrange
      queue.add(entityA, 5);
      queue.add(entityB, 15); // B is highest
      expect(queue.size()).toBe(2);

      // Act
      const result1 = queue.peek();
      const sizeAfterPeek1 = queue.size();
      const result2 = queue.peek();
      const sizeAfterPeek2 = queue.size();

      // Assert
      expect(result1).toBe(entityB);
      expect(sizeAfterPeek1).toBe(2); // Size unchanged after first peek
      expect(result2).toBe(entityB); // Same result on second peek
      expect(sizeAfterPeek2).toBe(2); // Size still unchanged
      // Verify B wasn't removed
      expect(queue.getNext()).toBe(entityB);
      expect(queue.size()).toBe(1);
    });

    // Test Case 10.5 (Peek Skips Lazily Removed Item at Top)
    it('Test Case 10.5: should skip a lazily removed item at the top and return the next valid one', () => {
      // Arrange
      queue.add(entityA, 5); // Lower priority
      queue.add(entityB, 15); // Higher priority
      expect(queue.size()).toBe(2);
      expect(queue.peek()).toBe(entityB); // Verify B is initially at top

      queue.remove('b'); // Lazily remove B
      // Size immediately reflects the removal intent
      expect(queue.size()).toBe(1);

      // Act
      const result = queue.peek(); // Peek should trigger cleanup of 'b'

      // Assert
      expect(result).toBe(entityA); // Should return A as B is removed
      // Size remains 1 because peek only cleans up, doesn't remove the returned item
      expect(queue.size()).toBe(1);
      // Verify internal state: next item should be A
      expect(queue.getNext()).toBe(entityA);
      expect(queue.size()).toBe(0); // Queue is now empty
      expect(queue.peek()).toBeNull(); // Verify empty after getNext
      // Implicitly check: the removed set should be empty now after peek/getNext processed 'b'
    });

    // Test Case 10.6 (Peek Skips Multiple Lazily Removed Items at Top)
    it('Test Case 10.6: should skip multiple lazily removed items at the top', () => {
      // Arrange
      queue.add(entityA, 5); // Lowest
      queue.add(entityB, 15); // Highest
      queue.add(entityC, 10); // Middle
      expect(queue.size()).toBe(3);
      expect(queue.peek()).toBe(entityB); // Verify B is initially at top

      queue.remove('b'); // Lazily remove highest
      queue.remove('c'); // Lazily remove middle
      // Effective size is now 1 (only A)
      expect(queue.size()).toBe(1);

      // Act
      const result = queue.peek(); // Peek should trigger cleanup of B and C

      // Assert
      expect(result).toBe(entityA); // Should return A as B and C are removed
      expect(queue.size()).toBe(1); // Size remains 1 (only A is left and peek doesn't remove it)
      // Verify internal state: next item should be A
      expect(queue.getNext()).toBe(entityA);
      expect(queue.size()).toBe(0);
      expect(queue.peek()).toBeNull(); // Verify empty
    });

    // Test Case 10.7 (Peek When Only Removed Items Remain)
    it('Test Case 10.7: should return null if all items in the queue have been lazily removed', () => {
      // Arrange
      queue.add(entityA, 10);
      queue.add(entityB, 5);
      expect(queue.size()).toBe(2);

      queue.remove('a'); // Lazily remove A (higher priority)
      queue.remove('b'); // Lazily remove B
      // Effective size is now 0
      expect(queue.size()).toBe(0);

      // Act
      const result = queue.peek(); // Peek should process removed A and B, finding nothing valid

      // Assert
      expect(result).toBeNull();
      expect(queue.size()).toBe(0); // Size remains 0
      expect(queue.isEmpty()).toBe(true); // Still empty
      expect(queue.getNext()).toBeNull(); // Verify getNext also returns null
    });
  }); // End describe('peek() Method Functionality')
}); // End describe('InitiativePriorityQueue')
