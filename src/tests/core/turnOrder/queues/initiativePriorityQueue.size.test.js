// src/tests/core/turnOrder/queues/initiativePriorityQueue.size.test.js

/**
 * @fileoverview Unit tests for the InitiativePriorityQueue class, focusing on the size() method considering lazy removal.
 * Ticket: TEST-TURN-ORDER-001.10.14
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

    beforeEach(() => {
        queue = new InitiativePriorityQueue();
        entityA = {id: 'a', name: 'Entity A'};
        entityB = {id: 'b', name: 'Entity B'};
    });

    // --- Test Suite for size() Method (TEST-TURN-ORDER-001.10.14) ---
    describe('size() Method (Considering Lazy Removal)', () => {

        // Test Case 14.1 (Initial State)
        it('Test Case 14.1: should return 0 for a newly created queue', () => {
            // Arrange: Queue is created in beforeEach

            // Act
            const currentSize = queue.size();

            // Assert
            expect(currentSize).toBe(0);
        });

        // Test Case 14.2 (After Add)
        it('Test Case 14.2: should return 1 after adding one entity', () => {
            // Arrange
            queue.add(entityA, 10);

            // Act
            const currentSize = queue.size();

            // Assert
            expect(currentSize).toBe(1);
        });

        // Test Case 14.3 (After Multiple Adds)
        it('Test Case 14.3: should return 2 after adding two distinct entities', () => {
            // Arrange
            queue.add(entityA, 10);
            queue.add(entityB, 5);

            // Act
            const currentSize = queue.size();

            // Assert
            expect(currentSize).toBe(2);
        });

        // Test Case 14.4 (After Remove)
        it('Test Case 14.4: should return 1 after adding two entities and removing one via remove()', () => {
            // Arrange
            queue.add(entityA, 10);
            queue.add(entityB, 5);
            expect(queue.size()).toBe(2); // Pre-condition

            queue.remove('a'); // Lazily remove entityA

            // Act
            const currentSize = queue.size();

            // Assert
            // Internal state: queue.length = 2, removedIds = {'a'}
            // Size calculation: Math.max(0, 2 - 1) = 1
            expect(currentSize).toBe(1);
            expect(queue.peek()).toBe(entityB); // Verify B is still the active one
        });

        // Test Case 14.5 (After Removing Last Active Item)
        it('Test Case 14.5: should return 0 after adding one entity and removing it via remove()', () => {
            // Arrange
            queue.add(entityA, 10);
            expect(queue.size()).toBe(1); // Pre-condition

            queue.remove('a'); // Lazily remove entityA

            // Act
            const currentSize = queue.size();

            // Assert
            // Internal state: queue.length = 1, removedIds = {'a'}
            // Size calculation: Math.max(0, 1 - 1) = 0
            expect(currentSize).toBe(0);
            expect(queue.isEmpty()).toBe(true); // Should also report as empty
        });

        // Test Case 14.6 (After getNext)
        it('Test Case 14.6: should return 1 after adding two entities and getting one via getNext()', () => {
            // Arrange
            queue.add(entityA, 10);
            queue.add(entityB, 5);
            expect(queue.size()).toBe(2); // Pre-condition

            const retrievedEntity = queue.getNext(); // Retrieves and removes A
            expect(retrievedEntity).toBe(entityA);

            // Act
            const currentSize = queue.size();

            // Assert
            // Internal state: queue.length = 1 (B remains), removedIds = {} (A was physically removed)
            // Size calculation: Math.max(0, 1 - 0) = 1
            expect(currentSize).toBe(1);
            expect(queue.peek()).toBe(entityB);
        });

        // Test Case 14.7 (After getNext Empties Queue)
        it('Test Case 14.7: should return 0 after adding one entity and getting it via getNext()', () => {
            // Arrange
            queue.add(entityA, 10);
            expect(queue.size()).toBe(1); // Pre-condition

            const retrievedEntity = queue.getNext(); // Retrieves and removes A
            expect(retrievedEntity).toBe(entityA);

            // Act
            const currentSize = queue.size();

            // Assert
            // Internal state: queue.length = 0, removedIds = {}
            // Size calculation: Math.max(0, 0 - 0) = 0
            expect(currentSize).toBe(0);
            expect(queue.isEmpty()).toBe(true);
        });

        // Test Case 14.8 (After getNext Skips Removed Item)
        it('Test Case 14.8: should return 0 after adding two, removing one, then getting the other via getNext()', () => {
            // Arrange
            queue.add(entityA, 10); // Higher priority
            queue.add(entityB, 5);
            expect(queue.size()).toBe(2); // Pre-condition

            queue.remove('a'); // Lazily remove A
            expect(queue.size()).toBe(1); // Size accounts for removal

            const retrievedEntity = queue.getNext(); // Should skip A, retrieve and remove B
            expect(retrievedEntity).toBe(entityB);

            // Act
            const currentSize = queue.size();

            // Assert
            // Internal state: queue.length = 0 (A was popped during getNext skip, B was popped and returned), removedIds = {} (A was processed)
            // Size calculation: Math.max(0, 0 - 0) = 0
            expect(currentSize).toBe(0);
            expect(queue.isEmpty()).toBe(true);
        });

        // Test Case 14.9 (After Clear)
        it('Test Case 14.9: should return 0 after adding an entity and then clearing the queue', () => {
            // Arrange
            queue.add(entityA, 10);
            queue.add(entityB, 5);
            queue.remove('a'); // Add a removed item to test clear thoroughly
            expect(queue.size()).toBe(1); // Pre-condition

            queue.clear();

            // Act
            const currentSize = queue.size();

            // Assert
            // Internal state: queue.length = 0, removedIds = {}
            // Size calculation: Math.max(0, 0 - 0) = 0
            expect(currentSize).toBe(0);
            expect(queue.isEmpty()).toBe(true);
        });

    }); // End describe('size() Method')

}); // End describe('InitiativePriorityQueue')