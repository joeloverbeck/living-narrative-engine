/**
 * @file Coverage resolution trace formatter that integrates with existing trace output patterns
 * @description Extends existing HumanReadableFormatter patterns for coverage-specific trace formatting
 * @see ../../actions/tracing/humanReadableFormatter.js
 * @see ./coverageTracingEnhancer.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { assertPresent } from '../../utils/dependencyUtils.js';

/**
 * Coverage resolution trace formatter that integrates with existing infrastructure
 */
export class CoverageResolutionTraceFormatter {
  #logger;

  /**
   * Constructor
   *
   * @param {object} dependencies - Injected dependencies
   * @param {object} dependencies.humanReadableFormatter - Existing human-readable formatter (validated but not stored)
   * @param {object} dependencies.logger - Logging service
   */
  constructor({ humanReadableFormatter, logger }) {
    validateDependency(
      humanReadableFormatter,
      'IHumanReadableFormatter',
      logger,
      {
        requiredMethods: ['format'],
      }
    );
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    // humanReadableFormatter is validated but not stored as we implement our own formatting
    this.#logger = logger;
  }

  /**
   * Format structured trace spans for coverage resolution
   *
   * @param {object} structuredTrace - The structured trace containing coverage resolution spans
   * @returns {string} Formatted coverage resolution trace
   */
  formatCoverageTrace(structuredTrace) {
    assertPresent(structuredTrace, 'Structured trace is required');

    try {
      const coverageSpan = this.#findCoverageResolutionSpan(structuredTrace);
      if (!coverageSpan) {
        this.#logger.warn(
          'No coverage resolution trace data found in structured trace'
        );
        return 'No coverage resolution trace data found';
      }

      const output = [];
      output.push('\n=== Coverage Resolution Trace ===');

      // Basic info from span attributes
      const attrs = coverageSpan.getAttributes
        ? coverageSpan.getAttributes()
        : coverageSpan.attributes || {};
      output.push(`Target Slot: ${attrs.targetSlot || 'unknown'}`);
      output.push(`Mode: ${attrs.mode || 'unknown'}`);
      output.push(`Strategy: ${attrs.strategy || 'unknown'}`);

      const duration = this.#calculateSpanDuration(coverageSpan);
      if (duration !== null) {
        output.push(`Duration: ${this.#formatDuration(duration)}ms\n`);
      } else {
        output.push('Duration: calculating...\n');
      }

      // Phase breakdown from child spans
      const childSpans = this.#getChildSpans(coverageSpan, structuredTrace);

      if (childSpans.node_analysis) {
        output.push(this.#formatNodeAnalysis(childSpans.node_analysis));
      }

      if (childSpans.candidate_collection) {
        output.push(
          this.#formatCandidateCollection(childSpans.candidate_collection)
        );
      }

      if (childSpans.priority_calculation) {
        output.push(
          this.#formatPriorityCalculation(childSpans.priority_calculation)
        );
      }

      if (childSpans.mode_filtering) {
        output.push(this.#formatModeFiltering(childSpans.mode_filtering));
      }

      if (childSpans.final_selection) {
        output.push(this.#formatFinalSelection(childSpans.final_selection));
      }

      // Final selection summary
      output.push('\n--- Final Result ---');

      // Try to get selectedItem from multiple sources
      let selectedItem = attrs.selectedItem;

      // First try: main span attributes (enhanced by CoverageTracingEnhancer)
      if (!selectedItem && childSpans.final_selection) {
        const finalSelectionAttrs = childSpans.final_selection.getAttributes
          ? childSpans.final_selection.getAttributes()
          : childSpans.final_selection.attributes || {};
        selectedItem = finalSelectionAttrs.selectedItem;
      }

      // Display the selected item or fallback information
      if (selectedItem && selectedItem !== 'none') {
        output.push(`Selected: ${selectedItem}`);
      } else if (attrs.resultCount > 0) {
        output.push(`Selected: ${attrs.resultCount} items`);
      } else {
        output.push(`Selected: None`);
      }

      output.push(`Result Count: ${attrs.resultCount || 0}`);
      output.push(`Success: ${attrs.success !== false ? 'Yes' : 'No'}`);

      return output.join('\n');
    } catch (error) {
      this.#logger.error('Error formatting coverage trace:', error);
      return this.#formatError(error, structuredTrace);
    }
  }

  /**
   * Find the coverage resolution span in the structured trace
   *
   * @private
   * @param {object} structuredTrace - The structured trace
   * @returns {object|null} The coverage resolution span or null if not found
   */
  #findCoverageResolutionSpan(structuredTrace) {
    // Try different methods to get spans
    let spans = [];

    if (structuredTrace.getSpans) {
      spans = structuredTrace.getSpans();
    } else if (structuredTrace.spans) {
      spans = Array.isArray(structuredTrace.spans)
        ? structuredTrace.spans
        : Array.from(structuredTrace.spans.values());
    }

    // Find span with operation name 'coverage_resolution'
    return (
      spans.find(
        (span) =>
          span.operation === 'coverage_resolution' ||
          span.name === 'coverage_resolution'
      ) || null
    );
  }

  /**
   * Get child spans of a parent span
   *
   * @private
   * @param {object} parentSpan - The parent span
   * @param {object} structuredTrace - The structured trace
   * @returns {object} Map of child span names to spans
   */
  #getChildSpans(parentSpan, structuredTrace) {
    const childSpans = {};

    try {
      let allSpans = [];

      if (structuredTrace.getSpans) {
        allSpans = structuredTrace.getSpans();
      } else if (structuredTrace.spans) {
        allSpans = Array.isArray(structuredTrace.spans)
          ? structuredTrace.spans
          : Array.from(structuredTrace.spans.values());
      }

      // Find child spans by parent ID
      const parentId = parentSpan.id || parentSpan.spanId;
      if (parentId) {
        for (const span of allSpans) {
          if (span.parentId === parentId || span.parent === parentId) {
            const operation = span.operation || span.name;
            if (operation) {
              childSpans[operation] = span;
            }
          }
        }
      }

      // Also check if parent span has direct children property
      if (parentSpan.children && Array.isArray(parentSpan.children)) {
        for (const child of parentSpan.children) {
          const operation = child.operation || child.name;
          if (operation) {
            childSpans[operation] = child;
          }
        }
      }
    } catch (error) {
      this.#logger.warn('Error getting child spans:', error);
    }

    return childSpans;
  }

  /**
   * Format node analysis phase
   *
   * @private
   * @param {object} span - The node analysis span
   * @returns {string} Formatted output
   */
  #formatNodeAnalysis(span) {
    const attrs = span.getAttributes
      ? span.getAttributes()
      : span.attributes || {};
    // Events not used in this formatter method
    // const events = span.getEvents ? span.getEvents() : span.events || [];

    const output = [];
    output.push('--- Node Analysis ---');
    output.push(`Node Type: ${attrs.nodeType || 'unknown'}`);
    output.push(`Field: ${attrs.field || 'unknown'}`);
    output.push(`Has Parent: ${attrs.hasParent ? 'Yes' : 'No'}`);
    output.push(`Parent Field: ${attrs.parentField || 'none'}`);
    output.push(`Result Count: ${attrs.resultCount || 0}`);

    const duration = this.#calculateSpanDuration(span);
    if (duration !== null) {
      output.push(`Duration: ${this.#formatDuration(duration)}ms`);
    }

    return output.join('\n') + '\n';
  }

  /**
   * Format candidate collection phase
   *
   * @private
   * @param {object} span - The candidate collection span
   * @returns {string} Formatted output
   */
  #formatCandidateCollection(span) {
    const attrs = span.getAttributes
      ? span.getAttributes()
      : span.attributes || {};
    const events = span.getEvents ? span.getEvents() : span.events || [];

    const output = [];
    output.push('--- Candidate Collection ---');
    output.push(`Total Found: ${attrs.totalCandidatesFound || 0}`);
    output.push(`Checked Layers: [${(attrs.checkedLayers || []).join(', ')}]`);
    output.push(
      `Available Layers: [${(attrs.availableLayers || []).join(', ')}]`
    );

    // Show individual candidates from events
    const candidateEvents = events.filter(
      (e) =>
        e.name === 'candidate_found' ||
        (e.attributes && e.attributes.phase === 'candidate_collection')
    );

    if (candidateEvents.length > 0) {
      output.push('\nCandidates:');
      candidateEvents.forEach((event) => {
        const eventAttrs = event.attributes || {};
        const itemId = eventAttrs.itemId || 'unknown';
        const layer = eventAttrs.layer || 'unknown';
        const priority =
          eventAttrs.priority || eventAttrs.coveragePriority || 'unknown';
        output.push(`  ${itemId} (layer: ${layer}, priority: ${priority})`);
      });
    }

    return output.join('\n') + '\n';
  }

  /**
   * Format priority calculation phase
   *
   * @private
   * @param {object} span - The priority calculation span
   * @returns {string} Formatted output
   */
  #formatPriorityCalculation(span) {
    const attrs = span.getAttributes
      ? span.getAttributes()
      : span.attributes || {};
    const events = span.getEvents ? span.getEvents() : span.events || [];

    const output = [];
    output.push('--- Priority Calculation ---');
    output.push(`Calculation Method: ${attrs.calculationMethod || 'standard'}`);
    output.push(`Total Calculations: ${attrs.totalCalculations || 0}`);

    const duration = this.#calculateSpanDuration(span);
    if (duration !== null) {
      output.push(`Calculation Time: ${this.#formatDuration(duration)}ms`);
    }

    // Show priority calculations from events
    const priorityEvents = events.filter(
      (e) =>
        e.name === 'priority_calculated' ||
        (e.attributes && e.attributes.phase === 'priority_calculation')
    );

    if (priorityEvents.length > 0) {
      output.push('\nPriority Results:');
      priorityEvents.forEach((event) => {
        const eventAttrs = event.attributes || {};
        const itemId = eventAttrs.itemId || 'unknown';
        const priority =
          eventAttrs.priority || eventAttrs.finalScore || 'unknown';
        const method = eventAttrs.method || eventAttrs.calculationMethod || '';
        output.push(
          `  ${itemId}: priority ${priority}${method ? ` (${method})` : ''}`
        );
      });
    }

    return output.join('\n') + '\n';
  }

  /**
   * Format mode filtering phase
   *
   * @private
   * @param {object} span - The mode filtering span
   * @returns {string} Formatted output
   */
  #formatModeFiltering(span) {
    const attrs = span.getAttributes
      ? span.getAttributes()
      : span.attributes || {};
    const events = span.getEvents ? span.getEvents() : span.events || [];

    const output = [];
    output.push('--- Mode Filtering ---');
    output.push(`Original Count: ${attrs.originalCount || 0}`);
    output.push(`Filtered Count: ${attrs.filteredCount || 0}`);
    output.push(`Mode: ${attrs.mode || 'unknown'}`);

    const duration = this.#calculateSpanDuration(span);
    if (duration !== null) {
      output.push(`Filtering Time: ${this.#formatDuration(duration)}ms`);
    }

    // Show filtered candidates from events
    const filterEvents = events.filter(
      (e) =>
        e.name === 'candidate_filtered' ||
        (e.attributes && e.attributes.phase === 'mode_filtering')
    );

    if (filterEvents.length > 0) {
      output.push('\nFiltered Out:');
      filterEvents.forEach((event) => {
        const eventAttrs = event.attributes || {};
        const itemId = eventAttrs.itemId || 'unknown';
        const reason =
          eventAttrs.reason || eventAttrs.exclusionReason || 'unknown';
        output.push(`  ${itemId} (${reason})`);
      });
    }

    return output.join('\n') + '\n';
  }

  /**
   * Format final selection phase
   *
   * @private
   * @param {object} span - The final selection span
   * @returns {string} Formatted output
   */
  #formatFinalSelection(span) {
    const attrs = span.getAttributes
      ? span.getAttributes()
      : span.attributes || {};
    const events = span.getEvents ? span.getEvents() : span.events || [];

    const output = [];
    output.push('--- Final Selection ---');
    output.push(`Selected Item: ${attrs.selectedItem || 'none'}`);
    output.push(
      `Selection Reason: ${attrs.selectionReason || attrs.reason || 'highest priority'}`
    );
    output.push(`Tie Breaking Used: ${attrs.tieBreakingUsed ? 'Yes' : 'No'}`);
    output.push(
      `Final Candidates: ${attrs.finalCandidates || attrs.totalCandidates || 0}`
    );

    const duration = this.#calculateSpanDuration(span);
    if (duration !== null) {
      output.push(`Selection Time: ${this.#formatDuration(duration)}ms`);
    }

    // Show selection process from events
    const selectionEvents = events.filter(
      (e) =>
        e.name === 'selection_made' ||
        (e.attributes && e.attributes.phase === 'final_selection')
    );

    if (selectionEvents.length > 0) {
      output.push('\nSelection Process:');
      selectionEvents.forEach((event) => {
        const eventAttrs = event.attributes || {};
        const selectedItem = eventAttrs.selectedItem || 'none';
        const reason = eventAttrs.reason || 'unknown';
        const totalCandidates = eventAttrs.totalCandidates || 0;
        output.push(
          `  Selected: ${selectedItem} from ${totalCandidates} candidates (${reason})`
        );
      });
    }

    return output.join('\n') + '\n';
  }

  /**
   * Calculate span duration
   *
   * @private
   * @param {object} span - The span
   * @returns {number|null} Duration in milliseconds or null if not available
   */
  #calculateSpanDuration(span) {
    try {
      if (span.duration !== undefined && span.duration !== null) {
        return span.duration;
      }

      if (span.endTime && span.startTime) {
        return span.endTime - span.startTime;
      }

      if (span.getDuration && typeof span.getDuration === 'function') {
        return span.getDuration();
      }

      return null;
    } catch (error) {
      this.#logger.debug('Error calculating span duration:', error);
      return null;
    }
  }

  /**
   * Format duration in milliseconds
   *
   * @private
   * @param {number} ms - Duration in milliseconds
   * @returns {string} Formatted duration
   */
  #formatDuration(ms) {
    if (!ms && ms !== 0) return 'N/A';

    if (ms < 1) {
      return '<1';
    } else if (ms < 1000) {
      return `${Math.round(ms)}`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(2)}s`;
    } else {
      const minutes = Math.floor(ms / 60000);
      const seconds = ((ms % 60000) / 1000).toFixed(1);
      return `${minutes}m ${seconds}s`;
    }
  }

  /**
   * Format error output when trace formatting fails
   *
   * @private
   * @param {Error} error - The formatting error
   * @param {object} structuredTrace - The original structured trace
   * @returns {string} Error formatted output
   */
  #formatError(error, structuredTrace) {
    const output = [];

    output.push('\n=== Coverage Resolution Trace Formatting Error ===');
    output.push(`Error: ${error.message}`);
    output.push(`Type: ${error.constructor.name}`);

    // Try to provide some basic info about the trace
    try {
      if (structuredTrace) {
        let spanCount = 0;
        if (structuredTrace.getSpans) {
          spanCount = structuredTrace.getSpans().length;
        } else if (structuredTrace.spans) {
          spanCount = Array.isArray(structuredTrace.spans)
            ? structuredTrace.spans.length
            : structuredTrace.spans.size;
        }

        output.push(`Trace spans available: ${spanCount}`);
      }
    } catch {
      output.push('Unable to analyze trace structure');
    }

    output.push('\nPlease check trace configuration and span structure.');

    return output.join('\n');
  }
}

export default CoverageResolutionTraceFormatter;
