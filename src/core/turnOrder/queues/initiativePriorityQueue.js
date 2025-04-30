// src/core/turnOrder/queues/initiativePriorityQueue.js

/**
 * @fileoverview Implements the ITurnOrderQueue interface using a priority queue
 * based on entity initiative scores. Uses the 'tinyqueue' library and employs
 * a lazy removal strategy.
 */

import TinyQueue from 'tinyqueue';
import {ITurnOrderQueue} from '../../interfaces/ITurnOrderQueue.js';

// --- Type Imports ---
/**
 * Represents an entity in the game. Expected to have at least an 'id' property.
 * @typedef {import('../../interfaces/ITurnOrderQueue.js').Entity} Entity
 */

/**
 * Internal structure stored in the priority queue.
 * @typedef {object} QueueItem
 * @property {Entity} entity - The game entity.
 * @property {number} priority - The entity's initiative score for this queue.
 */

/**
 * @class InitiativePriorityQueue
 * @implements {ITurnOrderQueue}
 * @classdesc A turn order queue that prioritizes entities based on a numerical
 * 'priority' value (higher value means higher priority - Max-Heap behavior).
 * It uses the 'tinyqueue' library for the underlying priority queue structure
 * and implements a lazy removal strategy for efficiency when removing items.
 */
export class InitiativePriorityQueue extends ITurnOrderQueue {
    /**
     * The internal priority queue instance from the 'tinyqueue' library.
     * Stores QueueItem objects.
     * @private
     * @type {TinyQueue<QueueItem>}
     */
    #queue;

    /**
     * A set storing the unique IDs (`entity.id`) of entities that have been
     * marked for removal via the `remove()` method but might still physically
     * exist in the #queue until processed by `getNext()` or `peek()`.
     * @private
     * @type {Set<string>}
     */
    #removedEntityIds;

    /**
     * Creates an instance of InitiativePriorityQueue.
     */
    constructor() {
        super();
        // Initialize TinyQueue with a comparator for Max-Heap behavior
        // (b.priority - a.priority means higher priority comes first).
        this.#queue = new TinyQueue([], (a, b) => b.priority - a.priority);
        this.#removedEntityIds = new Set();
    }

    /**
     * Adds an entity with a specific priority to the queue.
     * If the entity was previously marked for removal, this effectively cancels
     * the removal.
     * @override
     * @param {Entity} entity - The entity object to add. Must have a valid 'id'.
     * @param {number} priority - The numerical priority (initiative). Higher values are prioritized. Must be a finite number.
     * @returns {void}
     * @throws {Error} If the entity is invalid (null, undefined, or missing 'id').
     * @throws {Error} If the priority is not a finite number.
     */
    add(entity, priority) {
        if (!entity || typeof entity.id !== 'string' || entity.id === '') {
            throw new Error('InitiativePriorityQueue.add: Cannot add invalid entity (must have a valid string id).');
        }
        if (typeof priority !== 'number' || !Number.isFinite(priority)) {
            throw new Error(`InitiativePriorityQueue.add: Invalid priority value "${priority}" for entity "${entity.id}". Priority must be a finite number.`);
        }

        // If the entity was marked for removal, adding it back overrides that.
        this.#removedEntityIds.delete(entity.id);

        /** @type {QueueItem} */
        const newItem = {entity, priority};
        this.#queue.push(newItem);
    }

    /**
     * Marks an entity for removal from the queue using a lazy removal strategy.
     * The entity is not immediately removed from the underlying heap for performance reasons.
     * It will be skipped when encountered by `getNext()` or `peek()`.
     * @override
     * @param {string} entityId - The unique ID of the entity to remove.
     * @returns {null} Always returns null due to the lazy removal strategy,
     * as efficiently finding the Entity object without heap modification is complex.
     * This deviates slightly from the interface's ideal return but is pragmatic.
     */
    remove(entityId) {
        if (typeof entityId !== 'string' || entityId === '') {
            console.warn(`InitiativePriorityQueue.remove: Attempted to remove entity with invalid ID "${entityId}".`);
            // We can still add an invalid ID to the set, it just won't match anything.
            // Or we could return early: return null;
        }
        // Add the ID to the set of removed entities.
        // We don't know for sure if it was *actually* in the queue at this point
        // without an expensive search.
        this.#removedEntityIds.add(entityId);
        return null; // See JSDoc explanation.
    }

    /**
     * Retrieves and removes the entity with the highest priority from the queue,
     * skipping any entities marked for lazy removal.
     * @override
     * @returns {Entity | null} The highest priority entity object, or null if the
     * queue is effectively empty.
     */
    getNext() {
        while (this.#queue.length > 0) {
            const highestPriorityItem = this.#queue.pop();

            // Should not happen if length > 0, but safety check
            if (!highestPriorityItem) continue;

            const entityId = highestPriorityItem.entity.id;

            // Check if this entity was marked for removal
            if (this.#removedEntityIds.has(entityId)) {
                // It was removed, so discard this item and remove it from the set.
                this.#removedEntityIds.delete(entityId);
                // Continue to the next item in the queue.
                continue;
            } else {
                // This is a valid entity. Mark it as removed now so future calls
                // to remove() or concurrent operations handle it correctly.
                // This prevents it from being returned again if remove() is called
                // after getNext() but before the next turn.
                this.#removedEntityIds.add(entityId);
                return highestPriorityItem.entity; // Return the actual entity
            }
        }
        // Queue is empty or only contained removed items
        return null;
    }

    /**
     * Returns the entity with the highest priority without removing it from the queue.
     * Skips and cleans up any entities marked for lazy removal found at the top.
     * @override
     * @returns {Entity | null} The highest priority entity object, or null if the
     * queue is effectively empty.
     */
    peek() {
        while (this.#queue.length > 0) {
            const highestPriorityItem = this.#queue.peek();

            // Should not happen if length > 0, but safety check
            if (!highestPriorityItem) return null; // Should be impossible if length > 0

            const entityId = highestPriorityItem.entity.id;

            // Check if the top entity was marked for removal
            if (this.#removedEntityIds.has(entityId)) {
                // It was removed. We need to pop it to see the next *actual* item.
                this.#queue.pop(); // Remove it from the queue
                this.#removedEntityIds.delete(entityId); // Clean up the removal set
                // Continue the loop to peek at the new top item.
                continue;
            } else {
                // This is the valid next entity. Return it without modifying the queue state.
                return highestPriorityItem.entity;
            }
        }
        // Queue is empty or only contained removed items
        return null;
    }

    /**
     * Checks if the queue currently contains no active entities (considering lazy removals).
     * @override
     * @returns {boolean} True if the queue is effectively empty, false otherwise.
     */
    isEmpty() {
        // Note: This relies on size() accurately reflecting the effective count.
        return this.size() === 0;
    }

    /**
     * Removes all entities from the queue and clears lazy removal tracking.
     * @override
     * @returns {void}
     */
    clear() {
        // Reset the queue using the same comparator
        // Note: Accessing the comparator directly might depend on the lib version.
        // Re-creating ensures it's clean. Check tinyqueue specifics if needed.
        // It's safer to assume we might not have direct access to the old comparator easily.
        const comparator = (a, b) => b.priority - a.priority; // Re-declare for clarity
        this.#queue = new TinyQueue([], comparator);
        this.#removedEntityIds.clear();
    }

    /**
     * Returns the current number of *active* entities in the queue.
     * This calculation is approximate due to the lazy removal strategy. It subtracts
     * the count of removed IDs from the physical queue length. It might be slightly
     * inaccurate if entities marked for removal haven't been processed by getNext/peek yet.
     * @override
     * @returns {number} The approximate number of active entities.
     */
    size() {
        // Ensure size doesn't go negative if somehow removedEntityIds > queue.length
        // (shouldn't happen with correct logic but good safeguard).
        const estimatedSize = this.#queue.length - this.#removedEntityIds.size;
        return Math.max(0, estimatedSize);
    }

    /**
     * Returns an array containing all *active* entities currently in the queue.
     * Entities marked for lazy removal are excluded.
     * The order of entities in the returned array is based on the internal heap
     * structure of the priority queue and is **not** guaranteed to be sorted by priority.
     * @override
     * @returns {Array<Entity>} An array of the active entities. Returns an empty array `[]`
     * if the queue is effectively empty.
     */
    toArray() {
        // Access the internal data array (common in simple heap libs like tinyqueue).
        // If tinyqueue changes its internal structure, this might need adjustment.
        const internalData = this.#queue.data || []; // Use .data, fallback to empty array

        return internalData
            .filter(item => item && item.entity && !this.#removedEntityIds.has(item.entity.id))
            .map(item => item.entity);
    }
}