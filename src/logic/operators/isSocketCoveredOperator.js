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
   * @param {object} context - Evaluation context (may contain trace)
   * @returns {boolean} True if socket is covered by any equipped clothing
   */
  evaluateInternal(entityId, params, context) {
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

    this.logger.debug(
      `${this.operatorName}: Checking if socket '${socketId}' is covered for entity ${entityId}`
    );

    // Initialize trace data if trace context exists
    const traceData = {
      operator: 'isSocketCovered',
      entityId,
      socketId,
      timestamp: Date.now(),
      evaluationStart: Date.now(),
    };

    try {
      // Get equipment data first
      const equipmentData = this.getEquipmentData(entityId);

      if (!equipmentData) {
        this.logger.debug(
          `${this.operatorName}: Entity ${entityId} has no clothing:equipment component`
        );

        // Add to trace
        traceData.hasEquipmentComponent = false;
        traceData.result = false;
        traceData.reason = 'No clothing:equipment component';
        this.#addToTrace(context, traceData);

        return false;
      }

      // Check if equipment has the 'equipped' property and it's not empty
      if (
        !equipmentData.equipped ||
        typeof equipmentData.equipped !== 'object'
      ) {
        this.logger.debug(
          `${this.operatorName}: Entity ${entityId} has clothing:equipment but no equipped items structure`
        );

        traceData.hasEquipmentComponent = true;
        traceData.hasEquippedStructure = false;
        traceData.result = false;
        traceData.reason = 'No equipped items structure in clothing:equipment';
        this.#addToTrace(context, traceData);

        return false;
      }

      // Add equipment data to trace
      traceData.hasEquipmentComponent = true;
      traceData.hasEquippedStructure = true;
      traceData.equippedSlots = Object.keys(equipmentData.equipped);

      // Get the socket-to-slot mapping for this entity
      const potentialSlots = this.#getSocketToSlotMapping(entityId, socketId);
      traceData.potentialCoveringSlots = potentialSlots;

      if (potentialSlots.length === 0) {
        this.logger.debug(
          `${this.operatorName}: No clothing slots cover socket '${socketId}' for entity ${entityId}`
        );

        traceData.result = false;
        traceData.reason = `No slots defined to cover socket '${socketId}'`;
        this.#addToTrace(context, traceData);

        return false;
      }

      // Check each potential slot and track in trace
      const slotChecks = {};
      let coveredBySlot = null;

      this.logger.debug(
        `${this.operatorName}: Checking ${potentialSlots.length} potential slot(s) for socket '${socketId}' coverage`
      );

      const isCovered = potentialSlots.some((slotName) => {
        // Check if slot has items that actually provide coverage (exclude accessories)
        const hasCoveringItems =
          this.hasItemsInSlotExcludingAccessories(equipmentData, slotName) ||
          this.#hasCoverageMappingCoveringSlot(entityId, equipmentData, slotName);

        // Track slot check details
        const slotData = equipmentData.equipped?.[slotName];

        this.logger.debug(
          `${this.operatorName}: Checking slot '${slotName}' - exists: ${Boolean(slotData)}, hasCoveringItems: ${hasCoveringItems}`
        );

        slotChecks[slotName] = {
          hasItems: this.hasItemsInSlot(equipmentData, slotName), // Keep original for trace
          hasCoveringItems, // New field to show actual coverage
          slotExists: Boolean(slotData),
          layers: slotData ? Object.keys(slotData) : [],
          itemCounts: slotData
            ? Object.entries(slotData).reduce((acc, [layer, items]) => {
                acc[layer] = Array.isArray(items)
                  ? items.length
                  : items
                    ? 1
                    : 0;
                return acc;
              }, {})
            : {},
        };

        // Log layer details for debugging
        if (slotData) {
          for (const [layer, items] of Object.entries(slotData)) {
            const itemCount = Array.isArray(items)
              ? items.length
              : items
                ? 1
                : 0;
            const countsForCoverage = layer !== 'accessories';
            this.logger.debug(
              `${this.operatorName}: Slot '${slotName}' layer '${layer}' has ${itemCount} item(s) - counts for coverage: ${countsForCoverage}`
            );
          }
        }

        if (hasCoveringItems && !coveredBySlot) {
          coveredBySlot = slotName;
          this.logger.debug(
            `${this.operatorName}: Socket '${socketId}' is covered by slot '${slotName}'`
          );
        }

        return hasCoveringItems;
      });

      // Add slot check details to trace
      traceData.slotChecks = slotChecks;
      traceData.coveredBySlot = coveredBySlot;
      traceData.result = isCovered;
      traceData.reason = isCovered
        ? `Socket covered by items in slot '${coveredBySlot}'`
        : 'No items found in any covering slot';

      this.logger.debug(
        `${this.operatorName}: Socket '${socketId}' for entity ${entityId} is ${isCovered ? 'covered' : 'not covered'} by clothing`
      );

      // Add complete trace data
      this.#addToTrace(context, traceData);

      return isCovered;
    } catch (error) {
      this.logger.error(
        `${this.operatorName}: Error checking socket coverage for entity ${entityId}, socket ${socketId}`,
        error
      );

      traceData.error = error.message;
      traceData.result = false;
      this.#addToTrace(context, traceData);

      return false;
    }
  }

  /**
   * Adds trace data to the context if tracing is enabled
   *
   * @private
   * @param {object} context - The evaluation context
   * @param {object} traceData - The trace data to add
   */
  #addToTrace(context, traceData) {
    if (context?.trace?.captureOperatorEvaluation) {
      context.trace.captureOperatorEvaluation(traceData);
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
      const cached = this.#socketToSlotCache.get(cacheKey);
      this.logger.debug(
        `${this.operatorName}: Using cached slot mapping for ${entityId}:${socketId} - slots: [${cached.join(', ')}]`
      );
      return cached;
    }

    // Get the slot metadata component
    const slotMetadata = this.entityManager.getComponentData(
      entityId,
      'clothing:slot_metadata'
    );

    if (!slotMetadata) {
      this.logger.debug(
        `${this.operatorName}: Entity ${entityId} has no clothing:slot_metadata component`
      );
      // Cache empty result
      this.#socketToSlotCache.set(cacheKey, []);
      return [];
    }

    if (
      !slotMetadata.slotMappings ||
      typeof slotMetadata.slotMappings !== 'object'
    ) {
      this.logger.debug(
        `${this.operatorName}: Entity ${entityId} has clothing:slot_metadata but no slotMappings`
      );
      // Cache empty result
      this.#socketToSlotCache.set(cacheKey, []);
      return [];
    }

    // Log the available slot mappings for debugging
    this.logger.debug(
      `${this.operatorName}: Entity ${entityId} has slot mappings for slots: [${Object.keys(slotMetadata.slotMappings).join(', ')}]`
    );

    // Find all slots that cover this socket
    const coveringSlots = [];
    for (const [slotId, mapping] of Object.entries(slotMetadata.slotMappings)) {
      if (
        mapping &&
        mapping.coveredSockets &&
        Array.isArray(mapping.coveredSockets)
      ) {
        this.logger.debug(
          `${this.operatorName}: Slot '${slotId}' covers sockets: [${mapping.coveredSockets.join(', ')}]`
        );
        if (mapping.coveredSockets.includes(socketId)) {
          coveringSlots.push(slotId);
        }
      }
    }

    this.logger.debug(
      `${this.operatorName}: Socket '${socketId}' for entity ${entityId} can be covered by slots: [${coveringSlots.join(', ')}]`
    );

    // Cache the result for performance
    this.#socketToSlotCache.set(cacheKey, coveringSlots);

    return coveringSlots;
  }

  /**
   * Checks if a slot has items that provide actual coverage (excluding accessories)
   * Accessories like belts don't cover body sockets even if they're in the same slot
   *
   * @private
   * @param {object} equipmentData - Equipment component data
   * @param {string} slotName - Name of the equipment slot
   * @returns {boolean} True if slot has items that provide coverage
   */
  hasItemsInSlotExcludingAccessories(equipmentData, slotName) {
    if (!equipmentData?.equipped) {
      this.logger.debug(
        `${this.operatorName}: hasItemsInSlotExcludingAccessories - No equipped property in equipment data`
      );
      return false;
    }

    const slot = equipmentData.equipped[slotName];
    if (!slot) {
      this.logger.debug(
        `${this.operatorName}: hasItemsInSlotExcludingAccessories - Slot '${slotName}' does not exist`
      );
      return false;
    }

    // Check if slot is an object with layer structure
    if (typeof slot !== 'object' || Array.isArray(slot)) {
      this.logger.debug(
        `${this.operatorName}: hasItemsInSlotExcludingAccessories - Slot '${slotName}' has invalid structure (not an object)`
      );
      return false;
    }

    // Check if any non-accessories layer has items
    const hasItems = Object.entries(slot).some(([layer, items]) => {
      // Skip accessories layer as it doesn't provide coverage
      if (layer === 'accessories') {
        return false;
      }

      // Handle various possible item structures
      if (Array.isArray(items)) {
        return items.length > 0;
      }
      // Handle single item (non-array)
      if (typeof items === 'string' && items.trim() !== '') {
        return true;
      }
      // Handle object items
      if (items && typeof items === 'object' && !Array.isArray(items)) {
        return Object.keys(items).length > 0;
      }
      return false;
    });

    this.logger.debug(
      `${this.operatorName}: hasItemsInSlotExcludingAccessories - Slot '${slotName}' has covering items: ${hasItems}`
    );

    return hasItems;
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

  /**
   * Checks if any equipped item with a coverage_mapping covers the target slot.
   * Handles items equipped in other slots that extend coverage to this slot.
   *
   * @private
   * @param {string} entityId - Entity ID (for cache scoping)
   * @param {object} equipmentData - Equipment component data
   * @param {string} slotName - Slot to check coverage for
   * @returns {boolean} True if any non-accessory layer item covers the slot via coverage_mapping
   */
  #hasCoverageMappingCoveringSlot(entityId, equipmentData, slotName) {
    if (!equipmentData?.equipped || typeof equipmentData.equipped !== 'object') {
      return false;
    }

    let covered = false;

    for (const slot of Object.values(equipmentData.equipped)) {
      if (!slot || typeof slot !== 'object') continue;
      for (const [layer, items] of Object.entries(slot)) {
        if (layer === 'accessories') continue;

        const itemIds = Array.isArray(items) ? items : items ? [items] : [];
        for (const itemId of itemIds) {
          if (!itemId || typeof itemId !== 'string') continue;
          const mapping = this.entityManager.getComponentData(
            itemId,
            'clothing:coverage_mapping'
          );
          if (
            mapping &&
            Array.isArray(mapping.covers) &&
            mapping.covers.includes(slotName)
          ) {
            covered = true;
            break;
          }
        }
        if (covered) break;
      }
      if (covered) break;
    }

    return covered;
  }
}
