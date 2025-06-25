/**
 * @file IScopeRegistry.js
 * @description Interface for registering and retrieving scope definitions.
 */

export class IScopeRegistry {
  /**
   * Initializes the registry with scope definitions.
   *
   * @param {object} scopeDefinitions - Map of scope definitions keyed by name.
   */
  initialize(scopeDefinitions) {
    throw new Error('IScopeRegistry.initialize not implemented');
  }

  /**
   * Retrieves a scope definition by name.
   *
   * @param {string} name - The scope name.
   * @returns {object|null} The definition or null if not found.
   */
  getScope(name) {
    throw new Error('IScopeRegistry.getScope not implemented');
  }

  /**
   * Checks if a scope exists.
   *
   * @param {string} name - Scope name.
   * @returns {boolean} True if the scope is present.
   */
  hasScope(name) {
    throw new Error('IScopeRegistry.hasScope not implemented');
  }

  /**
   * Lists all registered scope names.
   *
   * @returns {string[]} Array of scope names.
   */
  getAllScopeNames() {
    throw new Error('IScopeRegistry.getAllScopeNames not implemented');
  }

  /**
   * Returns all registered scopes.
   *
   * @returns {Map<string, object>} Map of scope definitions.
   */
  getAllScopes() {
    throw new Error('IScopeRegistry.getAllScopes not implemented');
  }

  /**
   * Provides statistics about the registry.
   *
   * @returns {object} Registry statistics.
   */
  getStats() {
    throw new Error('IScopeRegistry.getStats not implemented');
  }

  /**
   * Clears all scopes from the registry.
   */
  clear() {
    throw new Error('IScopeRegistry.clear not implemented');
  }
}

export default IScopeRegistry;
