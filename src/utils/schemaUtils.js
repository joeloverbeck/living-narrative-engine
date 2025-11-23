/**
 * @module SchemaUtils
 * @description Utility helpers for working with schemas.
 */
import { ensureValidLogger } from './loggerUtils.js';

/**
 * Registers a schema with the provided validator, removing any existing schema
 * with the same ID first. Errors encountered during removal or addition are
 * re-thrown after being logged.
 *
 * When a schema is already loaded:
 * - Event payload schemas (ID contains '#payload'): Logged at debug level as this is
 *   expected during page navigation with singleton SchemaValidator
 * - Other schemas: Logged at warn level using the provided warnMessage or default
 *
 * @param {import('../interfaces/coreServices.js').ISchemaValidator} validator
 * @param {object} schema
 * @param {string} schemaId
 * @param {import('../interfaces/coreServices.js').ILogger} logger
 * @param {string} [warnMessage]
 * @returns {Promise<void>}
 */
export async function registerSchema(
  validator,
  schema,
  schemaId,
  logger,
  warnMessage
) {
  const moduleLogger = ensureValidLogger(logger, 'SchemaUtils');
  if (validator.isSchemaLoaded(schemaId)) {
    // Event payload schemas are commonly re-registered during page navigation
    // because SchemaValidator is a singleton that persists across page loads.
    // This is expected behavior when the same mod is loaded multiple times,
    // so we only log at debug level for payload schemas to reduce noise.
    const isPayloadSchema = schemaId.includes('#payload');

    if (isPayloadSchema) {
      moduleLogger.debug(
        `Schema '${schemaId}' already loaded from previous session. Re-registering.`
      );
    } else {
      moduleLogger.warn(
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
  const moduleLogger = ensureValidLogger(logger, 'SchemaUtils');
  const {
    warnMessage,
    successDebugMessage,
    errorLogMessage,
    errorContext,
    throwErrorMessage,
  } = messages;

  try {
    await registerSchema(
      validator,
      schema,
      schemaId,
      moduleLogger,
      warnMessage
    );
    if (successDebugMessage) {
      moduleLogger.debug(successDebugMessage);
    }
  } catch (error) {
    // Only log if a specific error message is provided by the caller.
    // Otherwise, just re-throw and let the caller handle logging.
    if (errorLogMessage) {
      let context;
      if (typeof errorContext === 'function') {
        try {
          context = errorContext(error) || {};
        } catch (contextError) {
          // If context function fails, use empty context
          context = {};
        }
      } else {
        context = { ...(errorContext || {}) };
      }
      if (!('error' in context)) {
        context.error =
          error && typeof error === 'object' && 'message' in error
            ? /** @type {{message?: any}} */ (error).message
            : error;
      }
      moduleLogger.error(errorLogMessage, context, error);
    }
    if (throwErrorMessage) {
      throw new Error(throwErrorMessage);
    }
    throw error;
  }
}
