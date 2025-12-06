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
import { ScopeResolutionError } from '../errors/scopeResolutionError.js';
import { FilterClauseAnalyzer } from '../analysis/filterClauseAnalyzer.js';

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

  const safeConsoleDebug =
    typeof console !== 'undefined' && typeof console.debug === 'function'
      ? console.debug.bind(console)
      : null;

  /**
   * Logs diagnostic filter evaluation messages using the runtime logger when available.
   *
   * @param {import('../../types/runtimeContext.js').RuntimeContext['logger']} logger - Logger from runtime context.
   * @param {string} message - Message to log.
   * @param {object} payload - Structured log payload.
   */
  function logDiagnosticDebug(logger, message, payload) {
    if (logger && typeof logger.debug === 'function') {
      logger.debug(message, payload);
    } else if (safeConsoleDebug) {
      safeConsoleDebug(message, payload);
    }
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
      const tracer = ctx.tracer; // ADD: Extract tracer from context
      const logger = ctx?.runtimeCtx?.logger || null;

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

      // Add trace logging for before filtering
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
        }
      }

      if (initialSize === 0) return new Set();

      const result = new Set();
      const filterEvaluations = []; // Collect detailed evaluation data for tracing

      for (const item of parentResult) {
        // Skip null or undefined items
        if (item === null || item === undefined) {
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
          let evalCtx = null; // Declare outside try block so it's available in catch
          try {
            evalCtx = createEvaluationContext(
              item,
              actorEntity,
              entitiesGateway,
              locationProvider,
              trace,
              ctx.runtimeCtx, // Pass runtime context for target/targets access
              processedActor // Use preprocessed actor for performance
            );

            if (!evalCtx) {
              continue;
            }

            const evalResult = logicEval.evaluate(node.logic, evalCtx);

            // ADD: Log to tracer (in addition to existing trace logging)
            if (tracer?.isEnabled()) {
              const entityId = typeof item === 'string' ? item : item?.id;

              // Analyze filter breakdown for detailed clause-level diagnostics
              const analysis = FilterClauseAnalyzer.analyzeFilter(
                node.logic,
                evalCtx,
                logicEval
              );

              tracer.logFilterEvaluation(
                entityId,
                node.logic,
                evalResult,
                evalCtx,
                analysis.breakdown
              );
            }

            // Capture detailed evaluation data for tracing
            if (trace) {
              const itemEntity =
                typeof item === 'string'
                  ? entitiesGateway.getEntityInstance(item)
                  : item;
              filterEvaluations.push({
                entityId: typeof item === 'string' ? item : item?.id,
                passedFilter: evalResult,
                evaluationContext: {
                  hasItemMarker:
                    itemEntity?.componentTypeIds?.includes('items:item') ||
                    false,
                  hasPortableMarker:
                    itemEntity?.componentTypeIds?.includes('items:portable') ||
                    false,
                  entityLocationId:
                    evalCtx.entity?.components?.['core:position']?.locationId,
                  actorLocationId:
                    evalCtx.actor?.components?.['core:position']?.locationId,
                  locationMatch:
                    evalCtx.entity?.components?.['core:position']
                      ?.locationId ===
                    evalCtx.actor?.components?.['core:position']?.locationId,
                },
              });
            }

            if (evalResult) {
              result.add(item);
            }
          } catch (error) {
            // Re-throw errors for missing condition references
            if (
              error.message &&
              error.message.includes('Could not resolve condition_ref')
            ) {
              // Wrap with ScopeResolutionError for better context
              const wrappedError = new ScopeResolutionError(
                'Filter logic evaluation failed',
                {
                  phase: 'filter evaluation',
                  parameters: {
                    entityId: typeof item === 'string' ? item : item?.id,
                    filterLogic: node.logic,
                    contextKeys: evalCtx ? Object.keys(evalCtx) : [],
                  },
                  hint: 'Check that JSON Logic expression is valid and context has required fields',
                  originalError: error,
                }
              );

              if (errorHandler) {
                errorHandler.handleError(
                  wrappedError,
                  ctx,
                  'FilterResolver',
                  ErrorCodes.RESOLUTION_FAILED_GENERIC
                );
              } else {
                throw wrappedError;
              }
            }
            // Handle other errors gracefully - continue processing other items
          }
        }
      }

      // Add trace logging for after filtering
      if (trace) {
        trace.addLog(
          'info',
          `Filter application complete. ${result.size} of ${initialSize} items passed.`,
          source
        );

        // Add detailed filter evaluation trace for diagnostics
        trace.addLog(
          'data',
          'Filter evaluation details',
          'ScopeEngine.filterEvaluation',
          {
            entitiesFromQuery: Array.from(parentResult),
            filterEvaluations: filterEvaluations,
            filteredResults: Array.from(result),
            totalEvaluated: initialSize,
            totalPassed: result.size,
            filterLogic: node.logic,
          }
        );
      }

      // TEMPORARY DIAGNOSTIC: Log filter results to console
      logDiagnosticDebug(logger, '[DIAGNOSTIC] Filter evaluation:', {
        initialSize,
        finalSize: result.size,
        logic: JSON.stringify(node.logic),
        filterEvaluations: filterEvaluations.map((e) => ({
          entityId: e.entityId,
          passed: e.passedFilter,
        })),
      });

      return result;
    },
  };
}
