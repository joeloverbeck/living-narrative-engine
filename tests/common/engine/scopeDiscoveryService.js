/**
 * @file Scope Discovery Service
 * @description Scans mod directories for scope files and configuration for test infrastructure.
 *
 * This service discovers .scope files from mod directories to enable automatic
 * registration of test scope resolvers.
 */

import { promises as fs } from 'fs';
import { resolve, join } from 'path';
import process from 'node:process';

/**
 * Service for discovering scope files from mod directories.
 * Scans for .scope files and optional scopes.config.json configuration.
 */
class ScopeDiscoveryService {
  /**
   * Discovers scope files from a mod directory.
   *
   * @param {string} modId - The mod identifier (e.g., 'positioning', 'inventory')
   * @param {object} [options] - Discovery options
   * @param {string[]|null} [options.categories] - Filter by categories (null = all)
   * @returns {Promise<object[]>} Array of discovered scope metadata
   */
  static async discoverScopes(modId, options = {}) {
    const { categories = null } = options;

    const modPath = resolve(process.cwd(), `data/mods/${modId}`);
    const scopesPath = join(modPath, 'scopes');

    // Check if scopes directory exists
    try {
      await fs.access(scopesPath);
    } catch {
      // No scopes directory - return empty array
      return [];
    }

    // Read directory contents
    let files;
    try {
      files = await fs.readdir(scopesPath);
    } catch (err) {
      throw new Error(
        `Failed to read scopes directory for mod "${modId}": ${err.message}`
      );
    }

    // Filter for .scope files
    const scopeFiles = files.filter((file) => file.endsWith('.scope'));

    const discovered = [];

    for (const file of scopeFiles) {
      const scopeName = file.replace('.scope', '');
      const fullScopeName = `${modId}:${scopeName}`;
      const filePath = join(scopesPath, file);

      // Determine category from mod ID or scope name
      // This is a simple heuristic - could be improved with metadata
      const category = this._inferCategory(modId, scopeName);

      // Skip if category filter is active and doesn't match
      if (categories && !categories.includes(category)) {
        continue;
      }

      discovered.push({
        modId,
        scopeName,
        fullScopeName,
        category,
        filePath,
        file,
      });
    }

    return discovered;
  }

  /**
   * Discovers scopes from multiple mods.
   *
   * @param {string[]} modIds - Array of mod identifiers
   * @param {object} [options] - Discovery options
   * @returns {Promise<object[]>} Array of discovered scope metadata
   */
  static async discoverScopesFromMods(modIds, options = {}) {
    const allDiscovered = [];

    for (const modId of modIds) {
      const discovered = await this.discoverScopes(modId, options);
      allDiscovered.push(...discovered);
    }

    return allDiscovered;
  }

  /**
   * Reads a scopes.config.json file if it exists.
   *
   * @param {string} modId - The mod identifier
   * @returns {Promise<object|null>} Configuration object or null if not found
   */
  static async readScopesConfig(modId) {
    const configPath = resolve(
      process.cwd(),
      `data/mods/${modId}/scopes.config.json`
    );

    try {
      const content = await fs.readFile(configPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      // Config file doesn't exist or is invalid - not an error
      return null;
    }
  }

  /**
   * Infers the category from mod ID or scope name.
   * Uses simple heuristics based on common naming patterns.
   *
   * @private
   * @param {string} modId - Mod identifier
   * @param {string} scopeName - Scope name
   * @returns {string} Inferred category
   */
  static _inferCategory(modId, scopeName) {
    // Check if mod ID matches a known category
    const knownCategories = [
      'positioning',
      'inventory',
      'items',
      'anatomy',
      'affection',
      'intimacy',
      'violence',
      'clothing',
    ];

    // Direct match with mod ID
    if (knownCategories.includes(modId)) {
      return modId;
    }

    // Check if mod ID contains a known category
    for (const category of knownCategories) {
      if (modId.includes(category)) {
        return category;
      }
    }

    // Check scope name for hints
    if (scopeName.includes('position') || scopeName.includes('sitting')) {
      return 'positioning';
    }
    if (scopeName.includes('item') || scopeName.includes('inventory')) {
      return 'items';
    }
    if (scopeName.includes('body') || scopeName.includes('anatomy')) {
      return 'anatomy';
    }

    // Default to using mod ID as category
    return modId;
  }

  /**
   * Validates that a scope file exists.
   *
   * @param {string} modId - Mod identifier
   * @param {string} scopeName - Scope name (without .scope extension)
   * @returns {Promise<boolean>} True if file exists
   */
  static async scopeFileExists(modId, scopeName) {
    const filePath = resolve(
      process.cwd(),
      `data/mods/${modId}/scopes/${scopeName}.scope`
    );

    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

export default ScopeDiscoveryService;
