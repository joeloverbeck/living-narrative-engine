/**
 * Error thrown when an essential JSON schema is missing or not loaded.
 *
 * @class MissingSchemaError
 * @augments Error
 */
class MissingSchemaError extends Error {
  /**
   * Creates a new MissingSchemaError instance.
   *
   * @param {string} schemaId - Identifier of the missing schema.
   */
  constructor(schemaId) {
    super(`Missing essential schema: ${schemaId}`);
    this.name = 'MissingSchemaError';
    this.schemaId = schemaId;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MissingSchemaError);
    }
  }
}

export default MissingSchemaError;
