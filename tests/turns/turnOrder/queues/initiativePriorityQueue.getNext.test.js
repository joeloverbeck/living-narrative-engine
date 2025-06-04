// src/tests/core/turnOrder/queues/initiativePriorityQueue.getNext.test.js

/**
 * @file Unit tests for the InitiativePriorityQueue class, focusing on the getNext() method.
 * Ticket: TEST-TURN-ORDER-001.10.9
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

  // --- Test Suite for getNext() Method Functionality (TEST-TURN-ORDER-001.10.9) ---
  describe('getNext() Method Functionality', () => {
    // Test Case 9.1 (Get From Single Item Queue)
    it('Test Case 9.1: should return and remove the only entity from a single-item queue', () => {
      // Arrange
      queue.add(entityA, 10);
      expect(queue.size()).toBe(1);
      expect(queue.isEmpty()).toBe(false);

      // Act
      const result = queue.getNext();

      // Assert
      expect(result).toBe(entityA);
      expect(queue.size()).toBe(0);
      expect(queue.isEmpty()).toBe(true);
      expect(queue.peek()).toBeNull(); // Verify queue is truly empty
    });

    // Test Case 9.2 (Get Multiple - Priority Order) - CORRECTED STRUCTURE
    it('Test Case 9.2: should return entities in descending priority order', () => {
      // Arrange
      queue.add(entityA, 5); // Lowest priority
      queue.add(entityB, 15); // Highest priority
      queue.add(entityC, 10); // Mid priority
      expect(queue.size()).toBe(3); // Initial check

      // Act & Assert 1
      console.log('--- Test 9.2: Before getNext() #1 ---');
      const result1 = queue.getNext();
      console.log('--- Test 9.2: After getNext() #1 ---');
      expect(result1).toBe(entityB); // Highest priority first (15)
      console.log('--- Test 9.2: Before size() check #1 ---');
      expect(queue.size()).toBe(2); // <<< Check size immediately
      console.log('--- Test 9.2: After size() check #1 ---');

      // Act & Assert 2
      console.log('--- Test 9.2: Before getNext() #2 ---');
      const result2 = queue.getNext();
      console.log('--- Test 9.2: After getNext() #2 ---');
      expect(result2).toBe(entityC); // Next priority (10)
      console.log('--- Test 9.2: Before size() check #2 ---');
      expect(queue.size()).toBe(1); // <<< Check size immediately
      console.log('--- Test 9.2: After size() check #2 ---');

      // Act & Assert 3
      console.log('--- Test 9.2: Before getNext() #3 ---');
      const result3 = queue.getNext();
      console.log('--- Test 9.2: After getNext() #3 ---');
      expect(result3).toBe(entityA); // Lowest priority last (5)
      console.log('--- Test 9.2: Before size() check #3 ---');
      expect(queue.size()).toBe(0); // <<< Check size immediately
      console.log('--- Test 9.2: After size() check #3 ---');

      // Act & Assert 4 (Check empty)
      console.log('--- Test 9.2: Before getNext() #4 ---');
      const result4 = queue.getNext(); // Try getting one more
      console.log('--- Test 9.2: After getNext() #4 ---');
      expect(result4).toBeNull(); // Queue is now empty
      expect(queue.isEmpty()).toBe(true); // Verify empty state
      expect(queue.size()).toBe(0); // Double-check size is still 0
    });

    // Test Case 9.3 (Get From Empty Queue)
    it('Test Case 9.3: should return null when getting from an empty queue', () => {
      // Arrange: Queue is already empty via beforeEach
      expect(queue.size()).toBe(0);
      expect(queue.isEmpty()).toBe(true);

      // Act
      const result = queue.getNext();

      // Assert
      expect(result).toBeNull();
      expect(queue.size()).toBe(0); // Size should remain 0
      expect(queue.isEmpty()).toBe(true);
    });

    // Test Case 9.4 (Get Skips Lazily Removed Item)
    it('Test Case 9.4: should skip a lazily removed item and return the next valid one', () => {
      // Arrange
      queue.add(entityA, 5);
      queue.add(entityB, 15); // B is initially highest priority
      expect(queue.peek()).toBe(entityB);
      expect(queue.size()).toBe(2);

      queue.remove('b'); // Lazily remove B

      // Verify state after removal: size reflects removal, peek cleans up and shows next
      expect(queue.size()).toBe(1);
      expect(queue.peek()).toBe(entityA); // Peek should skip B and show A

      // Act
      const result = queue.getNext(); // Should retrieve A, skipping B

      // Assert
      expect(result).toBe(entityA);
      expect(queue.size()).toBe(0);
      expect(queue.isEmpty()).toBe(true);
      expect(queue.peek()).toBeNull();
      // Note: Cannot directly assert on the internal #removedEntityIds set being empty,
      // but the correct retrieval of A and the final empty state confirm B was processed.
    });

    // Test Case 9.5 (Get Skips Multiple Lazily Removed Items)
    it('Test Case 9.5: should skip multiple lazily removed items', () => {
      // Arrange
      queue.add(entityA, 5); // Lowest
      queue.add(entityB, 15); // Highest
      queue.add(entityC, 10); // Middle
      expect(queue.size()).toBe(3);
      expect(queue.peek()).toBe(entityB);

      queue.remove('b'); // Lazily remove highest
      queue.remove('c'); // Lazily remove middle

      // Verify state after removals
      expect(queue.size()).toBe(1); // Only A should be left effectively
      expect(queue.peek()).toBe(entityA); // Peek should skip B and C

      // Act
      const result = queue.getNext(); // Should retrieve A

      // Assert
      expect(result).toBe(entityA);
      expect(queue.size()).toBe(0);
      expect(queue.isEmpty()).toBe(true);
      expect(queue.peek()).toBeNull();
    });

    // Test Case 9.6 (Get When Only Removed Items Remain)
    it('Test Case 9.6: should return null if all remaining items have been lazily removed', () => {
      // Arrange
      queue.add(entityA, 10);
      queue.add(entityB, 5);
      expect(queue.size()).toBe(2);

      queue.remove('a'); // Remove A (higher priority)
      queue.remove('b'); // Remove B

      // Verify state after removals
      expect(queue.size()).toBe(0); // Queue should be effectively empty
      expect(queue.peek()).toBeNull(); // Peek should return null

      // Act
      const result = queue.getNext(); // Should find no valid items

      // Assert
      expect(result).toBeNull();
      expect(queue.size()).toBe(0);
      expect(queue.isEmpty()).toBe(true);
    });

    // Test Case 9.7 (Get Correctly Handles Internal Removed Set - Indirect Verification)
    it('Test Case 9.7: should correctly handle internal state after getNext and allow re-adding', () => {
      // Arrange
      queue.add(entityA, 10);
      expect(queue.size()).toBe(1);

      // Act: Get the only item
      const result = queue.getNext();

      // Assert: Initial retrieval and empty state
      expect(result).toBe(entityA);
      expect(queue.size()).toBe(0);
      expect(queue.isEmpty()).toBe(true);
      expect(queue.peek()).toBeNull();

      // Arrange (Part 2): Re-add the same entity with a different priority
      queue.add(entityA, 5); // Re-add 'a'

      // Assert (Part 2): Verify it was successfully re-added and is now the top item
      expect(queue.size()).toBe(1);
      expect(queue.isEmpty()).toBe(false);
      expect(queue.peek()).toBe(entityA); // Should be able to peek 'a' again

      // Act (Part 2): Get the re-added item
      const result2 = queue.getNext();

      // Assert (Part 3): Verify successful retrieval and final empty state
      expect(result2).toBe(entityA);
      expect(queue.size()).toBe(0);
      expect(queue.isEmpty()).toBe(true);
      // This sequence implicitly verifies that getNext() processed 'a' correctly,
      // potentially adding it to an internal removed set temporarily (as per impl. notes),
      // and that the subsequent add() correctly cleared that state, allowing 'a' to be active again.
    });
  }); // End describe('getNext() Method Functionality')
}); // End describe('InitiativePriorityQueue')
