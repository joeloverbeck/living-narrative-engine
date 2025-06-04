// src/core/turnOrder/queue/simpleRoundRobinQueue.js

/**
 * @file Implements a simple First-In, First-Out (FIFO) turn order queue.
 * This queue manages entities based on the order they were added, suitable for
 * a basic round-robin turn system.
 */

import { ITurnOrderQueue } from '../../interfaces/ITurnOrderQueue.js';
// Use the Entity type defined in the interface file for consistency.
/** @typedef {import('../ITurnOrderQueue.js').Entity} Entity */

/**
 * @class SimpleRoundRobinQueue
 * @implements {ITurnOrderQueue}
 * @classdesc A concrete implementation of ITurnOrderQueue using a simple JavaScript
 * array to manage entities in a FIFO manner. The optional priority parameter
 * in the `add` method is ignored.
 */
export class SimpleRoundRobinQueue extends ITurnOrderQueue {
  /**
   * The internal array holding the entities in the queue.
   *
   * @private
   * @type {Array<Entity>}
   */
  _entities;

  /**
   * Creates an instance of SimpleRoundRobinQueue.
   */
  constructor() {
    super(); // Call the base class constructor (though it's empty in the interface)
    this._entities = [];
  }

  /**
   * Adds an entity to the end of the queue (FIFO). The priority parameter is ignored.
   *
   * @override
   * @param {Entity} entity - The entity object to add. Must not be null and should have an 'id' property.
   * @param {number} [priority] - Ignored in this implementation.
   * @returns {void}
   * @throws {Error} If the entity is null or invalid (e.g., missing id).
   */
  add(entity, priority) {
    if (!entity || typeof entity.id === 'undefined') {
      throw new Error(
        'SimpleRoundRobinQueue.add: Cannot add invalid or null entity.'
      );
    }
    // Ignore priority, just push to the end.
    this._entities.push(entity);
  }

  /**
   * Removes a specific entity from the queue by its ID.
   *
   * @override
   * @param {string} entityId - The unique ID of the entity to remove.
   * @returns {Entity | null} The removed entity object, or null if no entity with the given ID was found.
   */
  remove(entityId) {
    const index = this._entities.findIndex((entity) => entity.id === entityId);
    if (index !== -1) {
      // splice returns an array containing the removed elements
      const removed = this._entities.splice(index, 1);
      return removed[0]; // Return the single removed entity
    }
    return null; // Entity not found
  }

  /**
   * Retrieves and removes the entity at the front of the queue (FIFO).
   *
   * @override
   * @returns {Entity | null} The next entity object, or null if the queue is empty.
   */
  getNext() {
    if (this.isEmpty()) {
      return null;
    }
    // shift() removes and returns the first element, or undefined if empty
    // We handle empty case above, so it should return an Entity here.
    return this._entities.shift() ?? null; // Use nullish coalescing just in case
  }

  /**
   * Returns the entity at the front of the queue without removing it (FIFO).
   *
   * @override
   * @returns {Entity | null} The next entity object, or null if the queue is empty.
   */
  peek() {
    if (this.isEmpty()) {
      return null;
    }
    return this._entities[0];
  }

  /**
   * Checks if the queue currently contains no entities.
   *
   * @override
   * @returns {boolean} True if the queue is empty, false otherwise.
   */
  isEmpty() {
    return this._entities.length === 0;
  }

  /**
   * Removes all entities from the queue.
   *
   * @override
   * @returns {void}
   */
  clear() {
    this._entities = [];
  }

  /**
   * Returns the current number of entities in the queue.
   *
   * @override
   * @returns {number} The number of entities.
   */
  size() {
    return this._entities.length;
  }

  /**
   * Returns a shallow copy of the array containing all entities currently in the queue,
   * preserving the current FIFO order.
   *
   * @override
   * @returns {Array<Entity>} An array of the entities in the queue. Returns an empty array `[]` if the queue is empty.
   */
  toArray() {
    // Return a shallow copy to prevent external modification of the internal array
    return [...this._entities];
  }
}

// --- Boilerplate to ensure this file is treated as a module ---
// Already exporting the class, so this isn't strictly necessary but good practice
// if other things might be added later without exports.
// export {};
