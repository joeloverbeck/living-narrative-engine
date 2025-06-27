/**
 * @file Error class for duplicate content identifiers.
 */

/**
 * Error thrown when attempting to load content with an identifier that already exists.
 *
 * @class DuplicateContentError
 * @augments {Error}
 */
export class DuplicateContentError extends Error {
  /**
   * @param {string} contentType - The type of content (e.g., 'action', 'component', 'entity').
   * @param {string} qualifiedId - The fully qualified identifier (e.g., 'core:move').
   * @param {string} modId - The ID of the mod attempting to override.
   * @param {string} existingModId - The ID of the mod that originally defined the content.
   * @param {string} [sourceFile] - The source file attempting to define the duplicate.
   */
  constructor(contentType, qualifiedId, modId, existingModId, sourceFile) {
    const sourceInfo = sourceFile ? ` from file '${sourceFile}'` : '';
    const message =
      `Duplicate ${contentType} identifier '${qualifiedId}' detected. ` +
      `Mod '${modId}'${sourceInfo} is attempting to override content originally defined by mod '${existingModId}'. ` +
      `Mod overrides are not allowed.`;

    super(message);
    this.name = 'DuplicateContentError';
    this.contentType = contentType;
    this.qualifiedId = qualifiedId;
    this.modId = modId;
    this.existingModId = existingModId;
    this.sourceFile = sourceFile;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DuplicateContentError);
    }
  }
}

export default DuplicateContentError;
