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
   * @param {string} name - Scope name (can include mod prefix like 'core:inventory_items')
   * @returns {object | null} Scope definition or null if not found
   */
  getScope(name) {
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
      scopeNames: this.getAllScopeNames()
    };
  }

  /**
   * Clear all scopes (useful for testing)
   */
  clear() {
    this._scopes.clear();
    this._initialized = false;
  }

  // Singleton pattern
  static _instance = null;

  /**
   * Get the singleton instance
   *
   * @returns {ScopeRegistry} Singleton instance
   */
  static getInstance() {
    if (!ScopeRegistry._instance) {
      ScopeRegistry._instance = new ScopeRegistry();
    }
    return ScopeRegistry._instance;
  }
}

export default ScopeRegistry; 