/**
 * @module IsClosestRightOccupantOperator
 * @description JSON Logic operator to find the closest occupant to the right of an actor on furniture
 */

import { BaseFurnitureOperator } from './base/BaseFurnitureOperator.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */

/**
 * @class IsClosestRightOccupantOperator
 * @augments BaseFurnitureOperator
 * @description Checks if a candidate entity is the closest occupant to the right of an actor on furniture
 *
 * Algorithm:
 * 1. Get actor's spot_index on target furniture
 * 2. Get candidate's spot_index on target furniture
 * 3. Verify candidate is to the right of actor (candidate_index > actor_index)
 * 4. Ensure the immediate spot to the right of the actor is empty
 * 5. Iterate from (actor_index + 1) up to the end of the seating array
 * 6. Return true if the first occupied spot is the candidate
 *
 * Usage: {"isClosestRightOccupant": ["entity", "target", "actor"]}
 * Returns: true if entity is the closest occupant to the right of actor on target furniture
 */
export class IsClosestRightOccupantOperator extends BaseFurnitureOperator {
  /**
   * @param {object} dependencies
   * @param {IEntityManager} dependencies.entityManager
   * @param {ILogger} dependencies.logger
   */
  constructor({ entityManager, logger }) {
    super({ entityManager, logger }, 'isClosestRightOccupant');
  }

  /**
   * Evaluates if the candidate is the closest occupant to the right of the actor
   *
   * @protected
   * @param {string} candidateId - The candidate entity ID to check
   * @param {string} targetId - The furniture entity ID
   * @param {Array} params - Parameters: [actorPath]
   * @param {object} context - Evaluation context
   * @returns {boolean} True if candidate is closest right occupant
   */
  evaluateInternal(candidateId, targetId, params, context) {
    if (!params || params.length < 1) {
      this.logger.warn(
        `${this.operatorName}: Missing required actor parameter`
      );
      return false;
    }

    const actorPath = params[0];
    let actorId;

    if (actorPath === 'actor' && context.actor) {
      actorId = context.actor.id || context.actor;
    } else if (typeof actorPath === 'string' && context[actorPath]) {
      const actorEntity = context[actorPath];
      actorId = actorEntity.id || actorEntity;
    } else {
      this.logger.warn(
        `${this.operatorName}: Could not resolve actor from path: ${actorPath}`
      );
      return false;
    }

    this.logger.debug(
      `${this.operatorName}: Checking if candidate ${candidateId} is closest right occupant to actor ${actorId} on furniture ${targetId}`
    );

    const actorSitting = this.getSittingOnData(actorId);
    if (!actorSitting) {
      this.logger.debug(
        `${this.operatorName}: Actor ${actorId} is not sitting (no sitting_on component)`
      );
      return false;
    }

    if (actorSitting.furniture_id !== targetId) {
      this.logger.debug(
        `${this.operatorName}: Actor ${actorId} is not sitting on target furniture ${targetId}`
      );
      return false;
    }

    const candidateSitting = this.getSittingOnData(candidateId);
    if (!candidateSitting) {
      this.logger.debug(
        `${this.operatorName}: Candidate ${candidateId} is not sitting (no sitting_on component)`
      );
      return false;
    }

    if (candidateSitting.furniture_id !== targetId) {
      this.logger.debug(
        `${this.operatorName}: Candidate ${candidateId} is not sitting on target furniture ${targetId}`
      );
      return false;
    }

    const actorIndex = actorSitting.spot_index;
    const candidateIndex = candidateSitting.spot_index;

    if (typeof actorIndex !== 'number' || typeof candidateIndex !== 'number') {
      this.logger.warn(
        `${this.operatorName}: Invalid spot_index values - actor: ${actorIndex}, candidate: ${candidateIndex}`
      );
      return false;
    }

    if (candidateIndex <= actorIndex) {
      this.logger.debug(
        `${this.operatorName}: Candidate ${candidateId} (index ${candidateIndex}) is not to the right of actor ${actorId} (index ${actorIndex})`
      );
      return false;
    }

    const { spots, isValid } = this.getFurnitureSpots(targetId);
    if (!isValid) {
      return false;
    }

    if (
      actorIndex < 0 ||
      actorIndex >= spots.length ||
      candidateIndex < 0 ||
      candidateIndex >= spots.length
    ) {
      this.logger.warn(
        `${this.operatorName}: Indices out of bounds - actor: ${actorIndex}, candidate: ${candidateIndex}, spots length: ${spots.length}`
      );
      return false;
    }

    if (spots[actorIndex] !== actorId) {
      this.logger.warn(
        `${this.operatorName}: Actor ${actorId} claims spot ${actorIndex} but furniture shows ${spots[actorIndex]}`
      );
      return false;
    }

    if (spots[candidateIndex] !== candidateId) {
      this.logger.warn(
        `${this.operatorName}: Candidate ${candidateId} claims spot ${candidateIndex} but furniture shows ${spots[candidateIndex]}`
      );
      return false;
    }

    const spotToRight = spots[actorIndex + 1];
    if (spotToRight !== null) {
      this.logger.debug(
        `${this.operatorName}: Spot immediately to right of actor (index ${actorIndex + 1}) is occupied by ${spotToRight} - cannot scoot`
      );
      return false;
    }

    for (let i = actorIndex + 1; i < spots.length; i++) {
      if (spots[i] !== null) {
        const isMatch = spots[i] === candidateId;
        this.logger.debug(
          `${this.operatorName}: Closest right occupant is ${spots[i]} at index ${i} - ${isMatch ? 'matches' : 'does not match'} candidate ${candidateId}`
        );
        return isMatch;
      }
    }

    this.logger.debug(
      `${this.operatorName}: No occupant found to the right of actor ${actorId}`
    );
    return false;
  }
}
