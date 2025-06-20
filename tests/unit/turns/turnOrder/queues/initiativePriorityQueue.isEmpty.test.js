// src/tests/turns/order/queues/initiativePriorityQueue.isEmpty.test.js

/**
 * @file Unit tests for the InitiativePriorityQueue class, focusing on the isEmpty() method considering lazy removal.
 * Ticket: TEST-TURN-ORDER-001.10.13
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

  // --- Test Suite for isEmpty() Method (TEST-TURN-ORDER-001.10.13) ---
  describe('isEmpty() Method (Considering Lazy Removal)', () => {
    // Test Case 13.1 (Initial State)
    it('Test Case 13.1: isEmpty() should return true for a newly created queue', () => {
      // Arrange: Queue is created in beforeEach

      // Act
      const result = queue.isEmpty();

      // Assert
      expect(result).toBe(true);
      expect(queue.size()).toBe(0); // Also check size
    });

    // Test Case 13.2 (After Add)
    it('Test Case 13.2: isEmpty() should return false after adding an entity', () => {
      // Arrange
      queue.add(entityA, 10);

      // Act
      const result = queue.isEmpty();

      // Assert
      expect(result).toBe(false);
      expect(queue.size()).toBe(1); // Check size for consistency
    });

    // Test Case 13.3 (After Removing Last Active Item)
    it('Test Case 13.3: isEmpty() should return true after removing the only active entity via remove()', () => {
      // Arrange
      queue.add(entityA, 10);
      expect(queue.size()).toBe(1); // Pre-condition: not empty
      queue.remove('a');
      // Note: At this point, queue.length is 1, removedIds has 'a' (size 1).
      // size() calculates 1 - 1 = 0.

      // Act
      const result = queue.isEmpty();

      // Assert
      // isEmpty() relies on size(), which accounts for removed IDs.
      expect(result).toBe(true);
      expect(queue.size()).toBe(0); // Confirm size calculation
    });

    // Test Case 13.4 (After Getting Last Active Item)
    it('Test Case 13.4: isEmpty() should return true after getting the only active entity via getNext()', () => {
      // Arrange
      queue.add(entityA, 10);
      expect(queue.size()).toBe(1); // Pre-condition: not empty
      const retrievedEntity = queue.getNext();
      expect(retrievedEntity).toBe(entityA); // Ensure getNext worked

      // Act
      const result = queue.isEmpty();

      // Assert
      // getNext() physically removed the item.
      expect(result).toBe(true);
      expect(queue.size()).toBe(0); // Confirm queue is empty
    });

    // Test Case 13.5 (After Removing Item - Others Remain)
    it('Test Case 13.5: isEmpty() should return false if other active entities remain after a remove() call', () => {
      // Arrange
      queue.add(entityA, 10);
      queue.add(entityB, 5);
      expect(queue.size()).toBe(2); // Pre-condition: has two items
      queue.remove('a');
      // Note: queue.length is 2, removedIds has 'a' (size 1).
      // size() calculates 2 - 1 = 1.

      // Act
      const result = queue.isEmpty();

      // Assert
      // isEmpty() uses size(), which should be 1 here.
      expect(result).toBe(false);
      expect(queue.size()).toBe(1); // Confirm size calculation
      expect(queue.peek()).toBe(entityB); // Verify the remaining entity
    });

    // Test Case 13.6 (After Clear)
    it('Test Case 13.6: isEmpty() should return true after calling clear()', () => {
      // Arrange
      queue.add(entityA, 10);
      queue.add(entityB, 5);
      queue.remove('a'); // Add a removed ID to test clear comprehensively
      expect(queue.size()).toBe(1); // Pre-condition: effectively not empty
      expect(queue.isEmpty()).toBe(false); // Double-check pre-condition

      queue.clear();

      // Act
      const result = queue.isEmpty();

      // Assert
      expect(result).toBe(true);
      expect(queue.size()).toBe(0); // Confirm size is 0
      // Internal check (optional): Ensure removed set is also cleared
      // queue.add(entityA, 15); // Re-add A
      // queue.remove('c'); // Remove a non-existent item C
      // expect(queue.size()).toBe(0); // Size should be 0 (1 - 1)
      // queue.clear();
      // queue.add(entityC, 20); // Now add C
      // expect(queue.size()).toBe(1); // Should be 1 (1 - 0), confirming 'c' was cleared from removed set
    });
  }); // End describe('isEmpty() Method')
}); // End describe('InitiativePriorityQueue')
