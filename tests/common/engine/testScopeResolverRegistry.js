/**
 * @file Test Scope Resolver Registry
 * @description Central registry for test scope resolver functions.
 *
 * IMPORTANT: This is test infrastructure separate from production ScopeRegistry.
 * - Production ScopeRegistry (src/scopeDsl/scopeRegistry.js) stores scope DEFINITIONS (ASTs from .scope files)
 * - This TestScopeResolverRegistry stores JavaScript resolver FUNCTIONS for common test patterns
 *
 * The two registries serve different purposes and live in different locations:
 * - Production: src/scopeDsl/scopeRegistry.js (part of game engine)
 * - Test: tests/common/engine/testScopeResolverRegistry.js (test infrastructure only)
 */

/**
 * Central registry for test scope resolver functions.
 * Provides unified interface for registering, discovering, and resolving test scopes.
 *
 * Features:
 * - Register scope resolvers with IScopeResolver interface
 * - Category-based organization
 * - Dependency tracking and validation
 * - Auto-discovery from mod directories
 * - Clear error messages for debugging
 */
class TestScopeResolverRegistry {
  #resolvers = new Map(); // scopeId -> IScopeResolver
  #categoriesIndex = new Map(); // category -> Set<scopeId>
  #logger;

  /**
   * Creates a new test scope resolver registry.
   *
   * @param {object} config - Configuration object
   * @param {object} config.logger - Logger instance
   */
  constructor({ logger }) {
    if (!logger || typeof logger !== 'object') {
      throw new Error('TestScopeResolverRegistry requires a logger instance');
    }
    this.#logger = logger;
  }

  /**
   * Registers a scope resolver.
   *
   * @param {object} resolver - The resolver to register (must implement IScopeResolver)
   * @throws {Error} If resolver doesn't implement IScopeResolver interface
   * @throws {Error} If scope ID already registered
   */
  register(resolver) {
    // Validate resolver implements IScopeResolver
    this.#validateResolver(resolver);

    // Check for duplicates
    if (this.#resolvers.has(resolver.id)) {
      throw new Error(
        `Scope resolver "${resolver.id}" is already registered. ` +
          `Cannot register duplicate scope IDs.`
      );
    }

    // Validate dependencies exist (soft warning - dependencies might be registered later)
    for (const depId of resolver.dependencies) {
      if (!this.#resolvers.has(depId)) {
        this.#logger.warn(
          `Resolver "${resolver.id}" depends on "${depId}" which is not yet registered. ` +
            `Ensure dependencies are registered before dependent scopes.`
        );
      }
    }

    // Register the resolver
    this.#resolvers.set(resolver.id, resolver);

    // Update category index
    if (!this.#categoriesIndex.has(resolver.category)) {
      this.#categoriesIndex.set(resolver.category, new Set());
    }
    this.#categoriesIndex.get(resolver.category).add(resolver.id);

    this.#logger.debug(
      `Registered scope resolver: ${resolver.id} (${resolver.category})`
    );
  }

  /**
   * Registers multiple resolvers at once.
   *
   * @param {object[]} resolvers - Array of resolvers to register
   * @throws {Error} If any resolver is invalid
   */
  registerBatch(resolvers) {
    if (!Array.isArray(resolvers)) {
      throw new Error('registerBatch requires an array of resolvers');
    }

    for (const resolver of resolvers) {
      this.register(resolver);
    }
  }

  /**
   * Gets a resolver by ID.
   *
   * @param {string} scopeId - The scope ID (e.g., "personal-space:close_actors")
   * @returns {object|null} The resolver or null if not found
   */
  get(scopeId) {
    return this.#resolvers.get(scopeId) || null;
  }

  /**
   * Gets all resolvers for a category.
   *
   * @param {string} category - The category (e.g., "positioning")
   * @returns {object[]} Array of resolvers in that category
   */
  getByCategory(category) {
    const scopeIds = this.#categoriesIndex.get(category);
    if (!scopeIds) {
      return [];
    }

    return Array.from(scopeIds).map((id) => this.#resolvers.get(id));
  }

  /**
   * Auto-discovers and registers scopes from mod directories.
   *
   * @param {string[]} modIds - Mods to scan for scopes
   * @param {object} [options] - Discovery options
   * @param {string[]|null} [options.categories] - Categories to discover (null = all)
   * @param {boolean} [options.loadConditions] - Whether to load condition dependencies
   * @returns {Promise<number>} Number of scopes registered
   * @throws {Error} If discovery fails
   */
  async discoverAndRegister(modIds, options = {}) {
    const { categories = null, loadConditions = true } = options;

    // Lazy-load services to avoid circular dependencies
    const { default: ScopeDiscoveryService } = await import(
      './scopeDiscoveryService.js'
    );
    const { default: ScopeResolverFactory } = await import(
      './scopeResolverFactory.js'
    );

    let totalRegistered = 0;

    for (const modId of modIds) {
      try {
        // Scan for scope files
        const discovered = await ScopeDiscoveryService.discoverScopes(modId, {
          categories,
        });

        if (discovered.length === 0) {
          this.#logger.debug(
            `No scopes found in mod "${modId}"${categories ? ` for categories: ${categories.join(', ')}` : ''}`
          );
          continue;
        }

        // Create resolvers
        const resolvers = await ScopeResolverFactory.createResolvers(
          discovered,
          {
            loadConditions,
          }
        );

        // Register them
        this.registerBatch(resolvers);
        totalRegistered += resolvers.length;

        this.#logger.info(
          `Registered ${resolvers.length} scope(s) from mod "${modId}"`
        );
      } catch (err) {
        this.#logger.error(
          `Failed to discover/register scopes from mod "${modId}": ${err.message}`
        );
        // Continue with other mods instead of failing completely
      }
    }

    this.#logger.info(
      `Auto-discovered and registered ${totalRegistered} scope(s) from ${modIds.length} mod(s)`
    );
    return totalRegistered;
  }

  /**
   * Resolves a scope using the registered resolver.
   *
   * @param {string} scopeId - The scope ID
   * @param {object} context - Resolution context (e.g., { actor: entity })
   * @param {object} runtimeCtx - Runtime context with services
   * @returns {Set<string>} Resolved entity IDs
   * @throws {Error} If scope not found or resolution fails
   */
  resolve(scopeId, context, runtimeCtx) {
    const resolver = this.get(scopeId);

    if (!resolver) {
      const available = this.list().join(', ') || '(none)';
      throw new Error(
        `No resolver registered for scope "${scopeId}". ` +
          `Available scopes: ${available}`
      );
    }

    try {
      return resolver.resolve(context, runtimeCtx);
    } catch (err) {
      this.#logger.error(`Failed to resolve scope "${scopeId}":`, err);
      throw new Error(
        `Scope resolution failed for "${scopeId}": ${err.message}`
      );
    }
  }

  /**
   * Checks if a scope is registered.
   *
   * @param {string} scopeId - The scope ID
   * @returns {boolean} True if registered
   */
  has(scopeId) {
    return this.#resolvers.has(scopeId);
  }

  /**
   * Lists all registered scope IDs.
   *
   * @returns {string[]} Array of scope IDs (sorted)
   */
  list() {
    return Array.from(this.#resolvers.keys()).sort();
  }

  /**
   * Lists scopes organized by category.
   *
   * @returns {object} Object mapping category names to arrays of scope IDs
   */
  listByCategory() {
    const result = {};
    for (const [category, scopeIds] of this.#categoriesIndex) {
      result[category] = Array.from(scopeIds).sort();
    }
    return result;
  }

  /**
   * Clears all registrations (for testing).
   */
  clear() {
    this.#resolvers.clear();
    this.#categoriesIndex.clear();
    this.#logger.debug('Cleared all scope registrations');
  }

  /**
   * Gets the count of registered resolvers.
   *
   * @returns {number} Number of registered resolvers
   */
  count() {
    return this.#resolvers.size;
  }

  /**
   * Validates that an object implements IScopeResolver interface.
   *
   * @private
   * @param {object} resolver - Object to validate
   * @throws {Error} If resolver doesn't implement required interface
   */
  #validateResolver(resolver) {
    if (!resolver || typeof resolver !== 'object') {
      throw new Error('Resolver must be an object');
    }

    // Check for required properties
    const required = [
      'id',
      'category',
      'name',
      'dependencies',
      'resolve',
      'validate',
    ];

    for (const prop of required) {
      if (!(prop in resolver)) {
        throw new Error(
          `Resolver must implement IScopeResolver interface. Missing property: "${prop}"`
        );
      }
    }

    // Validate property types
    if (typeof resolver.id !== 'string' || resolver.id.trim() === '') {
      throw new Error('Resolver.id must be a non-empty string');
    }

    if (
      typeof resolver.category !== 'string' ||
      resolver.category.trim() === ''
    ) {
      throw new Error('Resolver.category must be a non-empty string');
    }

    if (typeof resolver.name !== 'string' || resolver.name.trim() === '') {
      throw new Error('Resolver.name must be a non-empty string');
    }

    if (typeof resolver.resolve !== 'function') {
      throw new Error('Resolver.resolve must be a function');
    }

    if (typeof resolver.validate !== 'function') {
      throw new Error('Resolver.validate must be a function');
    }

    if (!Array.isArray(resolver.dependencies)) {
      throw new Error('Resolver.dependencies must be an array');
    }

    // Validate dependencies are strings
    for (const dep of resolver.dependencies) {
      if (typeof dep !== 'string') {
        throw new Error(
          `Resolver.dependencies must contain only strings, found: ${typeof dep}`
        );
      }
    }

    // Run the resolver's own validation
    try {
      resolver.validate();
    } catch (err) {
      throw new Error(
        `Resolver "${resolver.id}" failed its own validation: ${err.message}`
      );
    }
  }
}

export default TestScopeResolverRegistry;
