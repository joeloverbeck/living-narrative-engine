import { BaseManifestItemLoader } from './baseManifestItemLoader.js';
// Import the new common parser utility
import { parseScopeDefinitions } from '../scopeDsl/scopeDefinitionParser.js';

/**
 * @file Scope Loader
 * @description Loads .scope files from mod directories and parses them into scope definitions
 */

/**
 * Loads scope definitions from .scope files in mod directories
 *
 * @augments {BaseManifestItemLoader}
 */
export default class ScopeLoader extends BaseManifestItemLoader {
  constructor(
    config,
    pathResolver,
    dataFetcher,
    schemaValidator,
    dataRegistry,
    logger
  ) {
    super(
      'scopes',
      config,
      pathResolver,
      dataFetcher,
      schemaValidator,
      dataRegistry,
      logger
    );
  }

  /**
   * Process a fetched scope file
   *
   * @param {string} modId - Mod identifier
   * @param {string} filename - Name of the file
   * @param {string} resolvedPath - Resolved path to the file
   * @param {string} content - Raw file content
   * @param {string} registryKey - Registry key for storing
   * @returns {Promise<{qualifiedId: string, didOverride: boolean}>} Result object with qualified ID and override flag
   */
  async _processFetchedItem(
    modId,
    filename,
    resolvedPath,
    content,
    registryKey
  ) {
    try {
      // The parseContent method now delegates to our common utility.
      const scopeDefinitions = this.parseContent(content, filename);
      const transformedScopes = this.transformContent(scopeDefinitions, modId);

      let lastResult = null;
      for (const [scopeName, scopeDef] of Object.entries(transformedScopes)) {
        lastResult = this._storeItemInRegistry(
          registryKey,
          modId,
          scopeName.split(':')[1], // Extract base name without mod prefix
          scopeDef,
          filename
        );
      }

      // Return the last result, or a default if no scopes were processed
      return lastResult || { qualifiedId: null, didOverride: false };
    } catch (error) {
      this._logger.error(
        `ScopeLoader: Failed to process scope file ${filename} for mod ${modId}: ${error.message}`,
        { modId, filename, error }
      );
      throw error;
    }
  }

  /**
   * Parse a .scope file content by delegating to the common utility.
   *
   * @param {string} content - Raw file content
   * @param {string} filePath - Path to the file for error reporting
   * @returns {Map<string, string>} A map of parsed scope definitions.
   */
  parseContent(content, filePath) {
    // The complex parsing logic is now gone, replaced by a single call.
    return parseScopeDefinitions(content, filePath);
  }

  /**
   * Transform loaded scope definitions into the format expected by the registry
   *
   * @param {Map<string, string>} parsedContent - Parsed scope definitions from our utility.
   * @param {string} modId - Mod identifier
   * @returns {object} Transformed scope definitions
   */
  transformContent(parsedContent, modId) {
    const transformed = {};

    // Iterate over the Map from the parser utility
    for (const [scopeName, dslExpression] of parsedContent.entries()) {
      const fullScopeName = `${modId}:${scopeName}`;
      transformed[fullScopeName] = {
        name: fullScopeName,
        expr: dslExpression,
        modId: modId,
        source: 'file',
      };
    }

    return transformed;
  }
}
