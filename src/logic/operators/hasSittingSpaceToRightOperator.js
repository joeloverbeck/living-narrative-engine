/**
 * @module HasSittingSpaceToRightOperator
 * @description JSON Logic operator to check if an entity has empty space to their right while sitting
 */

import { BaseFurnitureOperator } from './base/BaseFurnitureOperator.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */

/**
 * @class HasSittingSpaceToRightOperator
 * @augments BaseFurnitureOperator
 * @description Checks if an actor sitting on furniture has empty space to their right
 *              and is the rightmost occupant
 *
 * Usage: {"hasSittingSpaceToRight": ["entity", "target", 2]}
 * Returns: true if entity is sitting on target with minSpaces empty spots to their right
 *          AND is the rightmost occupant (no one sitting further right)
 */
export class HasSittingSpaceToRightOperator extends BaseFurnitureOperator {
  /**
   * @param {object} dependencies
   * @param {IEntityManager} dependencies.entityManager
   * @param {ILogger} dependencies.logger
   */
  constructor({ entityManager, logger }) {
    super({ entityManager, logger }, 'hasSittingSpaceToRight');
  }

  /**
   * Evaluates if the entity has empty space to their right while sitting
   *
   * @protected
   * @param {string} entityId - The entity ID to check
   * @param {string} targetId - The furniture entity ID
   * @param {Array} params - Parameters: [minSpaces] (optional, default: 2)
   * @param {object} context - Evaluation context
   * @returns {boolean} True if entity has space to right and is rightmost occupant
   */
  evaluateInternal(entityId, targetId, params, context) {
    // Parse minSpaces parameter (default: 2)
    const minSpaces = params && params.length > 0 ? params[0] : 2;

    // Validate minSpaces parameter
    if (typeof minSpaces !== 'number' || minSpaces < 0) {
      this.logger.warn(
        `${this.operatorName}: Invalid minSpaces parameter: ${minSpaces}, using default: 2`
      );
      return this.#evaluateWithMinSpaces(entityId, targetId, 2);
    }

    return this.#evaluateWithMinSpaces(entityId, targetId, minSpaces);
  }

  /**
   * Internal evaluation logic with validated minSpaces
   *
   * @private
   * @param {string} entityId - The entity ID
   * @param {string} targetId - The furniture entity ID
   * @param {number} minSpaces - Minimum required empty spots to the right
   * @returns {boolean} Result of the evaluation
   */
  #evaluateWithMinSpaces(entityId, targetId, minSpaces) {
    this.logger.debug(
      `${this.operatorName}: Checking if entity ${entityId} has ${minSpaces} empty spots to right on furniture ${targetId}`
    );

    // Step 1: Validate entity is sitting
    const sittingOn = this.getSittingOnData(entityId);
    if (!sittingOn) {
      this.logger.debug(
        `${this.operatorName}: Entity ${entityId} is not sitting (no sitting_on component)`
      );
      return false;
    }

    // Step 2: Validate entity is sitting on target furniture
    if (sittingOn.furniture_id !== targetId) {
      this.logger.debug(
        `${this.operatorName}: Entity ${entityId} is sitting on ${sittingOn.furniture_id}, not target ${targetId}`
      );
      return false;
    }

    // Step 3: Get spot configuration
    const spotIndex = sittingOn.spot_index;
    if (
      spotIndex === undefined ||
      spotIndex === null ||
      typeof spotIndex !== 'number'
    ) {
      this.logger.warn(
        `${this.operatorName}: Entity ${entityId} has invalid spot_index: ${spotIndex}`
      );
      return false;
    }

    const { spots, isValid } = this.getFurnitureSpots(targetId);
    if (!isValid) {
      return false; // Error already logged in getFurnitureSpots
    }

    // Step 4: Validate spot_index is within bounds
    if (spotIndex < 0 || spotIndex >= spots.length) {
      this.logger.warn(
        `${this.operatorName}: Entity ${entityId} spot_index ${spotIndex} is out of bounds (spots length: ${spots.length})`
      );
      return false;
    }

    // Step 5: Verify entity is actually in the spot (consistency check)
    if (spots[spotIndex] !== entityId) {
      this.logger.warn(
        `${this.operatorName}: Entity ${entityId} claims spot ${spotIndex} but furniture shows ${spots[spotIndex]}`
      );
      return false;
    }

    // Step 6: Check if there are enough spots to the right
    const availableSpots = spots.length - spotIndex - 1;
    if (availableSpots < minSpaces) {
      this.logger.debug(
        `${this.operatorName}: Entity ${entityId} only has ${availableSpots} spots to right, needs ${minSpaces}`
      );
      return false;
    }

    // Step 7: Verify the next minSpaces spots are empty
    for (let i = 1; i <= minSpaces; i++) {
      const checkIndex = spotIndex + i;
      if (spots[checkIndex] !== null) {
        this.logger.debug(
          `${this.operatorName}: Entity ${entityId} spot ${checkIndex} to the right is occupied by ${spots[checkIndex]}`
        );
        return false;
      }
    }

    // Step 8: Verify entity is rightmost occupant
    // (no occupied spots after entity's position)
    for (let i = spotIndex + 1; i < spots.length; i++) {
      if (spots[i] !== null) {
        this.logger.debug(
          `${this.operatorName}: Entity ${entityId} is not rightmost - spot ${i} is occupied by ${spots[i]}`
        );
        return false;
      }
    }

    // All conditions met
    this.logger.debug(
      `${this.operatorName}: Entity ${entityId} has ${minSpaces} empty spots to right and is rightmost occupant`
    );
    return true;
  }
}
