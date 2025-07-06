// src/utils/movementUtils.js

import { deepClone } from './cloneUtils.js';

/**
 * Update the locked state of an entity's movement component.
 * Handles both legacy entities with direct movement and anatomy-based movement.
 *
 * @param {import('../entities/entityManager.js').default} entityManager - Entity manager.
 * @param {string} entityId - ID of the entity to update.
 * @param {boolean} locked - Whether movement should be locked.
 * @returns {object|null} Updated movement component or null if no movement found.
 */
export function updateMovementLock(entityManager, entityId, locked) {
  // Check if entity has anatomy:body component
  const bodyComponent = entityManager.getComponentData(
    entityId,
    'anatomy:body'
  );

  if (bodyComponent && bodyComponent.body && bodyComponent.body.root) {
    // New anatomy-based path: find all body parts with movement
    const updatedParts = [];

    // Update movement for all parts in the body.parts map
    if (bodyComponent.body.parts) {
      for (const [partType, partId] of Object.entries(
        bodyComponent.body.parts
      )) {
        const movementComponent = entityManager.getComponentData(
          partId,
          'core:movement'
        );
        if (movementComponent) {
          // Clone and update the movement component
          const updatedMovement =
            typeof structuredClone === 'function'
              ? structuredClone(movementComponent)
              : deepClone(movementComponent);
          updatedMovement.locked = locked;

          // Update the component
          entityManager.addComponent(partId, 'core:movement', updatedMovement);
          updatedParts.push({ partId, movement: updatedMovement });
        }
      }
    }

    // Return summary of updates
    return updatedParts.length > 0 ? { updatedParts, locked } : null;
  }

  // Legacy path: check entity directly
  const existing = entityManager.getComponentData(entityId, 'core:movement');
  if (existing) {
    const move =
      typeof structuredClone === 'function'
        ? structuredClone(existing)
        : deepClone(existing);
    move.locked = locked;
    entityManager.addComponent(entityId, 'core:movement', move);
    return move;
  }

  // No movement component found
  return null;
}
