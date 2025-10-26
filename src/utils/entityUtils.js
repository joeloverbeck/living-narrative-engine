// src/utils/entityUtils.js

import { NAME_COMPONENT_ID } from '../constants/componentIds.js';
import { isValidEntity } from './entityValidationUtils.js';
import { isNonBlankString } from './textUtils.js';

/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../interfaces/ILogger.js').ILogger} ILogger */

/**
 * @typedef {object} NameComponentData
 * @property {string} text - The display name text
 * @property {string} [value] - Legacy display name value
 */

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
  if (!isValidEntity(entity)) {
    const entityId = entity && typeof entity.id === 'string' ? entity.id : null;
    logger?.debug(
      `getEntityDisplayName: Received invalid or non-entity object (ID: ${
        entityId || 'N/A'
      }). Using ${entityId ? 'ID' : 'fallbackString'}.`
    );
    return entityId || fallbackString;
  }

  // At this point, entity is validated and non-null
  // TypeScript needs explicit assertion after isValidEntity check
  /** @type {Entity} */
  const validEntity = /** @type {Entity} */ (entity);

  /** @type {NameComponentData | null | undefined} */
  const nameComponent = /** @type {NameComponentData | undefined} */ (
    validEntity.getComponentData(NAME_COMPONENT_ID)
  );
  if (nameComponent) {
    if (
      typeof nameComponent.text === 'string' &&
      isNonBlankString(nameComponent.text)
    ) {
      return nameComponent.text;
    }

    if (
      typeof nameComponent.value === 'string' &&
      isNonBlankString(nameComponent.value)
    ) {
      const entityId =
        typeof validEntity.id === 'string' && validEntity.id
          ? validEntity.id
          : 'unknown';
      logger?.debug(
        `getEntityDisplayName: Using legacy 'value' property from '${NAME_COMPONENT_ID}' component for entity '${entityId}'.`
      );
      return nameComponent.value;
    }
  }

  // Entity class doesn't have a 'name' property - skip directly to ID check
  if (typeof validEntity.id === 'string' && isNonBlankString(validEntity.id)) {
    logger?.warn(
      `getEntityDisplayName: Entity '${validEntity.id}' has no usable name from '${NAME_COMPONENT_ID}' component. Falling back to entity ID.`
    );
    return validEntity.id;
  }

  logger?.warn(
    'getEntityDisplayName: Entity (ID not available or invalid) could not resolve a name from any source. Using fallbackString.'
  );
  return fallbackString;
}
