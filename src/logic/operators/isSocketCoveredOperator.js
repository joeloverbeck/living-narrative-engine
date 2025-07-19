/**
 * @module IsSocketCoveredOperator
 * @description JSON Logic operator to check if a specific anatomical socket is covered by clothing
 */

import { BaseEquipmentOperator } from './base/BaseEquipmentOperator.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */

/**
 * @class IsSocketCoveredOperator
 * @augments BaseEquipmentOperator
 * @description Checks if a specific anatomical socket is covered by any equipped clothing
 *
 * Usage: {"isSocketCovered": ["actor", "vagina"]}
 * Returns: true if the socket is covered by any clothing item
 */
export class IsSocketCoveredOperator extends BaseEquipmentOperator {
  #socketToSlotCache = new Map();

  /**
   * Creates a new IsSocketCoveredOperator instance
   *
   * @param {object} dependencies - Required dependencies
   * @param {IEntityManager} dependencies.entityManager - Entity manager for component access
   * @param {ILogger} dependencies.logger - Logger for debugging and error reporting
   */
  constructor({ entityManager, logger }) {
    super({ entityManager, logger }, 'isSocketCovered');
  }

  /**
   * Evaluates if the entity has the specified socket covered by clothing
   *
   * @protected
   * @param {string} entityId - The entity ID to check
   * @param {Array} params - Parameters: [socketId]
   * @param {object} _context - Evaluation context (unused)
   * @returns {boolean} True if socket is covered by any equipped clothing
   */
  evaluateInternal(entityId, params, _context) {
    // Validate parameters
    if (!params || params.length < 1) {
      this.logger.warn(
        `${this.operatorName}: Missing required parameter: socketId`
      );
      return false;
    }

    const [socketId] = params;

    // Validate socket ID
    if (!socketId || typeof socketId !== 'string') {
      this.logger.warn(
        `${this.operatorName}: Invalid socketId parameter: ${socketId}`
      );
      return false;
    }

    try {
      // Get equipment data first
      const equipmentData = this.getEquipmentData(entityId);
      if (!equipmentData) {
        this.logger.debug(
          `${this.operatorName}: Entity ${entityId} has no clothing:equipment component`
        );
        return false;
      }

      // Get the socket-to-slot mapping for this entity
      const potentialSlots = this.#getSocketToSlotMapping(entityId, socketId);

      if (potentialSlots.length === 0) {
        this.logger.debug(
          `${this.operatorName}: No clothing slots cover socket '${socketId}' for entity ${entityId}`
        );
        return false;
      }

      // Check if any potential slot has equipped items
      const isCovered = potentialSlots.some((slotName) =>
        this.hasItemsInSlot(equipmentData, slotName)
      );

      this.logger.debug(
        `${this.operatorName}: Socket '${socketId}' for entity ${entityId} is ${isCovered ? 'covered' : 'not covered'} by clothing`
      );

      return isCovered;
    } catch (error) {
      this.logger.error(
        `${this.operatorName}: Error checking socket coverage for entity ${entityId}, socket ${socketId}`,
        error
      );
      return false;
    }
  }

  /**
   * Gets the clothing slots that cover a specific socket for an entity
   * Uses the clothing:slot_metadata component for dynamic lookup
   *
   * @private
   * @param {string} entityId - The entity to check
   * @param {string} socketId - The socket to find coverage for
   * @returns {string[]} Array of slot names that cover this socket
   */
  #getSocketToSlotMapping(entityId, socketId) {
    // Check cache first
    const cacheKey = `${entityId}:${socketId}`;
    if (this.#socketToSlotCache.has(cacheKey)) {
      return this.#socketToSlotCache.get(cacheKey);
    }

    // Get the slot metadata component
    const slotMetadata = this.entityManager.getComponentData(
      entityId,
      'clothing:slot_metadata'
    );

    if (!slotMetadata || !slotMetadata.slotMappings) {
      this.logger.debug(
        `${this.operatorName}: Entity ${entityId} has no clothing:slot_metadata component`
      );
      // Cache empty result
      this.#socketToSlotCache.set(cacheKey, []);
      return [];
    }

    // Find all slots that cover this socket
    const coveringSlots = [];
    for (const [slotId, mapping] of Object.entries(slotMetadata.slotMappings)) {
      if (mapping.coveredSockets && mapping.coveredSockets.includes(socketId)) {
        coveringSlots.push(slotId);
      }
    }

    // Cache the result for performance
    this.#socketToSlotCache.set(cacheKey, coveringSlots);

    return coveringSlots;
  }

  /**
   * Clears the socket-to-slot cache
   * Should be called when entity anatomy or clothing metadata changes
   *
   * @param {string} [entityId] - Optional entity ID to clear cache for specific entity
   */
  clearCache(entityId) {
    if (entityId) {
      // Clear cache entries for specific entity
      for (const key of this.#socketToSlotCache.keys()) {
        if (key.startsWith(`${entityId}:`)) {
          this.#socketToSlotCache.delete(key);
        }
      }
    } else {
      // Clear entire cache
      this.#socketToSlotCache.clear();
    }
  }
}
