// src/entities/utils/displayHelpers.js

import { DESCRIPTION_COMPONENT_ID } from '../../constants/componentIds.js';
import { getEntityDisplayName } from '../../utils/entityUtils.js';
import { withEntity } from './entityFetchHelpers.js';

/**
 * @module displayHelpers
 * @description Helper functions for retrieving entity display data.
 */

/**
 * Retrieve an entity's display name using shared logic.
 *
 * @param {import('../interfaces/IEntityManager.js').IEntityManager} entityManager - Entity manager instance.
 * @param {import('../interfaces/CommonTypes.js').NamespacedId | string} entityId - Identifier of the entity.
 * @param {string} [defaultName] - Value returned when no name is resolved.
 * @param {import('../interfaces/ILogger.js').ILogger} logger - Logger for diagnostics.
 * @param {string} logPrefix - Prefix for log messages.
 * @returns {string} The resolved display name or the default name.
 */
export function getDisplayName(
  entityManager,
  entityId,
  defaultName = 'Unknown Entity',
  logger,
  logPrefix
) {
  return withEntity(
    entityManager,
    entityId,
    defaultName,
    (entity) => getEntityDisplayName(entity, defaultName, logger),
    logger,
    logPrefix,
    `getDisplayName: Entity with ID '${entityId}' not found. Returning default name.`
  );
}

/**
 * Retrieve an entity's description using shared logic.
 *
 * @param {import('../interfaces/IEntityManager.js').IEntityManager} entityManager - Entity manager instance.
 * @param {import('../interfaces/CommonTypes.js').NamespacedId | string} entityId - Identifier of the entity.
 * @param {string} [defaultDescription] - Value returned when no description is found.
 * @param {import('../interfaces/ILogger.js').ILogger} logger - Logger for diagnostics.
 * @param {string} logPrefix - Prefix for log messages.
 * @returns {string} The description or the default description.
 */
export function getDescription(
  entityManager,
  entityId,
  defaultDescription = '',
  logger,
  logPrefix
) {
  return withEntity(
    entityManager,
    entityId,
    defaultDescription,
    (entity) => {
      const descriptionComponent = entity.getComponentData(
        DESCRIPTION_COMPONENT_ID
      );
      if (
        descriptionComponent &&
        typeof descriptionComponent.text === 'string'
      ) {
        return descriptionComponent.text;
      }

      logger.debug(
        `${logPrefix} getDescription: Entity '${entityId}' found, but no valid DESCRIPTION_COMPONENT_ID data. Returning default description.`
      );
      return defaultDescription;
    },
    logger,
    logPrefix,
    `getDescription: Entity with ID '${entityId}' not found. Returning default description.`
  );
}

export default {
  getDisplayName,
  getDescription,
};
