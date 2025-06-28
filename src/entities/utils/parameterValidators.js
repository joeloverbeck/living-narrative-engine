// src/entities/utils/parameterValidators.js

/**
 * Utility functions for validating parameters used by {@link EntityManager}.
 *
 * @module parameterValidators
 */

import {
  assertValidId,
  assertNonBlankString,
} from '../../utils/dependencyUtils.js';
import { isNonBlankString } from '../../utils/textUtils.js';
import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';
import { SerializedEntityError } from '../../errors/serializedEntityError.js';
import { InvalidInstanceIdError } from '../../errors/invalidInstanceIdError.js';

/**
 * @description Internal helper to assert both instance and component IDs.
 * @param {string} methodName Fully qualified method name for error context.
 * @param context
 * @param {string} instanceId Entity instance ID.
 * @param {string} componentTypeId Component type ID.
 * @param {import('../../interfaces/coreServices.js').ILogger} logger Logger for reporting issues.
 * @throws {InvalidArgumentError} When either ID is invalid.
 * @returns {void}
 * @private
 */
function _assertIds(context, instanceId, componentTypeId, logger) {
  try {
    assertValidId(instanceId, context, logger);
    assertNonBlankString(componentTypeId, 'componentTypeId', context, logger);
  } catch (err) {
    logger.error(err);
    throw new InvalidArgumentError(`Invalid ID: ${err.message}`);
  }
}

/**
 * Validate parameters for adding or updating a component.
 *
 * @param {string} instanceId - Entity instance ID.
 * @param {string} componentTypeId - Component type ID.
 * @param {object} componentData - Raw component data.
 * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger for reporting issues.
 * @param {string} [context] - Method context for error messages.
 * @throws {InvalidArgumentError} If parameters are invalid.
 */
export function validateAddComponentParams(
  instanceId,
  componentTypeId,
  componentData,
  logger,
  context = 'EntityManager.addComponent'
) {
  _assertIds(context, instanceId, componentTypeId, logger);

  if (componentData === null) {
    const errorMsg = `${context}: componentData cannot be null for ${componentTypeId} on ${instanceId}`;
    logger.error(errorMsg, {
      componentTypeId,
      instanceId,
    });
    throw new InvalidArgumentError(errorMsg, 'componentData', componentData);
  }

  if (componentData !== undefined && typeof componentData !== 'object') {
    const receivedType = typeof componentData;
    const errorMsg = `${context}: componentData for ${componentTypeId} on ${instanceId} must be an object. Received: ${receivedType}`;
    logger.error(errorMsg, {
      componentTypeId,
      instanceId,
      receivedType,
    });
    throw new InvalidArgumentError(errorMsg, 'componentData', componentData);
  }
}

/**
 * Validate parameters for removing a component.
 *
 * @param {string} instanceId - Entity instance ID.
 * @param {string} componentTypeId - Component type ID.
 * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger for reporting issues.
 * @param {string} [context] - Method context for error messages.
 * @throws {InvalidArgumentError} If parameters are invalid.
 */
export function validateRemoveComponentParams(
  instanceId,
  componentTypeId,
  logger,
  context = 'EntityManager.removeComponent'
) {
  _assertIds(context, instanceId, componentTypeId, logger);
}

/**
 * Validate serialized entity data prior to reconstruction.
 *
 * @param {object} serializedEntity - Serialized entity object.
 * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger for reporting issues.
 * @throws {Error} If the data is malformed.
 */
export function validateReconstructEntityParams(serializedEntity, logger) {
  if (!serializedEntity || typeof serializedEntity !== 'object') {
    const msg =
      'EntityManager.reconstructEntity: serializedEntity data is missing or invalid.';
    logger.error(msg);
    throw new SerializedEntityError(msg);
  }
  if (!isNonBlankString(serializedEntity.instanceId)) {
    const msg =
      'EntityManager.reconstructEntity: instanceId is missing or invalid in serialized data.';
    logger.error(msg);
    throw new InvalidInstanceIdError(serializedEntity.instanceId, msg);
  }
}

/**
 * Validate parameters for {@link EntityManager#getEntityInstance}.
 *
 * @param {string} instanceId - Entity instance ID.
 * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger for reporting issues.
 * @throws {InvalidArgumentError} If parameters are invalid.
 */
export function validateGetEntityInstanceParams(instanceId, logger) {
  try {
    assertValidId(instanceId, 'EntityManager.getEntityInstance', logger);
  } catch {
    logger.warn(
      `EntityManager.getEntityInstance: Invalid instanceId '${instanceId}'`
    );
    throw new InvalidArgumentError(
      `EntityManager.getEntityInstance: Invalid instanceId '${instanceId}'`,
      'instanceId',
      instanceId
    );
  }
}

/**
 * Validate parameters for {@link EntityManager#getComponentData}.
 *
 * @param {string} instanceId - Entity instance ID.
 * @param {string} componentTypeId - Component type ID.
 * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger for reporting issues.
 * @throws {InvalidArgumentError} If parameters are invalid.
 */
export function validateGetComponentDataParams(
  instanceId,
  componentTypeId,
  logger
) {
  _assertIds(
    'EntityManager.getComponentData',
    instanceId,
    componentTypeId,
    logger
  );
}

/**
 * Validate parameters for {@link EntityManager#hasComponent}.
 *
 * @param {string} instanceId - Entity instance ID.
 * @param {string} componentTypeId - Component type ID.
 * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger for reporting issues.
 * @throws {InvalidArgumentError} If parameters are invalid.
 */
export function validateHasComponentParams(
  instanceId,
  componentTypeId,
  logger
) {
  _assertIds('EntityManager.hasComponent', instanceId, componentTypeId, logger);
}

/**
 * Validate parameters for {@link EntityManager#hasComponentOverride}.
 *
 * @param {string} instanceId - Entity instance ID.
 * @param {string} componentTypeId - Component type ID.
 * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger for reporting issues.
 * @throws {InvalidArgumentError} If parameters are invalid.
 */
export function validateHasComponentOverrideParams(
  instanceId,
  componentTypeId,
  logger
) {
  _assertIds(
    'EntityManager.hasComponentOverride',
    instanceId,
    componentTypeId,
    logger
  );
}

/**
 * Validate parameters for {@link EntityManager#getEntitiesWithComponent}.
 *
 * @param {string} componentTypeId - Component type ID.
 * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger for reporting issues.
 * @throws {InvalidArgumentError} If parameters are invalid.
 */
export function validateGetEntitiesWithComponentParams(
  componentTypeId,
  logger
) {
  try {
    assertNonBlankString(
      componentTypeId,
      'componentTypeId',
      'EntityManager.getEntitiesWithComponent',
      logger
    );
  } catch {
    logger.warn(
      `EntityManager.getEntitiesWithComponent: Received invalid componentTypeId ('${componentTypeId}')`
    );
    throw new InvalidArgumentError(
      `EntityManager.getEntitiesWithComponent: Received invalid componentTypeId ('${componentTypeId}')`,
      'componentTypeId',
      componentTypeId
    );
  }
}

/**
 * Validate parameters for {@link EntityManager#removeEntityInstance}.
 *
 * @param {string} instanceId - Entity instance ID.
 * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger for reporting issues.
 * @throws {InvalidArgumentError} If parameters are invalid.
 */
export function validateRemoveEntityInstanceParams(instanceId, logger) {
  try {
    assertValidId(instanceId, 'EntityManager.removeEntityInstance', logger);
  } catch {
    logger.warn(
      `EntityManager.removeEntityInstance: Attempted to remove entity with invalid ID: '${instanceId}'`
    );
    throw new InvalidArgumentError(
      `EntityManager.removeEntityInstance: Attempted to remove entity with invalid ID: '${instanceId}'`,
      'instanceId',
      instanceId
    );
  }
}

// --- FILE END ---
