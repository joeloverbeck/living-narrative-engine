/**
 * @module SchemaValidation
 * @description Helper for validating data against JSON schemas with common logging and error handling.
 */

/** @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../interfaces/coreServices.js').ValidationResult} ValidationResult */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
import { formatAjvErrors } from './ajvUtils.js';
import { formatAjvErrorsEnhanced } from './ajvAnyOfErrorFormatter.js';
import {
  performPreValidation,
  formatPreValidationError,
} from './preValidationUtils.js';

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
 * @param {string} [context.filePath] - Optional file path for enhanced error reporting in pre-validation.
 * @param {boolean} [context.skipPreValidation] - When true, skips pre-validation checks and runs only AJV validation.
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
    filePath,
    skipPreValidation = false,
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

  // DIAGNOSTIC LOGGING: Log raw data structure for rule validation debugging
  if (schemaId === 'schema://living-narrative-engine/rule.schema.json' && filePath && filePath.includes('handle_drop_item')) {
    console.error('🔍 DEBUG: Raw data structure for handle_drop_item.rule.json:');
    console.error(JSON.stringify({
      dataKeys: Object.keys(data),
      schemaRef: data.$schema,
      ruleId: data.rule_id,
      eventType: data.event_type,
      actionsCount: Array.isArray(data.actions) ? data.actions.length : 'NOT_ARRAY',
      firstAction: data.actions?.[0] ? {
        type: data.actions[0].type,
        hasParameters: !!data.actions[0].parameters,
        parametersKeys: data.actions[0].parameters ? Object.keys(data.actions[0].parameters) : []
      } : 'NO_ACTIONS'
    }, null, 2));
    console.error('🔍 DEBUG: Full data JSON:');
    console.error(JSON.stringify(data, null, 2));
  }

  // Perform pre-validation checks to catch common issues before running full AJV validation
  if (!skipPreValidation) {
    const preValidationResult = performPreValidation(data, schemaId, filePath);

    if (!preValidationResult.isValid) {
      // Pre-validation failed - provide specific, actionable error
      const fileName = filePath ? filePath.split('/').pop() : 'unknown file';
      const preValidationError = formatPreValidationError(
        preValidationResult,
        fileName,
        schemaId
      );

      logger.error(`Pre-validation failed for '${fileName}'`, {
        ...failureContext,
        schemaId,
        preValidationError: preValidationResult.error,
        preValidationPath: preValidationResult.path,
        preValidationSuggestions: preValidationResult.suggestions,
      });

      const baseMessage =
        failureThrowMessage || `Pre-validation failed for '${fileName}'`;
      const finalMessage = appendErrorDetails
        ? `${baseMessage}\nDetails:\n${preValidationError}`
        : baseMessage;

      throw new Error(finalMessage);
    }

    // Pre-validation passed, log success for debugging
    logger.debug(
      `Pre-validation passed for '${filePath || 'data'}' against schema '${schemaId}'`
    );
  }

  const validationResult = validator.validate(schemaId, data);

  if (!validationResult.isValid) {
    // DIAGNOSTIC LOGGING: Log detailed AJV errors for handle_drop_item debugging
    if (schemaId === 'schema://living-narrative-engine/rule.schema.json' && filePath && filePath.includes('handle_drop_item')) {
      const firstTenErrors = (validationResult.errors || []).slice(0, 10);
      console.error('🔍 DEBUG: AJV validation errors (first 10):');
      console.error(JSON.stringify({
        totalErrors: validationResult.errors?.length || 0,
        errors: firstTenErrors.map((err, idx) => ({
          index: idx,
          instancePath: err.instancePath,
          schemaPath: err.schemaPath,
          keyword: err.keyword,
          message: err.message,
          params: err.params,
          data: typeof err.data === 'object' ? JSON.stringify(err.data) : err.data
        }))
      }, null, 2));
    }

    const computedFailureMsg =
      typeof failureMessage === 'function'
        ? failureMessage(validationResult.errors ?? [])
        : failureMessage;
    const errorDetails = formatAjvErrorsEnhanced(validationResult.errors, data);
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
