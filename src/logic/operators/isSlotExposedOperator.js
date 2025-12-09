/**
 * @module IsSlotExposedOperator
 * @description JSON Logic operator to check if a clothing slot is uncovered across specific layers
 */

import { BaseEquipmentOperator } from './base/BaseEquipmentOperator.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */

const DEFAULT_LAYERS = ['base', 'outer', 'armor'];

/**
 * @class IsSlotExposedOperator
 * @augments BaseEquipmentOperator
 * @description Returns true when no covering items are equipped in the configured layers for a slot
 */
export class IsSlotExposedOperator extends BaseEquipmentOperator {
  /**
   * @param {object} dependencies
   * @param {IEntityManager} dependencies.entityManager
   * @param {ILogger} dependencies.logger
   */
  constructor({ entityManager, logger }) {
    super({ entityManager, logger }, 'isSlotExposed');
  }

  /**
   * Evaluates if the specified slot is exposed (no items equipped in the configured layers)
   *
   * @protected
   * @param {string} entityId - The entity ID to check
   * @param {Array} params - Parameters: [slotName, options]
   * @param {object} context - Evaluation context
   * @returns {boolean} True if slot has no covering items in the selected layers
   */
  evaluateInternal(entityId, params, context) {
    if (!params || params.length < 1) {
      this.logger.warn(
        `${this.operatorName}: Missing required parameter: slotName`
      );
      return false;
    }

    const [slotName, options] = params;

    if (!slotName) {
      this.logger.debug(
        `${this.operatorName}: Falsy slotName provided, treating as exposed`
      );
      return true;
    }

    if (typeof slotName !== 'string') {
      this.logger.warn(
        `${this.operatorName}: Invalid slotName parameter: ${slotName}`
      );
      return false;
    }

    const normalizedOptions = this.#normalizeOptions(options);
    const equipmentData = this.getEquipmentData(entityId);

    if (!equipmentData) {
      this.logger.debug(
        `${this.operatorName}: Entity ${entityId} has no clothing:equipment component`
      );
      return true;
    }

    if (
      !equipmentData.equipped ||
      typeof equipmentData.equipped !== 'object'
    ) {
      this.logger.debug(
        `${this.operatorName}: Entity ${entityId} has clothing:equipment but no equipped items structure`
      );
      return true;
    }

    const slot = equipmentData.equipped[slotName];
    if (!slot || typeof slot !== 'object') {
      this.logger.debug(
        `${this.operatorName}: Entity ${entityId} slot '${slotName}' missing or invalid; treating as exposed`
      );
      return true;
    }

    const layersWithItems = [];
    for (const layer of normalizedOptions.layers) {
      const hasItems = this.hasItemsInSlotLayer(equipmentData, slotName, layer);
      if (hasItems) {
        layersWithItems.push(layer);
      }
    }

    const isExposed = layersWithItems.length === 0;

    this.logger.debug(
      `${this.operatorName}: Entity ${entityId} slot '${slotName}' layers [${normalizedOptions.layers.join(', ')}] exposed: ${isExposed}`
    );

    return isExposed;
  }

  /**
   * Normalizes and validates options for layer selection.
   *
   * @private
   * @param {any} options - Raw options value
   * @returns {{layers: string[]}} Validated options
   */
  #normalizeOptions(options) {
    const normalizeLayerList = (layers) => {
      const validLayers = [];
      for (const layer of layers) {
        const isValid = this.isValidLayerName(layer);
        if (!isValid) {
          this.logger.warn(
            `${this.operatorName}: Invalid layer name '${layer}'. Valid layers: underwear, base, outer, accessories, armor`
          );
        } else {
          validLayers.push(layer);
        }
      }
      return validLayers;
    };

    if (Array.isArray(options)) {
      const normalizedLayers = normalizeLayerList(options);
      if (!normalizedLayers.length) {
        this.logger.warn(
          `${this.operatorName}: No valid layers provided; falling back to defaults`
        );
        return { layers: [...DEFAULT_LAYERS] };
      }
      const uniqueLayers = [];
      for (const layer of normalizedLayers) {
        if (!uniqueLayers.includes(layer)) {
          uniqueLayers.push(layer);
        }
      }
      return { layers: uniqueLayers };
    }

    const optionsObj = options && typeof options === 'object' ? options : {};

    let layers = Array.isArray(optionsObj.layers)
      ? normalizeLayerList(optionsObj.layers)
      : [...DEFAULT_LAYERS];

    if (!layers.length) {
      this.logger.warn(
        `${this.operatorName}: No valid layers provided; falling back to defaults`
      );
      layers = [...DEFAULT_LAYERS];
    }

    if (optionsObj.includeUnderwear) {
      layers.push('underwear');
    }

    if (optionsObj.includeAccessories) {
      layers.push('accessories');
    }

    const uniqueLayers = [];
    for (const layer of layers) {
      if (!uniqueLayers.includes(layer)) {
        uniqueLayers.push(layer);
      }
    }

    return { layers: uniqueLayers };
  }
}
