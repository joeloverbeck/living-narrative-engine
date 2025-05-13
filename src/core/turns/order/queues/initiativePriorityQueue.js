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
        console.log('[DEBUG] Constructor: Queue initialized.'); // LOGGING
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

        console.log(`[DEBUG] add: Adding entity ${entity.id} (priority ${priority}). Current queue.length: ${this.#queue.length}, removedIds.size: ${this.#removedEntityIds.size}`); // LOGGING
        // If the entity was marked for removal, adding it back overrides that.
        const wasRemoved = this.#removedEntityIds.delete(entity.id);
        if (wasRemoved) {
            console.log(`[DEBUG] add: Entity ${entity.id} was in removedIds set, deleted it. removedIds.size: ${this.#removedEntityIds.size}`); // LOGGING
        }

        /** @type {QueueItem} */
        const newItem = {entity, priority};
        this.#queue.push(newItem);
        console.log(`[DEBUG] add: Entity ${entity.id} pushed. New queue.length: ${this.#queue.length}`); // LOGGING

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
        }
        console.log(`[DEBUG] remove: Marking entity ${entityId} for removal. Current removedIds.size: ${this.#removedEntityIds.size}`); // LOGGING
        this.#removedEntityIds.add(entityId);
        console.log(`[DEBUG] remove: Entity ${entityId} added to removedIds. New removedIds.size: ${this.#removedEntityIds.size}`); // LOGGING
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
        console.log(`[DEBUG] getNext: --- Called ---. Initial queue.length: ${this.#queue.length}, removedIds.size: ${this.#removedEntityIds.size}`); // LOGGING
        while (this.#queue.length > 0) {
            console.log(`[DEBUG] getNext: Loop start. queue.length: ${this.#queue.length}`); // LOGGING
            const highestPriorityItem = this.#queue.pop(); // Pop item physically
            const poppedEntityId = highestPriorityItem?.entity?.id ?? 'null/undefined';
            console.log(`[DEBUG] getNext: Popped item. New queue.length: ${this.#queue.length}. Popped entity ID: ${poppedEntityId}`); // LOGGING

            if (!highestPriorityItem) {
                console.log('[DEBUG] getNext: Popped item was null/undefined, continuing loop.'); // LOGGING
                continue;
            }

            const entityId = highestPriorityItem.entity.id;

            if (this.#removedEntityIds.has(entityId)) {
                console.log(`[DEBUG] getNext: Popped entity ${entityId} IS in removedIds. Deleting from set.`); // LOGGING
                this.#removedEntityIds.delete(entityId);
                console.log(`[DEBUG] getNext: Removed ${entityId} from removedIds. New removedIds.size: ${this.#removedEntityIds.size}. Continuing loop.`); // LOGGING
                continue;
            } else {
                console.log(`[DEBUG] getNext: Popped entity ${entityId} is VALID. Returning it. Final queue.length: ${this.#queue.length}, removedIds.size: ${this.#removedEntityIds.size}`); // LOGGING
                return highestPriorityItem.entity; // Return the actual entity
            }
        }
        console.log('[DEBUG] getNext: Queue is empty or only contained removed items. Returning null.'); // LOGGING
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
        console.log(`[DEBUG] peek: --- Called ---. Initial queue.length: ${this.#queue.length}, removedIds.size: ${this.#removedEntityIds.size}`); // LOGGING
        while (this.#queue.length > 0) {
            console.log(`[DEBUG] peek: Loop start. queue.length: ${this.#queue.length}`); // LOGGING
            const highestPriorityItem = this.#queue.peek(); // Look at top item
            const peekedEntityId = highestPriorityItem?.entity?.id ?? 'null/undefined';
            console.log(`[DEBUG] peek: Peeked item entity ID: ${peekedEntityId}. queue.length remains ${this.#queue.length}.`); // LOGGING


            if (!highestPriorityItem) {
                console.log('[DEBUG] peek: Peeked item was null/undefined, returning null.'); // LOGGING
                return null; // Should be impossible if length > 0
            }

            const entityId = highestPriorityItem.entity.id;

            if (this.#removedEntityIds.has(entityId)) {
                console.log(`[DEBUG] peek: Peeked entity ${entityId} IS in removedIds. Popping it for cleanup.`); // LOGGING
                this.#queue.pop(); // Remove it physically from the queue
                this.#removedEntityIds.delete(entityId); // Clean up the removal set
                console.log(`[DEBUG] peek: Popped ${entityId} for cleanup. New queue.length: ${this.#queue.length}. New removedIds.size: ${this.#removedEntityIds.size}. Continuing loop.`); // LOGGING
                continue;
            } else {
                console.log(`[DEBUG] peek: Peeked entity ${entityId} is VALID. Returning it. Final queue.length: ${this.#queue.length}, removedIds.size: ${this.#removedEntityIds.size}`); // LOGGING
                return highestPriorityItem.entity;
            }
        }
        console.log('[DEBUG] peek: Queue is empty or only contained removed items. Returning null.'); // LOGGING
        return null;
    }

    /**
     * Checks if the queue currently contains no active entities (considering lazy removals).
     * @override
     * @returns {boolean} True if the queue is effectively empty, false otherwise.
     */
    isEmpty() {
        console.log(`[DEBUG] isEmpty: --- Called ---. Initial queue.length: ${this.#queue.length}, removedIds.size: ${this.#removedEntityIds.size}`); // LOGGING
        if (this.#queue.length === 0) {
            console.log('[DEBUG] isEmpty: queue.length is 0. Clearing removedIds and returning true.'); // LOGGING
            this.#removedEntityIds.clear();
            return true;
        }
        const currentSize = this.size(); // Calls size() which also logs
        const result = currentSize === 0;
        console.log(`[DEBUG] isEmpty: Calculated size is ${currentSize}. Returning ${result}.`); // LOGGING
        return result;
    }

    /**
     * Removes all entities from the queue and clears lazy removal tracking.
     * @override
     * @returns {void}
     */
    clear() {
        console.log(`[DEBUG] clear: --- Called ---. Clearing queue and removedIds. Initial queue.length: ${this.#queue.length}, removedIds.size: ${this.#removedEntityIds.size}`); // LOGGING
        const comparator = (a, b) => b.priority - a.priority;
        this.#queue = new TinyQueue([], comparator);
        this.#removedEntityIds.clear();
        console.log(`[DEBUG] clear: Done. New queue.length: ${this.#queue.length}, removedIds.size: ${this.#removedEntityIds.size}`); // LOGGING
    }

    /**
     * Returns the current number of *active* entities in the queue.
     * This calculation subtracts the count of lazily removed entity IDs
     * (those marked via `remove()` but not yet processed by `getNext`/`peek`)
     * from the physical queue length.
     * @override
     * @returns {number} The number of active entities.
     */
    size() {
        const currentQueueLength = this.#queue.length;
        const currentRemovedIdsSize = this.#removedEntityIds.size;
        // LOGGING: Added specific identifier for clarity
        console.log(`[DEBUG] size(): --- Called ---. queue.length: ${currentQueueLength}, removedIds.size: ${currentRemovedIdsSize}`);
        const estimatedSize = currentQueueLength - currentRemovedIdsSize;
        const finalSize = Math.max(0, estimatedSize);
        console.log(`[DEBUG] size(): Calculated: ${currentQueueLength} - ${currentRemovedIdsSize} = ${estimatedSize} -> Result: ${finalSize}`);
        return finalSize;
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
        console.log(`[DEBUG] toArray: --- Called ---. queue.length: ${this.#queue.length}, removedIds.size: ${this.#removedEntityIds.size}`); // LOGGING
        const internalData = this.#queue.data || [];
        const result = internalData
            .filter(item => {
                const isValid = item && item.entity && !this.#removedEntityIds.has(item.entity.id);
                // console.log(`[DEBUG] toArray: Filtering item ${item?.entity?.id}, isValid: ${isValid}`); // Optional finer logging
                return isValid;
            })
            .map(item => item.entity);
        console.log(`[DEBUG] toArray: Filtered ${internalData.length} items down to ${result.length} active entities.`); // LOGGING
        return result;
    }
}
