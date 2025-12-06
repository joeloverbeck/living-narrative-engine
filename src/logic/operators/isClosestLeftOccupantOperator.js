/**
 * @module IsClosestLeftOccupantOperator
 * @description JSON Logic operator to find the closest occupant to the left of an actor on furniture
 */

import { BaseFurnitureOperator } from './base/BaseFurnitureOperator.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */

/**
 * @class IsClosestLeftOccupantOperator
 * @augments BaseFurnitureOperator
 * @description Checks if a candidate entity is the closest occupant to the left of an actor on furniture
 *
 * Algorithm:
 * 1. Get actor's spot_index on target furniture
 * 2. Get candidate's spot_index on target furniture
 * 3. Verify candidate is to the left of actor (candidate_index < actor_index)
 * 4. Iterate from (actor_index - 1) down to 0
 * 5. Return true if first occupied spot is the candidate
 *
 * Usage: {"isClosestLeftOccupant": ["entity", "target", "actor"]}
 * Returns: true if entity is the closest occupant to the left of actor on target furniture
 */
export class IsClosestLeftOccupantOperator extends BaseFurnitureOperator {
  /**
   * @param {object} dependencies
   * @param {IEntityManager} dependencies.entityManager
   * @param {ILogger} dependencies.logger
   */
  constructor({ entityManager, logger }) {
    super({ entityManager, logger }, 'isClosestLeftOccupant');
  }

  /**
   * Evaluates if the candidate is the closest occupant to the left of the actor
   *
   * @protected
   * @param {string} candidateId - The candidate entity ID to check
   * @param {string} targetId - The furniture entity ID
   * @param {Array} params - Parameters: [actorPath]
   * @param {object} context - Evaluation context
   * @returns {boolean} True if candidate is closest left occupant
   */
  evaluateInternal(candidateId, targetId, params, context) {
    // TEMP DEBUG: Log context structure
    console.log(`\n🔍 ${this.operatorName} CALLED:`, {
      candidateId,
      targetId,
      params,
      contextKeys: Object.keys(context || {}),
      'context.actor': context?.actor,
      'context.target': context?.target,
    });

    // Extract actor ID from params
    if (!params || params.length < 1) {
      this.logger.warn(
        `${this.operatorName}: Missing required actor parameter`
      );
      return false;
    }

    const actorPath = params[0];
    let actorId;

    // Resolve actor ID from path
    if (actorPath === 'actor' && context.actor) {
      actorId = context.actor.id || context.actor;
    } else if (typeof actorPath === 'string' && context[actorPath]) {
      const actorEntity = context[actorPath];
      actorId = actorEntity.id || actorEntity;
    } else {
      this.logger.warn(
        `${this.operatorName}: Could not resolve actor from path: ${actorPath}`
      );
      console.log(`❌ FAILED TO RESOLVE ACTOR from path: ${actorPath}`);
      return false;
    }

    this.logger.debug(
      `${this.operatorName}: Checking if candidate ${candidateId} is closest left occupant to actor ${actorId} on furniture ${targetId}`
    );

    // Step 1: Get actor's sitting position
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

    // Step 2: Get candidate's sitting position
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

    // Step 3: Validate indices are valid numbers
    if (typeof actorIndex !== 'number' || typeof candidateIndex !== 'number') {
      this.logger.warn(
        `${this.operatorName}: Invalid spot_index values - actor: ${actorIndex}, candidate: ${candidateIndex}`
      );
      return false;
    }

    // Step 4: Candidate must be to the left of actor
    if (candidateIndex >= actorIndex) {
      this.logger.debug(
        `${this.operatorName}: Candidate ${candidateId} (index ${candidateIndex}) is not to the left of actor ${actorId} (index ${actorIndex})`
      );
      return false;
    }

    // Step 5: Get furniture spots
    const { spots, isValid } = this.getFurnitureSpots(targetId);
    if (!isValid) {
      return false; // Error already logged in getFurnitureSpots
    }

    // Step 6: Validate indices are within bounds
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

    // Step 7: Verify both entities are actually in their claimed spots
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

    // Step 7.5: Check if the spot immediately to the left of actor is empty
    // This is required for the scoot_closer action - you can only scoot if there's
    // an empty spot to move into
    const spotToLeft = spots[actorIndex - 1];
    if (spotToLeft !== null) {
      this.logger.debug(
        `${this.operatorName}: Spot immediately to left of actor (index ${actorIndex - 1}) is occupied by ${spotToLeft} - cannot scoot`
      );
      return false;
    }

    // Step 8: Find closest occupant to the left of actor
    for (let i = actorIndex - 1; i >= 0; i--) {
      if (spots[i] !== null) {
        // Found closest occupant - check if it's the candidate
        const isMatch = spots[i] === candidateId;
        this.logger.debug(
          `${this.operatorName}: Closest left occupant is ${spots[i]} at index ${i} - ${isMatch ? 'matches' : 'does not match'} candidate ${candidateId}`
        );
        return isMatch;
      }
    }

    // No occupant found to the left
    this.logger.debug(
      `${this.operatorName}: No occupant found to the left of actor ${actorId}`
    );
    return false;
  }
}
