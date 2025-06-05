// src/utils/entityUtils.js

import { NAME_COMPONENT_ID } from '../constants/componentIds.js';

/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../interfaces/ILogger.js').ILogger} ILogger */

/**
 * Retrieves the display name of an entity.
 * It first checks for a `core:name` component and uses `component.text`.
 * If not found, it falls back to `entity.name` (if it exists).
 *
 * @param {Entity | null | undefined} entity - The entity whose name is to be retrieved.
 * @param {ILogger} [logger] - Optional logger instance for debug/warning messages.
 * @returns {string | undefined} The display name of the entity or undefined if no name is found.
 */
export function getEntityDisplayName(entity, logger) {
  if (!entity) {
    logger?.debug(
      'EntityUtils.getEntityDisplayName: Received null or undefined entity.'
    );
    return undefined;
  }

  const nameComponent = entity.getComponentData(NAME_COMPONENT_ID);
  if (
    nameComponent &&
    typeof nameComponent.text === 'string' &&
    nameComponent.text.trim() !== ''
  ) {
    return nameComponent.text;
  }

  if (typeof entity.name === 'string' && entity.name.trim() !== '') {
    logger?.debug(
      `EntityUtils.getEntityDisplayName: Entity '${entity.id}' using fallback entity.name property ('${entity.name}') as '${NAME_COMPONENT_ID}' was not found or invalid.`
    );
    return entity.name;
  }

  logger?.warn(
    `EntityUtils.getEntityDisplayName: Entity '${entity.id}' has no usable name from '${NAME_COMPONENT_ID}' or entity.name.`
  );
  return undefined;
}
