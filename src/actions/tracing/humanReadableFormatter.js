/**
 * @file Human-readable text formatter for action traces
 * @see jsonTraceFormatter.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';

/**
 * ANSI color codes for terminal output
 *
 * @enum {string}
 */
const Colors = {
  RESET: '\x1b[0m',
  BOLD: '\x1b[1m',
  DIM: '\x1b[2m',
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  MAGENTA: '\x1b[35m',
  CYAN: '\x1b[36m',
  WHITE: '\x1b[37m',
};

/**
 * Formats action traces as human-readable text
 */
export class HumanReadableFormatter {
  #logger;
  #actionTraceFilter;
  #enableColors;
  #lineWidth;
  #indentSize;
  #timeProvider;

  /**
   * Constructor
   *
   * @param {object} dependencies
   * @param {ILogger} dependencies.logger - Logger service
   * @param {IActionTraceFilter} dependencies.actionTraceFilter - Trace filter
   * @param {object} options - Formatter options
   * @param {Function} options.timeProvider - Function to get current time (defaults to Date.now)
   */
  constructor({ logger, actionTraceFilter }, options = {}) {
    this.#logger = ensureValidLogger(logger, 'HumanReadableFormatter');

    validateDependency(actionTraceFilter, 'IActionTraceFilter', null, {
      requiredMethods: ['getVerbosityLevel', 'getInclusionConfig'],
    });

    this.#actionTraceFilter = actionTraceFilter;
    this.#enableColors = options.enableColors || false;
    this.#lineWidth = options.lineWidth || 80;
    this.#indentSize = options.indentSize || 2;
    this.#timeProvider = options.timeProvider || (() => Date.now());
  }

  /**
   * Format trace as human-readable text
   *
   * @param {object} trace - Trace to format
   * @returns {string} Formatted text
   */
  format(trace) {
    if (!trace) {
      this.#logger.warn('HumanReadableFormatter: Null trace provided');
      return 'No trace data available\n';
    }

    try {
      // Determine trace type and format accordingly
      if (this.#isExecutionTrace(trace)) {
        return this.#formatExecutionTrace(trace);
      } else if (this.#isPipelineTrace(trace)) {
        return this.#formatPipelineTrace(trace);
      } else {
        return this.#formatGenericTrace(trace);
      }
    } catch (error) {
      this.#logger.error('HumanReadableFormatter: Formatting error', error);
      return this.#formatError(error, trace);
    }
  }

  /**
   * Check if trace is an execution trace
   *
   * @param trace
   * @private
   */
  #isExecutionTrace(trace) {
    // Note: Consider using instanceof if classes are available for import
    // e.g., trace instanceof ActionExecutionTrace
    // This would be more resilient to minification
    return (
      trace.constructor?.name === 'ActionExecutionTrace' ||
      (trace.actionId && trace.execution)
    );
  }

  /**
   * Check if trace is a pipeline trace
   *
   * @param trace
   * @private
   */
  #isPipelineTrace(trace) {
    // Note: Consider using instanceof if classes are available for import
    // e.g., trace instanceof ActionAwareStructuredTrace
    // This would be more resilient to minification
    return (
      trace.constructor?.name === 'ActionAwareStructuredTrace' ||
      (trace.getTracedActions && typeof trace.getTracedActions === 'function')
    );
  }

  /**
   * Format execution trace
   *
   * @param trace
   * @private
   */
  #formatExecutionTrace(trace) {
    const verbosity = this.#actionTraceFilter.getVerbosityLevel();
    const sections = [];

    // Header
    sections.push(this.#createHeader('ACTION EXECUTION TRACE'));

    // Basic Information
    sections.push(
      this.#createSection('Basic Information', [
        ['Action ID', this.#highlight(trace.actionId || 'unknown')],
        ['Actor ID', trace.actorId || 'unknown'],
        ['Timestamp', this.#formatTimestamp(trace.execution?.startTime)],
      ])
    );

    // Execution Details
    if (verbosity !== 'minimal' && trace.execution) {
      const duration =
        trace.execution.duration ||
        trace.execution.endTime - trace.execution.startTime;

      sections.push(
        this.#createSection('Execution Details', [
          ['Status', this.#formatStatus(trace.execution.result?.success)],
          ['Duration', this.#formatDuration(duration)],
          ['Start Time', this.#formatTimestamp(trace.execution.startTime)],
          ['End Time', this.#formatTimestamp(trace.execution.endTime)],
        ])
      );
    }

    // Turn Action Details
    if (
      (verbosity === 'detailed' || verbosity === 'verbose') &&
      trace.turnAction
    ) {
      sections.push(
        this.#createSection('Turn Action', [
          ['Command', trace.turnAction.commandString || 'N/A'],
          ['Action Definition', trace.turnAction.actionDefinitionId],
          ['Target Count', trace.turnAction.targetContexts?.length || 0],
        ])
      );
    }

    // Event Payload
    const hasExecution = Boolean(trace.execution);
    const hasEventPayload =
      hasExecution &&
      Object.prototype.hasOwnProperty.call(trace.execution, 'eventPayload');

    if (verbosity === 'verbose' && hasEventPayload) {
      sections.push(
        this.#createSection(
          'Event Payload',
          this.#formatObject(trace.execution.eventPayload, 1)
        )
      );
    }

    // Error Information
    if (trace.execution?.error) {
      sections.push(this.#formatErrorSection(trace.execution.error, verbosity));
    }

    // Footer
    sections.push(this.#createFooter());

    return sections.join('\n');
  }

  /**
   * Format pipeline trace
   *
   * @param trace
   * @private
   */
  #formatPipelineTrace(trace) {
    const verbosity = this.#actionTraceFilter.getVerbosityLevel();
    const config = this.#actionTraceFilter.getInclusionConfig();
    const sections = [];

    // Header
    sections.push(this.#createHeader('ACTION PIPELINE TRACE'));

    // Get traced actions
    const tracedActions = trace.getTracedActions
      ? trace.getTracedActions()
      : new Map();

    // Summary
    sections.push(
      this.#createSection('Summary', [
        ['Total Actions', tracedActions.size],
        ['Timestamp', this.#formatTimestamp(this.#timeProvider())],
        ['Trace Type', 'Pipeline'],
      ])
    );

    // Process each action
    for (const [actionId, actionData] of tracedActions) {
      sections.push(
        this.#formatPipelineAction(actionId, actionData, verbosity, config)
      );
    }

    // Spans
    if (verbosity !== 'minimal' && trace.getSpans) {
      const spans = trace.getSpans();
      if (spans && spans.length > 0) {
        sections.push(this.#formatSpansSection(spans, verbosity));
      }
    }

    // Performance Summary
    if (verbosity !== 'minimal') {
      sections.push(this.#createPerformanceSummary(tracedActions));
    }

    // Footer
    sections.push(this.#createFooter());

    return sections.join('\n');
  }

  /**
   * Format individual pipeline action
   *
   * @param actionId
   * @param actionData
   * @param verbosity
   * @param config
   * @private
   */
  #formatPipelineAction(actionId, actionData, verbosity, config) {
    const lines = [];

    // Action header
    lines.push(this.#createSeparator('─'));
    lines.push(this.#color(`ACTION: ${actionId}`, Colors.CYAN, true));
    lines.push(this.#createSeparator('─'));

    // Basic info
    lines.push(this.#indent('Actor: ' + actionData.actorId, 1));
    lines.push(
      this.#indent('Start: ' + this.#formatTimestamp(actionData.startTime), 1)
    );

    // Stages
    if (verbosity !== 'minimal' && actionData.stages) {
      lines.push('');
      lines.push(this.#indent('Pipeline Stages:', 1));
      lines.push('');

      const stageOrder = [
        'component_filtering',
        'prerequisite_evaluation',
        'target_resolution',
        'formatting',
      ];

      let stageNumber = 1;
      for (const stageName of stageOrder) {
        if (actionData.stages[stageName]) {
          lines.push(
            this.#formatStage(
              stageNumber++,
              stageName,
              actionData.stages[stageName],
              verbosity,
              config
            )
          );
        }
      }
    }

    // Timing summary
    if (actionData.stages) {
      const timing = this.#calculateTiming(actionData.stages);
      if (timing.total) {
        lines.push('');
        lines.push(
          this.#indent(
            `Total Pipeline Time: ${this.#formatDuration(timing.total)}`,
            1
          )
        );
      }
    }

    lines.push('');
    return lines.join('\n');
  }

  /**
   * Format pipeline stage
   *
   * @param number
   * @param stageName
   * @param stageData
   * @param verbosity
   * @param config
   * @private
   */
  #formatStage(number, stageName, stageData, verbosity, config) {
    const lines = [];
    const displayName = this.#formatStageName(stageName);

    lines.push(
      this.#indent(
        `${number}. ${this.#color(displayName, Colors.YELLOW)} ` +
          `(${this.#formatTimestamp(stageData.timestamp, true)})`,
        2
      )
    );

    // Stage-specific details
    const details = this.#getStageDetails(
      stageName,
      stageData.data,
      verbosity,
      config
    );

    if (details.length > 0) {
      for (const detail of details) {
        lines.push(this.#indent(`${detail}`, 3));
      }
    }

    return lines.join('\n');
  }

  /**
   * Get stage-specific details
   *
   * @param stageName
   * @param data
   * @param verbosity
   * @param config
   * @private
   */
  #getStageDetails(stageName, data, verbosity, config) {
    const details = [];

    switch (stageName) {
      case 'component_filtering':
        if (config.includeComponentData && data) {
          details.push(
            `Actor Components: ${data.actorComponents?.length || 0}`
          );
          details.push(
            `Required: ${data.requiredComponents?.join(', ') || 'none'}`
          );
          details.push(`Candidates Found: ${data.candidateCount || 0}`);
        }
        break;

      case 'prerequisite_evaluation':
        if (config.includePrerequisites && data) {
          const status = data.passed
            ? this.#color('PASSED', Colors.GREEN)
            : this.#color('FAILED', Colors.RED);
          details.push(`Result: ${status}`);

          if (verbosity === 'verbose' && data.prerequisites) {
            details.push(
              `Prerequisites: ${data.prerequisites.length} conditions`
            );
          }
        }
        break;

      case 'target_resolution':
        if (config.includeTargets && data) {
          details.push(`Targets Found: ${data.targetCount || 0}`);
          details.push(`Type: ${data.isLegacy ? 'Legacy' : 'Multi-target'}`);

          if (verbosity !== 'minimal' && data.targetKeys) {
            details.push(`Target Keys: ${data.targetKeys.join(', ')}`);
          }
        }
        break;

      case 'formatting':
        if (data) {
          details.push(`Template: "${data.template || 'N/A'}"`);
          if (verbosity !== 'minimal') {
            details.push(`Output: "${data.formattedCommand || 'N/A'}"`);
            details.push(`Display: "${data.displayName || 'N/A'}"`);
          }
        }
        break;
    }

    return details;
  }

  /**
   * Format generic trace
   *
   * @param trace
   * @private
   */
  #formatGenericTrace(trace) {
    const sections = [];

    sections.push(this.#createHeader('GENERIC TRACE'));
    sections.push(
      this.#createSection('Trace Data', this.#formatObject(trace, 0))
    );
    sections.push(this.#createFooter());

    return sections.join('\n');
  }

  /**
   * Create header section
   *
   * @param title
   * @private
   */
  #createHeader(title) {
    const lines = [];
    lines.push(this.#createSeparator('═'));
    lines.push(this.#center(this.#color(title, Colors.BOLD)));
    lines.push(this.#createSeparator('═'));
    lines.push(`Generated: ${new Date(this.#timeProvider()).toISOString()}`);
    lines.push('');
    return lines.join('\n');
  }

  /**
   * Create footer section
   *
   * @private
   */
  #createFooter() {
    return this.#createSeparator('═');
  }

  /**
   * Create a section with title and content
   *
   * @param title
   * @param content
   * @private
   */
  #createSection(title, content) {
    const lines = [];

    lines.push(this.#color(title.toUpperCase(), Colors.BOLD));
    lines.push(this.#createSeparator('─', title.length));

    if (Array.isArray(content)) {
      // Format as table
      // Use reduce to avoid stack overflow with large arrays
      const keyLengths = content.map(([key]) => key.length);
      const maxKeyLength = keyLengths.reduce(
        (max, len) => Math.max(max, len),
        0
      );

      for (const [key, value] of content) {
        const paddedKey = key.padEnd(maxKeyLength);
        lines.push(`${paddedKey} : ${value}`);
      }
    } else {
      // Format as text
      lines.push(content);
    }

    lines.push('');
    return lines.join('\n');
  }

  /**
   * Format error section
   *
   * @param error
   * @param verbosity
   * @private
   */
  #formatErrorSection(error, verbosity) {
    const lines = [];

    lines.push(this.#color('ERROR DETAILS', Colors.RED, true));
    lines.push(this.#createSeparator('─', 13));

    lines.push(`Message: ${error.message || 'Unknown error'}`);
    lines.push(`Type: ${error.type || 'Error'}`);

    if ((verbosity === 'detailed' || verbosity === 'verbose') && error.stack) {
      lines.push('');
      lines.push('Stack Trace:');
      lines.push(this.#indent(error.stack, 1));
    }

    if (verbosity === 'verbose' && error.context) {
      lines.push('');
      lines.push('Context:');
      lines.push(this.#formatObject(error.context, 1));
    }

    lines.push('');
    return lines.join('\n');
  }

  /**
   * Format spans section
   *
   * @param spans
   * @param verbosity
   * @private
   */
  #formatSpansSection(spans, verbosity) {
    const lines = [];

    lines.push(this.#color('TRACE SPANS', Colors.BOLD));
    lines.push(this.#createSeparator('─', 11));

    // Note: This method is only called when verbosity !== 'minimal' (see line 229)
    // so we don't need to check for minimal verbosity here
    for (const span of spans) {
      lines.push(
        this.#indent(
          `• ${span.name} (${this.#formatDuration(span.endTime - span.startTime)})`,
          1
        )
      );
    }

    lines.push('');
    return lines.join('\n');
  }

  /**
   * Create performance summary
   *
   * @param tracedActions
   * @private
   */
  #createPerformanceSummary(tracedActions) {
    const lines = [];
    const stats = this.#calculateStatistics(tracedActions);

    lines.push(this.#color('PERFORMANCE SUMMARY', Colors.BOLD));
    lines.push(this.#createSeparator('─', 19));

    lines.push(`Total Actions: ${stats.totalActions}`);
    lines.push(`Total Duration: ${this.#formatDuration(stats.totalDuration)}`);
    lines.push(`Average Duration: ${this.#formatDuration(stats.avgDuration)}`);
    lines.push(`Stages Executed: ${stats.stageCount}`);

    lines.push('');
    return lines.join('\n');
  }

  /**
   * Calculate statistics from traced actions
   *
   * @param tracedActions
   * @private
   */
  #calculateStatistics(tracedActions) {
    const stats = {
      totalActions: tracedActions.size,
      totalDuration: 0,
      avgDuration: 0,
      stageCount: 0,
    };

    for (const [actionId, actionData] of tracedActions) {
      if (actionData.stages) {
        stats.stageCount += Object.keys(actionData.stages).length;

        const timing = this.#calculateTiming(actionData.stages);
        if (timing.total) {
          stats.totalDuration += timing.total;
        }
      }
    }

    if (stats.totalActions > 0) {
      stats.avgDuration = Math.round(stats.totalDuration / stats.totalActions);
    }

    return stats;
  }

  /**
   * Calculate timing from stages
   *
   * @param stages
   * @private
   */
  #calculateTiming(stages) {
    const timestamps = Object.values(stages)
      .map((s) => s.timestamp)
      .filter((t) => t)
      .sort((a, b) => a - b);

    if (timestamps.length >= 2) {
      return {
        total: timestamps[timestamps.length - 1] - timestamps[0],
      };
    }

    return { total: 0 };
  }

  /**
   * Format object for display
   *
   * @param obj
   * @param indentLevel
   * @private
   */
  #formatObject(obj, indentLevel = 0) {
    const lines = [];

    if (obj === null || obj === undefined) {
      return 'null';
    }

    if (typeof obj !== 'object') {
      return String(obj);
    }

    for (const [key, value] of Object.entries(obj)) {
      const formattedKey = this.#indent(key + ':', indentLevel);

      if (typeof value === 'object' && value !== null) {
        lines.push(formattedKey);
        lines.push(this.#formatObject(value, indentLevel + 1));
      } else {
        lines.push(`${formattedKey} ${value}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Format timestamp
   *
   * @param timestamp
   * @param relative
   * @private
   */
  #formatTimestamp(timestamp, relative = false) {
    if (!timestamp) return 'N/A';

    const date = new Date(timestamp);

    if (relative) {
      // Return relative time format
      const now = this.#timeProvider();
      const diff = now - timestamp;
      return `+${this.#formatDuration(diff)}`;
    }

    return date.toISOString();
  }

  /**
   * Format duration in milliseconds
   *
   * @param ms
   * @private
   */
  #formatDuration(ms) {
    if (!ms && ms !== 0) return 'N/A';

    if (ms < 1) {
      return '<1ms';
    } else if (ms < 1000) {
      return `${Math.round(ms)}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(2)}s`;
    } else {
      const minutes = Math.floor(ms / 60000);
      const seconds = ((ms % 60000) / 1000).toFixed(1);
      return `${minutes}m ${seconds}s`;
    }
  }

  /**
   * Format status with color
   *
   * @param success
   * @private
   */
  #formatStatus(success) {
    if (success === undefined || success === null) {
      return 'UNKNOWN';
    }

    return success
      ? this.#color('SUCCESS', Colors.GREEN, true)
      : this.#color('FAILED', Colors.RED, true);
  }

  /**
   * Format stage name
   *
   * @param stageName
   * @private
   */
  #formatStageName(stageName) {
    return stageName
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Create separator line
   *
   * @param char
   * @param length
   * @private
   */
  #createSeparator(char = '─', length = null) {
    const len = length || this.#lineWidth;
    return char.repeat(len);
  }

  /**
   * Center text
   *
   * @param text
   * @private
   */
  #center(text) {
    // Strip ANSI codes to calculate actual text length
    const stripAnsi = (str) => str.replace(/\x1b\[[0-9;]*m/g, '');
    const actualLength = stripAnsi(text).length;
    const padding = Math.max(
      0,
      Math.floor((this.#lineWidth - actualLength) / 2)
    );
    return ' '.repeat(padding) + text;
  }

  /**
   * Indent text
   *
   * @param text
   * @param level
   * @private
   */
  #indent(text, level = 1) {
    const spaces = ' '.repeat(level * this.#indentSize);
    return text
      .split('\n')
      .map((line) => spaces + line)
      .join('\n');
  }

  /**
   * Highlight text
   *
   * @param text
   * @private
   */
  #highlight(text) {
    return this.#color(text, Colors.CYAN, true);
  }

  /**
   * Apply color to text
   *
   * @param text
   * @param color
   * @param bold
   * @private
   */
  #color(text, color, bold = false) {
    if (!this.#enableColors) {
      return text;
    }

    let result = '';

    if (bold) {
      result += Colors.BOLD;
    }

    result += color + text + Colors.RESET;

    return result;
  }

  /**
   * Format error output
   *
   * @param error
   * @param trace
   * @private
   */
  #formatError(error, trace) {
    const lines = [];

    lines.push(this.#createHeader('FORMATTING ERROR'));
    lines.push(this.#color('Failed to format trace', Colors.RED));
    lines.push(`Error: ${error.message}`);

    if (trace) {
      lines.push('');
      lines.push('Trace Info:');

      // Safely access actionId
      try {
        lines.push(`  Action ID: ${trace.actionId || 'unknown'}`);
      } catch (e) {
        lines.push(`  Action ID: <error accessing property>`);
      }

      // Safely access constructor name
      try {
        lines.push(`  Type: ${trace.constructor?.name || 'unknown'}`);
      } catch (e) {
        lines.push(`  Type: <error accessing property>`);
      }
    }

    lines.push(this.#createFooter());

    return lines.join('\n');
  }
}

export default HumanReadableFormatter;
