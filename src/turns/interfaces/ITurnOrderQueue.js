// src/interfaces/ITurnOrderQueue.js

/**
 * @file Defines the interface for a turn order queue structure.
 * This interface outlines the contract for data structures that manage
 * a collection of entities waiting for their turn, such as simple queues,
 * priority queues, etc.
 */

// Forward declaration for JSDoc type hinting. Assume Entity has at least an 'id' property.
/**
 * Represents an entity in the game (e.g., player, NPC).
 * Implementations will likely use a more concrete class or interface.
 *
 * @typedef {object} Entity
 * @property {string} id - A unique identifier for the entity.
 */

/**
 * @interface ITurnOrderQueue
 * @classdesc Defines the contract for managing a queue of entities for turn-based systems.
 * Different implementations can provide various ordering strategies (FIFO, priority-based).
 */
export class ITurnOrderQueue {
  /**
   * Adds an entity to the queue.
   *
   * @function add
   * @param {Entity} entity - The entity object to add to the queue. Must not be null.
   * @param {number} [priority] - Optional priority value for priority queue implementations.
   * Lower numbers might indicate higher priority depending on implementation.
   * @returns {void}
   * @throws {Error} Implementations might throw if the entity is invalid or cannot be added.
   */
  add(entity, priority) {
    throw new Error('ITurnOrderQueue.add method not implemented.');
  }

  /**
   * Removes a specific entity from the queue by its ID.
   *
   * @function remove
   * @param {string} entityId - The unique ID of the entity to remove.
   * @returns {Entity | null} The removed entity object, or null if no entity with the given ID was found in the queue.
   */
  remove(entityId) {
    throw new Error('ITurnOrderQueue.remove method not implemented.');
  }

  /**
   * Retrieves and removes the next entity from the queue based on its ordering rules (e.g., FIFO, highest priority).
   *
   * @function getNext
   * @returns {Entity | null} The next entity object, or null if the queue is empty.
   */
  getNext() {
    throw new Error('ITurnOrderQueue.getNext method not implemented.');
  }

  /**
   * Returns the next entity in the queue without removing it.
   *
   * @function peek
   * @returns {Entity | null} The next entity object, or null if the queue is empty.
   */
  peek() {
    throw new Error('ITurnOrderQueue.peek method not implemented.');
  }

  /**
   * Checks if the queue currently contains no entities.
   *
   * @function isEmpty
   * @returns {boolean} True if the queue is empty, false otherwise.
   */
  isEmpty() {
    throw new Error('ITurnOrderQueue.isEmpty method not implemented.');
  }

  /**
   * Removes all entities from the queue.
   *
   * @function clear
   * @returns {void}
   */
  clear() {
    throw new Error('ITurnOrderQueue.clear method not implemented.');
  }

  /**
   * Returns the current number of entities in the queue.
   *
   * @function size
   * @returns {number} The number of entities.
   */
  size() {
    throw new Error('ITurnOrderQueue.size method not implemented.');
  }

  /**
   * Returns an array containing all entities currently in the queue.
   * The order of entities in the array might depend on the specific queue implementation
   * and may not necessarily reflect the turn order.
   *
   * @function toArray
   * @returns {Array<Entity>} An array of the entities in the queue. Returns an empty array `[]` if the queue is empty.
   */
  toArray() {
    throw new Error('ITurnOrderQueue.toArray method not implemented.');
  }
}

// --- Boilerplate to ensure this file is treated as a module ---
export {};
