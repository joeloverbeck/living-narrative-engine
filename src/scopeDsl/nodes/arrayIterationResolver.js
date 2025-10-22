import { validateDependency } from '../../utils/dependencyUtils.js';
import { ErrorCodes } from '../constants/errorCodes.js';

/**
 * Creates an ArrayIterationStep node resolver for flattening array values.
 * Now delegates clothing accessibility logic to ClothingAccessibilityService.
 *
 * @param {object} deps - Dependencies
 * @param {object} [deps.clothingAccessibilityService] - Service for clothing queries
 * @param {object} [deps.errorHandler] - Optional error handler
 * @returns {object} NodeResolver with canResolve and resolve methods
 */
export default function createArrayIterationResolver({
  clothingAccessibilityService = null,
  errorHandler = null,
} = {}) {
  const safeConsoleDebug =
    typeof console !== 'undefined' && typeof console.debug === 'function'
      ? console.debug.bind(console)
      : null;

  /**
   * Logs diagnostic messages for array iteration debugging.
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

  // Validate if provided
  if (errorHandler) {
    validateDependency(errorHandler, 'IScopeDslErrorHandler', console, {
      requiredMethods: ['handleError', 'getErrorBuffer'],
    });
  }
  
  if (clothingAccessibilityService) {
    validateDependency(clothingAccessibilityService, 'ClothingAccessibilityService', console, {
      requiredMethods: ['getAccessibleItems'],
    });
  }

  const MAX_ARRAY_SIZE = 10000;

  /**
   * Process clothing access objects using accessibility service
   *
   * @param {object} clothingAccess - Clothing access object with entityId and mode
   * @param {object} trace - Trace context for logging
   * @returns {Array<string>} Array of accessible clothing item IDs
   * @private
   */
  function processClothingAccess(clothingAccess, trace) {
    const { entityId, mode = 'topmost' } = clothingAccess;
    
    if (!clothingAccessibilityService) {
      if (trace && trace.addStep) {
        trace.addStep('No clothing accessibility service available, returning empty array');
      }
      if (errorHandler) {
        errorHandler.handleError(
          'Clothing accessibility service not available',
          { context: 'processClothingAccess', entityId, mode },
          'ArrayIterationResolver',
          ErrorCodes.SERVICE_NOT_FOUND
        );
      }
      return [];
    }
    
    try {
      // Delegate to accessibility service
      const options = {
        mode,
        context: 'removal', // Default context for array iteration
        sortByPriority: true
      };
      
      const accessibleItems = clothingAccessibilityService.getAccessibleItems(
        entityId, 
        options
      );
      
      if (trace && trace.addStep) {
        trace.addStep(`Retrieved ${accessibleItems.length} accessible items for mode: ${mode}`);
      }
      
      return accessibleItems;
    } catch (error) {
      if (trace && trace.addStep) {
        trace.addStep(`Clothing access failed: ${error.message}`);
      }
      if (errorHandler) {
        errorHandler.handleError(
          error,
          { context: 'processClothingAccess', entityId, mode },
          'ArrayIterationResolver',
          ErrorCodes.CLOTHING_ACCESS_FAILED
        );
      }
      return [];
    }
  }

  return {
    /**
     * Checks if this resolver can handle the given node.
     *
     * @param {object} node - The node to check
     * @returns {boolean} True if node type is 'ArrayIterationStep'
     */
    canResolve(node) {
      return node.type === 'ArrayIterationStep';
    },

    /**
     * Resolves an ArrayIterationStep node by flattening arrays from parent results.
     *
     * @param {object} node - The ArrayIterationStep node to resolve
     * @param {object} ctx - Resolution context with actorEntity, trace, etc.
     * @returns {Set} Set of flattened values from arrays
     */
    resolve(node, ctx) {
      // Validate context
      if (!ctx.actorEntity) {
        const error = new Error(
          'ArrayIterationResolver: actorEntity is missing from context'
        );
        if (errorHandler) {
          errorHandler.handleError(
            error,
            ctx,
            'ArrayIterationResolver',
            ErrorCodes.MISSING_ACTOR
          );
        }
        throw error;
      }

      // Resolve parent node
      const parentResults = ctx.dispatcher
        ? ctx.dispatcher.resolve(node.parent, ctx)
        : new Set();

      // DIAGNOSTIC: Enhanced logging for array iteration debugging
      const parentResultsArray = Array.from(parentResults);
      const logger = ctx?.runtimeCtx?.logger || null;
      logDiagnosticDebug(
        logger,
        '[DIAGNOSTIC] ArrayIterationResolver - Starting iteration:',
        {
          parentResultsSize: parentResults.size,
          parentResultsPreview: parentResultsArray.slice(0, 3),
          parentResultsTypes: parentResultsArray.slice(0, 3).map(v =>
            Array.isArray(v) ? `Array(${v.length})` : typeof v
          ),
        }
      );

      const flattened = new Set();
      let totalArrayElements = 0;

      // Process each parent result
      for (const parentValue of parentResults) {
        if (parentValue === null || parentValue === undefined) {
          continue;
        }

        // Handle clothing access objects
        if (parentValue.__isClothingAccessObject === true) {
          const clothingItems = processClothingAccess(parentValue, ctx.trace);
          
          for (const itemId of clothingItems) {
            totalArrayElements++;
            if (totalArrayElements > MAX_ARRAY_SIZE) {
              if (errorHandler) {
                errorHandler.handleError(
                  'Array size limit exceeded',
                  { 
                    limit: MAX_ARRAY_SIZE, 
                    current: totalArrayElements 
                  },
                  'ArrayIterationResolver',
                  ErrorCodes.MEMORY_LIMIT
                );
              }
              break;
            }
            flattened.add(itemId);
          }
          continue;
        }

        // Handle regular arrays
        if (Array.isArray(parentValue)) {
          // DIAGNOSTIC: Log array processing details
          logDiagnosticDebug(
            logger,
            '[DIAGNOSTIC] ArrayIterationResolver - Processing array:',
            {
              arrayLength: parentValue.length,
              arrayPreview: parentValue.slice(0, 5),
              arrayItemTypes: parentValue.slice(0, 5).map(item =>
                item === null
                  ? 'null'
                  : item === undefined
                    ? 'undefined'
                    : typeof item === 'string'
                      ? 'string'
                      : typeof item
              ),
            }
          );

          // Check array size limit before processing
          if (parentValue.length > MAX_ARRAY_SIZE) {
            if (errorHandler) {
              try {
                errorHandler.handleError(
                  new Error(
                    `Array size ${parentValue.length} exceeds limit ${MAX_ARRAY_SIZE}`
                  ),
                  { ...ctx, arraySize: parentValue.length },
                  'ArrayIterationResolver',
                  ErrorCodes.MEMORY_LIMIT
                );
              } catch {
                // Error handler might throw, but we should continue processing
                // This is a warning - we still process the array
              }
            }
            // Still process the array, but error has been logged
          }

          for (const item of parentValue) {
            if (item !== null && item !== undefined) {
              flattened.add(item);
            }
          }
          continue;
        }

        // Handle special node types that can pass through non-arrays
        if (node.parent.type === 'Source') {
          // Pass through for entities()[] case where Source returns entity IDs
          if (parentValue !== null && parentValue !== undefined) {
            flattened.add(parentValue);
          }
        } else if (node.parent.type === 'ArrayIterationStep') {
          // Pass through for entities()[][] case where parent ArrayIterationStep returns entity IDs
          if (parentValue !== null && parentValue !== undefined) {
            flattened.add(parentValue);
          }
        } else if (node.parent.type === 'Filter') {
          // Pass through for filter nodes that emit entity IDs
          if (parentValue !== null && parentValue !== undefined) {
            flattened.add(parentValue);
          }
        } else if (node.parent.type === 'ScopeReference') {
          // Pass through for scope references producing direct entity IDs
          if (parentValue !== null && parentValue !== undefined) {
            flattened.add(parentValue);
          }
        } else if (
          node.parent.type === 'Step' &&
          node.parent.field === 'entities' &&
          node.parent.param
        ) {
          // Pass through for location.entities(component)[] case
          if (parentValue !== null && parentValue !== undefined) {
            flattened.add(parentValue);
          }
        } else if (parentValue !== null && parentValue !== undefined) {
          // Log unexpected non-array values in development mode
          if (errorHandler) {
            try {
              errorHandler.handleError(
                new Error(`Expected array but got ${typeof parentValue}`),
                { ...ctx, actualType: typeof parentValue, value: parentValue },
                'ArrayIterationResolver',
                ErrorCodes.DATA_TYPE_MISMATCH
              );
            } catch {
              // Error handler might throw, but we should continue processing
              // This is a non-critical error - just logging unexpected types
            }
          }
        }
        // For other cases (like Step nodes), non-arrays result in empty set
      }

      // DIAGNOSTIC: Log final array iteration results
      logDiagnosticDebug(
        logger,
        '[DIAGNOSTIC] ArrayIterationResolver - Iteration complete:',
        {
          totalArrayElements,
          flattenedSize: flattened.size,
          flattenedPreview: Array.from(flattened).slice(0, 5),
        }
      );

      if (ctx.trace && ctx.trace.addStep) {
        ctx.trace.addStep(
          `ArrayIterationResolver flattened ${totalArrayElements} elements`
        );
      }

      return flattened;
    },
  };
}