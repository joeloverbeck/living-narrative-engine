/**
 * @file Coverage analyzer for clothing accessibility based on coverage rules
 * @description Analyzes which clothing items block access to others based on coverage
 * priorities and body area overlap. Provides the foundation for fixing clothing
 * removal bugs where underwear is incorrectly accessible when covered by base layers.
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { COVERAGE_PRIORITY } from '../../scopeDsl/prioritySystem/priorityConstants.js';
import { ErrorCodes } from '../../scopeDsl/constants/errorCodes.js';

/**
 * Creates a coverage analyzer for clothing accessibility
 *
 * @param {object} deps - Dependencies
 * @param {object} deps.entitiesGateway - Gateway for entity component access
 * @param {object} [deps.errorHandler] - Optional error handler for logging
 * @returns {object} Coverage analyzer with analyzeCoverageBlocking method
 */
export default function createCoverageAnalyzer({
  entitiesGateway,
  errorHandler = null,
}) {
  // Validate required dependencies
  validateDependency(entitiesGateway, 'IEntitiesGateway', console, {
    requiredMethods: ['getComponentData'],
  });

  // Only validate error handler if provided
  if (errorHandler) {
    validateDependency(errorHandler, 'IScopeDslErrorHandler', console, {
      requiredMethods: ['handleError', 'getErrorBuffer'],
    });
  }

  /**
   * Determines if one coverage priority blocks another
   * Lower priority values (higher priority) block higher priority values (lower priority)
   *
   * @param {string} blockerPriority - Priority of potentially blocking item
   * @param {string} targetPriority - Priority of target item
   * @returns {boolean} True if blocker blocks target
   */
  function doesPriorityBlock(blockerPriority, targetPriority) {
    const blockerValue = COVERAGE_PRIORITY[blockerPriority];
    const targetValue = COVERAGE_PRIORITY[targetPriority];

    // If either priority is undefined, no blocking occurs
    if (blockerValue === undefined || targetValue === undefined) {
      return false;
    }

    // Lower value (higher priority) blocks higher value (lower priority)
    return blockerValue < targetValue;
  }

  /**
   * Checks if two items have overlapping body areas
   *
   * @param {string[]} areas1 - Body areas covered by first item
   * @param {string[]} areas2 - Body areas covered by second item
   * @returns {boolean} True if areas overlap
   */
  function hasAreaOverlap(areas1, areas2) {
    if (!Array.isArray(areas1) || !Array.isArray(areas2)) {
      return false;
    }

    return areas1.some((area) => areas2.includes(area));
  }

  /**
   * Builds a map of blocking relationships between equipped items
   *
   * @param {object} equipped - Equipment state from entity
   * @param {string} _entityId - Entity ID for coverage mapping lookup
   * @returns {Map<string, Set<string>>} Map of itemId to Set of itemIds it blocks
   */
  function buildBlockingMap(equipped, _entityId) {
    const blockingMap = new Map();
    const itemCoverageCache = new Map();

    // First pass: collect all items and their coverage data
    const equippedItems = [];
    for (const [slotName, slotData] of Object.entries(equipped)) {
      if (!slotData || typeof slotData !== 'object') {
        continue;
      }

      for (const [layer, itemId] of Object.entries(slotData)) {
        if (itemId && typeof itemId === 'string') {
          equippedItems.push({ itemId, slotName, layer });

          // Fetch and cache coverage data
          try {
            const coverageMapping = entitiesGateway.getComponentData(
              itemId,
              'clothing:coverage_mapping'
            );

            if (coverageMapping) {
              const covers =
                coverageMapping.covers !== undefined
                  ? coverageMapping.covers
                  : [];
              const coveragePriority =
                coverageMapping.coveragePriority ?? layer;

              itemCoverageCache.set(itemId, {
                covers,
                coveragePriority,
              });
            } else {
              // Fallback: use layer as coverage priority if no mapping exists
              itemCoverageCache.set(itemId, {
                covers: [slotName], // Assume it covers its own slot
                coveragePriority: layer,
              });
            }
          } catch (error) {
            if (errorHandler) {
              errorHandler.handleError(
                `Failed to get coverage mapping for ${itemId}`,
                {
                  errorCode: ErrorCodes.COMPONENT_RESOLUTION_FAILED,
                  itemId,
                  originalError: error.message,
                }
              );
            }
            // Use fallback data on error
            itemCoverageCache.set(itemId, {
              covers: [slotName],
              coveragePriority: layer,
            });
          }
        }
      }
    }

    // Second pass: determine blocking relationships
    for (const blocker of equippedItems) {
      const blockerCoverage = itemCoverageCache.get(blocker.itemId);
      const blockedItems = new Set();

      for (const target of equippedItems) {
        // Don't block yourself
        if (blocker.itemId === target.itemId) continue;

        const targetCoverage = itemCoverageCache.get(target.itemId);
        // Check blocking conditions:
        // 1. Areas must overlap
        // 2. Blocker must have higher priority (lower value)
        if (
          hasAreaOverlap(blockerCoverage.covers, targetCoverage.covers) &&
          doesPriorityBlock(
            blockerCoverage.coveragePriority,
            targetCoverage.coveragePriority
          )
        ) {
          blockedItems.add(target.itemId);
        }
      }

      if (blockedItems.size > 0) {
        blockingMap.set(blocker.itemId, blockedItems);
      }
    }

    return blockingMap;
  }

  /**
   * Analyzes which clothing items block access to others based on coverage rules
   *
   * @param {object} equipped - Equipment state from entity
   * @param {string} entityId - Entity ID for coverage mapping lookup
   * @returns {object} Accessibility analyzer with isAccessible method
   */
  function analyzeCoverageBlocking(equipped, entityId) {
    // Input validation
    if (!equipped || typeof equipped !== 'object') {
      if (errorHandler) {
        errorHandler.handleError('Invalid equipped parameter', {
          errorCode: ErrorCodes.INVALID_DATA_GENERIC,
          equipped: typeof equipped,
        });
      }
      // Return permissive analyzer on invalid input
      return {
        isAccessible: () => true,
        getBlockedItems: () => [],
        getBlockingItems: () => [],
      };
    }

    if (!entityId || typeof entityId !== 'string') {
      if (errorHandler) {
        errorHandler.handleError('Invalid entityId parameter', {
          errorCode: ErrorCodes.INVALID_ENTITY_ID,
          entityId,
        });
      }
      // Return permissive analyzer on invalid input
      return {
        isAccessible: () => true,
        getBlockedItems: () => [],
        getBlockingItems: () => [],
      };
    }

    // Build the blocking relationships
    const blockingMap = buildBlockingMap(equipped, entityId);

    // Create reverse lookup for what blocks each item
    const blockedByMap = new Map();
    for (const [blocker, blockedSet] of blockingMap.entries()) {
      for (const blocked of blockedSet) {
        if (!blockedByMap.has(blocked)) {
          blockedByMap.set(blocked, new Set());
        }
        blockedByMap.get(blocked).add(blocker);
      }
    }

    return {
      /**
       * Checks if a specific item is accessible (not blocked by coverage)
       *
       * @param {string} itemId - Item ID to check
       * @param {string} [_slotName] - Optional slot name (for future use)
       * @param {string} [_layer] - Optional layer (for future use)
       * @returns {boolean} True if item is accessible, false if blocked
       */
      isAccessible(itemId, _slotName = null, _layer = null) {
        // Item is accessible if nothing blocks it
        return !blockedByMap.has(itemId);
      },

      /**
       * Gets all items that are currently blocked
       *
       * @returns {string[]} Array of blocked item IDs
       */
      getBlockedItems() {
        return Array.from(blockedByMap.keys());
      },

      /**
       * Gets items that block a specific item
       *
       * @param {string} itemId - Item ID to check
       * @returns {string[]} Array of item IDs that block the target
       */
      getBlockingItems(itemId) {
        const blockers = blockedByMap.get(itemId);
        return blockers ? Array.from(blockers) : [];
      },
    };
  }

  return {
    analyzeCoverageBlocking,
  };
}
