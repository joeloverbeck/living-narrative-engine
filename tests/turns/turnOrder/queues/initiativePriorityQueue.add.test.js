// src/tests/core/turnOrder/queues/initiativePriorityQueue.add.test.js

/**
 * @fileoverview Unit tests for the InitiativePriorityQueue class, focusing on the add() method.
 * Ticket: TEST-TURN-ORDER-001.10.8
 */

import {describe, it, expect, beforeEach} from '@jest/globals';
import {InitiativePriorityQueue} from '../../../../src/turns/order/queues/initiativePriorityQueue.js'; // Adjust path as needed

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
        entityA = {id: 'a', name: 'Entity A'};
        entityB = {id: 'b', name: 'Entity B'};
        entityC = {id: 'c', name: 'Entity C'};
    });

    // --- Test Suite for add() Method Functionality (TEST-TURN-ORDER-001.10.8) ---
    describe('add() Method Functionality', () => {

        // Test Case 8.1 (Add Single)
        it('Test Case 8.1: should add a single entity correctly', () => {
            // Arrange: Queue is new. entityA is created.
            expect(queue.isEmpty()).toBe(true);

            // Act
            queue.add(entityA, 10);

            // Assert
            // Note: size() implementation in InitiativePriorityQueue relies on physical length minus removed IDs.
            // Here, physical length is 1, removed IDs size is 0.
            expect(queue.size()).toBe(1);
            expect(queue.peek()).toBe(entityA);
            expect(queue.isEmpty()).toBe(false);
        });

        // Test Case 8.2 (Add Multiple - Priority Order)
        it('Test Case 8.2: should add multiple entities and prioritize the one with higher priority', () => {
            // Arrange: Queue is new. entityA and entityB created.
            expect(queue.isEmpty()).toBe(true);

            // Act
            queue.add(entityA, 5);  // Lower priority
            queue.add(entityB, 10); // Higher priority

            // Assert
            expect(queue.size()).toBe(2);
            expect(queue.peek()).toBe(entityB); // Higher priority should be at the top
            expect(queue.isEmpty()).toBe(false);
        });

        // Test Case 8.3 (Add Multiple - Same Priority)
        it('Test Case 8.3: should add multiple entities with the same priority', () => {
            // Arrange: Queue is new. entityA and entityB created.
            expect(queue.isEmpty()).toBe(true);

            // Act
            queue.add(entityA, 10);
            queue.add(entityB, 10);

            // Assert
            expect(queue.size()).toBe(2);
            // The peek() result depends on the underlying heap implementation's tie-breaking,
            // which is often based on insertion order for stable sorts, but not guaranteed.
            // We just need to ensure *one* of them is at the top.
            const topEntity = queue.peek();
            expect([entityA, entityB]).toContain(topEntity);
            expect(queue.isEmpty()).toBe(false);
        });

        // Test Case 8.4 (Add with Negative/Zero Priority)
        it('Test Case 8.4: should handle negative and zero priorities correctly', () => {
            // Arrange: Queue is new. entityA, entityB, entityC created.
            expect(queue.isEmpty()).toBe(true);

            // Act
            queue.add(entityA, 0);
            queue.add(entityB, -5);
            queue.add(entityC, 5); // Highest priority

            // Assert
            expect(queue.size()).toBe(3);
            expect(queue.peek()).toBe(entityC); // C has the highest priority (5)
            expect(queue.isEmpty()).toBe(false);
        });

        // Test Case 8.5 (Add Invalid Entity - Null)
        it('Test Case 8.5: should throw an error when adding a null entity', () => {
            // Arrange: Queue is new.
            expect(queue.isEmpty()).toBe(true);

            // Act & Assert
            expect(() => {
                // @ts-ignore Test invalid input explicitly
                queue.add(null, 10);
            }).toThrow('InitiativePriorityQueue.add: Cannot add invalid entity');
            // Assert Queue state unchanged
            expect(queue.size()).toBe(0);
            expect(queue.isEmpty()).toBe(true);
            expect(queue.peek()).toBeNull();
        });

        // Test Case 8.6 (Add Invalid Entity - Missing ID)
        it('Test Case 8.6a: should throw an error when adding an entity missing the ID property', () => {
            // Arrange: Queue is new.
            const invalidEntity = {name: 'no id'};
            expect(queue.isEmpty()).toBe(true);

            // Act & Assert
            expect(() => {
                // @ts-ignore Test invalid input explicitly
                queue.add(invalidEntity, 10);
            }).toThrow('InitiativePriorityQueue.add: Cannot add invalid entity');
            // Assert Queue state unchanged
            expect(queue.size()).toBe(0);
            expect(queue.isEmpty()).toBe(true);
            expect(queue.peek()).toBeNull();
        });

        it('Test Case 8.6b: should throw an error when adding an entity with an empty string ID', () => {
            // Arrange: Queue is new.
            const invalidEntity = {id: '', name: 'empty id'};
            expect(queue.isEmpty()).toBe(true);

            // Act & Assert
            expect(() => {
                queue.add(invalidEntity, 10);
            }).toThrow('InitiativePriorityQueue.add: Cannot add invalid entity');
            // Assert Queue state unchanged
            expect(queue.size()).toBe(0);
            expect(queue.isEmpty()).toBe(true);
            expect(queue.peek()).toBeNull();
        });

        // Test Case 8.7 (Add Invalid Priority - Non-Finite)
        it('Test Case 8.7a: should throw an error when adding with Infinity priority', () => {
            // Arrange: Queue is new. entityA created.
            expect(queue.isEmpty()).toBe(true);

            // Act & Assert
            expect(() => {
                queue.add(entityA, Infinity);
            }).toThrow('InitiativePriorityQueue.add: Invalid priority value "Infinity"');
            // Assert Queue state unchanged
            expect(queue.size()).toBe(0);
            expect(queue.isEmpty()).toBe(true);
            expect(queue.peek()).toBeNull();
        });

        it('Test Case 8.7b: should throw an error when adding with NaN priority', () => {
            // Arrange: Queue is new. entityA created.
            expect(queue.isEmpty()).toBe(true);

            // Act & Assert
            expect(() => {
                queue.add(entityA, NaN);
            }).toThrow('InitiativePriorityQueue.add: Invalid priority value "NaN"');
            // Assert Queue state unchanged
            expect(queue.size()).toBe(0);
            expect(queue.isEmpty()).toBe(true);
            expect(queue.peek()).toBeNull();
        });

        it('Test Case 8.7c: should throw an error when adding with non-numeric priority', () => {
            // Arrange: Queue is new. entityA created.
            expect(queue.isEmpty()).toBe(true);

            // Act & Assert
            expect(() => {
                // @ts-ignore Test invalid input explicitly
                queue.add(entityA, 'abc');
            }).toThrow('InitiativePriorityQueue.add: Invalid priority value "abc"');
            // Assert Queue state unchanged
            expect(queue.size()).toBe(0);
            expect(queue.isEmpty()).toBe(true);
            expect(queue.peek()).toBeNull();
        });

        // Test Case 8.8 (Add Cancels Lazy Removal)
        it('Test Case 8.8: should cancel lazy removal when adding an entity that was previously removed', () => {
            // Arrange
            queue.add(entityA, 10);
            queue.add(entityB, 5);
            expect(queue.size()).toBe(2); // Physical size is 2
            queue.remove('a'); // Mark 'a' for lazy removal
            // After removal, size() should reflect the lazy removal
            expect(queue.size()).toBe(1);
            // Peek should skip 'a' if it's at the top, but here 'a' has higher priority
            // so peek should correctly return 'a' initially, but lazy removal is pending.
            // Let's verify the next *actual* item would be B after cleanup:
            expect(queue.peek()).toBe(entityB); // Peek cleans up 'a' and shows 'b'
            expect(queue.size()).toBe(1); // Size updates after peek cleans up

            // Act: Re-add entityA, this time with an even higher priority
            queue.add(entityA, 12);

            // Assert
            expect(queue.size()).toBe(2); // Should now contain active B(5) and active A(12)
            expect(queue.peek()).toBe(entityA); // A should be at the top due to the new higher priority
            expect(queue.isEmpty()).toBe(false);

            // Verify internal state implicitly: getNext() should now return A then B
            const first = queue.getNext();
            const second = queue.getNext();
            expect(first).toBe(entityA);
            expect(second).toBe(entityB);
            expect(queue.isEmpty()).toBe(true);
            // We cannot directly check #removedEntityIds, but the behavior confirms 'a' is no longer considered removed.
        });

    }); // End describe('add() Method Functionality')

}); // End describe('InitiativePriorityQueue')