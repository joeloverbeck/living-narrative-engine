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
   * @param {string} name - Scope name (must be namespaced like 'core:inventory_items', except for special cases 'none' and 'self')
   * @returns {object | null} Scope definition or null if not found
   */
  getScope(name) {
    // Allow special cases that don't require namespacing
    if (name === 'none' || name === 'self') {
      return null; // These are handled by the target resolution service, not by registry
    }

    // Only allow namespaced scope names (must contain ':')
    if (!name.includes(':')) {
      throw new Error(`Scope names must be namespaced (e.g., 'core:${name}'), but got: '${name}'. Only 'none' and 'self' are allowed without namespace.`);
    }

    return this._scopes.get(name) || null;
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
