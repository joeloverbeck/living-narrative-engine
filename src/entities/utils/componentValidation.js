// src/entities/utils/componentValidation.js

import {
  validationSucceeded,
  formatValidationErrors,
} from './validationHelpers.js';

/**
 * Validate component data and return a deep clone.
 *
 * @description
 * Shared helper used by EntityManager and EntityFactory to validate and clone
 * component payloads with consistent error handling.
 * @param {string} componentTypeId - Component type ID.
 * @param {object} data - Raw component data to validate and clone.
 * @param {import('../../interfaces/coreServices.js').ISchemaValidator} schemaValidator - Schema validator.
 * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger for reporting validation errors.
 * @param {string} errorContext - Context information for error messages.
 * @param {function(object): object} clonerFn - Function used to deep clone the data.
 * @returns {object} The validated (and cloned) data.
 */
export function validateAndClone(
  componentTypeId,
  data,
  schemaValidator,
  logger,
  errorContext,
  clonerFn
) {
  const clone = clonerFn(data);
  const result = schemaValidator.validate(componentTypeId, clone);
  if (!validationSucceeded(result)) {
    const details = formatValidationErrors(result);
    const msg = `${errorContext} Errors:\n${details}`;
    logger.error(msg);
    throw new Error(msg);
  }
  return clone;
}

export default validateAndClone;
