// src/tests/core/turnOrder/queues/initiativePriorityQueue.toArray.test.js

/**
 * @fileoverview Unit tests for the InitiativePriorityQueue class, focusing on the toArray() method and lazy removal.
 * Ticket: TEST-TURN-ORDER-001.10.16
 */

import {describe, it, expect, beforeEach} from '@jest/globals';
import {InitiativePriorityQueue} from '../../../../core/turnOrder/queues/initiativePriorityQueue.js'; // Adjust path as needed

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
    /** @type {Entity} */
    let entityD; // Extra entity for copy test

    beforeEach(() => {
        queue = new InitiativePriorityQueue();
        entityA = {id: 'a', name: 'Entity A'};
        entityB = {id: 'b', name: 'Entity B'};
        entityC = {id: 'c', name: 'Entity C'};
        entityD = {id: 'd', name: 'Entity D'}; // Extra entity
    });

    // --- Test Suite for toArray() Method (Considering Lazy Removal) (TEST-TURN-ORDER-001.10.16) ---
    describe('toArray() Method Functionality (Considering Lazy Removal)', () => {

        // Test Case 16.1 (toArray on Empty Queue)
        it('Test Case 16.1: should return an empty array for an empty queue', () => {
            // Arrange: Queue is empty (from beforeEach)
            expect(queue.isEmpty()).toBe(true);

            // Act
            const result = queue.toArray();

            // Assert
            expect(result).toEqual([]);
            expect(result.length).toBe(0);
        });

        // Test Case 16.2 (toArray on Single Item Queue)
        it('Test Case 16.2: should return an array with the single entity for a queue with one item', () => {
            // Arrange
            queue.add(entityA, 10);
            expect(queue.size()).toBe(1);

            // Act
            const result = queue.toArray();

            // Assert
            expect(result).toEqual([entityA]);
            expect(result.length).toBe(1);
        });

        // Test Case 16.3 (toArray on Multiple Items - Order Not Guaranteed)
        it('Test Case 16.3: should return an array containing all added entities (order not guaranteed)', () => {
            // Arrange
            queue.add(entityA, 5);
            queue.add(entityB, 15);
            queue.add(entityC, 10);
            expect(queue.size()).toBe(3);

            // Act
            const result = queue.toArray();

            // Assert
            expect(result.length).toBe(3);
            // Use expect.arrayContaining to check for presence regardless of order
            expect(result).toEqual(expect.arrayContaining([entityA, entityB, entityC]));
            // Ensure no duplicates or extra items
            expect(result.sort((x, y) => x.id.localeCompare(y.id))).toEqual([entityA, entityB, entityC].sort((x, y) => x.id.localeCompare(y.id)));
        });

        // Test Case 16.4 (toArray Excludes Removed Items)
        it('Test Case 16.4: should return an array excluding lazily removed entities', () => {
            // Arrange
            queue.add(entityA, 5);
            queue.add(entityB, 15);
            queue.add(entityC, 10);
            expect(queue.size()).toBe(3); // Pre-condition check
            queue.remove('b'); // Lazily remove entityB
            expect(queue.size()).toBe(2); // Size should reflect removal

            // Act
            const result = queue.toArray();

            // Assert
            expect(result.length).toBe(2);
            expect(result).toEqual(expect.arrayContaining([entityA, entityC]));
            expect(result).not.toEqual(expect.arrayContaining([entityB]));
            // More explicit checks:
            expect(result.includes(entityA)).toBe(true);
            expect(result.includes(entityC)).toBe(true);
            expect(result.includes(entityB)).toBe(false);
        });

        // Test Case 16.5 (toArray Returns Empty When All Removed)
        it('Test Case 16.5: should return an empty array when all entities have been lazily removed', () => {
            // Arrange
            queue.add(entityA, 10);
            queue.add(entityB, 5);
            expect(queue.size()).toBe(2); // Pre-condition check
            queue.remove('a');
            queue.remove('b');
            expect(queue.size()).toBe(0); // Queue should be effectively empty

            // Act
            const result = queue.toArray();

            // Assert
            expect(result).toEqual([]);
            expect(result.length).toBe(0);
        });

        // Test Case 16.6 (toArray Returns a Copy)
        it('Test Case 16.6: should return a copy of the internal data, not a reference', () => {
            // Arrange
            queue.add(entityA, 10);
            queue.add(entityC, 5);
            expect(queue.size()).toBe(2);

            const arrayCopy1 = queue.toArray();
            expect(arrayCopy1).toEqual(expect.arrayContaining([entityA, entityC]));
            expect(arrayCopy1.length).toBe(2);

            // Act: Modify the returned array copy
            arrayCopy1.push(entityD); // Add an unrelated entity
            arrayCopy1[0] = null;     // Modify an element
            arrayCopy1.pop();         // Remove an element

            // Assert: Original queue is unchanged
            expect(queue.size()).toBe(2); // Size should still be 2
            expect(queue.peek()).toBe(entityA); // Peek should still return the highest priority (A)

            // Assert: A new call to toArray returns the original, unmodified active entities
            const arrayCopy2 = queue.toArray();
            expect(arrayCopy2.length).toBe(2);
            expect(arrayCopy2).toEqual(expect.arrayContaining([entityA, entityC])); // Still contains original active entities
            expect(arrayCopy2).not.toContain(entityD); // Does not contain the added entity D
            expect(arrayCopy2).not.toContain(null);    // Does not contain the null modification

            // Ensure the two copies are different references
            expect(arrayCopy1).not.toBe(arrayCopy2); // Check they are different array instances
        });

    }); // End describe('toArray() Method Functionality')

}); // End describe('InitiativePriorityQueue')