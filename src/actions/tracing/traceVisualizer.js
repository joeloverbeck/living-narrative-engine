/**
 * @file TraceVisualizer class for visualizing structured traces
 * @see structuredTrace.js
 * @see analysisTypes.js
 */

import {
  validateDependency,
  assertPresent,
} from '../../utils/dependencyUtils.js';

/** @typedef {import('./analysisTypes.js').VisualizationOptions} VisualizationOptions */
/** @typedef {import('./analysisTypes.js').WaterfallEntry} WaterfallEntry */
/** @typedef {import('./tracingInterfaces.js').IStructuredTrace} IStructuredTrace */

/**
 * @class TraceVisualizer
 * @description Provides visualization capabilities for structured traces
 */
export class TraceVisualizer {
  #structuredTrace;
  #defaultOptions;

  /**
   * Creates a new TraceVisualizer instance
   *
   * @param {IStructuredTrace} structuredTrace - The structured trace to visualize
   * @throws {Error} If structuredTrace is not provided or invalid
   */
  constructor(structuredTrace) {
    validateDependency(structuredTrace, 'IStructuredTrace', null, {
      requiredMethods: ['getSpans', 'getHierarchicalView', 'getCriticalPath'],
    });

    this.#structuredTrace = structuredTrace;
    this.#defaultOptions = {
      showAttributes: true,
      showTimings: true,
      showErrors: true,
      showCriticalPath: true,
      maxDepth: 0, // 0 = no limit
      minDuration: 0,
      colorsEnabled: true,
    };
  }

  /**
   * Displays a hierarchical tree view of the trace
   *
   * @param {VisualizationOptions} [options] - Visualization options
   * @returns {string} The formatted hierarchy output
   */
  displayHierarchy(options = {}) {
    const opts = { ...this.#defaultOptions, ...options };
    const hierarchicalView = this.#structuredTrace.getHierarchicalView();

    if (!hierarchicalView) {
      return 'No trace data available.';
    }

    const criticalPathOps = opts.showCriticalPath
      ? this.#structuredTrace.getCriticalPath()
      : [];
    const output = [];

    output.push(this.#formatHeader('Trace Hierarchy'));
    output.push('');

    this.#renderHierarchyNode(
      hierarchicalView,
      0,
      '',
      true,
      criticalPathOps,
      opts,
      output
    );

    return output.join('\n');
  }

  /**
   * Renders a single node in the hierarchy
   *
   * @private
   * @param {import('./analysisTypes.js').HierarchicalSpan} node - Node to render
   * @param {number} depth - Current depth
   * @param {string} prefix - Line prefix for indentation
   * @param {boolean} isLast - Whether this is the last child
   * @param {string[]} criticalPathOps - Operations on critical path
   * @param {VisualizationOptions} options - Visualization options
   * @param {string[]} output - Output array to append to
   */
  #renderHierarchyNode(
    node,
    depth,
    prefix,
    isLast,
    criticalPathOps,
    options,
    output
  ) {
    // Check depth limit
    if (options.maxDepth > 0 && depth > options.maxDepth) {
      return;
    }

    // Check duration filter
    if (node.duration !== null && node.duration < options.minDuration) {
      return;
    }

    const connector = isLast ? '└── ' : '├── ';
    const line = prefix + connector;

    // Format the operation name
    let operationText = node.operation;

    // Add critical path indicator
    if (options.showCriticalPath && criticalPathOps.includes(node.operation)) {
      operationText = this.#applyColor(
        operationText + ' [CRITICAL]',
        'yellow',
        options.colorsEnabled
      );
    }

    // Add timing information
    if (options.showTimings && node.duration !== null) {
      operationText += ` (${node.duration.toFixed(2)}ms)`;
    }

    // Add status indicator
    if (node.status === 'error') {
      operationText = this.#applyColor(
        operationText + ' ❌',
        'red',
        options.colorsEnabled
      );
    } else if (node.status === 'success') {
      operationText = this.#applyColor(
        operationText + ' ✅',
        'green',
        options.colorsEnabled
      );
    }

    output.push(line + operationText);

    // Show attributes if requested
    if (options.showAttributes && Object.keys(node.attributes).length > 0) {
      const attributePrefix = prefix + (isLast ? '    ' : '│   ') + '  ';
      for (const [key, value] of Object.entries(node.attributes)) {
        output.push(
          attributePrefix +
            this.#applyColor(
              `${key}: ${JSON.stringify(value)}`,
              'blue',
              options.colorsEnabled
            )
        );
      }
    }

    // Show error details if present and requested
    if (options.showErrors && node.error) {
      const errorPrefix = prefix + (isLast ? '    ' : '│   ') + '  ';
      output.push(
        errorPrefix +
          this.#applyColor(`Error: ${node.error}`, 'red', options.colorsEnabled)
      );
    }

    // Recursively render children
    const nextPrefix = prefix + (isLast ? '    ' : '│   ');
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const childIsLast = i === node.children.length - 1;

      this.#renderHierarchyNode(
        child,
        depth + 1,
        nextPrefix,
        childIsLast,
        criticalPathOps,
        options,
        output
      );
    }
  }

  /**
   * Displays a waterfall timeline view of the trace
   *
   * @param {VisualizationOptions} [options] - Visualization options
   * @returns {string} The formatted waterfall output
   */
  displayWaterfall(options = {}) {
    const opts = { ...this.#defaultOptions, ...options };
    const spans = this.#structuredTrace.getSpans();

    if (spans.length === 0) {
      return 'No trace data available.';
    }

    const completedSpans = spans.filter(
      (span) => span.startTime !== undefined && span.endTime !== null
    );

    if (completedSpans.length === 0) {
      return 'No completed spans available for waterfall display.';
    }

    const criticalPathOps = opts.showCriticalPath
      ? this.#structuredTrace.getCriticalPath()
      : [];

    // Create waterfall entries
    const entries = this.#createWaterfallEntries(
      completedSpans,
      criticalPathOps,
      opts
    );

    // Sort by start time
    entries.sort((a, b) => a.startTime - b.startTime);

    const output = [];
    output.push(this.#formatHeader('Trace Waterfall'));
    output.push('');

    // Find the overall timeline bounds
    const minTime = Math.min(...entries.map((e) => e.startTime));
    const maxTime = Math.max(...entries.map((e) => e.endTime));
    const timeRange = maxTime - minTime;

    // Render timeline header
    output.push(this.#renderTimelineHeader(minTime, maxTime, timeRange));
    output.push('');

    // Render each entry
    for (const entry of entries) {
      output.push(
        this.#renderWaterfallEntry(
          entry,
          minTime,
          timeRange,
          opts.colorsEnabled
        )
      );
    }

    return output.join('\n');
  }

  /**
   * Creates waterfall entries from spans
   *
   * @private
   * @param {import('./span.js').Span[]} spans - Completed spans
   * @param {string[]} criticalPathOps - Critical path operations
   * @param {VisualizationOptions} options - Visualization options
   * @returns {WaterfallEntry[]} Waterfall entries
   */
  #createWaterfallEntries(spans, criticalPathOps, options) {
    const entries = [];

    for (const span of spans) {
      // Apply filters
      if (span.duration < options.minDuration) {
        continue;
      }

      const depth = this.#calculateSpanDepth(span, spans);
      if (options.maxDepth > 0 && depth > options.maxDepth) {
        continue;
      }

      entries.push({
        operation: span.operation,
        startTime: span.startTime,
        endTime: span.endTime,
        duration: span.duration,
        depth,
        status: span.status,
        onCriticalPath: criticalPathOps.includes(span.operation),
      });
    }

    return entries;
  }

  /**
   * Calculates the depth of a span in the hierarchy
   *
   * @private
   * @param {import('./span.js').Span} span - The span
   * @param {import('./span.js').Span[]} allSpans - All spans
   * @returns {number} Depth level
   */
  #calculateSpanDepth(span, allSpans) {
    let depth = 0;
    let currentSpan = span;

    while (currentSpan.parentId !== null) {
      depth++;
      currentSpan = allSpans.find((s) => s.id === currentSpan.parentId);
      if (!currentSpan) break;
    }

    return depth;
  }

  /**
   * Renders the timeline header
   *
   * @private
   * @param {number} minTime - Minimum time
   * @param {number} maxTime - Maximum time
   * @param {number} timeRange - Time range
   * @returns {string} Timeline header
   */
  #renderTimelineHeader(minTime, maxTime, timeRange) {
    const width = 60; // Character width for timeline
    const markers = [];

    // Add time markers
    for (let i = 0; i <= 5; i++) {
      const time = minTime + (timeRange * i) / 5;
      markers.push(`${time.toFixed(1)}ms`);
    }

    const header = 'Timeline: ' + markers.join('  ');
    const ruler = '─'.repeat(width);

    return header + '\n' + ruler;
  }

  /**
   * Renders a single waterfall entry
   *
   * @private
   * @param {WaterfallEntry} entry - The entry to render
   * @param {number} minTime - Minimum time in trace
   * @param {number} timeRange - Total time range
   * @param {boolean} colorsEnabled - Whether to use colors
   * @returns {string} Rendered entry
   */
  #renderWaterfallEntry(entry, minTime, timeRange, colorsEnabled) {
    const width = 60;
    const indent = '  '.repeat(entry.depth);

    // Calculate bar position and width
    const relativeStart = entry.startTime - minTime;
    const startPos = Math.floor((relativeStart / timeRange) * width);
    const barWidth = Math.max(
      1,
      Math.floor((entry.duration / timeRange) * width)
    );

    // Create the timeline bar
    const spaces = ' '.repeat(startPos);
    let bar = '█'.repeat(barWidth);

    // Apply styling based on status and critical path
    if (entry.onCriticalPath) {
      bar = this.#applyColor(bar, 'yellow', colorsEnabled);
    } else if (entry.status === 'error') {
      bar = this.#applyColor(bar, 'red', colorsEnabled);
    } else {
      bar = this.#applyColor(bar, 'green', colorsEnabled);
    }

    // Format the operation name and duration
    let operationText = `${entry.operation} (${entry.duration.toFixed(2)}ms)`;

    if (entry.onCriticalPath) {
      operationText = this.#applyColor(
        operationText + ' [CRITICAL]',
        'yellow',
        colorsEnabled
      );
    }

    return `${indent}${operationText}\n${indent}${spaces}${bar}`;
  }

  /**
   * Displays a summary of trace metrics
   *
   * @param {VisualizationOptions} [options] - Visualization options
   * @returns {string} The formatted summary output
   */
  displaySummary(options = {}) {
    const opts = { ...this.#defaultOptions, ...options };
    const summary = this.#structuredTrace.getPerformanceSummary();

    const output = [];
    output.push(this.#formatHeader('Trace Summary'));
    output.push('');

    // Basic metrics
    output.push(`Total Duration: ${summary.totalDuration.toFixed(2)}ms`);
    output.push(`Operation Count: ${summary.operationCount}`);
    output.push(`Error Count: ${summary.errorCount}`);
    output.push('');

    // Critical path
    if (summary.criticalPath.length > 0) {
      output.push('Critical Path:');
      for (const op of summary.criticalPath) {
        output.push(
          `  • ${this.#applyColor(op, 'yellow', opts.colorsEnabled)}`
        );
      }
      output.push('');
    }

    // Slowest operations
    if (summary.slowestOperations.length > 0) {
      output.push('Slowest Operations:');
      for (const op of summary.slowestOperations.slice(0, 5)) {
        output.push(`  • ${op.operation}: ${op.duration.toFixed(2)}ms`);
      }
      output.push('');
    }

    // Operation statistics
    if (Object.keys(summary.operationStats).length > 0) {
      output.push('Operation Time Distribution:');
      const sortedOps = Object.entries(summary.operationStats).sort(
        (a, b) => b[1] - a[1]
      );

      for (const [operation, duration] of sortedOps.slice(0, 5)) {
        const percentage = ((duration / summary.totalDuration) * 100).toFixed(
          1
        );
        output.push(
          `  • ${operation}: ${percentage}% (${duration.toFixed(2)}ms)`
        );
      }
    }

    return output.join('\n');
  }

  /**
   * Displays errors with highlighting
   *
   * @param {VisualizationOptions} [options] - Visualization options
   * @returns {string} The formatted error output
   */
  displayErrors(options = {}) {
    const opts = { ...this.#defaultOptions, ...options };
    const spans = this.#structuredTrace.getSpans();
    const errorSpans = spans.filter((span) => span.status === 'error');

    if (errorSpans.length === 0) {
      return 'No errors found in trace.';
    }

    const output = [];
    output.push(this.#formatHeader('Trace Errors'));
    output.push('');

    output.push(
      this.#applyColor(
        `Found ${errorSpans.length} error(s):`,
        'red',
        opts.colorsEnabled
      )
    );
    output.push('');

    for (let i = 0; i < errorSpans.length; i++) {
      const span = errorSpans[i];
      const errorNum = i + 1;

      output.push(
        this.#applyColor(
          `${errorNum}. ${span.operation}`,
          'red',
          opts.colorsEnabled
        )
      );

      if (opts.showTimings && span.duration !== null) {
        output.push(`   Duration: ${span.duration.toFixed(2)}ms`);
      }

      if (span.error) {
        output.push(`   Error: ${span.error.message}`);
      }

      if (opts.showAttributes && Object.keys(span.attributes).length > 0) {
        output.push('   Attributes:');
        for (const [key, value] of Object.entries(span.attributes)) {
          output.push(
            `     ${key}: ${this.#applyColor(
              JSON.stringify(value),
              'blue',
              opts.colorsEnabled
            )}`
          );
        }
      }

      output.push('');
    }

    return output.join('\n');
  }

  /**
   * Formats a section header
   *
   * @private
   * @param {string} title - Header title
   * @returns {string} Formatted header
   */
  #formatHeader(title) {
    const line = '='.repeat(Math.max(title.length, 50));
    return `${line}\n${title}\n${line}`;
  }

  /**
   * Applies ANSI color codes to text
   *
   * @private
   * @param {string} text - Text to colorize
   * @param {string} color - Color name
   * @param {boolean} enabled - Whether colors are enabled
   * @returns {string} Colorized text
   */
  #applyColor(text, color, enabled) {
    if (!enabled) {
      return text;
    }

    const colors = {
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      reset: '\x1b[0m',
    };

    return `${colors[color] || ''}${text}${colors.reset}`;
  }

  /**
   * Gets all visualization outputs as an object
   *
   * @param {VisualizationOptions} [options] - Visualization options
   * @returns {object} All visualization outputs
   */
  getAllDisplays(options = {}) {
    return {
      hierarchy: this.displayHierarchy(options),
      waterfall: this.displayWaterfall(options),
      summary: this.displaySummary(options),
      errors: this.displayErrors(options),
    };
  }
}

export default TraceVisualizer;
