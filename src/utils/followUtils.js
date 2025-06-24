/**
 * @module followUtils
 * @description Provides utility functions related to the follow/companion system.
 */

/**
 * @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager
 */

import { FOLLOWING_COMPONENT_ID } from '../constants/componentIds.js';
import { isValidEntityManager } from './entityValidationUtils.js';
import { resolveEntityInstance } from './componentAccessUtils.js';

/**
 * @description Retrieves the leader an entity is following.
 * @param {string} entityId - ID of the entity whose leader is requested.
 * @param {IEntityManager} entityManager - Manager used to resolve entities.
 * @returns {string | null} The leader ID or `null` when not found.
 */
export function getLeaderId(entityId, entityManager) {
  if (!entityId || !isValidEntityManager(entityManager)) {
    return null;
  }

  const entity = resolveEntityInstance(entityId, entityManager);
  if (!entity) {
    return null;
  }

  const data = entity.getComponentData(FOLLOWING_COMPONENT_ID);
  return data && data.leaderId ? data.leaderId : null;
}

/**
 * @description Performs a DFS traversal to detect a follow cycle.
 * @param {string} startId - The ID of the prospective follower.
 * @param {string} targetId - The ID of the entity being followed.
 * @param {IEntityManager} entityManager - Manager used to resolve entities.
 * @returns {boolean} `true` if a cycle is detected, otherwise `false`.
 */
export function detectCycle(startId, targetId, entityManager) {
  const visited = new Set();
  let currentId = targetId;

  while (currentId) {
    if (currentId === startId) {
      return true;
    }

    if (visited.has(currentId)) {
      return false;
    }
    visited.add(currentId);

    const leaderId = getLeaderId(currentId, entityManager);
    if (!leaderId) {
      return false;
    }
    currentId = leaderId;
  }

  return false;
}

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
  if (
    !prospectiveFollowerId ||
    !prospectiveLeaderId ||
    !isValidEntityManager(entityManager)
  ) {
    // Cannot perform check without required IDs and entity manager.
    return false;
  }

  return detectCycle(prospectiveFollowerId, prospectiveLeaderId, entityManager);
}
