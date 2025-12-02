// src/anatomy/anatomyGraphContext.js

/**
 * @file Context object for tracking state during anatomy graph building
 */

import { ValidationError } from '../errors/validationError.js';

/**
 * Context that tracks state during anatomy graph construction
 */
export class AnatomyGraphContext {
  /** @type {string[]} */
  #createdEntities;
  /** @type {Map<string, number>} */
  #partCounts;
  /** @type {Set<string>} */
  #socketOccupancy;
  /** @type {Map<string, string>} */
  #slotToEntity;
  /** @type {Function} */
  #rng;
  /** @type {string} */
  #rootId;

  /**
   * Creates a new anatomy graph context
   *
   * @param {number} [seed] - Optional random seed
   */
  constructor(seed) {
    this.#createdEntities = [];
    this.#partCounts = new Map();
    this.#socketOccupancy = new Set();
    this.#slotToEntity = new Map();
    this.#rng = this.#createRNG(seed);
    this.#rootId = null;
  }

  /**
   * Sets the root entity ID
   *
   * @param {string} rootId - Root entity ID
   */
  setRootId(rootId) {
    this.#rootId = rootId;
    this.addCreatedEntity(rootId);
    // Root has no parent slot
    this.#slotToEntity.set(null, rootId);
  }

  /**
   * Gets the root entity ID
   *
   * @returns {string|null} Root entity ID
   */
  getRootId() {
    return this.#rootId;
  }

  /**
   * Adds a created entity to tracking
   *
   * @param {string} entityId - Entity ID to track
   */
  addCreatedEntity(entityId) {
    this.#createdEntities.push(entityId);
  }

  /**
   * Gets all created entity IDs
   *
   * @returns {string[]} Array of entity IDs
   */
  getCreatedEntities() {
    return [...this.#createdEntities];
  }

  /**
   * Updates the part count for a type
   *
   * @param {string} partType - Part type
   */
  incrementPartCount(partType) {
    const currentCount = this.#partCounts.get(partType) || 0;
    this.#partCounts.set(partType, currentCount + 1);
  }

  /**
   * Gets the count for a part type
   *
   * @param {string} partType - Part type
   * @returns {number} Count
   */
  getPartCount(partType) {
    return this.#partCounts.get(partType) || 0;
  }

  /**
   * Gets all part counts
   *
   * @returns {Map<string, number>} Part counts map
   */
  getPartCounts() {
    return new Map(this.#partCounts);
  }

  /**
   * Marks a socket as occupied
   *
   * @param {string} parentId - Parent entity ID
   * @param {string} socketId - Socket ID
   */
  occupySocket(parentId, socketId) {
    const key = `${parentId}:${socketId}`;
    this.#socketOccupancy.add(key);
  }

  /**
   * Checks if a socket is occupied
   *
   * @param {string} parentId - Parent entity ID
   * @param {string} socketId - Socket ID
   * @returns {boolean} True if occupied
   */
  isSocketOccupied(parentId, socketId) {
    const key = `${parentId}:${socketId}`;
    return this.#socketOccupancy.has(key);
  }

  /**
   * Gets the socket occupancy set
   *
   * @returns {Set<string>} Socket occupancy set
   */
  getSocketOccupancy() {
    return new Set(this.#socketOccupancy);
  }

  /**
   * Maps a slot key to an entity ID
   *
   * @param {string} slotKey - Slot key from blueprint
   * @param {string} entityId - Entity ID
   * @throws {ValidationError} If slot key is already mapped to a different entity
   */
  mapSlotToEntity(slotKey, entityId) {
    if (this.#slotToEntity.has(slotKey)) {
      const existingEntityId = this.#slotToEntity.get(slotKey);
      throw new ValidationError(
        `Slot key '${slotKey}' already mapped to entity '${existingEntityId}'. ` +
          `Cannot remap to '${entityId}'. Duplicate slot keys detected in blueprint.`
      );
    }
    this.#slotToEntity.set(slotKey, entityId);
  }

  /**
   * Gets the entity ID for a slot
   *
   * @param {string} slotKey - Slot key
   * @returns {string|undefined} Entity ID
   */
  getEntityForSlot(slotKey) {
    return this.#slotToEntity.get(slotKey);
  }

  /**
   * Gets the random number generator
   *
   * @returns {Function} RNG function
   */
  getRNG() {
    return this.#rng;
  }

  /**
   * Creates a seeded random number generator
   *
   * @param {number} [seed] - Optional seed value
   * @returns {Function} Random number generator function
   * @private
   */
  #createRNG(seed) {
    // Simple seedable RNG using linear congruential generator
    let state = seed || Date.now();
    return () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
  }
}

export default AnatomyGraphContext;
