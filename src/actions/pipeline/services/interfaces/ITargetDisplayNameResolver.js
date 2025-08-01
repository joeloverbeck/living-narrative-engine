/**
 * @file ITargetDisplayNameResolver - Interface for resolving entity display names
 * @see MultiTargetResolutionStage.js
 */

/** @typedef {import('../../../../entities/entity.js').default} Entity */

/**
 * @typedef {object} DisplayNameOptions
 * @property {boolean} [includeTitle] - Include title/role if available
 * @property {boolean} [includeId] - Include entity ID as fallback
 * @property {string} [defaultName] - Default name if none found
 * @property {boolean} [preferShortName] - Prefer short name over full name
 */

/**
 * @typedef {object} DisplayNameResult
 * @property {string} displayName - The resolved display name
 * @property {string} source - Source of the name (e.g., 'name', 'shortName', 'id', 'default')
 * @property {boolean} isDefault - Whether default name was used
 */

/**
 * Interface for resolving entity display names for formatting
 *
 * This service is responsible for:
 * - Extracting appropriate display names from entities
 * - Handling different name formats (name, shortName, title)
 * - Providing fallback strategies for missing names
 * - Supporting localization and formatting options
 */
export class ITargetDisplayNameResolver {
  /**
   * Get display name for an entity
   *
   * @param {Entity} entity - Entity to get display name for
   * @param {DisplayNameOptions} [options] - Display name options
   * @param _entity
   * @param _options
   * @returns {string} The display name
   */
  getDisplayName(_entity, _options) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Get detailed display name information
   *
   * @param {Entity} entity - Entity to get display name for
   * @param {DisplayNameOptions} [options] - Display name options
   * @param _entity
   * @param _options
   * @returns {DisplayNameResult} Detailed display name result
   */
  getDisplayNameDetails(_entity, _options) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Get display names for multiple entities
   *
   * @param {Entity[]} entities - Array of entities
   * @param {DisplayNameOptions} [options] - Display name options
   * @param _entities
   * @param _options
   * @returns {Map<string, string>} Map of entity ID to display name
   */
  getDisplayNames(_entities, _options) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Format display name with additional context
   *
   * @param {Entity} entity - Entity to format
   * @param {object} context - Additional formatting context
   * @param {boolean} [context.includeLocation] - Include location in name
   * @param {boolean} [context.includeState] - Include state/condition in name
   * @param _entity
   * @param _context
   * @returns {string} Formatted display name with context
   */
  formatWithContext(_entity, _context) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Check if entity has a valid display name
   *
   * @param {Entity} entity - Entity to check
   * @param _entity
   * @returns {boolean} True if entity has a non-default display name
   */
  hasValidDisplayName(_entity) {
    throw new Error('Method must be implemented by concrete class');
  }
}
