/**
 * @file Scope Registry
 * @description Manages scope definitions loaded from mods
 */

class ScopeRegistry {
  constructor() {
    this._scopes = new Map();
    this._initialized = false;
  }

  /**
   * Initialize the registry with scope definitions from the data registry
   *
   * @param {object} scopeDefinitions - Map of scope definitions from the registry
   */
  initialize(scopeDefinitions = {}) {
    this._scopes.clear();

    for (const [scopeName, scopeDef] of Object.entries(scopeDefinitions)) {
      this._scopes.set(scopeName, scopeDef);
    }

    this._initialized = true;
  }

  /**
   * Get a scope definition by name
   *
   * @param {string} name - Scope name (can include mod prefix like 'core:inventory_items' or be a base name like 'inventory_items')
   * @returns {object | null} Scope definition or null if not found
   */
  getScope(name) {
    // First try exact match (for backward compatibility and explicit namespaced lookups)
    const exactMatch = this._scopes.get(name);
    if (exactMatch) {
      return exactMatch;
    }

    // If no exact match and name doesn't contain ':', try to find by base name
    if (!name.includes(':')) {
      // Look for any scope that has this base name (after the ':')
      for (const [scopeName, scopeDef] of this._scopes.entries()) {
        const baseName = scopeName.includes(':') ? scopeName.split(':')[1] : scopeName;
        if (baseName === name) {
          return scopeDef;
        }
      }
    }

    return null;
  }

  /**
   * Check if a scope exists
   *
   * @param {string} name - Scope name
   * @returns {boolean} True if scope exists
   */
  hasScope(name) {
    return this._scopes.has(name);
  }

  /**
   * Get all scope names
   *
   * @returns {string[]} Array of scope names
   */
  getAllScopeNames() {
    return Array.from(this._scopes.keys());
  }

  /**
   * Get all scope definitions
   *
   * @returns {Map<string, object>} Map of scope definitions
   */
  getAllScopes() {
    return new Map(this._scopes);
  }

  /**
   * Get statistics about the registry
   *
   * @returns {object} Registry statistics
   */
  getStats() {
    return {
      size: this._scopes.size,
      initialized: this._initialized,
      scopeNames: this.getAllScopeNames(),
    };
  }

  /**
   * Clear all scopes (useful for testing)
   */
  clear() {
    this._scopes.clear();
    this._initialized = false;
  }
}

export default ScopeRegistry;
