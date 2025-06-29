// src/utils/movementUtils.js

import { deepClone } from './cloneUtils.js';

/**
 * Update the locked state of an entity's movement component.
 *
 * @param {import('../../entities/entityManager.js').default} entityManager - Entity manager.
 * @param {string} entityId - ID of the entity to update.
 * @param {boolean} locked - Whether movement should be locked.
 * @returns {void}
 */
export function updateMovementLock(entityManager, entityId, locked) {
  const existing = entityManager.getComponentData(entityId, 'core:movement');
  const move = existing
    ? typeof structuredClone === 'function'
      ? structuredClone(existing)
      : deepClone(existing)
    : {};
  move.locked = locked;
  entityManager.addComponent(entityId, 'core:movement', move);
}
