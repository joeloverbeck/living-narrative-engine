// src/tests/turns/order/queues/initiativePriorityQueue.remove.test.js

/**
 * @file Unit tests for the InitiativePriorityQueue class, focusing on the remove() method (lazy removal).
 * Ticket: TEST-TURN-ORDER-001.10.11
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  jest,
  afterEach,
} from '@jest/globals';
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

  // Mock console.warn before each test to check for specific warnings
  let consoleWarnSpy;

  beforeEach(() => {
    queue = new InitiativePriorityQueue();
    entityA = { id: 'a', name: 'Entity A' };
    entityB = { id: 'b', name: 'Entity B' };

    // Reset and spy on console.warn
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {}); // Suppress warnings in test output
  });

  afterEach(() => {
    // Restore console.warn mock after each test
    consoleWarnSpy.mockRestore();
  });

  // --- Test Suite for remove() Method Functionality (TEST-TURN-ORDER-001.10.11) ---
  describe('remove() Method Functionality (Lazy Removal)', () => {
    it('removes an existing entity without affecting other entries', () => {
      queue.add(entityA, 10);
      queue.add(entityB, 5);

      const result = queue.remove('a');

      expect(result).toBe(entityA);
      expect(queue.size()).toBe(1);
      expect(queue.peek()).toBe(entityB);
      expect(queue.getNext()).toBe(entityB);
      expect(queue.size()).toBe(0);
    });

    it('returns null when removing a non-existent entity and leaves the queue unchanged', () => {
      queue.add(entityA, 10);

      const result = queue.remove('b');

      expect(result).toBeNull();
      expect(queue.size()).toBe(1);
      expect(queue.peek()).toBe(entityA);
      expect(queue.toArray()).toEqual([entityA]);
    });

    it('is idempotent when removing the same entity multiple times', () => {
      queue.add(entityA, 10);

      expect(queue.remove('a')).toBe(entityA);
      expect(queue.size()).toBe(0);
      expect(queue.peek()).toBeNull();

      expect(queue.remove('a')).toBeNull();
      expect(queue.size()).toBe(0);
      expect(queue.getNext()).toBeNull();
    });

    it('gracefully handles removal requests when the queue is empty', () => {
      expect(queue.remove('a')).toBeNull();
      expect(queue.size()).toBe(0);
      expect(queue.peek()).toBeNull();

      queue.add(entityB, 7);
      expect(queue.size()).toBe(1);
      expect(queue.peek()).toBe(entityB);
    });

    it('warns and ignores removal requests with invalid identifiers', () => {
      queue.add(entityA, 10);

      expect(queue.remove('')).toBeNull();
      expect(queue.remove(null)).toBeNull();
      expect(queue.remove(undefined)).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledTimes(3);
      expect(queue.size()).toBe(1);
      expect(queue.peek()).toBe(entityA);
    });

    it('discards stale entries when an entity is re-added after removal', () => {
      queue.add(entityA, 5);
      queue.add(entityB, 10);

      const removed = queue.remove('a');
      expect(removed).toBe(entityA);

      const updatedEntityA = { id: 'a', name: 'Entity A (updated)' };
      queue.add(updatedEntityA, 20);

      expect(queue.size()).toBe(2);
      expect(queue.getNext()).toBe(updatedEntityA);
      expect(queue.getNext()).toBe(entityB);
      expect(queue.getNext()).toBeNull();
      expect(queue.isEmpty()).toBe(true);
    });
  }); // End describe('remove() Method Functionality')
}); // End describe('InitiativePriorityQueue')
