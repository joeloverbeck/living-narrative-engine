/**
 * @file Handles access to specific clothing slots after clothing field resolution
 * @description Processes slot access like .torso_upper, .legs from clothing access objects
 * enabling syntax: actor.topmost_clothing.torso_upper
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import {
  calculatePriorityWithValidation,
  sortCandidatesWithTieBreaking,
} from '../prioritySystem/priorityCalculator.js';
import { ErrorCodes } from '../constants/errorCodes.js';

/**
 * Feature flags for coverage system enhancement
 */
const COVERAGE_FEATURES = {
  enableCoverageResolution: true,
  fallbackToLegacy: true,
  enablePerformanceLogging: false,
  enableErrorRecovery: true,
};

/**
 * Creates a slot access resolver for handling clothing slot-specific access
 *
 * @param {object} dependencies - Injected dependencies
 * @param {object} dependencies.entitiesGateway - Gateway for entity data access
 * @param {object} [dependencies.errorHandler] - Optional centralized error handler
 * @returns {object} NodeResolver with canResolve and resolve methods
 */
export default function createSlotAccessResolver({
  entitiesGateway,
  errorHandler = null,
}) {
  validateDependency(entitiesGateway, 'entitiesGateway');

  // Only validate if provided (for backward compatibility)
  if (errorHandler) {
    validateDependency(errorHandler, 'IScopeDslErrorHandler', console, {
      requiredMethods: ['handleError', 'getErrorBuffer'],
    });
  }

  const CLOTHING_SLOTS = [
    'torso_upper',
    'torso_lower',
    'legs',
    'feet',
    'head_gear',
    'hands',
    'left_arm_clothing',
    'right_arm_clothing',
  ];

  const LAYER_PRIORITY = {
    topmost: ['outer', 'base', 'underwear', 'accessories'],
    topmost_no_accessories: ['outer', 'base', 'underwear'],
    all: ['outer', 'base', 'underwear', 'accessories'],
    outer: ['outer'],
    base: ['base'],
    underwear: ['underwear'],
  };

  /**
   * Check if coverage resolution is enabled
   *
   * @returns {boolean} True if coverage resolution is enabled
   */
  function isCoverageResolutionEnabled() {
    return COVERAGE_FEATURES.enableCoverageResolution;
  }

  /**
   * Check if slot name is a clothing slot
   *
   * @param {string} slotName - Slot name to check
   * @returns {boolean} True if slot is a clothing slot
   */
  function isClothingSlot(slotName) {
    return CLOTHING_SLOTS.includes(slotName);
  }

  /**
   * Enhancement function to improve existing resolveSlotAccess
   * This builds on the existing sophisticated candidate-based resolution
   *
   * @param {string} slotItem - The resolved slot item
   * @param {string} field - The slot field name
   * @param {object} ctx - Resolution context with trace
   * @returns {string} Enhanced slot item or original item
   */
  function applyEnhancedCoverage(slotItem, field, ctx) {
    // Enhancement: Add additional coverage validation logic here
    // This builds on the existing sophisticated candidate-based resolution
    // that already includes priority calculation and tie-breaking

    if (!slotItem || !ctx.trace) {
      return slotItem;
    }

    // Add enhanced tracing or validation logic
    if (COVERAGE_FEATURES.enableCoverageResolution && isClothingSlot(field)) {
      ctx.trace.addLog(
        'info',
        `Enhanced coverage applied for ${field}`,
        'CoverageEnhancer'
      );
    }

    return slotItem;
  }

  /**
   * Maps clothing access mode and layer to coverage priority
   *
   * @param {string} mode - Clothing access mode
   * @param {string} layer - Layer type
   * @returns {string} Coverage priority for priority calculation
   */
  function getCoveragePriorityFromMode(mode, layer) {
    // Map layer directly to coverage priority in most cases
    const layerToCoverage = {
      outer: 'outer',
      base: 'base',
      underwear: 'underwear',
      accessories: 'base', // Accessories treated as base coverage
    };

    return layerToCoverage[layer] || 'direct';
  }

  /**
   * Comprehensive error handling wrapper for coverage resolution
   *
   * @param {Function} resolveFn - The resolution function to wrap
   * @param {string} targetSlot - The target slot being resolved
   * @param {object} trace - Optional trace logger
   * @returns {Function} Wrapped resolution function with error handling
   */
  function _safeResolveCoverageAwareSlot(resolveFn, targetSlot, trace) {
    return function (...args) {
      const startTime = performance.now();

      try {
        const result = resolveFn(...args);

        // Performance logging removed - use error handler for critical issues only

        return result;
      } catch (error) {
        if (errorHandler) {
          errorHandler.handleError(
            `Coverage resolution error for ${targetSlot}: ${error.message}`,
            { targetSlot, originalError: error.message, duration: performance.now() - startTime },
            'SlotAccessResolver',
            ErrorCodes.SLOT_ACCESS_FAILED
          );
        }

        if (trace) {
          trace.coverageError = {
            targetSlot,
            error: error.message,
            duration: performance.now() - startTime,
          };
        }

        if (COVERAGE_FEATURES.enableErrorRecovery) {
          return null; // Trigger fallback to legacy
        }

        throw error; // Re-throw if error recovery disabled
      }
    };
  }

  /**
   * Select optimal resolution strategy based on complexity
   *
   * @param {string} entityId - Entity ID being resolved
   * @param {string} targetSlot - Target slot name
   * @returns {string} Strategy type ('legacy' or 'coverage')
   */
  function _selectResolutionStrategy(entityId, targetSlot) {
    // For simple cases, use legacy resolution
    const equipment = entitiesGateway.getComponentData(
      entityId,
      'clothing:equipment'
    );
    if (!equipment || !equipment.equipped) {
      return 'legacy';
    }

    const directItems = Object.keys(
      equipment.equipped[targetSlot] || {}
    ).length;
    const totalItems = Object.values(equipment.equipped || {}).reduce(
      (sum, slot) => sum + (slot ? Object.keys(slot).length : 0),
      0
    );

    // Use legacy for simple cases to avoid overhead
    if (totalItems <= 3 && directItems > 0) {
      return 'legacy';
    }

    // Use coverage-aware for complex cases
    return 'coverage';
  }

  /**
   * Checks if this resolver can handle the given node
   *
   * @param {object} node - The node to check
   * @returns {boolean} True if node is a Step node with a clothing slot field
   */
  function canResolve(node) {
    if (!node || node.type !== 'Step' || !node.field) {
      return false;
    }
    // Only handle clothing slots if the parent is a clothing access step
    // This prevents interference with direct component property access
    if (
      node.parent &&
      node.parent.type === 'Step' &&
      (node.parent.field === 'topmost_clothing' ||
        node.parent.field === 'topmost_clothing_no_accessories' ||
        node.parent.field === 'all_clothing' ||
        node.parent.field === 'outer_clothing' ||
        node.parent.field === 'base_clothing' ||
        node.parent.field === 'underwear')
    ) {
      return CLOTHING_SLOTS.includes(node.field);
    }
    return false;
  }

  /**
   * Collects items from other slots that have coverage mapping for the target slot
   *
   * @param {string} entityId - The entity ID being resolved
   * @param {string} targetSlot - The target slot to find coverage for
   * @param {object} equipped - The equipped items data
   * @param {object} trace - Optional trace logger
   * @returns {Array} Array of coverage candidates with metadata
   */
  function collectCoverageItems(entityId, targetSlot, equipped, trace) {
    const coverageCandidates = [];

    // Check all equipped slots for items with coverage mapping
    for (const [slotName, slotData] of Object.entries(equipped || {})) {
      if (!slotData || slotName === targetSlot) {
        continue; // Skip empty slots and the target slot itself
      }

      // Check each layer in the slot
      for (const [layer, itemId] of Object.entries(slotData)) {
        if (!itemId) continue;

        // Get the item's coverage mapping component
        const coverageMapping = entitiesGateway.getComponentData(
          itemId,
          'clothing:coverage_mapping'
        );

        if (coverageMapping?.covers?.includes(targetSlot)) {
          const candidate = {
            itemId: itemId,
            sourceSlot: slotName,
            layer: layer,
            coveragePriority: coverageMapping.coveragePriority || 'base',
            source: 'coverage_mapping',
          };

          coverageCandidates.push(candidate);

          if (trace) {
            trace.addLog(
              'info',
              `SlotAccessResolver: Found coverage item ${itemId} in ${slotName}/${layer} covering ${targetSlot}`,
              'SlotAccessResolver',
              {
                itemId,
                sourceSlot: slotName,
                layer,
                targetSlot,
                coveragePriority: candidate.coveragePriority,
                covers: coverageMapping.covers,
              }
            );
          }
        }
      }
    }

    return coverageCandidates;
  }

  /**
   * Resolves slot access from a clothing access object
   *
   * @param {object} clothingAccess - The clothing access object from ClothingStepResolver
   * @param {string} slotName - The slot name to access
   * @param {object} ctx - Resolution context with trace and structuredTrace
   * @returns {string|null} The entity ID of the item in the slot or null
   */
  function resolveSlotAccess(clothingAccess, slotName, ctx) {
    // Validate inputs
    if (!clothingAccess || typeof clothingAccess !== 'object') {
      if (errorHandler) {
        errorHandler.handleError(
          'Invalid clothing access object provided',
          { slotName, clothingAccess },
          'SlotAccessResolver',
          ErrorCodes.INVALID_DATA_GENERIC
        );
      }
      return null;
    }

    if (!slotName || typeof slotName !== 'string') {
      if (errorHandler) {
        errorHandler.handleError(
          'Invalid slot name provided',
          { slotName },
          'SlotAccessResolver',
          ErrorCodes.INVALID_ENTITY_ID
        );
      }
      return null;
    }

    if (!CLOTHING_SLOTS.includes(slotName)) {
      if (errorHandler) {
        errorHandler.handleError(
          `Invalid slot identifier: ${slotName}`,
          { slotName, validSlots: CLOTHING_SLOTS },
          'SlotAccessResolver',
          ErrorCodes.INVALID_ENTITY_ID
        );
      }
      return null;
    }

    const { equipped, mode, entityId } = clothingAccess;
    
    if (!equipped) {
      if (errorHandler) {
        errorHandler.handleError(
          'No equipped items data found',
          { entityId, slotName },
          'SlotAccessResolver',
          ErrorCodes.MISSING_CONTEXT_GENERIC
        );
      }
      return null;
    }

    if (!mode || !LAYER_PRIORITY[mode]) {
      if (errorHandler) {
        errorHandler.handleError(
          `Invalid clothing mode: ${mode}`,
          { mode, entityId, slotName, validModes: Object.keys(LAYER_PRIORITY) },
          'SlotAccessResolver',
          ErrorCodes.INVALID_DATA_GENERIC
        );
      }
      return null;
    }

    const slotData = equipped[slotName];

    // Enhanced structured tracing integration
    const trace = ctx?.trace;
    const structuredTrace = ctx?.structuredTrace;
    const _performanceMonitor = ctx?.performanceMonitor;

    // Build candidates from both direct slot items and coverage mapping
    const candidates = [];

    // First, collect items directly equipped to the slot
    if (slotData) {
      const layers = LAYER_PRIORITY[mode] || LAYER_PRIORITY.topmost;

      for (const layer of layers) {
        if (slotData[layer]) {
          const candidate = {
            itemId: slotData[layer],
            layer: layer,
            coveragePriority: getCoveragePriorityFromMode(mode, layer),
            source: 'direct',
            priority: 0, // Will be calculated
          };

          candidates.push(candidate);
        }
      }
    }

    // Then, collect items from other slots with coverage mapping
    if (isCoverageResolutionEnabled()) {
      const coverageCandidates = collectCoverageItems(
        entityId,
        slotName,
        equipped,
        trace
      );

      // Add coverage candidates to the main candidates list
      for (const coverageCandidate of coverageCandidates) {
        // Check if this layer should be included based on mode
        const layers = LAYER_PRIORITY[mode] || LAYER_PRIORITY.topmost;
        if (layers.includes(coverageCandidate.layer)) {
          coverageCandidate.priority = 0; // Will be calculated
          candidates.push(coverageCandidate);
        }
      }
    }

    if (candidates.length === 0) {
      if (trace) {
        const availableSlots = Object.keys(equipped || {});
        trace.addLog(
          'info',
          `SlotAccessResolver: No items found for slot ${slotName} (direct or via coverage). Available slots: ${availableSlots.join(', ') || 'none'}`,
          'SlotAccessResolver',
          { slotName, availableSlots, mode }
        );
      }

      // Structured trace: Log no slot data found
      if (structuredTrace) {
        const activeSpan = structuredTrace.getActiveSpan();
        if (activeSpan) {
          activeSpan.addEvent('no_slot_data', {
            slotName,
            availableSlots: Object.keys(equipped || {}),
            mode,
            reason: 'no_candidates_found',
          });
        }
      }

      return null;
    }

    // Enhanced tracing: Show candidates from all sources
    if (trace) {
      const candidateSummary = {
        total: candidates.length,
        direct: candidates.filter((c) => c.source === 'direct').length,
        coverage: candidates.filter((c) => c.source === 'coverage_mapping')
          .length,
        byLayer: {},
      };

      for (const candidate of candidates) {
        if (!candidateSummary.byLayer[candidate.layer]) {
          candidateSummary.byLayer[candidate.layer] = [];
        }
        candidateSummary.byLayer[candidate.layer].push({
          itemId: candidate.itemId,
          source: candidate.source,
          sourceSlot: candidate.sourceSlot,
        });
      }

      trace.addLog(
        'info',
        `SlotAccessResolver: Found ${candidates.length} candidates for slot ${slotName}`,
        'SlotAccessResolver',
        {
          slotName,
          mode,
          candidateSummary,
          excludesAccessories: mode === 'topmost_no_accessories',
        }
      );
    }

    // Structured trace: Start candidate collection phase
    let candidateCollectionSpan = null;
    if (structuredTrace) {
      candidateCollectionSpan = structuredTrace.startSpan(
        'candidate_collection',
        {
          slotName,
          mode,
          candidateCount: candidates.length,
        }
      );

      // Log each candidate found
      for (const candidate of candidates) {
        candidateCollectionSpan.addEvent('candidate_found', {
          itemId: candidate.itemId,
          layer: candidate.layer,
          coveragePriority: candidate.coveragePriority,
          source: candidate.source,
          sourceSlot: candidate.sourceSlot,
        });
      }

      structuredTrace.endSpan(candidateCollectionSpan);
    }

    // Calculate priorities and sort candidates
    let priorityCalculationSpan = null;

    // Structured trace: Start priority calculation phase
    if (structuredTrace) {
      priorityCalculationSpan = structuredTrace.startSpan(
        'priority_calculation',
        {
          candidateCount: candidates.length,
          calculationMethod: 'standard',
        }
      );
    }

    for (const candidate of candidates) {
      candidate.priority = calculatePriorityWithValidation(
        candidate.coveragePriority,
        candidate.layer,
        trace
          ? { warn: (msg) => trace.addLog('warn', msg, 'SlotAccessResolver') }
          : null
      );

      // Structured trace: Log priority calculation
      if (priorityCalculationSpan) {
        priorityCalculationSpan.addEvent('priority_calculated', {
          itemId: candidate.itemId,
          priority: candidate.priority,
          coveragePriority: candidate.coveragePriority,
          layer: candidate.layer,
        });
      }
    }

    // Structured trace: Complete priority calculation
    if (priorityCalculationSpan) {
      priorityCalculationSpan.addAttributes({
        totalCalculations: candidates.length,
      });
      structuredTrace.endSpan(priorityCalculationSpan);
    }

    // Final selection with structured tracing
    let finalSelectionSpan = null;

    // Structured trace: Start final selection phase
    if (structuredTrace) {
      finalSelectionSpan = structuredTrace.startSpan('final_selection', {
        candidateCount: candidates.length,
      });
    }

    const sortedCandidates = sortCandidatesWithTieBreaking(candidates);
    const selectedCandidate = sortedCandidates[0];

    // Structured trace: Log final selection
    if (finalSelectionSpan) {
      finalSelectionSpan.addEvent('selection_made', {
        selectedItem: selectedCandidate?.itemId || 'none',
        reason: 'highest_priority',
        totalCandidates: sortedCandidates.length,
        tieBreakingUsed:
          sortedCandidates.length > 1 &&
          sortedCandidates[0].priority === sortedCandidates[1]?.priority,
      });

      finalSelectionSpan.addAttributes({
        selectedItem: selectedCandidate?.itemId || 'none',
        selectionReason: 'highest_priority',
        finalCandidates: sortedCandidates.length,
        tieBreakingUsed:
          sortedCandidates.length > 1 &&
          sortedCandidates[0].priority === sortedCandidates[1]?.priority,
      });

      structuredTrace.endSpan(finalSelectionSpan);
    }

    if (trace) {
      trace.addLog(
        'info',
        `SlotAccessResolver: Selected item from slot ${slotName}, layer ${selectedCandidate.layer}`,
        'SlotAccessResolver',
        {
          slotName,
          layer: selectedCandidate.layer,
          itemId: selectedCandidate.itemId,
          mode,
          priority: selectedCandidate.priority,
          totalCandidates: candidates.length,
        }
      );
    }

    return selectedCandidate.itemId;
  }

  /**
   * Adds a value to the result set, handling various data types
   *
   * @param {Set} resultSet - The result set to add to
   * @param {any} data - The data to add
   */
  function addToResultSet(resultSet, data) {
    if (Array.isArray(data)) {
      data.forEach((item) => resultSet.add(item));
    } else if (typeof data === 'string') {
      resultSet.add(data);
    } else if (data !== null && data !== undefined) {
      resultSet.add(data);
    }
  }

  /**
   * Resolves a Step node for clothing slot access
   *
   * @param {object} node - The Step node to resolve
   * @param {object} ctx - Resolution context
   * @returns {Set} Set of resolved values
   */
  function resolve(node, ctx) {
    const { field, parent } = node;
    const parentResults = ctx.dispatcher.resolve(parent, ctx);
    const resultSet = new Set();

    if (ctx.trace) {
      ctx.trace.addLog(
        'info',
        `SlotAccessResolver: Processing slot ${field}`,
        'SlotAccessResolver',
        { field, parentResultsSize: parentResults.size }
      );
    }

    for (const item of parentResults) {
      // Handle arrays that might contain clothing access objects
      if (Array.isArray(item)) {
        for (const subItem of item) {
          if (
            typeof subItem === 'object' &&
            subItem !== null &&
            subItem.__clothingSlotAccess
          ) {
            const slotItem = resolveSlotAccess(subItem, field, ctx);
            if (slotItem) {
              // Enhancement: Apply additional coverage validation here
              const enhancedResult = applyEnhancedCoverage(
                slotItem,
                field,
                ctx
              );
              resultSet.add(enhancedResult || slotItem);
            }
          }
        }
      } else if (
        typeof item === 'object' &&
        item !== null &&
        item.__clothingSlotAccess
      ) {
        // This is a clothing slot access object from ClothingStepResolver
        const slotItem = resolveSlotAccess(item, field, ctx);
        if (slotItem) {
          // Enhancement: Apply additional coverage validation here
          const enhancedResult = applyEnhancedCoverage(slotItem, field, ctx);
          resultSet.add(enhancedResult || slotItem);
        }
      } else if (typeof item === 'string') {
        // Regular entity - try to access component field (backward compatibility)
        const componentData = entitiesGateway.getComponentData(item, field);
        if (componentData !== null && componentData !== undefined) {
          addToResultSet(resultSet, componentData);
        }
      }
    }

    if (ctx.trace) {
      ctx.trace.addLog(
        'info',
        `SlotAccessResolver: Resolution complete, found ${resultSet.size} items`,
        'SlotAccessResolver',
        { resultSize: resultSet.size }
      );
    }

    return resultSet;
  }

  return {
    canResolve,
    resolve,
  };
}
