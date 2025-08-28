/**
 * @typedef {import('../nodes/nodeResolver.js').NodeResolver} NodeResolver
 * @typedef {import('../core/gateways.js').LogicEvaluator} LogicEvaluator
 * @typedef {import('../core/gateways.js').EntityGateway} EntityGateway
 */

import {
  createEvaluationContext,
  preprocessActorForEvaluation,
} from '../core/entityHelpers.js';
import { validateDependency } from '../../utils/dependencyUtils.js';
import { ErrorCodes } from '../constants/errorCodes.js';

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
 * @param deps.errorHandler
 * @returns {NodeResolver} Filter node resolver
 */
export default function createFilterResolver({
  logicEval,
  entitiesGateway,
  locationProvider,
  errorHandler = null,
}) {
  // Only validate if provided (for backward compatibility)
  if (errorHandler) {
    validateDependency(errorHandler, 'IScopeDslErrorHandler', console, {
      requiredMethods: ['handleError', 'getErrorBuffer'],
    });
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

      // Check if we have a cached processed actor from previous iterations
      // This avoids reprocessing the actor 10,000+ times in large datasets
      const cacheKey = '_processedActor';
      let processedActor = ctx[cacheKey];

      // Critical validation: actorEntity must be present and have valid ID
      if (!actorEntity) {
        const error = new Error(
          'FilterResolver: actorEntity is undefined in context'
        );
        if (errorHandler) {
          errorHandler.handleError(
            error,
            ctx,
            'FilterResolver',
            ErrorCodes.MISSING_ACTOR
          );
        } else {
          // Fallback for backward compatibility
          throw error;
        }
      }

      // Additional validation for actorEntity ID
      if (
        !actorEntity.id ||
        actorEntity.id === 'undefined' ||
        typeof actorEntity.id !== 'string'
      ) {
        const isPossibleSpreadIssue =
          !actorEntity.id &&
          typeof actorEntity === 'object' &&
          actorEntity !== null &&
          ('componentTypeIds' in actorEntity || 'components' in actorEntity);

        const errorMessage = isPossibleSpreadIssue
          ? `FilterResolver: actorEntity has invalid ID: ${JSON.stringify(actorEntity.id)}. This appears to be an Entity instance that lost its 'id' getter method`
          : `FilterResolver: actorEntity has invalid ID: ${JSON.stringify(actorEntity.id)}`;

        const error = new Error(errorMessage);
        if (errorHandler) {
          errorHandler.handleError(
            error,
            ctx,
            'FilterResolver',
            ErrorCodes.INVALID_ACTOR_ID
          );
        } else {
          // Fallback for backward compatibility
          throw error;
        }
      }

      // Validate node structure
      if (!node || !node.parent) {
        const error = new Error(
          'FilterResolver: Invalid node structure - missing parent node'
        );
        if (errorHandler) {
          errorHandler.handleError(
            error,
            ctx,
            'FilterResolver',
            ErrorCodes.MISSING_NODE_PARENT
          );
        } else {
          // Fallback for backward compatibility
          throw error;
        }
      }

      // Recursively resolve parent node
      const parentResult = dispatcher.resolve(node.parent, ctx);

      const source = 'ScopeEngine.resolveFilter';
      const initialSize = parentResult.size;

      // Preprocess actor once for all filtering operations (performance optimization)
      // This avoids reprocessing the actor for each of potentially 10,000+ entities
      if (!processedActor && initialSize > 0) {
        try {
          processedActor = preprocessActorForEvaluation(
            actorEntity,
            entitiesGateway
          );
          // Store in context for potential nested filter operations
          ctx[cacheKey] = processedActor;
        } catch (err) {
          // If preprocessing fails, we'll fall back to per-item processing
          if (trace) {
            trace.addLog(
              'warning',
              `Failed to preprocess actor, falling back to per-item processing: ${err.message}`,
              source
            );
          }
        }
      }

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
        // Skip null or undefined items
        if (item === null || item === undefined) {
          if (trace) {
            trace.addLog(
              'warning',
              'Skipping null/undefined item in filter',
              source
            );
          }
          continue;
        }

        // If the item is an array, iterate over its elements for filtering
        if (Array.isArray(item)) {
          for (const arrayElement of item) {
            if (arrayElement === null || arrayElement === undefined) continue;

            const evalCtx = createEvaluationContext(
              arrayElement,
              actorEntity,
              entitiesGateway,
              locationProvider,
              trace,
              ctx.runtimeCtx, // Pass runtime context for target/targets access
              processedActor // Use preprocessed actor for performance
            );
            if (evalCtx && logicEval.evaluate(node.logic, evalCtx)) {
              result.add(arrayElement);
            }
          }
        } else {
          // Handle single items (entity IDs or objects)
          try {
            const evalCtx = createEvaluationContext(
              item,
              actorEntity,
              entitiesGateway,
              locationProvider,
              trace,
              ctx.runtimeCtx, // Pass runtime context for target/targets access
              processedActor // Use preprocessed actor for performance
            );

            if (!evalCtx) {
              if (trace) {
                trace.addLog(
                  'debug',
                  `Skipping item ${item} - could not create evaluation context`,
                  source
                );
              }
              continue;
            }

            // Enhanced trace logging for debugging filter evaluation
            if (trace) {
              trace.addLog(
                'debug',
                `Evaluating filter for item ${item}`,
                source,
                {
                  itemId: item,
                  hasEntityComponents: !!evalCtx.entity?.components,
                  entityComponentKeys: evalCtx.entity?.components
                    ? Object.keys(evalCtx.entity.components)
                    : [],
                  logic: node.logic,
                }
              );
            }

            const evalResult = logicEval.evaluate(node.logic, evalCtx);
            if (evalResult) {
              result.add(item);
              if (trace) {
                trace.addLog('debug', `Item ${item} passed filter`, source);
              }
            } else if (trace) {
              trace.addLog('debug', `Item ${item} failed filter`, source);
            }
          } catch (error) {
            // Re-throw errors for missing condition references
            if (
              error.message &&
              error.message.includes('Could not resolve condition_ref')
            ) {
              if (errorHandler) {
                errorHandler.handleError(
                  error,
                  ctx,
                  'FilterResolver',
                  ErrorCodes.RESOLUTION_FAILED_GENERIC
                );
              } else {
                throw error;
              }
            }
            // Handle other errors gracefully
            if (trace) {
              trace.addLog(
                'error',
                `Error filtering item ${item}: ${error.message}`,
                source,
                { error: error.message, stack: error.stack }
              );
            }
            // Continue processing other items
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
