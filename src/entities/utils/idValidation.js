// src/entities/utils/idValidation.js

import {
  assertValidId,
  assertNonBlankString,
} from '../../utils/dependencyUtils.js';
import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';

/**
 * Determine if a given value is a valid non-blank string ID.
 *
 * @param {any} id - Value to validate.
 * @param {string} context - Error context for logging.
 * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger instance.
 * @returns {boolean} True if the ID is valid, otherwise false.
 */
export function isValidId(id, context, logger) {
  try {
    assertValidId(id, context, logger);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate both an entity instance ID and a component type ID.
 *
 * @param {string} instanceId - Entity instance ID to validate.
 * @param {string} componentTypeId - Component type ID to validate.
 * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger instance.
 * @param {string} [context] - Error context.
 * @throws {InvalidArgumentError} If either ID is invalid.
 * @returns {void}
 */
export function validateInstanceAndComponent(
  instanceId,
  componentTypeId,
  logger,
  context = 'idValidation.validateInstanceAndComponent'
) {
  try {
    assertValidId(instanceId, context, logger);
    assertNonBlankString(componentTypeId, 'componentTypeId', context, logger);
  } catch (err) {
    logger.error(err);
    throw new InvalidArgumentError(`Invalid ID: ${err.message}`);
  }
}

export default {
  isValidId,
  validateInstanceAndComponent,
};
