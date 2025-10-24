/**
 * @file JSON formatter for action traces
 * @see actionTraceOutputService.js
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';

/**
 * Formats action traces as JSON
 */
export class JsonTraceFormatter {
  #logger;
  #actionTraceFilter;
  #schemaVersion;
  #circularRefHandler;

  /**
   * Constructor
   *
   * @param {object} dependencies
   * @param {ILogger} dependencies.logger - Logger service
   * @param {IActionTraceFilter} dependencies.actionTraceFilter - Trace filter
   */
  constructor({ logger, actionTraceFilter }) {
    this.#logger = ensureValidLogger(logger, 'JsonTraceFormatter');

    validateDependency(actionTraceFilter, 'IActionTraceFilter', this.#logger, {
      requiredMethods: ['getVerbosityLevel', 'getInclusionConfig'],
    });

    this.#actionTraceFilter = actionTraceFilter;
    this.#schemaVersion = '1.0.0';
    this.#circularRefHandler = new WeakSet();
  }

  /**
   * Format trace as JSON
   *
   * @param {object} trace - Trace to format
   * @returns {string} JSON string
   */
  format(trace) {
    if (!trace) {
      this.#logger.warn('JsonTraceFormatter: Null trace provided');
      return '{}';
    }

    try {
      const formatted = this.#formatTrace(trace);
      const verbosity = this.#actionTraceFilter.getVerbosityLevel();
      const indent = this.#getIndentLevel(verbosity);

      return JSON.stringify(formatted, this.#createReplacer(), indent);
    } catch (error) {
      this.#logger.error('JsonTraceFormatter: Formatting error', error);
      return this.#createErrorOutput(trace, error);
    }
  }

  /**
   * Format trace based on type
   *
   * @private
   * @param {object} trace - Raw trace
   * @returns {object} Formatted trace
   */
  #formatTrace(trace) {
    if (this.#isExecutionTrace(trace)) {
      return this.#formatExecutionTrace(trace);
    } else if (this.#isPipelineTrace(trace)) {
      return this.#formatPipelineTrace(trace);
    } else {
      return this.#formatGenericTrace(trace);
    }
  }

  /**
   * Check if trace is an execution trace
   *
   * @param trace
   * @private
   */
  #isExecutionTrace(trace) {
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
    const config = this.#actionTraceFilter.getInclusionConfig();

    const formatted = {
      metadata: this.#createMetadata('execution'),
      actionId: trace.actionId,
      actorId: trace.actorId,
      timestamp: trace.execution?.startTime
        ? new Date(trace.execution.startTime).toISOString()
        : new Date().toISOString(),
    };

    if (verbosity !== 'minimal') {
      formatted.execution = {
        startTime: trace.execution?.startTime,
        endTime: trace.execution?.endTime,
        duration:
          trace.execution?.duration ||
          trace.execution?.endTime - trace.execution?.startTime,
        status: trace.execution?.result?.success ? 'success' : 'failed',
      };
    }

    if (verbosity === 'detailed' || verbosity === 'verbose') {
      if (trace.turnAction) {
        formatted.turnAction = this.#sanitizeTurnAction(trace.turnAction);
      }
    }

    if (config.componentData && trace.execution?.eventPayload) {
      formatted.eventPayload = this.#sanitizePayload(
        trace.execution.eventPayload
      );
    }

    if (trace.execution?.error) {
      formatted.error = this.#formatError(trace.execution.error);
    }

    return formatted;
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

    const formatted = {
      metadata: this.#createMetadata('pipeline'),
      timestamp: new Date().toISOString(),
      traceType: 'pipeline',
    };

    const tracedActions = trace.getTracedActions
      ? trace.getTracedActions()
      : new Map();

    formatted.actions = {};
    for (const [actionId, actionData] of tracedActions) {
      formatted.actions[actionId] = this.#formatActionData(
        actionId,
        actionData,
        verbosity,
        config
      );
    }

    if (verbosity !== 'minimal' && trace.getSpans) {
      const spans = trace.getSpans();
      if (spans && spans.length > 0) {
        formatted.spans = this.#formatSpans(spans, verbosity);
      }
    }

    formatted.summary = this.#createPipelineSummary(tracedActions);

    return formatted;
  }

  /**
   * Format individual action data from pipeline
   *
   * @param actionId
   * @param actionData
   * @param verbosity
   * @param config
   * @private
   */
  #formatActionData(actionId, actionData, verbosity, config) {
    const formatted = {
      actionId,
      actorId: actionData.actorId,
      startTime: actionData.startTime,
    };

    if (verbosity !== 'minimal' && actionData.stages) {
      formatted.stages = {};

      for (const [stageName, stageData] of Object.entries(actionData.stages)) {
        formatted.stages[stageName] = this.#formatStageData(
          stageName,
          stageData,
          verbosity,
          config
        );
      }
    }

    if (actionData.stages) {
      const timings = this.#calculateStageTiming(actionData.stages);
      formatted.timing = timings;
    }

    return formatted;
  }

  /**
   * Format stage data
   *
   * @param stageName
   * @param stageData
   * @param verbosity
   * @param config
   * @private
   */
  #formatStageData(stageName, stageData, verbosity, config) {
    const formatted = {
      timestamp: stageData.timestamp,
    };

    switch (stageName) {
      case 'component_filtering':
        if (config.componentData) {
          formatted.actorComponents = stageData.data?.actorComponents || [];
          formatted.requiredComponents =
            stageData.data?.requiredComponents || [];
          formatted.candidateCount = stageData.data?.candidateCount || 0;
        }
        break;

      case 'prerequisite_evaluation':
        if (config.prerequisites) {
          formatted.prerequisites = stageData.data?.prerequisites || [];
          formatted.passed = stageData.data?.passed || false;

          if (verbosity === 'verbose') {
            formatted.evaluationDetails = stageData.data?.evaluationDetails;
          }
        }
        break;

      case 'target_resolution':
        if (config.targets) {
          formatted.targetCount = stageData.data?.targetCount || 0;
          formatted.isLegacy = stageData.data?.isLegacy || false;

          if (verbosity !== 'minimal') {
            formatted.targetKeys = stageData.data?.targetKeys || [];
          }

          if (verbosity === 'detailed' || verbosity === 'verbose') {
            formatted.resolvedTargets = stageData.data?.resolvedTargets || {};
          }
        }
        break;

      case 'formatting':
        formatted.template = stageData.data?.template;
        formatted.formattedCommand = stageData.data?.formattedCommand;

        if (verbosity !== 'minimal') {
          formatted.displayName = stageData.data?.displayName;
          formatted.hasTargets = stageData.data?.hasTargets || false;
        }
        break;

      default:
        if (verbosity === 'verbose') {
          formatted.data = stageData.data;
        }
    }

    return formatted;
  }

  /**
   * Format generic trace
   *
   * @param trace
   * @private
   */
  #formatGenericTrace(trace) {
    // Reset circular ref handler for new sanitization
    this.#circularRefHandler = new WeakSet();

    return {
      metadata: this.#createMetadata('generic'),
      timestamp: new Date().toISOString(),
      data: this.#sanitizeObject(trace),
    };
  }

  /**
   * Create metadata header
   *
   * @param traceType
   * @private
   */
  #createMetadata(traceType) {
    return {
      version: this.#schemaVersion,
      type: traceType,
      generated: new Date().toISOString(),
      generator: 'ActionTraceOutputService',
    };
  }

  /**
   * Calculate stage timing statistics
   *
   * @param stages
   * @private
   */
  #calculateStageTiming(stages) {
    const timestamps = [];
    const stageTimings = {};

    for (const [stageName, stageData] of Object.entries(stages)) {
      if (stageData.timestamp) {
        timestamps.push({
          stage: stageName,
          time: stageData.timestamp,
        });
      }
    }

    timestamps.sort((a, b) => a.time - b.time);

    for (let i = 0; i < timestamps.length - 1; i++) {
      const current = timestamps[i];
      const next = timestamps[i + 1];
      stageTimings[current.stage] = {
        duration: next.time - current.time,
        startTime: current.time,
      };
    }

    if (timestamps.length > 0) {
      const last = timestamps[timestamps.length - 1];
      stageTimings[last.stage] = {
        startTime: last.time,
      };
    }

    if (timestamps.length >= 2) {
      const first = timestamps[0];
      const last = timestamps[timestamps.length - 1];
      stageTimings.total = last.time - first.time;
    }

    return stageTimings;
  }

  /**
   * Create pipeline summary
   *
   * @param tracedActions
   * @private
   */
  #createPipelineSummary(tracedActions) {
    const summary = {
      totalActions: tracedActions.size,
      stages: new Set(),
      totalDuration: 0,
    };

    for (const [actionId, actionData] of tracedActions) {
      if (actionData.stages) {
        Object.keys(actionData.stages).forEach((stage) => {
          summary.stages.add(stage);
        });
      }

      if (actionData.stages) {
        const timings = this.#calculateStageTiming(actionData.stages);
        if (timings.total) {
          summary.totalDuration += timings.total;
        }
      }
    }

    summary.stages = Array.from(summary.stages);
    summary.avgDuration =
      tracedActions.size > 0
        ? Math.round(summary.totalDuration / tracedActions.size)
        : 0;

    return summary;
  }

  /**
   * Format spans for output
   *
   * @param spans
   * @param verbosity
   * @private
   */
  #formatSpans(spans, verbosity) {
    return spans.map((span) => ({
      name: span.name,
      startTime: span.startTime,
      endTime: span.endTime,
      duration: span.endTime - span.startTime,
      ...(verbosity === 'verbose' ? { data: span.data } : {}),
    }));
  }

  /**
   * Sanitize turn action for output
   *
   * @param turnAction
   * @private
   */
  #sanitizeTurnAction(turnAction) {
    return {
      actionDefinitionId: turnAction.actionDefinitionId,
      commandString: turnAction.commandString,
      targetContexts: turnAction.targetContexts?.length || 0,
      ...(turnAction.resolvedTargets
        ? {
            resolvedTargets: Object.keys(turnAction.resolvedTargets),
          }
        : {}),
    };
  }

  /**
   * Sanitize event payload
   *
   * @param payload
   * @private
   */
  #sanitizePayload(payload) {
    const verbosity = this.#actionTraceFilter.getVerbosityLevel();

    if (verbosity === 'minimal') {
      return { type: payload.type || 'unknown' };
    }

    const sanitized = { ...payload };

    if (verbosity !== 'verbose') {
      delete sanitized.entityCache;
      delete sanitized.componentData;
    }

    return this.#sanitizeObject(sanitized);
  }

  /**
   * Format error object
   *
   * @param error
   * @private
   */
  #formatError(error) {
    if (!error) return null;

    const formatted = {
      message: error.message || 'Unknown error',
      type: error.type || error.constructor?.name || 'Error',
    };

    const verbosity = this.#actionTraceFilter.getVerbosityLevel();

    if (verbosity === 'detailed' || verbosity === 'verbose') {
      formatted.stack = error.stack;
    }

    if (verbosity === 'verbose' && error.context) {
      formatted.context = this.#sanitizeObject(error.context);
    }

    return formatted;
  }

  /**
   * Sanitize object for JSON serialization
   *
   * @param obj
   * @param depth
   * @private
   */
  #sanitizeObject(obj, depth = 0) {
    const maxDepth = 10;

    if (depth > maxDepth) {
      return '[Max depth exceeded]';
    }

    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'object') {
      if (this.#circularRefHandler.has(obj)) {
        return '[Circular reference]';
      }
      this.#circularRefHandler.add(obj);
    }

    if (obj instanceof Date) {
      return obj.toISOString();
    }

    if (obj instanceof Error) {
      return this.#formatError(obj);
    }

    if (obj instanceof Map) {
      const result = {};
      for (const [key, value] of obj) {
        result[String(key)] = this.#sanitizeObject(value, depth + 1);
      }
      return result;
    }

    if (obj instanceof Set) {
      return Array.from(obj).map((item) =>
        this.#sanitizeObject(item, depth + 1)
      );
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.#sanitizeObject(item, depth + 1));
    }

    if (typeof obj === 'object') {
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value !== 'function' && typeof value !== 'symbol') {
          result[key] = this.#sanitizeObject(value, depth + 1);
        }
      }
      return result;
    }

    return obj;
  }

  /**
   * Create JSON replacer function
   *
   * @private
   */
  #createReplacer() {
    const seen = new WeakSet();

    return (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }

      if (typeof value === 'bigint') {
        return value.toString();
      }

      if (value === undefined) {
        return null;
      }

      return value;
    };
  }

  /**
   * Get indentation level based on verbosity
   *
   * @param verbosity
   * @private
   */
  #getIndentLevel(verbosity) {
    switch (verbosity) {
      case 'minimal':
        return 0;
      case 'standard':
        return 2;
      case 'detailed':
      case 'verbose':
        return 2;
      default:
        return 2;
    }
  }

  /**
   * Create error output when formatting fails
   *
   * @param trace
   * @param error
   * @private
   */
  #createErrorOutput(trace, error) {
    return JSON.stringify(
      {
        metadata: this.#createMetadata('error'),
        error: {
          message: 'Failed to format trace',
          details: error.message,
        },
        rawTrace: {
          actionId: trace?.actionId || 'unknown',
          type: trace?.constructor?.name || 'unknown',
        },
      },
      null,
      2
    );
  }
}

export default JsonTraceFormatter;
