/**
 * @file Coverage resolution tracing enhancer that integrates with existing structured tracing infrastructure
 * @description Wraps SlotAccessResolver with structured tracing capabilities while maintaining backward compatibility
 * @see ../nodes/slotAccessResolver.js
 * @see ../../actions/tracing/structuredTrace.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { assertNonBlankString } from '../../utils/dependencyUtils.js';

/**
 * Coverage resolution tracing enhancer that integrates with existing IStructuredTrace system
 */
export class CoverageTracingEnhancer {
  #structuredTraceFactory;
  #performanceMonitor;
  #traceFormatter;
  #logger;

  /**
   * Constructor
   *
   * @param {object} dependencies - Injected dependencies
   * @param {Function} dependencies.structuredTraceFactory - Factory for creating structured traces
   * @param {object} dependencies.performanceMonitor - Performance monitoring service
   * @param {object} dependencies.traceFormatter - Coverage-specific trace formatter
   * @param {object} dependencies.logger - Logging service
   */
  constructor({ structuredTraceFactory, performanceMonitor, traceFormatter, logger }) {
    validateDependency(structuredTraceFactory, 'IStructuredTraceFactory', logger, {
      requiredMethods: ['create'],
    });
    validateDependency(performanceMonitor, 'IPerformanceMonitor', logger, {
      requiredMethods: ['startMeasurement', 'endMeasurement', 'recordMetrics'],
    });
    validateDependency(traceFormatter, 'ICoverageResolutionTraceFormatter', logger, {
      requiredMethods: ['formatCoverageTrace'],
    });
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    this.#structuredTraceFactory = structuredTraceFactory;
    this.#performanceMonitor = performanceMonitor;
    this.#traceFormatter = traceFormatter;
    this.#logger = logger;
  }

  /**
   * Enhances SlotAccessResolver with structured tracing capabilities
   *
   * @param {object} slotAccessResolver - The slot access resolver to enhance
   * @param {object} config - Trace configuration
   * @returns {object} Enhanced slot access resolver
   */
  enhanceSlotAccessResolver(slotAccessResolver, config) {
    validateDependency(slotAccessResolver, 'ISlotAccessResolver', this.#logger, {
      requiredMethods: ['canResolve', 'resolve'],
    });

    if (!config?.scopeDslTracing?.coverageResolution?.enabled) {
      this.#logger.debug('Coverage resolution tracing disabled, returning unmodified resolver');
      return slotAccessResolver; // Return unmodified if tracing disabled
    }

    this.#logger.info('Enhancing SlotAccessResolver with structured tracing capabilities');

    // Create enhanced resolver by wrapping the resolve method
    const enhancedResolver = Object.create(slotAccessResolver);

    // Preserve original methods
    enhancedResolver.canResolve = slotAccessResolver.canResolve.bind(slotAccessResolver);
    
    // Wrap the resolve method with structured tracing
    const originalResolve = slotAccessResolver.resolve.bind(slotAccessResolver);
    enhancedResolver.resolve = this.#createTracingWrapper(originalResolve, config);

    return enhancedResolver;
  }

  /**
   * Creates a tracing wrapper for the resolve method
   *
   * @private
   * @param {Function} originalResolve - The original resolve method
   * @param {object} config - Trace configuration
   * @returns {Function} Enhanced resolve method with structured tracing
   */
  #createTracingWrapper(originalResolve, config) {
    return (node, ctx) => {
      // Check if we should trace this node before creating any trace infrastructure
      if (config.scopeDslTracing.coverageResolution.enabled && this.#shouldTrace(node, ctx)) {
        // Add structured trace to context if not present
        if (!ctx.structuredTrace) {
          ctx.structuredTrace = this.#structuredTraceFactory.create();
          ctx.performanceMonitor = this.#performanceMonitor;
          ctx.coverageTraceFormatter = this.#traceFormatter;

          this.#logger.debug('Added structured trace to resolution context');
        }

        // Wrap resolution with coverage tracing
        // Validate that the existing structured trace has required methods
        if (this.#isValidStructuredTrace(ctx.structuredTrace)) {
          return this.#resolveWithStructuredTracing(originalResolve, node, ctx, config);
        } else {
          this.#logger.warn('Existing structured trace is invalid, creating new one');
          // Replace invalid trace with a new valid one
          ctx.structuredTrace = this.#structuredTraceFactory.create();
          return this.#resolveWithStructuredTracing(originalResolve, node, ctx, config);
        }
      }

      // Fallback to original resolution without structured tracing
      return originalResolve(node, ctx);
    };
  }

  /**
   * Validates that a structured trace object has all required methods
   *
   * @private
   * @param {object} structuredTrace - The structured trace object to validate
   * @returns {boolean} Whether the structured trace is valid
   */
  #isValidStructuredTrace(structuredTrace) {
    if (!structuredTrace) return false;
    
    const requiredMethods = ['startSpan', 'endSpan', 'getActiveSpan', 'getSpans'];
    
    for (const method of requiredMethods) {
      if (typeof structuredTrace[method] !== 'function') {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Determines if this node should be traced based on configuration and node type
   *
   * @private
   * @param {object} node - The node being resolved
   * @param {object} _ctx - Resolution context (unused)
   * @returns {boolean} Whether to enable tracing for this resolution
   */
  #shouldTrace(node, _ctx) {
    // Only trace clothing slot access nodes
    if (!node || node.type !== 'Step' || !node.field) {
      return false;
    }

    // Check if this is a clothing access step (same logic as SlotAccessResolver.canResolve)
    const isClothingAccess = node.parent &&
      node.parent.type === 'Step' &&
      (node.parent.field === 'topmost_clothing' ||
        node.parent.field === 'topmost_clothing_no_accessories' ||
        node.parent.field === 'all_clothing' ||
        node.parent.field === 'outer_clothing' ||
        node.parent.field === 'base_clothing' ||
        node.parent.field === 'underwear');

    const isClothingSlot = [
      'torso_upper', 'torso_lower', 'legs', 'feet', 'head_gear',
      'hands', 'left_arm_clothing', 'right_arm_clothing'
    ].includes(node.field);

    return isClothingAccess && isClothingSlot;
  }

  /**
   * Resolves a node with structured tracing enabled
   *
   * @private
   * @param {Function} originalResolve - The original resolve method
   * @param {object} node - The node to resolve
   * @param {object} ctx - Resolution context with structured trace
   * @param {object} config - Trace configuration
   * @returns {Set} Resolution results
   */
  #resolveWithStructuredTracing(originalResolve, node, ctx, config) {
    const { structuredTrace, performanceMonitor } = ctx;
    
    // Determine the mode from the parent field
    const modeMap = {
      'topmost_clothing': 'topmost',
      'topmost_clothing_no_accessories': 'topmost_no_accessories',
      'all_clothing': 'all',
      'outer_clothing': 'outer',
      'base_clothing': 'base',
      'underwear': 'underwear'
    };
    const mode = modeMap[node.parent?.field] || 'unknown';
    
    // Create a coverage resolution span
    const span = structuredTrace.startSpan('coverage_resolution', {
      targetSlot: node.field,
      mode: mode,
      strategy: 'coverage', // Default strategy
      nodeType: node.type,
      parentField: node.parent?.field || 'unknown'
    });

    this.#logger.debug(`Started coverage resolution span for slot: ${node.field}`);

    let performanceMarker = null;
    if (performanceMonitor) {
      performanceMarker = performanceMonitor.startMeasurement('coverage_resolution');
    }

    try {
      // Wrap the original resolution to capture coverage-specific tracing
      const result = this.#interceptResolutionPhases(originalResolve, node, ctx, span, config);

      // Extract selected item from result set and child spans
      let selectedItem = null;
      if (result.size > 0) {
        selectedItem = Array.from(result)[0]; // Get first item from result set
      }

      // Also try to get selectedItem from final_selection child span if available
      const allSpans = structuredTrace.getSpans ? structuredTrace.getSpans() : [];
      const finalSelectionSpan = allSpans.find(s => 
        (s.operation === 'final_selection' || s.name === 'final_selection') && 
        s.parentId === span.id
      );
      
      if (finalSelectionSpan) {
        const finalSelectionAttrs = finalSelectionSpan.getAttributes ? 
          finalSelectionSpan.getAttributes() : 
          finalSelectionSpan.attributes || {};
        if (finalSelectionAttrs.selectedItem && finalSelectionAttrs.selectedItem !== 'none') {
          selectedItem = finalSelectionAttrs.selectedItem;
        }
      }

      // Add final result attributes including the selected item
      const finalAttributes = {
        resultCount: result.size,
        success: true
      };
      
      if (selectedItem) {
        finalAttributes.selectedItem = selectedItem;
      }
      
      span.addAttributes(finalAttributes);

      span.setStatus('success');
      this.#logger.debug(`Coverage resolution completed successfully for slot: ${node.field}, results: ${result.size}`);

      return result;

    } catch (error) {
      this.#logger.error(`Coverage resolution error for slot ${node.field}:`, error);
      
      span.recordError(error);
      span.addAttributes({
        error: error.message,
        errorType: error.constructor.name
      });

      throw error;
    } finally {
      // End performance measurement
      if (performanceMarker && performanceMonitor) {
        const duration = performanceMonitor.endMeasurement(performanceMarker);
        span.addAttributes({ duration: duration });
      }

      structuredTrace.endSpan(span);
      this.#logger.debug(`Ended coverage resolution span for slot: ${node.field}`);
    }
  }

  /**
   * Intercepts resolution phases to add detailed tracing
   *
   * @private
   * @param {Function} originalResolve - The original resolve method
   * @param {object} node - The node to resolve
   * @param {object} ctx - Resolution context
   * @param {object} _parentSpan - The parent span for this resolution (unused)
   * @param {object} _config - Trace configuration (unused)
   * @returns {Set} Resolution results
   */
  #interceptResolutionPhases(originalResolve, node, ctx, _parentSpan, _config) {
    const { structuredTrace } = ctx;

    // Phase 1: Node Analysis
    const nodeAnalysisSpan = structuredTrace.startSpan('node_analysis', {
      nodeType: node.type,
      field: node.field,
      hasParent: !!node.parent,
      parentField: node.parent?.field || null
    });

    try {
      // Call original resolve method which will handle the actual resolution
      // The original method will call resolveSlotAccess internally for clothing access objects
      const result = originalResolve(node, ctx);

      nodeAnalysisSpan.addAttributes({
        resultCount: result.size,
        resultType: 'Set'
      });

      nodeAnalysisSpan.setStatus('success');
      return result;

    } catch (error) {
      nodeAnalysisSpan.recordError(error);
      throw error;
    } finally {
      structuredTrace.endSpan(nodeAnalysisSpan);
    }
  }

  /**
   * Creates enhanced performance monitoring for coverage resolution
   *
   * @param {object} ctx - Resolution context
   * @returns {object} Performance monitoring utilities
   */
  createPerformanceMonitoring(ctx) {
    const performanceMonitor = ctx.performanceMonitor;
    
    if (!performanceMonitor) {
      // Fallback to basic performance logging
      return {
        markPhaseStart: () => {},
        markPhaseEnd: () => 0,
        getMetrics: () => ({})
      };
    }

    return {
      markPhaseStart(phaseName) {
        return performanceMonitor.startMeasurement(`coverage_${phaseName}`);
      },
      
      markPhaseEnd(phaseName, marker, additionalMetrics = {}) {
        if (!marker) return 0;
        
        const duration = performanceMonitor.endMeasurement(marker);
        
        // Record phase-specific metrics
        performanceMonitor.recordMetrics({
          [`coverage_${phaseName}_duration`]: duration,
          ...additionalMetrics
        });
        
        return duration;
      },
      
      getMetrics() {
        return performanceMonitor.getMetrics();
      }
    };
  }

  /**
   * Creates a helper for adding coverage-specific trace events
   *
   * @param {object} span - The span to add events to
   * @param {string} phase - The current resolution phase
   * @returns {object} Event logging utilities
   */
  createTraceEventHelper(span, phase) {
    assertNonBlankString(phase, 'Phase name', 'createTraceEventHelper', this.#logger);

    return {
      logCandidateFound(itemId, layer, priority) {
        span.addEvent(`candidate_found`, {
          phase: phase,
          itemId: itemId || 'unknown',
          layer: layer || 'unknown',
          priority: priority || 0
        });
      },

      logCandidateFiltered(itemId, reason) {
        span.addEvent(`candidate_filtered`, {
          phase: phase,
          itemId: itemId || 'unknown',
          reason: reason || 'unknown'
        });
      },

      logSelection(selectedItem, reason, totalCandidates) {
        span.addEvent(`selection_made`, {
          phase: phase,
          selectedItem: selectedItem || 'none',
          reason: reason || 'unknown',
          totalCandidates: totalCandidates || 0
        });
      },

      logPhaseComplete(duration, metrics = {}) {
        span.addEvent(`${phase}_complete`, {
          duration: duration,
          ...metrics
        });
      }
    };
  }
}

export default CoverageTracingEnhancer;