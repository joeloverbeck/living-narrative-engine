// src/tests/core/turnOrder/queues/simpleRoundRobinQueue.add.test.js

/**
 * @file Unit tests for the SimpleRoundRobinQueue class.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { SimpleRoundRobinQueue } from '../../../../src/turns/order/queues/simpleRoundRobinQueue.js'; // Adjust path as needed

// Mock Entity type for testing
/** @typedef {import('../../interfaces/ITurnOrderQueue.js').Entity} Entity */

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

  // --- Test Suite for add() Method (TEST-TURN-ORDER-001.10.1) ---
  describe('add() Method Functionality', () => {
    // Test Case 1.1 (Add Single)
    it('Test Case 1.1: should correctly add a single entity', () => {
      // Arrange: queue and entityA are set up in beforeEach

      // Act
      queue.add(entityA);

      // Assert
      expect(queue.size()).toBe(1);
      expect(queue.peek()).toBe(entityA);
      expect(queue.isEmpty()).toBe(false);
    });

    // Test Case 1.2 (Add Multiple - FIFO)
    it('Test Case 1.2: should add multiple entities in FIFO order', () => {
      // Arrange: queue, entityA, entityB are set up in beforeEach

      // Act
      queue.add(entityA);
      queue.add(entityB);

      // Assert
      expect(queue.size()).toBe(2);
      expect(queue.toArray()).toEqual([entityA, entityB]); // Check array contents and order
      expect(queue.peek()).toBe(entityA); // First added should be at the front
    });

    // Test Case 1.3 (Ignore Priority)
    it('Test Case 1.3: should ignore the priority parameter and maintain FIFO order', () => {
      // Arrange: queue, entityA, entityB are set up in beforeEach

      // Act
      queue.add(entityA, 10); // Higher priority value
      queue.add(entityB, 5); // Lower priority value

      // Assert
      expect(queue.size()).toBe(2);
      // Order should still be A then B, regardless of priority parameter
      expect(queue.toArray()).toEqual([entityA, entityB]);
      expect(queue.peek()).toBe(entityA); // First added is still first
    });

    // Test Case 1.4 (Invalid Entity - Null)
    it('Test Case 1.4: should throw an error when adding null and queue state remains unchanged', () => {
      // Arrange: queue is set up in beforeEach

      // Act & Assert
      expect(() => {
        queue.add(null);
      }).toThrow(Error); // Check for any Error
      // Optionally check for specific message if the implementation provides one:
      // .toThrow('SimpleRoundRobinQueue.add: Cannot add invalid or null entity.');

      // Assert queue state
      expect(queue.size()).toBe(0);
      expect(queue.isEmpty()).toBe(true);
      expect(queue.peek()).toBeNull();
    });

    // Test Case 1.5 (Invalid Entity - Missing ID)
    it('Test Case 1.5: should throw an error when adding an entity with no id property and queue state remains unchanged', () => {
      // Arrange: queue is set up in beforeEach
      const invalidEntity = { name: 'no id' }; // Missing 'id' property

      // Act & Assert
      expect(() => {
        // @ts-ignore // Suppress TypeScript error for testing invalid input
        queue.add(invalidEntity);
      }).toThrow(Error);
      // Optionally check specific message:
      // .toThrow('SimpleRoundRobinQueue.add: Cannot add invalid or null entity.');

      // Assert queue state
      expect(queue.size()).toBe(0);
      expect(queue.isEmpty()).toBe(true);
    });

    // Test Case 1.6 (Invalid Entity - Undefined ID)
    it('Test Case 1.6: should throw an error when adding an entity with undefined id and queue state remains unchanged', () => {
      // Arrange: queue is set up in beforeEach
      const invalidEntity = { id: undefined, name: 'undefined id' };

      // Act & Assert
      expect(() => {
        // @ts-ignore // Suppress TypeScript error for testing invalid input
        queue.add(invalidEntity);
      }).toThrow(Error);
      // Optionally check specific message:
      // .toThrow('SimpleRoundRobinQueue.add: Cannot add invalid or null entity.');

      // Assert queue state
      expect(queue.size()).toBe(0);
      expect(queue.isEmpty()).toBe(true);
    });
  }); // End describe('add() Method Functionality')
}); // End describe('SimpleRoundRobinQueue')
