# ACTTRA-026: Add JSON Output Formatter

## Summary

Implement a comprehensive JSON output formatter for action traces that creates structured, schema-compliant JSON files with proper formatting, data organization, and metadata inclusion. The formatter should handle all trace types and verbosity levels while maintaining consistency and readability.

## Status

- **Type**: Implementation
- **Priority**: Medium
- **Complexity**: Low
- **Estimated Time**: 2 hours
- **Dependencies**:
  - ACTTRA-024 (ActionTraceOutputService)
  - ACTTRA-019 (ActionExecutionTrace)
  - ACTTRA-009 (ActionAwareStructuredTrace)

## Objectives

### Primary Goals

1. **Create JSON Formatter** - Structured JSON output generation
2. **Schema Compliance** - Ensure output matches defined schemas
3. **Verbosity Support** - Adapt output based on verbosity level
4. **Data Organization** - Logical structure for easy consumption
5. **Metadata Inclusion** - Add context and timing information
6. **Safe Serialization** - Handle circular references and special types

### Success Criteria

- [ ] JSON output validates against schema
- [ ] All trace types properly formatted
- [ ] Verbosity levels control detail level
- [ ] Circular references handled safely
- [ ] Special types (Date, Error) serialized correctly
- [ ] Output is human-readable with indentation
- [ ] File size optimized based on verbosity
- [ ] Consistent structure across trace types

## Technical Specification

### 1. JSON Formatter Implementation

#### File: `src/actions/tracing/jsonTraceFormatter.js`

```javascript
/**
 * @file JSON formatter for action traces
 * @see actionTraceOutputService.js
 */

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
   * @param {object} dependencies
   * @param {ILogger} dependencies.logger - Logger service
   * @param {IActionTraceFilter} dependencies.actionTraceFilter - Trace filter
   */
  constructor({ logger, actionTraceFilter }) {
    this.#logger = ensureValidLogger(logger, 'JsonTraceFormatter');

    validateDependency(actionTraceFilter, 'IActionTraceFilter', null, {
      requiredMethods: ['getVerbosityLevel', 'getInclusionConfig'],
    });

    this.#actionTraceFilter = actionTraceFilter;
    this.#schemaVersion = '1.0.0';
    this.#circularRefHandler = new WeakSet();
  }

  /**
   * Format trace as JSON
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
   * @private
   * @param {object} trace - Raw trace
   * @returns {object} Formatted trace
   */
  #formatTrace(trace) {
    // Determine trace type and format accordingly
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

    // Add execution details based on verbosity
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

    // Add turn action details if verbose
    if (verbosity === 'detailed' || verbosity === 'verbose') {
      if (trace.turnAction) {
        formatted.turnAction = this.#sanitizeTurnAction(trace.turnAction);
      }
    }

    // Add event payload if verbose and configured
    if (verbosity === 'verbose' && config.includeComponentData) {
      if (trace.execution?.eventPayload) {
        formatted.eventPayload = this.#sanitizePayload(
          trace.execution.eventPayload
        );
      }
    }

    // Add error details if present
    if (trace.execution?.error) {
      formatted.error = this.#formatError(trace.execution.error);
    }

    return formatted;
  }

  /**
   * Format pipeline trace
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

    // Get traced actions
    const tracedActions = trace.getTracedActions
      ? trace.getTracedActions()
      : new Map();

    // Format each traced action
    formatted.actions = {};
    for (const [actionId, actionData] of tracedActions) {
      formatted.actions[actionId] = this.#formatActionData(
        actionId,
        actionData,
        verbosity,
        config
      );
    }

    // Add spans if available and not minimal
    if (verbosity !== 'minimal' && trace.getSpans) {
      const spans = trace.getSpans();
      if (spans && spans.length > 0) {
        formatted.spans = this.#formatSpans(spans, verbosity);
      }
    }

    // Add summary statistics
    formatted.summary = this.#createPipelineSummary(tracedActions);

    return formatted;
  }

  /**
   * Format individual action data from pipeline
   * @private
   */
  #formatActionData(actionId, actionData, verbosity, config) {
    const formatted = {
      actionId,
      actorId: actionData.actorId,
      startTime: actionData.startTime,
    };

    // Add stages based on verbosity
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

    // Calculate and add timing
    if (actionData.stages) {
      const timings = this.#calculateStageTiming(actionData.stages);
      formatted.timing = timings;
    }

    return formatted;
  }

  /**
   * Format stage data
   * @private
   */
  #formatStageData(stageName, stageData, verbosity, config) {
    const formatted = {
      timestamp: stageData.timestamp,
    };

    // Handle different stages based on configuration
    switch (stageName) {
      case 'component_filtering':
        if (config.includeComponentData) {
          formatted.actorComponents = stageData.data?.actorComponents || [];
          formatted.requiredComponents =
            stageData.data?.requiredComponents || [];
          formatted.candidateCount = stageData.data?.candidateCount || 0;
        }
        break;

      case 'prerequisite_evaluation':
        if (config.includePrerequisites) {
          formatted.prerequisites = stageData.data?.prerequisites || [];
          formatted.passed = stageData.data?.passed || false;

          if (verbosity === 'verbose') {
            formatted.evaluationDetails = stageData.data?.evaluationDetails;
          }
        }
        break;

      case 'target_resolution':
        if (config.includeTargets) {
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
        // Include raw data for unknown stages in verbose mode
        if (verbosity === 'verbose') {
          formatted.data = stageData.data;
        }
    }

    return formatted;
  }

  /**
   * Format generic trace
   * @private
   */
  #formatGenericTrace(trace) {
    return {
      metadata: this.#createMetadata('generic'),
      timestamp: new Date().toISOString(),
      data: this.#sanitizeObject(trace),
    };
  }

  /**
   * Create metadata header
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
   * @private
   */
  #calculateStageTiming(stages) {
    const timestamps = [];
    const stageTimings = {};

    // Collect all timestamps
    for (const [stageName, stageData] of Object.entries(stages)) {
      if (stageData.timestamp) {
        timestamps.push({
          stage: stageName,
          time: stageData.timestamp,
        });
      }
    }

    // Sort by timestamp
    timestamps.sort((a, b) => a.time - b.time);

    // Calculate durations
    for (let i = 0; i < timestamps.length - 1; i++) {
      const current = timestamps[i];
      const next = timestamps[i + 1];
      stageTimings[current.stage] = {
        duration: next.time - current.time,
        startTime: current.time,
      };
    }

    // Add last stage (no end time)
    if (timestamps.length > 0) {
      const last = timestamps[timestamps.length - 1];
      stageTimings[last.stage] = {
        startTime: last.time,
      };
    }

    // Calculate total
    if (timestamps.length >= 2) {
      const first = timestamps[0];
      const last = timestamps[timestamps.length - 1];
      stageTimings.total = last.time - first.time;
    }

    return stageTimings;
  }

  /**
   * Create pipeline summary
   * @private
   */
  #createPipelineSummary(tracedActions) {
    const summary = {
      totalActions: tracedActions.size,
      stages: new Set(),
      totalDuration: 0,
    };

    for (const [actionId, actionData] of tracedActions) {
      // Collect unique stages
      if (actionData.stages) {
        Object.keys(actionData.stages).forEach((stage) => {
          summary.stages.add(stage);
        });
      }

      // Calculate total duration
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
   * @private
   */
  #formatSpans(spans, verbosity) {
    if (verbosity === 'minimal') {
      return spans.length;
    }

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
   * @private
   */
  #sanitizePayload(payload) {
    const verbosity = this.#actionTraceFilter.getVerbosityLevel();

    if (verbosity === 'minimal') {
      return { type: payload.type || 'unknown' };
    }

    // Remove sensitive or large data
    const sanitized = { ...payload };

    // Remove large objects based on verbosity
    if (verbosity !== 'verbose') {
      delete sanitized.entityCache;
      delete sanitized.componentData;
    }

    return this.#sanitizeObject(sanitized);
  }

  /**
   * Format error object
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

    // Handle circular references
    if (typeof obj === 'object') {
      if (this.#circularRefHandler.has(obj)) {
        return '[Circular reference]';
      }
      this.#circularRefHandler.add(obj);
    }

    // Handle special types
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
        // Skip functions and symbols
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
   * @private
   */
  #createReplacer() {
    const seen = new WeakSet();

    return (key, value) => {
      // Handle circular references
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }

      // Handle BigInt
      if (typeof value === 'bigint') {
        return value.toString();
      }

      // Handle undefined (convert to null for JSON)
      if (value === undefined) {
        return null;
      }

      return value;
    };
  }

  /**
   * Get indentation level based on verbosity
   * @private
   */
  #getIndentLevel(verbosity) {
    switch (verbosity) {
      case 'minimal':
        return 0; // No indentation
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
```

### 2. JSON Schema Definition

#### File: `data/schemas/action-trace-output.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "action-trace-output.schema.json",
  "title": "Action Trace Output",
  "description": "Schema for action trace JSON output",
  "type": "object",
  "properties": {
    "metadata": {
      "type": "object",
      "properties": {
        "version": { "type": "string" },
        "type": {
          "type": "string",
          "enum": ["execution", "pipeline", "generic", "error"]
        },
        "generated": { "type": "string", "format": "date-time" },
        "generator": { "type": "string" }
      },
      "required": ["version", "type", "generated"]
    },
    "actionId": { "type": "string" },
    "actorId": { "type": "string" },
    "timestamp": { "type": "string", "format": "date-time" },
    "execution": {
      "type": "object",
      "properties": {
        "startTime": { "type": "number" },
        "endTime": { "type": "number" },
        "duration": { "type": "number" },
        "status": { "type": "string", "enum": ["success", "failed"] }
      }
    },
    "actions": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "properties": {
          "actionId": { "type": "string" },
          "actorId": { "type": "string" },
          "startTime": { "type": "number" },
          "stages": { "type": "object" },
          "timing": { "type": "object" }
        }
      }
    },
    "error": {
      "type": "object",
      "properties": {
        "message": { "type": "string" },
        "type": { "type": "string" },
        "stack": { "type": "string" },
        "context": { "type": "object" }
      }
    }
  },
  "required": ["metadata", "timestamp"]
}
```

## Implementation Notes

### Verbosity Levels

1. **Minimal**
   - Essential data only
   - No indentation
   - Smallest file size
   - Basic error info

2. **Standard**
   - Common use case data
   - 2-space indentation
   - Moderate detail
   - Error messages

3. **Detailed**
   - Comprehensive data
   - Full stage information
   - Error stacks
   - Target details

4. **Verbose**
   - Everything available
   - Component data
   - Event payloads
   - Debug information

### Data Safety

1. **Circular References**
   - WeakSet tracking
   - Replacer function
   - Fallback handling

2. **Special Types**
   - Date to ISO string
   - Error to object
   - Map/Set to arrays/objects
   - BigInt to string

## Testing Requirements

### Unit Tests

```javascript
// tests/unit/actions/tracing/jsonTraceFormatter.unit.test.js

describe('JsonTraceFormatter - Formatting', () => {
  it('should format execution traces correctly');
  it('should format pipeline traces correctly');
  it('should handle verbosity levels');
  it('should include/exclude data based on config');
  it('should handle circular references');
  it('should format errors properly');
  it('should sanitize sensitive data');
  it('should validate against schema');
});
```

## Dependencies

- `IActionTraceFilter` - Configuration and verbosity
- `ILogger` - Error logging
- JSON Schema for validation

## Next Steps

1. **ACTTRA-027** - Add human-readable output formatter
2. **ACTTRA-028** - Implement file rotation policies

---

**Ticket Status**: Ready for Implementation
**Last Updated**: 2025-01-10
**Author**: System Architect
