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
