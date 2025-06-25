// src/interfaces/IScopeEngine.js

/** @typedef {import('../actions/tracing/traceContext.js').TraceContext} TraceContext */

/**
 * @file IScopeEngine.js
 * @description Interface for Scope DSL engines that resolve AST expressions to entity sets
 */

/**
 * @interface IScopeEngine
 * @description Interface for Scope DSL engines that resolve scope expressions
 */
export class IScopeEngine {
  /**
   * Resolves a Scope-DSL AST to a set of entity IDs
   *
   * @param {object} ast - The parsed AST
   * @param {object} actorEntity - The acting entity instance
   * @param {object} runtimeCtx - Runtime context with services
   * @param {TraceContext} [trace] - Optional trace context for logging
   * @returns {Set<string>} Set of entity IDs
   * @abstract
   */
  resolve(ast, actorEntity, runtimeCtx, trace = null) {
    throw new Error('IScopeEngine.resolve() must be implemented');
  }

  /**
   * Set the maximum depth for scope resolution
   *
   * @param {number} n - Maximum depth
   * @abstract
   */
  setMaxDepth(n) {
    throw new Error('IScopeEngine.setMaxDepth() must be implemented');
  }
}

export default IScopeEngine;