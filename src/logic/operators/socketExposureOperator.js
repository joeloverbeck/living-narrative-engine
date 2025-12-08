/**
 * @module SocketExposureOperator
 * @description Aggregates socket coverage checks using isSocketCovered
 */

import { BaseEquipmentOperator } from './base/BaseEquipmentOperator.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */

/**
 * @class SocketExposureOperator
 * @augments BaseEquipmentOperator
 * @description Evaluates exposure/coverage across one or more sockets using isSocketCovered
 */
export class SocketExposureOperator extends BaseEquipmentOperator {
  #isSocketCoveredOperator;

  /**
   * @param {object} dependencies
   * @param {IEntityManager} dependencies.entityManager
   * @param {ILogger} dependencies.logger
   * @param {import('./isSocketCoveredOperator.js').IsSocketCoveredOperator} dependencies.isSocketCoveredOperator
   */
  constructor({ entityManager, logger, isSocketCoveredOperator }) {
    super({ entityManager, logger }, 'socketExposure');
    this.#isSocketCoveredOperator = isSocketCoveredOperator;
  }

  /**
   * Aggregates socket exposure/coverage results
   *
   * @protected
   * @param {string} entityId
   * @param {Array} params - [sockets, mode?, invert?, treatMissingAsExposed?]
   * @param {object} context
   * @returns {boolean}
   */
  evaluateInternal(entityId, params, context) {
    if (!this.#isSocketCoveredOperator) {
      this.logger.error(
        `${this.operatorName}: Missing isSocketCoveredOperator dependency`
      );
      return false;
    }

    if (!params || params.length < 1) {
      this.logger.warn(
        `${this.operatorName}: Missing required parameter: sockets`
      );
      return false;
    }

    const [sockets, mode = 'any', invert = false, treatMissingAsExposed = true] =
      params;

    const socketList = Array.isArray(sockets) ? sockets : [sockets];

    const normalizedMode = mode === 'all' ? 'all' : 'any';
    if (mode !== 'any' && mode !== 'all') {
      this.logger.warn(
        `${this.operatorName}: Invalid mode '${mode}', defaulting to 'any'`
      );
    }

    const treatMissing = Boolean(treatMissingAsExposed);
    const inverted = Boolean(invert);

    const results = socketList.map((socketId) =>
      this.#evaluateSocket(entityId, socketId, treatMissing, inverted, context)
    );

    if (results.length === 0) {
      return inverted ? !treatMissing : treatMissing;
    }

    return normalizedMode === 'all'
      ? results.every(Boolean)
      : results.some(Boolean);
  }

  #evaluateSocket(entityId, socketId, treatMissingAsExposed, invert, context) {
    if (!socketId || typeof socketId !== 'string') {
      if (socketId !== undefined && socketId !== null && socketId !== false) {
        this.logger.warn(
          `${this.operatorName}: Invalid socketId '${socketId}', treating as ${
            treatMissingAsExposed ? 'exposed' : 'covered'
          }`
        );
      }

      const exposed = treatMissingAsExposed;
      return invert ? !exposed : exposed;
    }

    const covered = this.#isSocketCoveredOperator.evaluateInternal(
      entityId,
      [socketId],
      context
    );

    const exposed = !covered;
    return invert ? covered : exposed;
  }

  /**
   * Delegates cache clearing to the underlying isSocketCovered operator
   *
   * @param {string} [entityId]
   */
  clearCache(entityId) {
    if (typeof this.#isSocketCoveredOperator?.clearCache === 'function') {
      this.#isSocketCoveredOperator.clearCache(entityId);
    }
  }
}
