/**
 * @module CanScootCloserOperator
 * @description JSON Logic operator to check if an actor can scoot one spot closer (to the left) on furniture
 */

import { BaseFurnitureOperator } from './base/BaseFurnitureOperator.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */

/**
 * @class CanScootCloserOperator
 * @augments BaseFurnitureOperator
 * @description Checks if an actor can move one spot to the left on furniture
 *
 * Validation steps:
 * 1. Verify entity is sitting on target furniture
 * 2. Verify entity's spot_index > 0 (not leftmost)
 * 3. Verify spot to the left (spot_index - 1) is empty
 * 4. Verify there's at least one occupied spot further left (to scoot toward)
 * 5. Verify no gaps between entity and leftmost occupant
 *
 * Usage: {"canScootCloser": ["entity", "target"]}
 * Returns: true if entity can scoot closer on target furniture
 */
export class CanScootCloserOperator extends BaseFurnitureOperator {
  /**
   * @param {object} dependencies
   * @param {IEntityManager} dependencies.entityManager
   * @param {ILogger} dependencies.logger
   */
  constructor({ entityManager, logger }) {
    super({ entityManager, logger }, 'canScootCloser');
  }

  /**
   * Evaluates if the entity can scoot one spot closer on the furniture
   *
   * @protected
   * @param {string} entityId - The entity ID to check
   * @param {string} targetId - The furniture entity ID
   * @param {Array} params - Operator-specific parameters (unused)
   * @param {object} context - Evaluation context
   * @returns {boolean} True if entity can scoot closer
   */
  evaluateInternal(entityId, targetId, params, context) {
    this.logger.debug(
      `${this.operatorName}: Checking if entity ${entityId} can scoot closer on furniture ${targetId}`
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

    // Step 3: Get furniture spots configuration
    const { spots, isValid } = this.getFurnitureSpots(targetId);
    if (!isValid) {
      return false; // Error already logged in getFurnitureSpots
    }

    const currentIndex = sittingOn.spot_index;

    // Step 4: Validate spot_index is a valid number and within bounds
    if (
      currentIndex === undefined ||
      currentIndex === null ||
      typeof currentIndex !== 'number'
    ) {
      this.logger.warn(
        `${this.operatorName}: Entity ${entityId} has invalid spot_index: ${currentIndex}`
      );
      return false;
    }

    if (currentIndex < 0 || currentIndex >= spots.length) {
      this.logger.warn(
        `${this.operatorName}: Entity ${entityId} spot_index ${currentIndex} is out of bounds (spots length: ${spots.length})`
      );
      return false;
    }

    // Step 5: Verify entity is actually in the spot (consistency check)
    if (spots[currentIndex] !== entityId) {
      this.logger.warn(
        `${this.operatorName}: Entity ${entityId} claims spot ${currentIndex} but furniture shows ${spots[currentIndex]}`
      );
      return false;
    }

    // Step 6: Validate not in leftmost position
    if (currentIndex <= 0) {
      this.logger.debug(
        `${this.operatorName}: Entity ${entityId} is already in leftmost position (index ${currentIndex})`
      );
      return false;
    }

    // Step 7: Validate spot to the left is empty
    if (spots[currentIndex - 1] !== null) {
      this.logger.debug(
        `${this.operatorName}: Entity ${entityId} cannot scoot - spot ${currentIndex - 1} to the left is occupied by ${spots[currentIndex - 1]}`
      );
      return false;
    }

    // Step 8: Find closest occupant to the left
    let hasOccupantToLeft = false;
    let closestOccupantIndex = -1;

    for (let i = currentIndex - 2; i >= 0; i--) {
      if (spots[i] !== null) {
        hasOccupantToLeft = true;
        closestOccupantIndex = i;
        break;
      }
    }

    // Step 9: Validate there's an occupant to scoot toward
    if (!hasOccupantToLeft) {
      this.logger.debug(
        `${this.operatorName}: Entity ${entityId} has no occupant to the left to scoot toward`
      );
      return false;
    }

    // Step 10: Validate no gaps - all spots from closestOccupantIndex to currentIndex
    // should form a continuous group (only empty spots between, no other occupants)
    // AND all spots from 0 to closestOccupantIndex should also be consecutive
    for (let i = 0; i < closestOccupantIndex; i++) {
      if (spots[i] !== null) {
        // Found an occupant before the closest one - check if there's a gap
        let gapFound = false;
        for (let j = i + 1; j < closestOccupantIndex; j++) {
          if (spots[j] === null) {
            gapFound = true;
            break;
          }
        }
        if (gapFound) {
          this.logger.debug(
            `${this.operatorName}: Entity ${entityId} has a gap between occupants to the left`
          );
          return false;
        }
      }
    }

    // All conditions met
    this.logger.debug(
      `${this.operatorName}: Entity ${entityId} can scoot closer on furniture ${targetId} (current: ${currentIndex} → new: ${currentIndex - 1})`
    );
    return true;
  }
}
