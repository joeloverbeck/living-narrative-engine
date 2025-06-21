// src/tests/turns/order/queues/simpleRoundRobinQueue.getNext.test.js

/**
 * @file Unit tests for the SimpleRoundRobinQueue class.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { SimpleRoundRobinQueue } from '../../../../../src/turns/order/queues/simpleRoundRobinQueue.js'; // Adjust path as needed

// Mock Entity type for testing
/** @typedef {{ id: string; name: string; }} Entity */ // Simplified mock type

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

  // --- Test Suite for getNext() Method (TEST-TURN-ORDER-001.10.2) ---
  describe('getNext() Method Functionality', () => {
    // Test Case 2.1 (Get From Single Item Queue)
    it('Test Case 2.1: should retrieve and remove the only entity from a single-item queue', () => {
      // Arrange
      queue.add(entityA);
      expect(queue.size()).toBe(1); // Pre-condition check

      // Act
      const result = queue.getNext();

      // Assert
      expect(result).toBe(entityA);
      expect(queue.size()).toBe(0);
      expect(queue.isEmpty()).toBe(true);
      expect(queue.peek()).toBeNull(); // After getting the last item, peek should be null
    });

    // Test Case 2.2 (Get Multiple - FIFO Order)
    it('Test Case 2.2: should retrieve and remove multiple entities in FIFO order', () => {
      // Arrange
      queue.add(entityA);
      queue.add(entityB);
      expect(queue.size()).toBe(2); // Pre-condition check

      // Act
      const result1 = queue.getNext();
      const result2 = queue.getNext();

      // Assert
      expect(result1).toBe(entityA); // First In is First Out
      expect(result2).toBe(entityB); // Second In is Second Out
      expect(queue.size()).toBe(0);
      expect(queue.isEmpty()).toBe(true);
      expect(queue.peek()).toBeNull();
    });

    // Test Case 2.3 (Get From Empty Queue)
    it('Test Case 2.3: should return null when attempting to get from an empty queue', () => {
      // Arrange: queue is empty from beforeEach
      expect(queue.isEmpty()).toBe(true); // Pre-condition check

      // Act
      const result = queue.getNext();

      // Assert
      expect(result).toBeNull();
      expect(queue.size()).toBe(0);
      expect(queue.isEmpty()).toBe(true);
    });

    // Test Case 2.4 (Get After Add/Get Sequence)
    it('Test Case 2.4: should correctly get the next entity after a sequence of adds and gets', () => {
      // Arrange
      queue.add(entityA);
      queue.add(entityB);
      const firstResult = queue.getNext(); // Get and discard entityA
      expect(firstResult).toBe(entityA); // Verify the discard was correct
      queue.add(entityC); // Add entityC after A was removed
      expect(queue.size()).toBe(2); // Queue should now have B, then C
      expect(queue.peek()).toBe(entityB); // B should be next

      // Act
      const result = queue.getNext(); // Get the next entity (should be B)

      // Assert
      expect(result).toBe(entityB); // Verify B was retrieved
      expect(queue.peek()).toBe(entityC); // C should now be at the front
      expect(queue.size()).toBe(1); // Only C should remain
      expect(queue.isEmpty()).toBe(false);
      expect(queue.toArray()).toEqual([entityC]); // Check remaining entity
    });
  }); // End describe('getNext() Method Functionality')
}); // End describe('SimpleRoundRobinQueue')
