/**
 * @file Utility functions for managing grabbing appendage locks
 *
 * Provides functions to count, lock, and unlock grabbing appendages
 * on entities that have anatomy:body components with parts containing
 * anatomy:can_grab components.
 * @see data/mods/anatomy/components/can_grab.component.json
 * @see brainstorming/appendage-grabbing-occupation-system.md
 */

import { deepClone } from './cloneUtils.js';

/** @typedef {import('../entities/entityManager.js').default} EntityManager */

/**
 * Clone a component object safely.
 *
 * @param {object} component - The component to clone
 * @returns {object} The cloned component
 * @private
 */
function cloneComponent(component) {
  const structuredCloneFn = globalThis.structuredClone;
  if (typeof structuredCloneFn === 'function') {
    return structuredCloneFn(component);
  }
  return deepClone(component);
}

/**
 * Finds all body part IDs that have the anatomy:can_grab component
 *
 * @param {EntityManager} entityManager - Entity manager instance
 * @param {string} entityId - The entity ID to check
 * @returns {string[]} Array of body part entity IDs with can_grab component
 */
export function findGrabbingAppendages(entityManager, entityId) {
  if (!entityManager || !entityId) {
    return [];
  }

  const bodyComponent = entityManager.getComponentData(
    entityId,
    'anatomy:body'
  );
  if (!bodyComponent || !bodyComponent.body || !bodyComponent.body.parts) {
    return [];
  }

  const grabbingParts = [];
  for (const partId of Object.values(bodyComponent.body.parts)) {
    const canGrab = entityManager.getComponentData(partId, 'anatomy:can_grab');
    if (canGrab) {
      grabbingParts.push(partId);
    }
  }

  return grabbingParts;
}

/**
 * Count free (unlocked) grabbing appendages for an entity
 *
 * @param {EntityManager} entityManager - Entity manager instance
 * @param {string} entityId - The entity ID to check
 * @returns {number} Count of free grabbing appendages
 */
export function countFreeGrabbingAppendages(entityManager, entityId) {
  const appendages = findGrabbingAppendages(entityManager, entityId);
  let count = 0;

  for (const partId of appendages) {
    const canGrab = entityManager.getComponentData(partId, 'anatomy:can_grab');
    if (canGrab && !canGrab.locked) {
      count++;
    }
  }

  return count;
}

/**
 * Count total grabbing appendages for an entity (locked + unlocked)
 *
 * @param {EntityManager} entityManager - Entity manager instance
 * @param {string} entityId - The entity ID to check
 * @returns {number} Total count of grabbing appendages
 */
export function countTotalGrabbingAppendages(entityManager, entityId) {
  return findGrabbingAppendages(entityManager, entityId).length;
}

/**
 * Calculate total grip strength of free appendages
 *
 * @param {EntityManager} entityManager - Entity manager instance
 * @param {string} entityId - The entity ID to check
 * @returns {number} Sum of gripStrength from all free appendages
 */
export function calculateFreeGripStrength(entityManager, entityId) {
  const appendages = findGrabbingAppendages(entityManager, entityId);
  let totalStrength = 0;

  for (const partId of appendages) {
    const canGrab = entityManager.getComponentData(partId, 'anatomy:can_grab');
    if (canGrab && !canGrab.locked) {
      // Default gripStrength is 1.0 per schema
      totalStrength += canGrab.gripStrength ?? 1.0;
    }
  }

  return totalStrength;
}

/**
 * Lock N grabbing appendages, optionally associating with an item
 *
 * @param {EntityManager} entityManager - Entity manager instance
 * @param {string} entityId - The entity ID whose appendages to lock
 * @param {number} count - Number of appendages to lock
 * @param {string|null} [itemId] - Optional item ID to associate with locked appendages
 * @returns {Promise<{ success: boolean, lockedParts: string[], error?: string }>}
 */
export async function lockGrabbingAppendages(
  entityManager,
  entityId,
  count,
  itemId = null
) {
  if (!entityManager || !entityId) {
    return { success: false, lockedParts: [], error: 'Invalid arguments' };
  }

  if (count <= 0) {
    return { success: true, lockedParts: [] };
  }

  const appendages = findGrabbingAppendages(entityManager, entityId);
  const freeAppendages = [];

  for (const partId of appendages) {
    const canGrab = entityManager.getComponentData(partId, 'anatomy:can_grab');
    if (canGrab && !canGrab.locked) {
      freeAppendages.push({ partId, canGrab });
    }
  }

  if (freeAppendages.length < count) {
    return {
      success: false,
      lockedParts: [],
      error: `Not enough free appendages: need ${count}, have ${freeAppendages.length}`,
    };
  }

  const lockedParts = [];
  const toLock = freeAppendages.slice(0, count);

  for (const { partId, canGrab } of toLock) {
    const updated = cloneComponent(canGrab);
    updated.locked = true;
    updated.heldItemId = itemId;

    await entityManager.addComponent(partId, 'anatomy:can_grab', updated);
    lockedParts.push(partId);
  }

  return { success: true, lockedParts };
}

/**
 * Unlock N grabbing appendages, optionally filtering by held item
 *
 * @param {EntityManager} entityManager - Entity manager instance
 * @param {string} entityId - The entity ID whose appendages to unlock
 * @param {number} count - Number of appendages to unlock
 * @param {string|null} [itemId] - Optional: only unlock appendages holding this item
 * @returns {Promise<{ success: boolean, unlockedParts: string[], error?: string }>}
 */
export async function unlockGrabbingAppendages(
  entityManager,
  entityId,
  count,
  itemId = null
) {
  if (!entityManager || !entityId) {
    return { success: false, unlockedParts: [], error: 'Invalid arguments' };
  }

  if (count <= 0) {
    return { success: true, unlockedParts: [] };
  }

  const appendages = findGrabbingAppendages(entityManager, entityId);
  const lockedAppendages = [];

  for (const partId of appendages) {
    const canGrab = entityManager.getComponentData(partId, 'anatomy:can_grab');
    if (canGrab && canGrab.locked) {
      // Filter by itemId if specified
      if (itemId === null || canGrab.heldItemId === itemId) {
        lockedAppendages.push({ partId, canGrab });
      }
    }
  }

  // Gracefully handle when not enough locked appendages
  const toUnlock = lockedAppendages.slice(0, count);
  const unlockedParts = [];

  for (const { partId, canGrab } of toUnlock) {
    const updated = cloneComponent(canGrab);
    updated.locked = false;
    updated.heldItemId = null;

    await entityManager.addComponent(partId, 'anatomy:can_grab', updated);
    unlockedParts.push(partId);
  }

  return { success: true, unlockedParts };
}

/**
 * Unlock all appendages holding a specific item
 *
 * @param {EntityManager} entityManager - Entity manager instance
 * @param {string} entityId - The entity ID whose appendages to check
 * @param {string} itemId - The item ID to search for
 * @returns {Promise<{ success: boolean, unlockedParts: string[] }>}
 */
export async function unlockAppendagesHoldingItem(
  entityManager,
  entityId,
  itemId
) {
  if (!entityManager || !entityId || !itemId) {
    return { success: false, unlockedParts: [] };
  }

  const appendages = findGrabbingAppendages(entityManager, entityId);
  const unlockedParts = [];

  for (const partId of appendages) {
    const canGrab = entityManager.getComponentData(partId, 'anatomy:can_grab');
    if (canGrab && canGrab.locked && canGrab.heldItemId === itemId) {
      const updated = cloneComponent(canGrab);
      updated.locked = false;
      updated.heldItemId = null;

      await entityManager.addComponent(partId, 'anatomy:can_grab', updated);
      unlockedParts.push(partId);
    }
  }

  return { success: true, unlockedParts };
}

/**
 * Get list of items currently held by an entity's appendages
 *
 * @param {EntityManager} entityManager - Entity manager instance
 * @param {string} entityId - The entity ID to check
 * @returns {Array<{ partId: string, itemId: string }>} Array of held items with their holding part
 */
export function getHeldItems(entityManager, entityId) {
  if (!entityManager || !entityId) {
    return [];
  }

  const appendages = findGrabbingAppendages(entityManager, entityId);
  const heldItems = [];

  for (const partId of appendages) {
    const canGrab = entityManager.getComponentData(partId, 'anatomy:can_grab');
    if (canGrab && canGrab.locked && canGrab.heldItemId) {
      heldItems.push({ partId, itemId: canGrab.heldItemId });
    }
  }

  return heldItems;
}

/**
 * Check if entity has enough free appendages with sufficient grip strength
 *
 * @param {EntityManager} entityManager - Entity manager instance
 * @param {string} entityId - The entity ID to check
 * @param {number} requiredCount - Number of free appendages required
 * @param {number} [requiredGripStrength] - Optional minimum grip strength required
 * @returns {boolean} True if requirements are met
 */
export function hasEnoughFreeAppendages(
  entityManager,
  entityId,
  requiredCount,
  requiredGripStrength = 0
) {
  if (!entityManager || !entityId) {
    return false;
  }

  const freeCount = countFreeGrabbingAppendages(entityManager, entityId);
  if (freeCount < requiredCount) {
    return false;
  }

  if (requiredGripStrength > 0) {
    const freeStrength = calculateFreeGripStrength(entityManager, entityId);
    if (freeStrength < requiredGripStrength) {
      return false;
    }
  }

  return true;
}

// Export for testing
export const __testing__ = {
  cloneComponent,
};
