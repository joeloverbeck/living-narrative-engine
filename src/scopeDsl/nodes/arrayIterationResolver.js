import {
  calculatePriorityWithValidation,
  sortCandidatesWithTieBreaking,
} from '../prioritySystem/priorityCalculator.js';
import { validateDependency } from '../../utils/dependencyUtils.js';
import { ErrorCodes } from '../constants/errorCodes.js';

/**
 * Creates an ArrayIterationStep node resolver for flattening array values.
 * Resolves ArrayIterationStep nodes by flattening arrays from parent results.
 *
 * @param {object} deps - Dependencies
 * @param {object} deps.errorHandler - Optional error handler for centralized error handling
 * @returns {object} NodeResolver with canResolve and resolve methods
 */
export default function createArrayIterationResolver({ errorHandler = null } = {}) {
  // Only validate if provided (for backward compatibility)
  if (errorHandler) {
    validateDependency(errorHandler, 'IScopeDslErrorHandler', console, {
      requiredMethods: ['handleError', 'getErrorBuffer'],
    });
  }
  
  const MAX_ARRAY_SIZE = 10000; // Configurable limit
  const LAYER_PRIORITY = {
    topmost: ['outer', 'base', 'underwear'],
    all: ['outer', 'base', 'underwear', 'accessories'],
    outer: ['outer'],
    base: ['base'],
    underwear: ['underwear'],
  };

  /**
   * Maps clothing access mode and layer to coverage priority
   *
   * @param {string} mode - Clothing access mode
   * @param {string} layer - Layer type
   * @returns {string} Coverage priority for priority calculation
   */
  function getCoveragePriorityFromMode(mode, layer) {
    const layerToCoverage = {
      outer: 'outer',
      base: 'base',
      underwear: 'underwear',
      accessories: 'base', // Accessories treated as base coverage
    };

    return layerToCoverage[layer] || 'direct';
  }

  /**
   * Gets all clothing items from a clothing access object using priority-based selection
   *
   * @param {object} clothingAccess - The clothing access object
   * @param {object} trace - Optional trace logger
   * @returns {Array} Array of clothing entity IDs sorted by priority
   */
  function getAllClothingItems(clothingAccess, trace) {
    const { equipped, mode } = clothingAccess;
    const candidates = [];
    const layers = LAYER_PRIORITY[mode] || LAYER_PRIORITY.topmost;

    // Collect all available items with their priority data
    for (const [slotName, slotData] of Object.entries(equipped)) {
      if (!slotData || typeof slotData !== 'object') {
        continue;
      }

      for (const layer of layers) {
        if (slotData[layer]) {
          candidates.push({
            itemId: slotData[layer],
            layer: layer,
            slotName: slotName,
            coveragePriority: getCoveragePriorityFromMode(mode, layer),
            source: 'coverage',
            priority: 0, // Will be calculated
          });

          if (mode === 'topmost') {
            break; // Only take the topmost for topmost mode
          }
        }
      }
    }

    // Calculate priorities for all candidates
    for (const candidate of candidates) {
      candidate.priority = calculatePriorityWithValidation(
        candidate.coveragePriority,
        candidate.layer,
        trace
          ? {
              warn: (msg) =>
                trace.addLog('warn', msg, 'ArrayIterationResolver'),
            }
          : null
      );
    }

    // Sort candidates by priority and extract item IDs
    const sortedCandidates = sortCandidatesWithTieBreaking(candidates);
    const result = sortedCandidates.map((candidate) => candidate.itemId);

    if (trace && result.length > 0) {
      trace.addLog(
        'info',
        `ArrayIterationResolver: Processed ${candidates.length} clothing items with priority-based sorting`,
        'ArrayIterationResolver',
        {
          totalCandidates: candidates.length,
          resultCount: result.length,
          mode: mode,
          topPriority: sortedCandidates[0]?.priority,
        }
      );
    }

    return result;
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
      const trace = ctx.trace;

      // Validate context has required properties
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

      // Use dispatcher to resolve parent node - pass full context
      const parentResult = ctx.dispatcher.resolve(node.parent, ctx);

      if (trace) {
        trace.addLog(
          'info',
          `Resolving ArrayIterationStep node. Parent result size: ${parentResult.size}`,
          'ArrayIterationResolver',
          {
            parentSize: parentResult.size,
          }
        );
      }

      const result = new Set();

      // Flatten arrays from parent result
      for (const parentValue of parentResult) {
        if (Array.isArray(parentValue)) {
          // Check array size limit
          if (parentValue.length > MAX_ARRAY_SIZE) {
            if (errorHandler) {
              try {
                errorHandler.handleError(
                  new Error(`Array size ${parentValue.length} exceeds limit ${MAX_ARRAY_SIZE}`),
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
              result.add(item);
            }
          }
        } else if (parentValue && parentValue.__isClothingAccessObject) {
          // Handle clothing access objects from ClothingStepResolver
          try {
            const items = getAllClothingItems(parentValue, trace);
            for (const item of items) {
              if (item !== null && item !== undefined) {
                result.add(item);
              }
            }
          } catch (error) {
            if (errorHandler) {
              try {
                errorHandler.handleError(
                  error,
                  { ...ctx, clothingAccess: parentValue },
                  'ArrayIterationResolver',
                  ErrorCodes.ARRAY_ITERATION_FAILED
                );
              } catch {
                // Error handler might throw, but we should continue processing
              }
            }
            // Continue processing other items
          }
        } else if (node.parent.type === 'Source') {
          // Pass through for entities()[] case where Source returns entity IDs
          if (parentValue !== null && parentValue !== undefined) {
            result.add(parentValue);
          }
        } else if (
          node.parent.type === 'Step' &&
          node.parent.field === 'entities' &&
          node.parent.param
        ) {
          // Pass through for location.entities(component)[] case
          if (parentValue !== null && parentValue !== undefined) {
            result.add(parentValue);
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

      if (trace) {
        trace.addLog(
          'info',
          `ArrayIterationStep node resolved. Result size: ${result.size}`,
          'ArrayIterationResolver',
          {
            resultSize: result.size,
          }
        );
      }

      return result;
    },
  };
}
