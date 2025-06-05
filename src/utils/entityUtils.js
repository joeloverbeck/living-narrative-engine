// src/utils/entityUtils.js

import { NAME_COMPONENT_ID } from '../constants/componentIds.js';

/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../interfaces/ILogger.js').ILogger} ILogger */

/**
 * @description Retrieves the display name of an entity with fallback logic.
 * The lookup priority is:
 * 1. `core:name` component's `text` property.
 * 2. `core:name` component's `value` property (legacy support).
 * 3. The entity's direct `name` property.
 * 4. The entity's `id`.
 * 5. The provided `fallbackString`.
 * @param {Entity | null | undefined} entity - The entity whose name is to be retrieved.
 * @param {string} [fallbackString] - String returned if no name is determined.
 * @param {ILogger} [logger] - Optional logger instance for debug/warning messages.
 * @returns {string} The display name of the entity or the fallback string.
 */
export function getEntityDisplayName(
  entity,
  fallbackString = 'unknown entity',
  logger
) {
  if (!entity || typeof entity.getComponentData !== 'function') {
    const entityId = entity && typeof entity.id === 'string' ? entity.id : null;
    logger?.debug(
      `getEntityDisplayName: Received invalid or non-entity object (ID: ${
        entityId || 'N/A'
      }). Using ${entityId ? 'ID' : 'fallbackString'}.`
    );
    return entityId || fallbackString;
  }

  const nameComponent = entity.getComponentData(NAME_COMPONENT_ID);
  if (nameComponent) {
    if (
      typeof nameComponent.text === 'string' &&
      nameComponent.text.trim() !== ''
    ) {
      return nameComponent.text;
    }

    if (
      typeof nameComponent.value === 'string' &&
      nameComponent.value.trim() !== ''
    ) {
      logger?.debug(
        `getEntityDisplayName: Entity '${entity.id}' using legacy 'value' from '${NAME_COMPONENT_ID}' component.`
      );
      return nameComponent.value;
    }
  }

  if (typeof entity.name === 'string' && entity.name.trim() !== '') {
    logger?.debug(
      `getEntityDisplayName: Entity '${entity.id}' using fallback 'entity.name' property ('${entity.name}') as '${NAME_COMPONENT_ID}' was not found or lacked 'text'/'value'.`
    );
    return entity.name;
  }

  if (typeof entity.id === 'string' && entity.id.trim() !== '') {
    logger?.warn(
      `getEntityDisplayName: Entity '${entity.id}' has no usable name from component or 'entity.name'. Falling back to entity ID.`
    );
    return entity.id;
  }

  logger?.warn(
    'getEntityDisplayName: Entity (ID not available or invalid) could not resolve a name from any source. Using fallbackString.'
  );
  return fallbackString;
}
