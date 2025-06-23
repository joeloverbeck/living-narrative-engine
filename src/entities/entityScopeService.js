/**
 * @file entityScopeService.js
 * @description Service for resolving entity scopes using the Scope DSL engine.
 */

/** @typedef {import('../scopeDsl/scopeRegistry.js').default} ScopeRegistry */
/** @typedef {import('../models/actionContext.js').ActionContext} ActionContext */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {string} EntityId */

import ScopeEngine from '../scopeDsl/engine.js';
import { parseDslExpression } from '../scopeDsl/parser.js';

/**
 * Aggregates unique entity IDs from one or more specified scopes.
 *
 * @param {string | string[]} scopes - A single scope name or an array of them.
 * @param {ActionContext} context - The action context.
 * @param {ScopeRegistry} scopeRegistry - The scope registry instance.
 * @param {ILogger} logger - Logger instance.
 * @returns {Set<EntityId>} A single set of unique entity IDs.
 */
function getEntityIdsForScopes(
  scopes,
  context,
  scopeRegistry,
  logger = console
) {
  const requestedScopes = Array.isArray(scopes) ? scopes : [scopes];
  const aggregatedIds = new Set();

  if (!context || !context.entityManager) {
    logger.error(
      'getEntityIdsForScopes: Invalid or incomplete context provided. Cannot proceed.',
      { context }
    );
    return aggregatedIds;
  }
  if (!scopeRegistry) {
    logger.error(
      'getEntityIdsForScopes: ScopeRegistry not provided. Cannot proceed.'
    );
    return aggregatedIds;
  }

  for (const scopeName of requestedScopes) {
    try {
      // Handle special scope
      if (scopeName === 'none') {
        // 'none' means no targets needed, return empty set
        continue;
      }

      // Resolve using the Scope DSL engine
      const scopeIds = _resolveScopeWithDSL(
        scopeName,
        context,
        scopeRegistry,
        logger
      );

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
 * @param {string} scopeName - The scope name to resolve
 * @param {ActionContext} context - The action context. This object from ActionDiscoveryService contains entityManager, actingEntity, location, and jsonLogicEval.
 * @param {ScopeRegistry} scopeRegistry - The scope registry instance.
 * @param {ILogger} logger - Logger instance
 * @returns {Set<string>} Set of entity IDs
 * @private
 */
function _resolveScopeWithDSL(scopeName, context, scopeRegistry, logger) {
  try {
    const scopeDefinition = scopeRegistry.getScope(scopeName);

    logger.debug(`Resolving scope '${scopeName}' with DSL`);
    logger.debug(`Scope definition:`, scopeDefinition);

    if (
      !scopeDefinition ||
      typeof scopeDefinition.expr !== 'string' ||
      !scopeDefinition.expr.trim()
    ) {
      logger.warn(
        `Scope '${scopeName}' not found or has no expression in registry`
      );
      return new Set();
    }

    const ast = parseDslExpression(scopeDefinition.expr);
    logger.debug(`Parsed AST:`, ast);

    // FIX: The runtime context for the engine was being built incorrectly.
    // It needs the jsonLogicEval service from the context, and other services
    // should know about the full actor entity, not just its ID.
    const runtimeCtx = {
      entityManager: context.entityManager,
      spatialIndexManager: context.spatialIndexManager,
      jsonLogicEval: context.jsonLogicEval, // Use the jsonLogicEval from the provided context
      logger: logger,
      actor: context.actingEntity, // Pass the full actor entity
      // FIX: Be flexible with the location property to support TurnContext's 'currentLocation'
      location: context.location || context.currentLocation,
    };

    logger.debug(`Runtime context:`, runtimeCtx);

    const scopeEngine = new ScopeEngine();
    const actorEntity = context.actingEntity;

    if (!actorEntity) {
      logger.error('Cannot resolve scope: actingEntity is missing');
      return new Set();
    }

    // Pass the full actor entity to the engine, not just the ID.
    const result = scopeEngine.resolve(ast, actorEntity, runtimeCtx);
    logger.debug(`Scope engine result:`, result);

    return result;
  } catch (error) {
    logger.error(`Error resolving scope '${scopeName}' with DSL:`, error);
    return new Set();
  }
}

// --- Exports ---
export { getEntityIdsForScopes };
