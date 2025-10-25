// src/turns/order/queues/initiativePriorityQueue.js

/**
 * @file Implements the ITurnOrderQueue interface using a priority queue
 * based on entity initiative scores. Uses the 'tinyqueue' library and employs
 * a lazy removal strategy.
 */

import TinyQueue from 'tinyqueue';
import { ITurnOrderQueue } from '../../interfaces/ITurnOrderQueue.js';

// --- Type Imports ---
/**
 * Represents an entity in the game. Expected to have at least an 'id' property.
 *
 * @typedef {import('../../interfaces/ITurnOrderQueue.js').Entity} Entity
 */

/**
 * Internal structure stored in the priority queue.
 *
 * @typedef {object} QueueItem
 * @property {Entity} entity - The game entity.
 * @property {number} priority - The entity's initiative score for this queue.
 * @property {boolean} removed - Flag indicating whether the entry has been lazily removed.
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
   *
   * @private
   * @type {TinyQueue<QueueItem>}
   */
  #queue;

  /**
   * Tracks the number of active (non-removed) entities currently stored in the
   * queue. Used for O(1) size/isEmpty checks without needing to inspect the
   * underlying heap structure.
   *
   * @private
   * @type {number}
   */
  #activeSize;

  /**
   * Creates an instance of InitiativePriorityQueue.
   */
  constructor() {
    super();
    // Initialize TinyQueue with a comparator for Max-Heap behavior
    // (b.priority - a.priority means higher priority comes first).
    this.#queue = new TinyQueue([], (a, b) => b.priority - a.priority);
    this.#activeSize = 0;
    console.debug('[DEBUG] Constructor: Queue initialized.'); // LOGGING
  }

  /**
   * Adds an entity with a specific priority to the queue.
   * If the entity was previously marked for removal, this effectively cancels
   * the removal.
   *
   * @override
   * @param {Entity} entity - The entity object to add. Must have a valid 'id'.
   * @param {number} priority - The numerical priority (initiative). Higher values are prioritized. Must be a finite number.
   * @returns {void}
   * @throws {Error} If the entity is invalid (null, undefined, or missing 'id').
   * @throws {Error} If the priority is not a finite number.
   */
  add(entity, priority) {
    if (!entity || typeof entity.id !== 'string' || entity.id === '') {
      throw new Error(
        'InitiativePriorityQueue.add: Cannot add invalid entity (must have a valid string id).'
      );
    }
    if (typeof priority !== 'number' || !Number.isFinite(priority)) {
      throw new Error(
        `InitiativePriorityQueue.add: Invalid priority value "${priority}" for entity "${entity.id}". Priority must be a finite number.`
      );
    }

    console.debug(
      `[DEBUG] add: Adding entity ${entity.id} (priority ${priority}). Current queue.length: ${this.#queue.length}`
    ); // LOGGING

    /** @type {QueueItem} */
    const newItem = { entity, priority, removed: false };
    this.#queue.push(newItem);
    this.#activeSize += 1;
    console.debug(
      `[DEBUG] add: Entity ${entity.id} pushed. New queue.length: ${this.#queue.length}`
    ); // LOGGING
  }

  /**
   * Marks an entity for removal from the queue using a lazy removal strategy.
   * The entity is not immediately removed from the underlying heap for performance reasons.
   * It will be skipped when encountered by `getNext()` or `peek()`.
   *
   * @override
   * @param {string} entityId - The unique ID of the entity to remove.
   * @returns {null} Always returns null due to the lazy removal strategy,
   * as efficiently finding the Entity object without heap modification is complex.
   * This deviates slightly from the interface's ideal return but is pragmatic.
   */
  remove(entityId) {
    if (typeof entityId !== 'string' || entityId === '') {
      console.warn(
        `InitiativePriorityQueue.remove: Attempted to remove entity with invalid ID "${entityId}".`
      );
    }
    console.debug(
      `[DEBUG] remove: Marking entity ${entityId} for removal. Current queue.length: ${this.#queue.length}`
    ); // LOGGING

    let removedCount = 0;
    const internalData = this.#queue.data || [];
    for (const item of internalData) {
      if (!item || item.removed || !item.entity) {
        continue;
      }

      if (item.entity.id === entityId) {
        item.removed = true;
        removedCount += 1;
      }
    }

    if (removedCount > 0) {
      this.#activeSize = Math.max(0, this.#activeSize - removedCount);
      console.debug(
        `[DEBUG] remove: Flagged ${removedCount} entr${
          removedCount === 1 ? 'y' : 'ies'
        } for entity ${entityId} as removed. Active size now ${this.#activeSize}.`
      ); // LOGGING
    }
    return null; // See JSDoc explanation.
  }

  /**
   * Retrieves and removes the entity with the highest priority from the queue,
   * skipping any entities marked for lazy removal.
   *
   * @override
   * @returns {Entity | null} The highest priority entity object, or null if the
   * queue is effectively empty.
   */
  getNext() {
    console.debug(
      `[DEBUG] getNext: --- Called ---. Initial queue.length: ${this.#queue.length}, activeSize: ${this.#activeSize}`
    ); // LOGGING
    while (this.#queue.length > 0) {
      console.debug(
        `[DEBUG] getNext: Loop start. queue.length: ${this.#queue.length}`
      ); // LOGGING
      const highestPriorityItem = this.#queue.pop(); // Pop item physically
      const poppedEntityId =
        highestPriorityItem?.entity?.id ?? 'null/undefined';
      console.debug(
        `[DEBUG] getNext: Popped item. New queue.length: ${this.#queue.length}. Popped entity ID: ${poppedEntityId}`
      ); // LOGGING

      if (!highestPriorityItem) {
        console.debug(
          '[DEBUG] getNext: Popped item was null/undefined, continuing loop.'
        ); // LOGGING
        continue;
      }

      if (highestPriorityItem.removed) {
        console.debug(
          `[DEBUG] getNext: Popped entity ${poppedEntityId} was flagged as removed. Skipping.`
        ); // LOGGING
        continue;
      }

      const entityId = highestPriorityItem.entity.id;
      console.debug(
        `[DEBUG] getNext: Popped entity ${entityId} is VALID. Returning it. Final queue.length: ${this.#queue.length}`
      ); // LOGGING
      this.#activeSize = Math.max(0, this.#activeSize - 1);
      return highestPriorityItem.entity; // Return the actual entity
    }
    console.debug(
      '[DEBUG] getNext: Queue is empty or only contained removed items. Returning null.'
    ); // LOGGING
    return null;
  }

  /**
   * Returns the entity with the highest priority without removing it from the queue.
   * Skips and cleans up any entities marked for lazy removal found at the top.
   *
   * @override
   * @returns {Entity | null} The highest priority entity object, or null if the
   * queue is effectively empty.
   */
  peek() {
    console.debug(
      `[DEBUG] peek: --- Called ---. Initial queue.length: ${this.#queue.length}, activeSize: ${this.#activeSize}`
    ); // LOGGING
    while (this.#queue.length > 0) {
      console.debug(
        `[DEBUG] peek: Loop start. queue.length: ${this.#queue.length}`
      ); // LOGGING
      const highestPriorityItem = this.#queue.peek(); // Look at top item
      const peekedEntityId =
        highestPriorityItem?.entity?.id ?? 'null/undefined';
      console.debug(
        `[DEBUG] peek: Peeked item entity ID: ${peekedEntityId}. queue.length remains ${this.#queue.length}.`
      ); // LOGGING

      if (!highestPriorityItem) {
        console.debug(
          '[DEBUG] peek: Peeked item was null/undefined, returning null.'
        ); // LOGGING
        return null; // Should be impossible if length > 0
      }

      if (highestPriorityItem.removed) {
        console.debug(
          `[DEBUG] peek: Peeked entity ${peekedEntityId} was flagged as removed. Popping for cleanup.`
        ); // LOGGING
        this.#queue.pop(); // Remove it physically from the queue
        continue;
      }

      const entityId = highestPriorityItem.entity.id;
      console.debug(
        `[DEBUG] peek: Peeked entity ${entityId} is VALID. Returning it. Final queue.length: ${this.#queue.length}`
      ); // LOGGING
      return highestPriorityItem.entity;
    }
    console.debug(
      '[DEBUG] peek: Queue is empty or only contained removed items. Returning null.'
    ); // LOGGING
    return null;
  }

  /**
   * Checks if the queue currently contains no active entities (considering lazy removals).
   *
   * @override
   * @returns {boolean} True if the queue is effectively empty, false otherwise.
   */
  isEmpty() {
    console.debug(
      `[DEBUG] isEmpty: --- Called ---. Active size: ${this.#activeSize}, queue.length: ${this.#queue.length}`
    ); // LOGGING
    const result = this.#activeSize === 0;
    console.debug(`[DEBUG] isEmpty: Returning ${result}.`); // LOGGING
    return result;
  }

  /**
   * Removes all entities from the queue and clears lazy removal tracking.
   *
   * @override
   * @returns {void}
   */
  clear() {
    console.debug(
      `[DEBUG] clear: --- Called ---. Clearing queue. Initial queue.length: ${this.#queue.length}, activeSize: ${this.#activeSize}`
    ); // LOGGING
    const comparator = (a, b) => b.priority - a.priority;
    this.#queue = new TinyQueue([], comparator);
    this.#activeSize = 0;
    console.debug(
      `[DEBUG] clear: Done. New queue.length: ${this.#queue.length}, activeSize: ${this.#activeSize}`
    ); // LOGGING
  }

  /**
   * Returns the current number of *active* entities in the queue.
   *
   * @override
   * @returns {number} The number of active entities.
   */
  size() {
    console.debug(
      `[DEBUG] size(): --- Called ---. Active size: ${this.#activeSize}, queue.length: ${this.#queue.length}`
    );
    return this.#activeSize;
  }

  /**
   * Returns an array containing all *active* entities currently in the queue.
   * Entities marked for lazy removal are excluded.
   * The order of entities in the returned array is based on the internal heap
   * structure of the priority queue and is **not** guaranteed to be sorted by priority.
   *
   * @override
   * @returns {Array<Entity>} An array of the active entities. Returns an empty array `[]`
   * if the queue is effectively empty.
   */
  toArray() {
    console.debug(
      `[DEBUG] toArray: --- Called ---. queue.length: ${this.#queue.length}, activeSize: ${this.#activeSize}`
    ); // LOGGING
    const internalData = this.#queue.data || [];
    const result = internalData
      .filter((item) => {
        const isValid = item && item.entity && !item.removed;
        // console.debug(`[DEBUG] toArray: Filtering item ${item?.entity?.id}, isValid: ${isValid}`); // Optional finer logging
        return isValid;
      })
      .map((item) => item.entity);
    console.debug(
      `[DEBUG] toArray: Filtered ${internalData.length} items down to ${result.length} active entities.`
    ); // LOGGING
    return result;
  }
}
