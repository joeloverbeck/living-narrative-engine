/**
 * @file entityScopeService.js
 * @description Service for resolving entity scopes using the Scope DSL engine.
 */

import { ScopeRegistry } from '../scopeDsl/scopeRegistry.js';
import { parseInlineExpr } from '../scopeDsl/parser.js';
import { ScopeEngine } from '../scopeDsl/engine.js';

/**
 * Aggregates unique entity IDs from one or more specified scopes.
 *
 * @param {string | string[]} scopes - A single scope name or an array of them.
 * @param {ActionContext} context - The action context.
 * @param {ILogger} logger - Logger instance.
 * @returns {Set<EntityId>} A single set of unique entity IDs.
 */
function getEntityIdsForScopes(scopes, context, logger = console) {
  const requestedScopes = Array.isArray(scopes) ? scopes : [scopes];
  const aggregatedIds = new Set();

  if (!context || !context.entityManager) {
    logger.error(
      'getEntityIdsForScopes: Invalid or incomplete context provided. Cannot proceed.',
      { context }
    );
    return aggregatedIds;
  }

  for (const scopeName of requestedScopes) {
    try {
      // Handle special scopes
      if (scopeName === 'none') {
        // 'none' means no targets needed, return empty set
        continue;
      }
      
      if (scopeName === 'direction') {
        // 'direction' is handled differently (not as entity IDs)
        continue;
      }

      // Resolve using the Scope DSL engine
      const scopeIds = _resolveScopeWithDSL(scopeName, context, logger);
      
      if (scopeIds) {
        scopeIds.forEach((id) => aggregatedIds.add(id));
      }
    } catch (error) {
      logger.error(
        `getEntityIdsForScopes: Error executing handler for scope '${scopeName}':`,
        error
      );
    }
  }
  return aggregatedIds;
}

/**
 * Resolves a scope using the Scope DSL engine
 * 
 * @param {string} scopeName - The scope name to resolve
 * @param {ActionContext} context - The action context
 * @param {ILogger} logger - Logger instance
 * @returns {Set<string>} Set of entity IDs
 * @private
 */
function _resolveScopeWithDSL(scopeName, context, logger) {
  try {
    // Get the scope definition from the registry
    const scopeRegistry = ScopeRegistry.getInstance();
    const scopeDefinition = scopeRegistry.getScope(scopeName);
    
    if (!scopeDefinition) {
      logger.warn(`Scope '${scopeName}' not found in registry`);
      return new Set();
    }

    // Parse the DSL expression
    const ast = parseInlineExpr(scopeDefinition.expr);
    
    // Create runtime context for the scope engine
    const runtimeCtx = {
      entityManager: context.entityManager,
      spatialIndexManager: context.spatialIndexManager,
      jsonLogicEval: context.jsonLogicEval,
      logger: logger
    };

    // Resolve using the scope engine
    const scopeEngine = new ScopeEngine();
    const actorId = context.actingEntity?.id;
    
    if (!actorId) {
      logger.error('Cannot resolve scope: actingEntity ID is missing');
      return new Set();
    }

    return scopeEngine.resolve(ast, actorId, runtimeCtx);
  } catch (error) {
    logger.error(`Error resolving scope '${scopeName}' with DSL:`, error);
    return new Set();
  }
}

// --- Exports ---
export { getEntityIdsForScopes };
