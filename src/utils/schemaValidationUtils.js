/**
 * @module SchemaValidation
 * @description Helper for validating data against JSON schemas with common logging and error handling.
 */

/** @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../interfaces/coreServices.js').ValidationResult} ValidationResult */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
import { formatAjvErrors } from './ajvUtils.js';

/**
 * Validates data against a schema using the provided validator.
 * Performs standard checks for schema availability and validator retrieval,
 * then logs and throws with formatted details on validation failure.
 *
 * @param {ISchemaValidator} validator - Schema validator instance.
 * @param {string} schemaId - ID of the schema to validate against.
 * @param {any} data - Data object to validate.
 * @param {ILogger} logger - Logger for debug/warn/error messages.
 * @param {object} [context] - Optional settings to control logging behaviour and thrown messages.
 * @param {string} [context.validationDebugMessage] - Debug message logged before validation.
 * @param {string} [context.notLoadedMessage] - Message logged when the schema is not loaded.
 * @param {'warn'|'error'} [context.notLoadedLogLevel] - Log level for the notLoadedMessage.
 * @param {boolean} [context.skipIfSchemaNotLoaded] - When true, returns success if the schema is not loaded.
 * @param {string} [context.notLoadedThrowMessage] - Error message thrown when the schema is missing and skipping is disabled.
 * @param {string|function(import('ajv').ErrorObject[]):string} [context.failureMessage]
 *   - Message logged on validation failure. If a function is provided it
 *     receives the Ajv errors array and should return the log message string.
 * @param {object} [context.failureContext] - Additional context object passed to the logger on validation failure.
 * @param {string} [context.failureThrowMessage] - Base message for the thrown Error on validation failure.
 * @param {boolean} [context.appendErrorDetails] - Whether to append formatted error details to the thrown error.
 * @returns {ValidationResult} Result of the validation. If skipping due to unloaded schema, returns `{isValid: true, errors: null}`.
 * @throws {Error} When the schema is missing (and skipping disabled), no validator function exists, or validation fails.
 */
export function validateAgainstSchema(
  validator,
  schemaId,
  data,
  logger,
  context = {}
) {
  const {
    validationDebugMessage,
    notLoadedMessage,
    notLoadedLogLevel = 'error',
    skipIfSchemaNotLoaded = false,
    notLoadedThrowMessage,
    failureMessage,
    failureContext = {},
    failureThrowMessage,
    appendErrorDetails = true,
  } = context;

  if (!validator.isSchemaLoaded(schemaId)) {
    if (notLoadedMessage) {
      if (notLoadedLogLevel === 'warn') {
        logger.warn(notLoadedMessage);
      } else {
        logger.error(notLoadedMessage);
      }
    }
    if (skipIfSchemaNotLoaded) {
      return { isValid: true, errors: null };
    }
    throw new Error(
      notLoadedThrowMessage ||
        notLoadedMessage ||
        `Schema '${schemaId}' not loaded.`
    );
  }

  if (validationDebugMessage) {
    logger.debug(validationDebugMessage);
  }

  const validationResult = validator.validate(schemaId, data);

  if (!validationResult.isValid) {
    const computedFailureMsg =
      typeof failureMessage === 'function'
        ? failureMessage(validationResult.errors)
        : failureMessage;
    const errorDetails = formatAjvErrors(validationResult.errors);
    if (computedFailureMsg) {
      logger.error(computedFailureMsg, {
        ...failureContext,
        schemaId,
        validationErrors: validationResult.errors,
        validationErrorDetails: errorDetails,
      });
    }
    const baseMessage =
      failureThrowMessage || computedFailureMsg || 'Schema validation failed.';
    const finalMessage = appendErrorDetails
      ? `${baseMessage}\nDetails:\n${errorDetails}`
      : baseMessage;
    throw new Error(finalMessage);
  }

  return validationResult;
}
