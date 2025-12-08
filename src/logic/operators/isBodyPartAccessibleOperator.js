/**
 * @module IsBodyPartAccessibleOperator
 * @description Combines slot exposure and socket exposure checks for a body part
 */

import { BaseBodyPartOperator } from './base/BaseBodyPartOperator.js';
import { hasValidEntityId } from '../utils/entityPathResolver.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../anatomy/bodyGraphService.js').BodyGraphService} BodyGraphService */

const VALID_LAYERS = ['underwear', 'base', 'outer', 'accessories', 'armor'];
const DEFAULT_LAYERS = ['base', 'outer', 'armor'];

/**
 * @class IsBodyPartAccessibleOperator
 * @augments BaseBodyPartOperator
 * @description Determines whether a body part is exposed/accessible based on clothing slot and socket coverage
 */
export class IsBodyPartAccessibleOperator extends BaseBodyPartOperator {
  #isSlotExposedOperator;
  #socketExposureOperator;

  /**
   * @param {object} dependencies
   * @param {IEntityManager} dependencies.entityManager
   * @param {BodyGraphService} dependencies.bodyGraphService
   * @param {ILogger} dependencies.logger
   * @param {import('./isSlotExposedOperator.js').IsSlotExposedOperator} dependencies.isSlotExposedOperator
   * @param {import('./socketExposureOperator.js').SocketExposureOperator} dependencies.socketExposureOperator
   */
  constructor({
    entityManager,
    bodyGraphService,
    logger,
    isSlotExposedOperator,
    socketExposureOperator,
  }) {
    super({ entityManager, bodyGraphService, logger }, 'isBodyPartAccessible');
    this.#isSlotExposedOperator = isSlotExposedOperator;
    this.#socketExposureOperator = socketExposureOperator;
  }

  /**
   * @protected
   * @param {string} entityId - Owner entity ID (used for clothing/socket checks)
   * @param {string} rootId - Root anatomy ID (unused, retained for parity)
   * @param {Array} params - [partEntityRef, options]
   * @param {object} context - Evaluation context
   * @param {object} bodyComponent - The owner's body component
   * @returns {boolean}
   */
  evaluateInternal(entityId, rootId, params, context, bodyComponent) {
    if (!this.#isSlotExposedOperator || !this.#socketExposureOperator) {
      this.logger.error(
        `${this.operatorName}: Missing slot/socket operator dependencies`
      );
      return false;
    }

    if (!params || params.length < 1) {
      this.logger.warn(`${this.operatorName}: Invalid parameters`);
      return false;
    }

    const [partEntityRef, options] = params;
    const partEntityId = this.#resolvePartEntityId(partEntityRef);

    if (!partEntityId) {
      this.logger.warn(
        `${this.operatorName}: Invalid part reference for entity '${entityId}'`
      );
      return false;
    }

    const visibilityRules = this.#getComponentSafe(
      partEntityRef,
      partEntityId,
      'anatomy:visibility_rules'
    );
    const joint = this.#getComponentSafe(
      partEntityRef,
      partEntityId,
      'anatomy:joint'
    );

    const { slotOptions, socketOptions, slotName, socketTargets } =
      this.#normalizeOptions(options, visibilityRules, joint);

    const slotLayers = slotOptions.layers || [];
    const slotExposed =
      !slotName || slotLayers.length === 0
        ? true
        : this.#isSlotExposedOperator.evaluateInternal(
            entityId,
            [slotName, slotOptions],
            context
          );

    if (!slotExposed) {
      return false;
    }

    if (!socketTargets || socketTargets.length === 0) {
      return socketOptions.treatMissingAsExposed;
    }

    return this.#socketExposureOperator.evaluateInternal(
      entityId,
      [
        socketTargets.length === 1 ? socketTargets[0] : socketTargets,
        socketOptions.mode,
        socketOptions.invert,
        socketOptions.treatMissingAsExposed,
      ],
      context
    );
  }

  /**
   * Delegates cache clearing to socket exposure operator (and its coverage dependency)
   *
   * @param {string} [entityId]
   */
  clearCache(entityId) {
    if (typeof this.#socketExposureOperator?.clearCache === 'function') {
      this.#socketExposureOperator.clearCache(entityId);
    }
  }

  #resolvePartEntityId(partEntityRef) {
    if (hasValidEntityId(partEntityRef)) {
      return partEntityRef.id;
    }

    if (typeof partEntityRef === 'string' || typeof partEntityRef === 'number') {
      return partEntityRef;
    }

    if (partEntityRef && typeof partEntityRef === 'object') {
      if (typeof partEntityRef.getComponentData === 'function') {
        // eslint-disable-next-line no-underscore-dangle
        return partEntityRef.id ?? partEntityRef._id ?? null;
      }

      if (typeof partEntityRef.id === 'string' || typeof partEntityRef.id === 'number') {
        return partEntityRef.id;
      }
    }

    return null;
  }

  #getComponentSafe(partEntityRef, partEntityId, componentId) {
    try {
      const data = this.entityManager.getComponentData(partEntityId, componentId);
      if (data !== undefined) {
        return data;
      }
    } catch (error) {
      this.logger.debug(
        `${this.operatorName}: Failed to read ${componentId} for part '${partEntityId}' via entityManager`,
        error
      );
    }

    if (partEntityRef && typeof partEntityRef.getComponentData === 'function') {
      try {
        return partEntityRef.getComponentData(componentId);
      } catch (error) {
        this.logger.debug(
          `${this.operatorName}: Failed to read ${componentId} from part reference`,
          error
        );
      }
    }

    if (partEntityRef && partEntityRef.components) {
      return partEntityRef.components[componentId] || null;
    }

    return null;
  }

  #normalizeOptions(options, visibilityRules, joint) {
    const slotOptionsInput = options?.slot || {};
    const socketOptionsInput = options?.socket || {};

    const excludeLayers = new Set();
    const addExclusion = (layer) => {
      if (VALID_LAYERS.includes(layer)) {
        excludeLayers.add(layer);
      }
    };

    if (Array.isArray(slotOptionsInput.excludeLayers)) {
      for (const layer of slotOptionsInput.excludeLayers) {
        addExclusion(layer);
      }
    }

    if (Array.isArray(visibilityRules?.nonBlockingLayers)) {
      for (const layer of visibilityRules.nonBlockingLayers) {
        addExclusion(layer);
      }
    }

    const baseLayers = Array.isArray(slotOptionsInput.layers)
      ? slotOptionsInput.layers
      : DEFAULT_LAYERS;

    const layers = [];
    const candidateLayers = [
      ...baseLayers,
      ...(slotOptionsInput.includeUnderwear ? ['underwear'] : []),
      ...(slotOptionsInput.includeAccessories ? ['accessories'] : []),
    ];

    for (const layer of candidateLayers) {
      if (!VALID_LAYERS.includes(layer) || excludeLayers.has(layer)) {
        continue;
      }
      if (!layers.includes(layer)) {
        layers.push(layer);
      }
    }

    const socketTargets = this.#normalizeSocketTargets(
      socketOptionsInput.ids ?? socketOptionsInput.sockets ?? joint?.socketId
    );

    return {
      slotOptions: { layers },
      slotName:
        slotOptionsInput.slotName ||
        slotOptionsInput.clothingSlotId ||
        visibilityRules?.clothingSlotId ||
        null,
      socketOptions: {
        mode: socketOptionsInput.mode === 'all' ? 'all' : 'any',
        invert: Boolean(socketOptionsInput.invert),
        treatMissingAsExposed:
          socketOptionsInput.treatMissingAsExposed === false ? false : true,
      },
      socketTargets,
    };
  }

  #normalizeSocketTargets(socketIdOrList) {
    if (Array.isArray(socketIdOrList)) {
      return socketIdOrList.filter((id) => id);
    }

    if (socketIdOrList) {
      return [socketIdOrList];
    }

    return [];
  }
}
