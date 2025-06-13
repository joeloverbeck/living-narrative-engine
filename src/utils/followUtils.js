/**
 * @module followUtils
 * @description Provides utility functions related to the follow/companion system.
 */

/**
 * @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager
 */

import { FOLLOWING_COMPONENT_ID } from '../constants/componentIds.js';

/**
 * @description
 * Traverses the "follow graph" to determine if an entity attempting to follow another
 * would create a cycle. It performs a Depth-First Search (DFS) starting from the
 * potential leader, following the `leaderId` references in `core:following` components.
 * @example
 * // Scenario: A -> B. C wants to follow A. No cycle.
 * wouldCreateCycle('C', 'A', entityManager); // returns false
 * @example
 * // Scenario: A -> B. B wants to follow A. Direct cycle.
 * wouldCreateCycle('B', 'A', entityManager); // returns true
 * @example
 * // Scenario: A -> B -> C. C wants to follow A. Long cycle.
 * wouldCreateCycle('C', 'A', entityManager); // returns true
 * @param {string} prospectiveFollowerId - The ID of the entity that wants to start following.
 * @param {string} prospectiveLeaderId - The ID of the entity that would be followed.
 * @param {IEntityManager} entityManager - The entity manager instance to query game state.
 * @returns {boolean} Returns `true` if a cycle would be created, otherwise `false`.
 */
export function wouldCreateCycle(
  prospectiveFollowerId,
  prospectiveLeaderId,
  entityManager
) {
  if (!prospectiveFollowerId || !prospectiveLeaderId || !entityManager) {
    // Cannot perform check without required IDs and entity manager.
    return false;
  }

  const visited = new Set();
  let currentId = prospectiveLeaderId;

  while (currentId) {
    // 1. Cycle detected: The chain leads back to the original follower.
    if (currentId === prospectiveFollowerId) {
      return true;
    }

    // 2. An existing (but unrelated) cycle was found, or we've already checked this path.
    if (visited.has(currentId)) {
      return false; // Not a cycle involving our prospectiveFollower, but the path is broken/cyclic.
    }
    visited.add(currentId);

    const currentEntity = entityManager.getEntityInstance(currentId);
    if (!currentEntity) {
      // The leader doesn't exist, so the chain is broken. No cycle.
      return false;
    }

    const followingComponent = currentEntity.getComponentData(
      FOLLOWING_COMPONENT_ID
    );
    if (!followingComponent || !followingComponent.leaderId) {
      // The current entity in the chain isn't following anyone. End of the line. No cycle.
      return false;
    }

    // 3. Move to the next link in the chain.
    currentId = followingComponent.leaderId;
  }

  // 4. Reached the end of the chain without finding the prospective follower.
  return false;
}
