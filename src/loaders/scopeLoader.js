import { BaseManifestItemLoader } from './baseManifestItemLoader.js';
import { parseInlineExpr } from '../scopeDsl/parser.js';

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
   * @returns {Promise<void>}
   */
  async _processFetchedItem(modId, filename, resolvedPath, content, registryKey) {
    try {
      const scopeDefinitions = this.parseContent(content, filename);
      const transformedScopes = this.transformContent(scopeDefinitions, modId);
      
      // Store each scope definition in the registry
      for (const [scopeName, scopeDef] of Object.entries(transformedScopes)) {
        this._storeItemInRegistry(
          registryKey,
          modId,
          scopeName,
          scopeDef,
          filename
        );
      }
    } catch (error) {
      this._logger.error(
        `ScopeLoader: Failed to process scope file ${filename} for mod ${modId}: ${error.message}`,
        { modId, filename, error }
      );
      throw error;
    }
  }

  /**
   * Parse a .scope file content into a scope definition
   *
   * @param {string} content - Raw file content
   * @param {string} filePath - Path to the file for error reporting
   * @returns {object} Parsed scope definition
   */
  parseContent(content, filePath) {
    const lines = content.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('//'));
    
    if (lines.length === 0) {
      throw new Error(`Empty scope file: ${filePath}`);
    }

    const scopeDefinitions = {};
    
    for (const line of lines) {
      const match = line.match(/^(\w+)\s*:=\s*(.+)$/);
      if (!match) {
        throw new Error(`Invalid scope definition format in ${filePath}: "${line}". Expected "name := dsl_expression"`);
      }

      const [, scopeName, dslExpression] = match;
      
      try {
        // Validate the DSL expression by parsing it
        parseInlineExpr(dslExpression.trim());
        
        scopeDefinitions[scopeName] = dslExpression.trim();
      } catch (parseError) {
        throw new Error(`Invalid DSL expression in ${filePath} for scope "${scopeName}": ${parseError.message}`);
      }
    }

    return scopeDefinitions;
  }

  /**
   * Transform loaded scope definitions into the format expected by the registry
   *
   * @param {object} parsedContent - Parsed scope definitions
   * @param {string} modId - Mod identifier
   * @returns {object} Transformed scope definitions
   */
  transformContent(parsedContent, modId) {
    const transformed = {};
    
    for (const [scopeName, dslExpression] of Object.entries(parsedContent)) {
      const fullScopeName = `${modId}:${scopeName}`;
      transformed[fullScopeName] = {
        name: fullScopeName,
        dsl: dslExpression,
        modId: modId,
        source: 'file'
      };
    }
    
    return transformed;
  }
} 