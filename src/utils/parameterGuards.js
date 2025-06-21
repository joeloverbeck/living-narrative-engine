/**
 * @file Parameter validation guard utilities.
 */

import { isNonBlankString } from './textUtils.js';
import { InvalidArgumentError } from '../errors/invalidArgumentError.js';

/**
 * Asserts that an ID is valid (non-blank string).
 * Throws InvalidArgumentError if validation fails.
 *
 * @param {any} id - The ID to validate.
 * @param {string} context - Context information for error messages (e.g., method name).
 * @param {import('../interfaces/coreServices.js').ILogger} logger - Logger instance for error logging.
 * @throws {InvalidArgumentError} If the ID is invalid.
 */
export function assertValidId(id, context, logger) {
  if (!isNonBlankString(id)) {
    const message = `${context}: Invalid ID '${id}'. Expected non-blank string.`;
    logger.error(message, {
      receivedId: id,
      receivedType: typeof id,
      context
    });
    throw new InvalidArgumentError(message, 'id', id);
  }
}

/**
 * Asserts that a string is non-blank.
 * Throws InvalidArgumentError if validation fails.
 *
 * @param {any} str - The string to validate.
 * @param {string} name - The name of the parameter for error messages.
 * @param {string} context - Context information for error messages (e.g., method name).
 * @param {import('../interfaces/coreServices.js').ILogger} logger - Logger instance for error logging.
 * @throws {InvalidArgumentError} If the string is blank or not a string.
 */
export function assertNonBlankString(str, name, context, logger) {
  if (!isNonBlankString(str)) {
    const message = `${context}: Invalid ${name} '${str}'. Expected non-blank string.`;
    logger.error(message, {
      receivedValue: str,
      receivedType: typeof str,
      parameterName: name,
      context
    });
    throw new InvalidArgumentError(message, name, str);
  }
} 