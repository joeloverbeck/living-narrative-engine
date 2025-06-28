import { BaseManifestItemLoader } from './baseManifestItemLoader.js';
// Import the new common parser utility
import { parseScopeDefinitions } from '../scopeDsl/scopeDefinitionParser.js';
import { SCOPES_KEY } from '../constants/dataRegistryKeys.js';

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
      SCOPES_KEY,
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
      // The parseScopeFile method delegates to our common utility.
      const scopeDefinitions = this.parseScopeFile(content, filename);
      const transformedScopes = this.transformContent(scopeDefinitions, modId);

      let lastResult = null;
      for (const [scopeName, scopeDef] of Object.entries(transformedScopes)) {
        // Extract the base name from the fully qualified scope name
        const baseName = scopeName.split(':', 2)[1];
        lastResult = this._storeItemInRegistry(
          registryKey,
          modId,
          baseName, // Use base name, registryStoreUtils will prefix with modId
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
   * Parse a `.scope` file's contents by delegating to the common utility.
   *
   * @param {string} content - Raw file content
   * @param {string} filePath - Path to the file for error reporting
   * @returns {Map<string, {expr: string, ast: object}>} A map of parsed scope definitions with pre-parsed ASTs.
   */
  parseScopeFile(content, filePath) {
    // The complex parsing logic is now gone, replaced by a single call.
    return parseScopeDefinitions(content, filePath);
  }

  /**
   * Transform loaded scope definitions into the format expected by the registry
   *
   * @param {Map<string, {expr: string, ast: object}>} parsedContent - Parsed scope definitions from our utility.
   * @param {string} modId - Mod identifier
   * @returns {object} Transformed scope definitions
   */
  transformContent(parsedContent, modId) {
    const transformed = {};

    // Iterate over the Map from the parser utility
    for (const [scopeName, scopeData] of parsedContent.entries()) {
      // Validate that the scope name is properly namespaced
      if (!scopeName.includes(':')) {
        throw new Error(
          `Scope '${scopeName}' must be namespaced (e.g., '${modId}:${scopeName}'). Only 'none' and 'self' are allowed without namespace.`
        );
      }

      // Validate that the scope belongs to the correct mod
      const [declaredModId, baseName] = scopeName.split(':', 2);
      if (declaredModId !== modId) {
        throw new Error(
          `Scope '${scopeName}' is declared in mod '${modId}' but claims to belong to mod '${declaredModId}'. Scope names must match the mod they're defined in.`
        );
      }

      transformed[scopeName] = {
        name: scopeName,
        expr: scopeData.expr,
        ast: scopeData.ast,
        modId: modId,
        source: 'file',
      };
    }

    return transformed;
  }
}
