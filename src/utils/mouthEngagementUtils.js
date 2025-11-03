/**
 * @file Utility functions for managing mouth engagement locks.
 * @description Provides unified interface for locking/unlocking mouth engagement
 * across both anatomy-based and legacy entity structures.
 */

import { deepClone } from './cloneUtils.js';

/** @typedef {import('../entities/entityManager.js').default} EntityManager */

/**
 * Result from updating mouth engagement lock.
 *
 * @typedef {object} MouthEngagementUpdateResult
 * @property {Array<{partId: string, engagement: object}>} [updatedParts] - Updated anatomy parts
 * @property {boolean} locked - The lock state that was applied
 */

/**
 * Update the locked state of an entity's mouth engagement component.
 * Handles both legacy entities with direct mouth engagement and anatomy-based mouth parts.
 *
 * @param {EntityManager} entityManager - Entity manager instance.
 * @param {string} entityId - ID of the entity to update.
 * @param {boolean} locked - Whether mouth engagement should be locked.
 * @returns {Promise<MouthEngagementUpdateResult|null>} Update result or null if no mouth found.
 */
export async function updateMouthEngagementLock(
  entityManager,
  entityId,
  locked
) {
  // Validate inputs
  if (!entityManager) {
    throw new Error('EntityManager is required');
  }

  if (!entityId || typeof entityId !== 'string') {
    throw new Error('Valid entityId string is required');
  }

  if (typeof locked !== 'boolean') {
    throw new Error('Locked parameter must be a boolean');
  }

  // Check if entity has anatomy:body component
  const bodyComponent = entityManager.getComponentData(
    entityId,
    'anatomy:body'
  );

  if (bodyComponent && bodyComponent.body && bodyComponent.body.root) {
    // New anatomy-based path: find and update mouth parts
    return await updateAnatomyBasedMouthEngagement(
      entityManager,
      entityId,
      bodyComponent,
      locked
    );
  }

  // Legacy path: check entity directly for mouth engagement
  return await updateLegacyMouthEngagement(entityManager, entityId, locked);
}

/**
 * Update mouth engagement for anatomy-based entities.
 *
 * @param {EntityManager} entityManager - Entity manager instance
 * @param {string} entityId - ID of the entity to update
 * @param {object} bodyComponent - The anatomy:body component data
 * @param {boolean} locked - Whether mouth engagement should be locked
 * @returns {Promise<MouthEngagementUpdateResult|null>} Update result or null if no mouth found
 * @private
 */
async function updateAnatomyBasedMouthEngagement(
  entityManager,
  entityId,
  bodyComponent,
  locked
) {
  const updatedParts = [];

  // Look for mouth parts in the body.parts map
  if (bodyComponent.body.parts) {
    for (const [_partType, partId] of Object.entries(
      bodyComponent.body.parts
    )) {
      // Check if this part is a mouth by looking for the anatomy:part component
      const partComponent = entityManager.getComponentData(
        partId,
        'anatomy:part'
      );

      if (partComponent && partComponent.subType === 'mouth') {
        // Get or create mouth engagement component
        let mouthEngagement = entityManager.getComponentData(
          partId,
          'core:mouth_engagement'
        );

        if (!mouthEngagement) {
          mouthEngagement = { locked: false, forcedOverride: false };
        }

        // Clone and update the mouth engagement component
        const updatedEngagement = cloneComponent(mouthEngagement);
        updatedEngagement.locked = locked;

        // Update the component
        await entityManager.addComponent(
          partId,
          'core:mouth_engagement',
          updatedEngagement
        );

        updatedParts.push({
          partId,
          engagement: updatedEngagement,
        });
      }
    }
  }

  // Return summary of updates
  return updatedParts.length > 0 ? { updatedParts, locked } : null;
}

/**
 * Update mouth engagement for legacy entities.
 *
 * @param {EntityManager} entityManager - Entity manager instance
 * @param {string} entityId - ID of the entity to update
 * @param {boolean} locked - Whether mouth engagement should be locked
 * @returns {Promise<{locked: boolean}>} Update result with locked state
 * @private
 */
async function updateLegacyMouthEngagement(entityManager, entityId, locked) {
  // Check for existing mouth engagement component
  const existing = entityManager.getComponentData(
    entityId,
    'core:mouth_engagement'
  );

  const engagement = existing
    ? cloneComponent(existing)
    : { locked: false, forcedOverride: false };

  engagement.locked = locked;

  await entityManager.addComponent(
    entityId,
    'core:mouth_engagement',
    engagement
  );

  return { locked };
}

/**
 * Clone a component object safely.
 *
 * @param {object} component - The component to clone
 * @returns {object} The cloned component
 * @private
 */
function cloneComponent(component) {
  // Use native structuredClone if available (Node 17+)
  const structuredCloneFn = globalThis.structuredClone;

  if (typeof structuredCloneFn === 'function') {
    return structuredCloneFn(component);
  }
  // Fallback to utility function
  return deepClone(component);
}

export const __testing__ = {
  cloneComponent,
};

/**
 * Check if an entity's mouth is currently locked.
 * Convenience function for read-only checks.
 *
 * @param {EntityManager} entityManager - Entity manager instance.
 * @param {string} entityId - ID of the entity to check.
 * @returns {boolean} True if mouth is locked, false otherwise.
 */
export function isMouthLocked(entityManager, entityId) {
  if (!entityManager || !entityId) {
    return false;
  }

  // Check anatomy-based path first
  const bodyComponent = entityManager.getComponentData(
    entityId,
    'anatomy:body'
  );

  if (bodyComponent && bodyComponent.body && bodyComponent.body.parts) {
    // Check all mouth parts
    for (const [_partType, partId] of Object.entries(
      bodyComponent.body.parts
    )) {
      const partComponent = entityManager.getComponentData(
        partId,
        'anatomy:part'
      );

      if (partComponent && partComponent.subType === 'mouth') {
        const engagement = entityManager.getComponentData(
          partId,
          'core:mouth_engagement'
        );

        if (engagement && engagement.locked) {
          return true; // At least one mouth is locked
        }
      }
    }
    return false; // No locked mouths found
  }

  // Check legacy path
  const engagement = entityManager.getComponentData(
    entityId,
    'core:mouth_engagement'
  );

  return engagement ? engagement.locked : false;
}

/**
 * Get all mouth parts for an entity.
 * Useful for debugging and testing.
 *
 * @param {EntityManager} entityManager - Entity manager instance.
 * @param {string} entityId - ID of the entity.
 * @returns {Array<{partId: string, partComponent: object, engagement: object|null}>} Array of mouth parts.
 */
export function getMouthParts(entityManager, entityId) {
  const mouthParts = [];

  if (!entityManager || !entityId) {
    return mouthParts;
  }

  const bodyComponent = entityManager.getComponentData(
    entityId,
    'anatomy:body'
  );

  if (bodyComponent && bodyComponent.body && bodyComponent.body.parts) {
    for (const [_partType, partId] of Object.entries(
      bodyComponent.body.parts
    )) {
      const partComponent = entityManager.getComponentData(
        partId,
        'anatomy:part'
      );

      if (partComponent && partComponent.subType === 'mouth') {
        const engagement = entityManager.getComponentData(
          partId,
          'core:mouth_engagement'
        );

        mouthParts.push({
          partId,
          partComponent,
          engagement,
        });
      }
    }
  }

  return mouthParts;
}
