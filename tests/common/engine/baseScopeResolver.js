/**
 * @file Base Scope Resolver
 * @description Base class for scope resolver implementations in test infrastructure.
 *
 * Note: This is test infrastructure separate from production ScopeRegistry.
 * Production ScopeRegistry (src/scopeDsl/scopeRegistry.js) stores scope definitions (ASTs).
 * This test helper stores JavaScript resolver functions for common test patterns.
 */

/**
 * Base class for scope resolver implementations.
 * Provides common functionality and validation for test scope resolvers.
 *
 * Implements the IScopeResolver interface:
 * - id: Unique identifier (e.g., "positioning:close_actors")
 * - category: Category name (e.g., "positioning", "inventory")
 * - name: Human-readable name for diagnostics
 * - dependencies: Array of scope IDs this resolver depends on
 * - resolve(context, runtimeCtx): Resolves to Set<string> of entity IDs
 * - validate(): Validates resolver configuration
 */
class BaseScopeResolver {
  #id;
  #category;
  #name;
  #dependencies;

  /**
   * Creates a new scope resolver.
   *
   * @param {object} config - Configuration object
   * @param {string} config.id - Unique identifier for this scope (e.g., "positioning:close_actors")
   * @param {string} config.category - Category this scope belongs to (e.g., "positioning")
   * @param {string} config.name - Human-readable name for diagnostics
   * @param {string[]} [config.dependencies] - Scope IDs this resolver depends on
   * @throws {Error} If required config is missing
   */
  constructor({ id, category, name, dependencies = [] }) {
    if (!id || typeof id !== 'string') {
      throw new Error('Resolver must have a valid id (non-empty string)');
    }
    if (!category || typeof category !== 'string') {
      throw new Error('Resolver must have a valid category (non-empty string)');
    }
    if (!name || typeof name !== 'string') {
      throw new Error('Resolver must have a valid name (non-empty string)');
    }
    if (!Array.isArray(dependencies)) {
      throw new Error('dependencies must be an array');
    }

    this.#id = id;
    this.#category = category;
    this.#name = name;
    this.#dependencies = dependencies;
  }

  /**
   * Gets the unique identifier for this scope.
   *
   * @returns {string} Scope ID
   */
  get id() {
    return this.#id;
  }

  /**
   * Gets the category this scope belongs to.
   *
   * @returns {string} Category name
   */
  get category() {
    return this.#category;
  }

  /**
   * Gets the human-readable name for this scope.
   *
   * @returns {string} Scope name
   */
  get name() {
    return this.#name;
  }

  /**
   * Gets the dependencies for this scope.
   *
   * @returns {string[]} Array of scope IDs this resolver depends on
   */
  get dependencies() {
    return this.#dependencies;
  }

  /**
   * Resolves the scope to a set of entity IDs.
   * Must be implemented by subclasses.
   *
   * @param {object} _context - Resolution context (e.g., { actor: entity })
   * @param {object} _runtimeCtx - Runtime context with services
   * @returns {Set<string>} Set of entity IDs that match the scope
   * @throws {Error} If not implemented by subclass
   */
  resolve(_context, _runtimeCtx) {
    throw new Error(
      `resolve() must be implemented by ${this.constructor.name} for scope "${this.#id}"`
    );
  }

  /**
   * Validates the resolver configuration.
   * Subclasses can override to add additional validation.
   *
   * @returns {boolean} True if valid
   * @throws {Error} If validation fails
   */
  validate() {
    if (!this.#id || typeof this.#id !== 'string') {
      throw new Error('Resolver must have a valid id');
    }
    if (!this.#category || typeof this.#category !== 'string') {
      throw new Error('Resolver must have a valid category');
    }
    if (!this.#name || typeof this.#name !== 'string') {
      throw new Error('Resolver must have a valid name');
    }
    if (!Array.isArray(this.#dependencies)) {
      throw new Error('dependencies must be an array');
    }

    return true;
  }

  /**
   * Helper to ensure result is a Set.
   * Converts arrays to sets if needed.
   *
   * @protected
   * @param {Set<string>|Array<string>} result - The result to ensure is a Set
   * @returns {Set<string>} The result as a Set
   * @throws {Error} If result cannot be converted to a Set
   */
  _ensureSet(result) {
    if (result instanceof Set) {
      return result;
    }
    if (Array.isArray(result)) {
      return new Set(result);
    }
    throw new Error(
      `Resolver "${this.#id}" must return a Set or Array of entity IDs, got ${typeof result}`
    );
  }

  /**
   * Helper to validate context has required properties.
   *
   * @protected
   * @param {object} context - Context object to validate
   * @param {string[]} required - Array of required property names
   * @throws {Error} If required properties are missing
   */
  _validateContext(context, required) {
    if (!context || typeof context !== 'object') {
      throw new Error(
        `Resolver "${this.#id}" requires context object, got ${typeof context}`
      );
    }

    for (const prop of required) {
      if (!(prop in context)) {
        throw new Error(
          `Resolver "${this.#id}" requires context.${prop} to be defined`
        );
      }
    }
  }

  /**
   * Helper to validate runtime context has required services.
   *
   * @protected
   * @param {object} runtimeCtx - Runtime context to validate
   * @param {string[]} required - Array of required service names
   * @throws {Error} If required services are missing
   */
  _validateRuntimeContext(runtimeCtx, required) {
    if (!runtimeCtx || typeof runtimeCtx !== 'object') {
      throw new Error(
        `Resolver "${this.#id}" requires runtimeCtx object, got ${typeof runtimeCtx}`
      );
    }

    for (const service of required) {
      if (!(service in runtimeCtx)) {
        throw new Error(
          `Resolver "${this.#id}" requires runtimeCtx.${service} to be defined`
        );
      }
    }
  }
}

export default BaseScopeResolver;
