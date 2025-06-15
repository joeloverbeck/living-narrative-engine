/**
 * @module SchemaUtils
 * @description Utility helpers for working with schemas.
 */

/**
 * Registers a schema with the provided validator, removing any existing schema
 * with the same ID first. Errors encountered during removal or addition are
 * re-thrown after being logged.
 *
 * @param {import('../interfaces/coreServices.js').ISchemaValidator} validator
 * @param {object} schema
 * @param {string} schemaId
 * @param {import('../interfaces/coreServices.js').ILogger} logger
 * @param warnMessage
 * @returns {Promise<void>}
 */
export async function registerSchema(
  validator,
  schema,
  schemaId,
  logger,
  warnMessage
) {
  if (validator.isSchemaLoaded(schemaId)) {
    if (logger && typeof logger.warn === 'function') {
      logger.warn(
        warnMessage || `Schema '${schemaId}' already loaded. Overwriting.`
      );
    }
    validator.removeSchema(schemaId);
  }
  await validator.addSchema(schema, schemaId);
}

/**
 * Registers an inline schema using {@link registerSchema} and handles
 * standard logging for success and failure cases.
 *
 * @param {import('../interfaces/coreServices.js').ISchemaValidator} validator
 * @param {object} schema
 * @param {string} schemaId
 * @param {import('../interfaces/coreServices.js').ILogger} logger
 * @param {object} [messages]
 * @param {string} [messages.warnMessage] - Warning when schema already loaded.
 * @param {string} [messages.successDebugMessage] - Debug message on success.
 * @param {string} [messages.errorLogMessage] - Error message for logger on failure.
 * @param {object} [messages.errorContext] - Additional context for error logs.
 * @param {string} [messages.throwErrorMessage] - Message for thrown Error on failure.
 * @returns {Promise<void>}
 */
export async function registerInlineSchema(
  validator,
  schema,
  schemaId,
  logger,
  messages = {}
) {
  const {
    warnMessage,
    successDebugMessage,
    errorLogMessage,
    errorContext,
    throwErrorMessage,
  } = messages;

  try {
    await registerSchema(validator, schema, schemaId, logger, warnMessage);
    if (successDebugMessage && logger && typeof logger.debug === 'function') {
      logger.debug(successDebugMessage);
    }
  } catch (error) {
    if (logger && typeof logger.error === 'function') {
      let context;
      if (typeof errorContext === 'function') {
        context = errorContext(error) || {};
      } else {
        context = { ...(errorContext || {}) };
      }
      if (!('error' in context)) {
        context.error = error?.message || error;
      }
      logger.error(
        errorLogMessage || `Error registering inline schema '${schemaId}'.`,
        context,
        error
      );
    }
    if (throwErrorMessage) {
      throw new Error(throwErrorMessage);
    }
    throw error;
  }
}
