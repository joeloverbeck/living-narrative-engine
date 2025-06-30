/**
 * @typedef {import('../nodes/nodeResolver.js').NodeResolver} NodeResolver
 * @typedef {import('../core/gateways.js').LogicEvaluator} LogicEvaluator
 * @typedef {import('../core/gateways.js').EntityGateway} EntityGateway
 */

import { buildComponents } from '../core/entityComponentUtils.js';

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
  /**
   * Creates an evaluation context for a single item
   *
   * @param {*} item - Item to filter (entity ID, object, etc.)
   * @param {object} actorEntity - The acting entity
   * @returns {object} Evaluation context for JSON Logic
   */
  function createEvaluationContext(item, actorEntity) {
    let entity;

    if (typeof item === 'string') {
      entity = entitiesGateway.getEntityInstance(item);
      if (!entity) {
        entity = { id: item };
      }
    } else if (item && typeof item === 'object') {
      entity = item;
    } else {
      return null;
    }

    if (entity && entity.componentTypeIds && !entity.components) {
      entity.components = buildComponents(entity.id, entity, entitiesGateway);
    } else {
      // no-op
    }

    let actor = actorEntity;
    if (
      actorEntity &&
      actorEntity.componentTypeIds &&
      !actorEntity.components
    ) {
      const comps = buildComponents(
        actorEntity.id,
        actorEntity,
        entitiesGateway
      );
      actor = { ...actorEntity, components: comps };
    }

    const location = locationProvider.getLocation();

    return { entity, actor, location };
  }

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
            const evalCtx = createEvaluationContext(arrayElement, actorEntity);
            if (evalCtx && logicEval.evaluate(node.logic, evalCtx)) {
              result.add(arrayElement);
            }
          }
        } else {
          // Handle single items (entity IDs or objects)
          const evalCtx = createEvaluationContext(item, actorEntity);
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
