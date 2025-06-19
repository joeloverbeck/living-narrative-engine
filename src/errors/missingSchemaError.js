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
   * @param {string} message - The primary error message.
   * @param {string | null} [schemaId=null] - Identifier of the missing/unloaded schema, if applicable.
   * @param {string | null} [contentType=null] - The content type associated with the schema, if applicable.
   */
  constructor(message, schemaId = null, contentType = null) {
    super(message);
    this.name = 'MissingSchemaError';
    this.schemaId = schemaId;
    this.contentType = contentType;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MissingSchemaError);
    }
  }
}

export default MissingSchemaError;
