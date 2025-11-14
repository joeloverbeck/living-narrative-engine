/**
 * @file Unit tests for MinHeap binary min-heap implementation.
 * Tests basic operations, heap property maintenance, advanced operations, and edge cases.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import MinHeap from '../../../../src/goap/planner/minHeap.js';

describe('MinHeap - Basic Operations', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should require comparison function in constructor', () => {
    expect(() => new MinHeap()).toThrow('compareFn must be a function');
    expect(() => new MinHeap(null)).toThrow('compareFn must be a function');
    expect(() => new MinHeap('not a function')).toThrow('compareFn must be a function');
    expect(() => new MinHeap(42)).toThrow('compareFn must be a function');
  });

  it('should create empty heap', () => {
    const heap = new MinHeap((a, b) => a - b);

    expect(heap.isEmpty()).toBe(true);
    expect(heap.size).toBe(0);
  });

  it('should add item with push and not be empty', () => {
    const heap = new MinHeap((a, b) => a - b);

    heap.push(5);

    expect(heap.isEmpty()).toBe(false);
    expect(heap.size).toBe(1);
  });

  it('should remove minimum item with pop', () => {
    const heap = new MinHeap((a, b) => a - b);
    heap.push(5);
    heap.push(3);
    heap.push(7);

    const min = heap.pop();

    expect(min).toBe(3);
    expect(heap.size).toBe(2);
  });

  it('should return undefined when popping empty heap', () => {
    const heap = new MinHeap((a, b) => a - b);

    const result = heap.pop();

    expect(result).toBeUndefined();
    expect(heap.isEmpty()).toBe(true);
  });

  it('should return correct size', () => {
    const heap = new MinHeap((a, b) => a - b);

    expect(heap.size).toBe(0);

    heap.push(1);
    expect(heap.size).toBe(1);

    heap.push(2);
    expect(heap.size).toBe(2);

    heap.pop();
    expect(heap.size).toBe(1);

    heap.pop();
    expect(heap.size).toBe(0);
  });
});

describe('MinHeap - Heap Property', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should maintain min-heap property after multiple pushes', () => {
    const heap = new MinHeap((a, b) => a - b);
    const values = [10, 5, 15, 3, 7, 12, 18, 1, 8];

    values.forEach((val) => heap.push(val));

    // Verify heap property: each element should be >= minimum
    const sortedValues = [];
    while (!heap.isEmpty()) {
      sortedValues.push(heap.pop());
    }

    // Should be in ascending order (min-heap always pops minimum)
    expect(sortedValues).toEqual([1, 3, 5, 7, 8, 10, 12, 15, 18]);
  });

  it('should always pop minimum item', () => {
    const heap = new MinHeap((a, b) => a - b);
    heap.push(50);
    heap.push(30);
    heap.push(70);
    heap.push(20);
    heap.push(40);

    expect(heap.pop()).toBe(20);
    expect(heap.pop()).toBe(30);
    expect(heap.pop()).toBe(40);
    expect(heap.pop()).toBe(50);
    expect(heap.pop()).toBe(70);
    expect(heap.isEmpty()).toBe(true);
  });

  it('should maintain heap after mixed push and pop operations', () => {
    const heap = new MinHeap((a, b) => a - b);

    heap.push(5);
    heap.push(3);
    expect(heap.pop()).toBe(3);

    heap.push(7);
    heap.push(1);
    expect(heap.pop()).toBe(1);

    heap.push(10);
    heap.push(2);
    expect(heap.pop()).toBe(2);

    expect(heap.pop()).toBe(5);
    expect(heap.pop()).toBe(7);
    expect(heap.pop()).toBe(10);
    expect(heap.isEmpty()).toBe(true);
  });
});

describe('MinHeap - Advanced Operations', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should find item index with predicate', () => {
    const heap = new MinHeap((a, b) => a.value - b.value);
    const items = [
      { id: 'a', value: 5 },
      { id: 'b', value: 3 },
      { id: 'c', value: 7 },
    ];

    items.forEach((item) => heap.push(item));

    const index = heap.findIndex((item) => item.id === 'c');

    expect(index).toBeGreaterThanOrEqual(0);
    expect(heap.get(index).id).toBe('c');
  });

  it('should return -1 when item not found', () => {
    const heap = new MinHeap((a, b) => a - b);
    heap.push(1);
    heap.push(2);
    heap.push(3);

    const index = heap.findIndex((item) => item === 99);

    expect(index).toBe(-1);
  });

  it('should get item without removing', () => {
    const heap = new MinHeap((a, b) => a - b);
    heap.push(5);
    heap.push(3);
    heap.push(7);

    const minItem = heap.get(0);

    expect(minItem).toBe(3);
    expect(heap.size).toBe(3); // Not removed
    expect(heap.pop()).toBe(3); // Still there
  });

  it('should remove item and maintain heap property', () => {
    const heap = new MinHeap((a, b) => a - b);
    heap.push(5);
    heap.push(3);
    heap.push(7);
    heap.push(1);
    heap.push(9);

    const index = heap.findIndex((item) => item === 3);
    heap.remove(index);

    expect(heap.size).toBe(4);

    const remaining = [];
    while (!heap.isEmpty()) {
      remaining.push(heap.pop());
    }

    expect(remaining).toEqual([1, 5, 7, 9]);
  });

  it('should handle remove on last item', () => {
    const heap = new MinHeap((a, b) => a - b);
    heap.push(5);
    heap.push(3);
    heap.push(7);

    heap.remove(heap.size - 1); // Remove last item

    expect(heap.size).toBe(2);
    expect(heap.pop()).toBe(3);
    expect(heap.pop()).toBe(5);
  });

  it('should handle remove on root', () => {
    const heap = new MinHeap((a, b) => a - b);
    heap.push(5);
    heap.push(3);
    heap.push(7);
    heap.push(1);

    heap.remove(0); // Remove root (minimum)

    expect(heap.size).toBe(3);
    expect(heap.pop()).toBe(3);
    expect(heap.pop()).toBe(5);
    expect(heap.pop()).toBe(7);
  });

  it('should throw error on invalid remove index', () => {
    const heap = new MinHeap((a, b) => a - b);
    heap.push(1);
    heap.push(2);

    expect(() => heap.remove(-1)).toThrow('Invalid index: -1');
    expect(() => heap.remove(5)).toThrow('Invalid index: 5');
    expect(() => heap.remove(heap.size)).toThrow(`Invalid index: ${heap.size}`);
  });
});

describe('MinHeap - Edge Cases', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should handle large heap efficiently', () => {
    const heap = new MinHeap((a, b) => a - b);
    const itemCount = 1000;

    // Push 1000 items
    const pushStart = Date.now();
    for (let i = itemCount; i > 0; i--) {
      heap.push(i);
    }
    const pushTime = Date.now() - pushStart;

    expect(heap.size).toBe(itemCount);
    expect(pushTime).toBeLessThan(10); // < 10ms for 1000 pushes

    // Pop 1000 items
    const popStart = Date.now();
    const results = [];
    while (!heap.isEmpty()) {
      results.push(heap.pop());
    }
    const popTime = Date.now() - popStart;

    expect(results.length).toBe(itemCount);
    expect(popTime).toBeLessThan(10); // < 10ms for 1000 pops

    // Verify items came out in sorted order
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i]).toBeLessThanOrEqual(results[i + 1]);
    }
  });

  it('should handle duplicate values', () => {
    const heap = new MinHeap((a, b) => a - b);
    heap.push(5);
    heap.push(3);
    heap.push(5);
    heap.push(3);
    heap.push(7);
    heap.push(3);

    const results = [];
    while (!heap.isEmpty()) {
      results.push(heap.pop());
    }

    expect(results).toEqual([3, 3, 3, 5, 5, 7]);
  });

  it('should handle single item heap', () => {
    const heap = new MinHeap((a, b) => a - b);
    heap.push(42);

    expect(heap.isEmpty()).toBe(false);
    expect(heap.size).toBe(1);
    expect(heap.get(0)).toBe(42);
    expect(heap.pop()).toBe(42);
    expect(heap.isEmpty()).toBe(true);
  });

  it('should handle complex objects with custom comparator', () => {
    const heap = new MinHeap((a, b) => a.priority - b.priority);

    const items = [
      { id: 'task1', priority: 10 },
      { id: 'task2', priority: 5 },
      { id: 'task3', priority: 15 },
      { id: 'task4', priority: 3 },
    ];

    items.forEach((item) => heap.push(item));

    expect(heap.pop().id).toBe('task4'); // priority 3
    expect(heap.pop().id).toBe('task2'); // priority 5
    expect(heap.pop().id).toBe('task1'); // priority 10
    expect(heap.pop().id).toBe('task3'); // priority 15
  });
});

describe('MinHeap - PlanningNode Integration', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should work with PlanningNode-like objects', () => {
    const heap = new MinHeap((a, b) => a.fScore - b.fScore);

    // Simulate PlanningNode objects with fScore
    const nodes = [
      { id: 'node1', fScore: 10, gScore: 5, hScore: 5 },
      { id: 'node2', fScore: 7, gScore: 3, hScore: 4 },
      { id: 'node3', fScore: 12, gScore: 6, hScore: 6 },
      { id: 'node4', fScore: 5, gScore: 2, hScore: 3 },
    ];

    nodes.forEach((node) => heap.push(node));

    expect(heap.pop().id).toBe('node4'); // fScore 5
    expect(heap.pop().id).toBe('node2'); // fScore 7
    expect(heap.pop().id).toBe('node1'); // fScore 10
    expect(heap.pop().id).toBe('node3'); // fScore 12
  });

  it('should support duplicate detection for A* algorithm', () => {
    const heap = new MinHeap((a, b) => a.fScore - b.fScore);

    const node1 = { id: 'state-A', fScore: 10 };
    const node2 = { id: 'state-B', fScore: 8 };
    const node3 = { id: 'state-A', fScore: 7 }; // Duplicate state, better path

    heap.push(node1);
    heap.push(node2);

    // Find existing node for state-A
    const existingIndex = heap.findIndex((n) => n.id === 'state-A');
    expect(existingIndex).toBeGreaterThanOrEqual(0);

    // Remove old path
    heap.remove(existingIndex);

    // Add new better path
    heap.push(node3);

    expect(heap.size).toBe(2);
    expect(heap.pop().id).toBe('state-A'); // Better path (fScore 7)
    expect(heap.pop().id).toBe('state-B'); // fScore 8
  });
});
