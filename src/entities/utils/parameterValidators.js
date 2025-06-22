// src/entities/utils/parameterValidators.js

/**
 * Utility functions for validating parameters used by {@link EntityManager}.
 *
 * @module parameterValidators
 */

import {
  assertValidId,
  assertNonBlankString,
} from '../../utils/parameterGuards.js';
import { isNonBlankString } from '../../utils/textUtils.js';
import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';

/**
 * Validate parameters for adding or updating a component.
 *
 * @param {string} instanceId - Entity instance ID.
 * @param {string} componentTypeId - Component type ID.
 * @param {object} componentData - Raw component data.
 * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger for reporting issues.
 * @throws {InvalidArgumentError} If parameters are invalid.
 */
export function validateAddComponentParams(
  instanceId,
  componentTypeId,
  componentData,
  logger
) {
  try {
    assertValidId(instanceId, 'EntityManager.addComponent', logger);
    assertNonBlankString(
      componentTypeId,
      'componentTypeId',
      'EntityManager.addComponent',
      logger
    );
  } catch {
    logger.warn(
      `EntityManager.addComponent: Invalid parameters - instanceId: '${instanceId}', componentTypeId: '${componentTypeId}'`
    );
    throw new InvalidArgumentError(
      `EntityManager.addComponent: Invalid parameters - instanceId: '${instanceId}', componentTypeId: '${componentTypeId}'`,
      'instanceId/componentTypeId',
      { instanceId, componentTypeId }
    );
  }

  if (componentData === null) {
    const errorMsg = `EntityManager.addComponent: componentData cannot be null for ${componentTypeId} on ${instanceId}`;
    logger.error(errorMsg, {
      componentTypeId,
      instanceId,
    });
    throw new InvalidArgumentError(errorMsg, 'componentData', componentData);
  }

  if (componentData !== undefined && typeof componentData !== 'object') {
    const receivedType = typeof componentData;
    const errorMsg = `EntityManager.addComponent: componentData for ${componentTypeId} on ${instanceId} must be an object. Received: ${receivedType}`;
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
 * @throws {InvalidArgumentError} If parameters are invalid.
 */
export function validateRemoveComponentParams(
  instanceId,
  componentTypeId,
  logger
) {
  try {
    assertValidId(instanceId, 'EntityManager.removeComponent', logger);
    assertNonBlankString(
      componentTypeId,
      'componentTypeId',
      'EntityManager.removeComponent',
      logger
    );
  } catch {
    logger.warn(
      `EntityManager.removeComponent: Invalid parameters - instanceId: '${instanceId}', componentTypeId: '${componentTypeId}'`
    );
    throw new InvalidArgumentError(
      `EntityManager.removeComponent: Invalid parameters - instanceId: '${instanceId}', componentTypeId: '${componentTypeId}'`,
      'instanceId/componentTypeId',
      { instanceId, componentTypeId }
    );
  }
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
    throw new Error(msg);
  }
  if (!isNonBlankString(serializedEntity.instanceId)) {
    const msg =
      'EntityManager.reconstructEntity: instanceId is missing or invalid in serialized data.';
    logger.error(msg);
    throw new Error(msg);
  }
}

// --- FILE END ---
