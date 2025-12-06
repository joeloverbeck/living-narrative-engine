/**
 * @file Scope Resolver Factory
 * @description Factory for creating test scope resolver instances from .scope files.
 *
 * Creates resolver functions that wrap scope DSL evaluation for use in test infrastructure.
 */

import { promises as fs } from 'fs';
import process from 'node:process';
import { parseScopeDefinitions } from '../../../src/scopeDsl/scopeDefinitionParser.js';
import BaseScopeResolver from './baseScopeResolver.js';

/**
 * Factory for creating scope resolver instances.
 * Wraps scope DSL parsing and evaluation into callable test resolver functions.
 */
class ScopeResolverFactory {
  /**
   * Creates resolvers from discovered scope metadata.
   *
   * @param {object[]} discovered - Array of discovered scope metadata
   * @param {object} [options] - Creation options
   * @returns {Promise<object[]>} Array of resolver instances
   */
  static async createResolvers(discovered, options = {}) {
    const resolvers = [];

    // Import ScopeEngine for runtime evaluation
    const { default: ScopeEngine } = await import(
      '../../../src/scopeDsl/engine.js'
    );

    for (const metadata of discovered) {
      try {
        const resolver = await this.createResolver(metadata, {
          ScopeEngine,
        });
        resolvers.push(resolver);
      } catch (err) {
        // Log error but continue with other scopes
        // Note: Using console.warn here is intentional for factory-level diagnostics
        // eslint-disable-next-line no-console
        console.warn(
          `Failed to create resolver for ${metadata.fullScopeName}: ${err.message}`
        );
      }
    }

    return resolvers;
  }

  /**
   * Creates a single resolver from scope metadata.
   *
   * @param {object} metadata - Scope metadata from discovery
   * @param {object} [options] - Creation options
   * @param {object} [options.ScopeEngine] - ScopeEngine class (pre-imported)
   * @returns {Promise<object>} Resolver instance
   */
  static async createResolver(metadata, options = {}) {
    const { ScopeEngine } = options;

    // Read and parse the scope file
    const content = await fs.readFile(metadata.filePath, 'utf-8');
    const parsedScopes = parseScopeDefinitions(content, metadata.filePath);

    // Get the scope data for this specific scope
    const scopeData = parsedScopes.get(metadata.fullScopeName);

    if (!scopeData) {
      const available = Array.from(parsedScopes.keys()).join(', ');
      throw new Error(
        `Scope "${metadata.fullScopeName}" not found in file ${metadata.filePath}. ` +
          `Available scopes: ${available || '(none)'}`
      );
    }

    // Create a resolver instance that wraps the scope DSL evaluation
    return new ScopeDslResolver({
      id: metadata.fullScopeName,
      category: metadata.category,
      name: metadata.scopeName,
      scopeData,
      ScopeEngine,
    });
  }

  /**
   * Creates a resolver from a scope file path.
   *
   * @param {string} modId - Mod identifier
   * @param {string} scopeName - Scope name (without .scope extension)
   * @param {string} category - Category name
   * @param {object} [options] - Creation options
   * @returns {Promise<object>} Resolver instance
   */
  static async createResolverFromFile(
    modId,
    scopeName,
    category,
    options = {}
  ) {
    const { default: ScopeEngine } = await import(
      '../../../src/scopeDsl/engine.js'
    );

    const metadata = {
      modId,
      scopeName,
      fullScopeName: `${modId}:${scopeName}`,
      category,
      filePath: `${process.cwd()}/data/mods/${modId}/scopes/${scopeName}.scope`,
    };

    return this.createResolver(metadata, {
      ScopeEngine,
      ...options,
    });
  }
}

/**
 * Resolver implementation that wraps scope DSL evaluation.
 * Extends BaseScopeResolver and implements IScopeResolver interface.
 */
class ScopeDslResolver extends BaseScopeResolver {
  #scopeData;
  #scopeEngine;

  /**
   * Creates a new scope DSL resolver.
   *
   * @param {object} config - Configuration
   * @param {string} config.id - Scope ID
   * @param {string} config.category - Category
   * @param {string} config.name - Name
   * @param {object} config.scopeData - Parsed scope data with AST
   * @param {Function} config.ScopeEngine - ScopeEngine class
   */
  constructor({ id, category, name, scopeData, ScopeEngine }) {
    super({ id, category, name, dependencies: [] });

    if (!scopeData || !scopeData.ast) {
      throw new Error(`Invalid scope data for "${id}": missing AST`);
    }

    this.#scopeData = scopeData;
    this.#scopeEngine = new ScopeEngine();
  }

  /**
   * Resolves the scope using the DSL engine.
   *
   * @param {object} context - Resolution context (e.g., { actor: entity })
   * @param {object} runtimeCtx - Runtime context with services
   * @returns {Set<string>} Resolved entity IDs
   */
  resolve(context, runtimeCtx) {
    try {
      // Validate runtime context has required services
      this._validateRuntimeContext(runtimeCtx, ['entityManager']);

      // Build runtime context for scope engine
      const engineRuntimeCtx = {
        entityManager: runtimeCtx.entityManager,
        jsonLogicEval: runtimeCtx.jsonLogicEval || runtimeCtx.jsonLogic,
        logger: runtimeCtx.logger,
      };

      // Resolve using scope engine
      const result = this.#scopeEngine.resolve(
        this.#scopeData.ast,
        context,
        engineRuntimeCtx
      );

      // Ensure result is a Set
      return this._ensureSet(result);
    } catch (err) {
      throw new Error(`Failed to resolve scope "${this.id}": ${err.message}`);
    }
  }

  /**
   * Validates the resolver.
   *
   * @returns {boolean} True if valid
   */
  validate() {
    super.validate();

    if (!this.#scopeData) {
      throw new Error(`Resolver "${this.id}" is missing scope data`);
    }

    if (!this.#scopeData.ast) {
      throw new Error(`Resolver "${this.id}" is missing scope AST`);
    }

    return true;
  }
}

export default ScopeResolverFactory;
