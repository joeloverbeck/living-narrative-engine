/**
 * @typedef {import('../nodes/nodeResolver.js').NodeResolver} NodeResolver
 * @typedef {import('../core/gateways.js').LogicEvaluator} LogicEvaluator
 * @typedef {import('../core/gateways.js').EntityGateway} EntityGateway
 */

import { createEvaluationContext } from '../core/entityHelpers.js';

/**
 * @typedef {object} LocationProvider
 * @property {() => {id: string} | null} getLocation - Function to get the current location
 */

/**
 * Factory function that creates a filter resolver with injected dependencies
 *
 * @param {object} deps - Dependencies
 * @param {LogicEvaluator} deps.logicEval - JSON Logic evaluator
 * @param {EntityGateway} deps.entitiesGateway - Gateway for entity operations
 * @param {LocationProvider} deps.locationProvider - Provider for current location
 * @returns {NodeResolver} Filter node resolver
 */
export default function createFilterResolver({
  logicEval,
  entitiesGateway,
  locationProvider,
}) {
  return {
    /**
     * Determines if this resolver can handle the given node
     *
     * @param {object} node - AST node
     * @returns {boolean} True if this is a Filter node
     */
    canResolve(node) {
      return node.type === 'Filter';
    },

    /**
     * Resolves a Filter node by applying JSON Logic to parent results
     *
     * @param {object} node - Filter node with parent and logic
     * @param {object} ctx - Resolution context
     * @param {object} ctx.actorEntity - The acting entity
     * @param {Function} ctx.dispatcher - Dispatcher for recursive resolution
     * @param {object} [ctx.trace] - Optional trace context
     * @returns {Set<any>} Filtered set of items
     */
    resolve(node, ctx) {
      const { actorEntity, dispatcher, trace } = ctx;

      // Critical validation: actorEntity must be present and have valid ID
      if (!actorEntity) {
        const error = new Error('FilterResolver: actorEntity is undefined in context. This is a critical error.');
        console.error('[CRITICAL] FilterResolver context missing actorEntity:', {
          hasCtx: !!ctx,
          ctxKeys: ctx ? Object.keys(ctx) : [],
          nodeType: node?.type,
          hasDispatcher: !!dispatcher,
          hasTrace: !!trace
        });
        throw error;
      }

      // Additional validation for actorEntity ID
      if (!actorEntity.id || actorEntity.id === 'undefined') {
        const error = new Error(`FilterResolver: actorEntity has invalid ID: ${actorEntity.id}. This is a critical error.`);
        console.error('[CRITICAL] FilterResolver actorEntity has invalid ID:', {
          actorId: actorEntity.id,
          actorKeys: Object.keys(actorEntity),
          nodeType: node?.type,
          hasDispatcher: !!dispatcher,
          hasTrace: !!trace
        });
        throw error;
      }

      // Recursively resolve parent node
      const parentResult = dispatcher.resolve(node.parent, ctx);

      const source = 'ScopeEngine.resolveFilter';
      const initialSize = parentResult.size;

      if (trace) {
        trace.addLog(
          'info',
          `Applying filter to ${initialSize} items.`,
          source,
          {
            logic: node.logic,
          }
        );
      }

      if (initialSize === 0) return new Set();

      const result = new Set();

      for (const item of parentResult) {
        // If the item is an array, iterate over its elements for filtering
        if (Array.isArray(item)) {
          for (const arrayElement of item) {
            const evalCtx = createEvaluationContext(
              arrayElement,
              actorEntity,
              entitiesGateway,
              locationProvider,
              trace
            );
            if (evalCtx && logicEval.evaluate(node.logic, evalCtx)) {
              result.add(arrayElement);
            }
          }
        } else {
          // Handle single items (entity IDs or objects)
          const evalCtx = createEvaluationContext(
            item,
            actorEntity,
            entitiesGateway,
            locationProvider,
            trace
          );
          if (evalCtx && logicEval.evaluate(node.logic, evalCtx)) {
            result.add(item);
          }
        }
      }

      if (trace) {
        trace.addLog(
          'info',
          `Filter application complete. ${result.size} of ${initialSize} items passed.`,
          source
        );
      }

      return result;
    },
  };
}
