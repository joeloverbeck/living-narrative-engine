# ACTTRA-022: Add Error Capture to Execution Traces

## Summary

Implement comprehensive error capture and handling mechanisms for action execution traces, providing detailed error information, stack traces, error classification, and recovery context. This system will enable developers to quickly identify, categorize, and debug action execution failures while maintaining system stability and providing actionable error information for debugging and monitoring purposes.

## Status

- **Type**: Implementation
- **Priority**: High
- **Complexity**: Low
- **Estimated Time**: 2 hours
- **Dependencies**: ACTTRA-019 (ActionExecutionTrace) - timing integration already complete

## Objectives

### Primary Goals

1. **Comprehensive Error Information** - Capture complete error context including messages, types, stack traces
2. **Error Classification** - Categorize errors by type, severity, and recovery potential
3. **Context Preservation** - Maintain execution context at the point of error occurrence
4. **Stack Trace Analysis** - Provide useful stack trace information for debugging
5. **Error Recovery Guidance** - Suggest potential recovery actions or troubleshooting steps
6. **Performance Impact Minimization** - Ensure error capture doesn't significantly impact performance

### Success Criteria

- [ ] All error types are captured with appropriate detail level
- [ ] Stack traces are preserved and formatted for readability
- [ ] Error context includes timing, phase, and execution state information
- [ ] Error classification enables automated categorization and filtering
- [ ] Error capture works for both synchronous and asynchronous errors
- [ ] Error information is included in trace JSON output with proper structure
- [ ] Performance overhead for error capture is <1ms per error

## Technical Specification

### 1. Error Classification System

#### File: `src/actions/tracing/errorClassification.js`

```javascript
/**
 * @file Error classification system for execution traces
 * Provides categorization and analysis of errors during action execution
 */

/**
 * Error categories for classification
 */
export const ERROR_CATEGORIES = {
  VALIDATION: 'validation',
  AUTHORIZATION: 'authorization',
  RESOURCE: 'resource',
  NETWORK: 'network',
  TIMEOUT: 'timeout',
  LOGIC: 'logic',
  SYSTEM: 'system',
  UNKNOWN: 'unknown',
};

/**
 * Error severity levels
 */
export const ERROR_SEVERITY = {
  CRITICAL: 'critical', // System failure, requires immediate attention
  HIGH: 'high', // Action failure, user impacted
  MEDIUM: 'medium', // Degraded functionality, workaround available
  LOW: 'low', // Minor issue, minimal impact
  INFO: 'info', // Informational, not a real error
};

/**
 * Recovery potential classification
 */
export const RECOVERY_POTENTIAL = {
  IMMEDIATE: 'immediate', // Can retry immediately
  DELAYED: 'delayed', // Can retry after delay
  CONDITIONAL: 'conditional', // Can retry under certain conditions
  MANUAL: 'manual', // Requires manual intervention
  PERMANENT: 'permanent', // Cannot be retried
};

/**
 * Error classifier for analyzing and categorizing errors
 */
export class ErrorClassifier {
  #classificationRules;
  #logger;

  constructor({ logger }) {
    this.#logger = logger;
    this.#initializeClassificationRules();
  }

  /**
   * Classify an error and provide analysis
   * @param {Error} error - Error to classify
   * @param {Object} context - Execution context
   * @returns {Object} Error classification and analysis
   */
  classifyError(error, context = {}) {
    const classification = {
      category: this.#determineCategory(error),
      severity: this.#determineSeverity(error, context),
      recoveryPotential: this.#determineRecoveryPotential(error, context),
      isTransient: this.#isTransientError(error),
      isRetryable: this.#isRetryableError(error),
      confidence: 1.0,
    };

    // Add specific analysis
    classification.analysis = this.#analyzeError(
      error,
      context,
      classification
    );

    // Add troubleshooting suggestions
    classification.troubleshooting = this.#generateTroubleshootingSteps(
      error,
      classification
    );

    return classification;
  }

  /**
   * Initialize classification rules
   * @private
   */
  #initializeClassificationRules() {
    this.#classificationRules = new Map([
      // Validation errors
      [
        /validation|invalid|required|missing/i,
        {
          category: ERROR_CATEGORIES.VALIDATION,
          severity: ERROR_SEVERITY.MEDIUM,
          recovery: RECOVERY_POTENTIAL.IMMEDIATE,
        },
      ],

      // Authorization/Permission errors
      [
        /unauthorized|forbidden|permission|access/i,
        {
          category: ERROR_CATEGORIES.AUTHORIZATION,
          severity: ERROR_SEVERITY.HIGH,
          recovery: RECOVERY_POTENTIAL.MANUAL,
        },
      ],

      // Resource errors
      [
        /not found|resource|file|entity/i,
        {
          category: ERROR_CATEGORIES.RESOURCE,
          severity: ERROR_SEVERITY.MEDIUM,
          recovery: RECOVERY_POTENTIAL.CONDITIONAL,
        },
      ],

      // Network errors
      [
        /network|connection|timeout|fetch|http/i,
        {
          category: ERROR_CATEGORIES.NETWORK,
          severity: ERROR_SEVERITY.MEDIUM,
          recovery: RECOVERY_POTENTIAL.DELAYED,
        },
      ],

      // Timeout errors
      [
        /timeout|expired|deadline/i,
        {
          category: ERROR_CATEGORIES.TIMEOUT,
          severity: ERROR_SEVERITY.MEDIUM,
          recovery: RECOVERY_POTENTIAL.DELAYED,
        },
      ],

      // Logic errors
      [
        /logic|assertion|invariant|state/i,
        {
          category: ERROR_CATEGORIES.LOGIC,
          severity: ERROR_SEVERITY.HIGH,
          recovery: RECOVERY_POTENTIAL.MANUAL,
        },
      ],

      // System errors
      [
        /system|internal|server|critical/i,
        {
          category: ERROR_CATEGORIES.SYSTEM,
          severity: ERROR_SEVERITY.CRITICAL,
          recovery: RECOVERY_POTENTIAL.MANUAL,
        },
      ],
    ]);
  }

  /**
   * Determine error category
   * @private
   * @param {Error} error - Error to categorize
   * @returns {string} Error category
   */
  #determineCategory(error) {
    const errorMessage = error.message || '';
    const errorType = error.constructor.name || '';
    const combined = `${errorMessage} ${errorType}`;

    for (const [pattern, rule] of this.#classificationRules) {
      if (pattern.test(combined)) {
        return rule.category;
      }
    }

    // Check for specific error types
    if (error.name === 'TypeError') return ERROR_CATEGORIES.LOGIC;
    if (error.name === 'ReferenceError') return ERROR_CATEGORIES.LOGIC;
    if (error.name === 'SyntaxError') return ERROR_CATEGORIES.LOGIC;
    if (error.name === 'RangeError') return ERROR_CATEGORIES.VALIDATION;

    return ERROR_CATEGORIES.UNKNOWN;
  }

  /**
   * Determine error severity
   * @private
   * @param {Error} error - Error to analyze
   * @param {Object} context - Execution context
   * @returns {string} Error severity
   */
  #determineSeverity(error, context) {
    // Check context for severity indicators
    if (context.phase === 'initialization') {
      return ERROR_SEVERITY.CRITICAL; // Early failures are often critical
    }

    if (context.isRetry) {
      return ERROR_SEVERITY.HIGH; // Retry failures are more severe
    }

    // Check error patterns
    const errorMessage = (error.message || '').toLowerCase();

    if (errorMessage.includes('critical') || errorMessage.includes('fatal')) {
      return ERROR_SEVERITY.CRITICAL;
    }

    if (
      errorMessage.includes('warning') ||
      errorMessage.includes('deprecated')
    ) {
      return ERROR_SEVERITY.LOW;
    }

    // Default based on category
    const category = this.#determineCategory(error);
    switch (category) {
      case ERROR_CATEGORIES.SYSTEM:
        return ERROR_SEVERITY.CRITICAL;
      case ERROR_CATEGORIES.AUTHORIZATION:
      case ERROR_CATEGORIES.LOGIC:
        return ERROR_SEVERITY.HIGH;
      case ERROR_CATEGORIES.VALIDATION:
      case ERROR_CATEGORIES.RESOURCE:
      case ERROR_CATEGORIES.NETWORK:
      case ERROR_CATEGORIES.TIMEOUT:
        return ERROR_SEVERITY.MEDIUM;
      default:
        return ERROR_SEVERITY.LOW;
    }
  }

  /**
   * Determine recovery potential
   * @private
   * @param {Error} error - Error to analyze
   * @param {Object} context - Execution context
   * @returns {string} Recovery potential
   */
  #determineRecoveryPotential(error, context) {
    const category = this.#determineCategory(error);

    // Context-based recovery assessment
    if (context.retryCount >= 3) {
      return RECOVERY_POTENTIAL.MANUAL; // Too many retries
    }

    // Category-based recovery
    switch (category) {
      case ERROR_CATEGORIES.VALIDATION:
        return RECOVERY_POTENTIAL.IMMEDIATE; // Can fix validation and retry
      case ERROR_CATEGORIES.NETWORK:
      case ERROR_CATEGORIES.TIMEOUT:
        return RECOVERY_POTENTIAL.DELAYED; // Retry after delay
      case ERROR_CATEGORIES.RESOURCE:
        return RECOVERY_POTENTIAL.CONDITIONAL; // Retry if resource available
      case ERROR_CATEGORIES.AUTHORIZATION:
      case ERROR_CATEGORIES.SYSTEM:
        return RECOVERY_POTENTIAL.MANUAL; // Requires intervention
      case ERROR_CATEGORIES.LOGIC:
        return RECOVERY_POTENTIAL.PERMANENT; // Logic errors don't retry
      default:
        return RECOVERY_POTENTIAL.CONDITIONAL;
    }
  }

  /**
   * Check if error is transient
   * @private
   * @param {Error} error - Error to check
   * @returns {boolean} True if transient
   */
  #isTransientError(error) {
    const transientPatterns = [
      /timeout/i,
      /connection/i,
      /network/i,
      /temporary/i,
      /busy/i,
      /throttled/i,
    ];

    const errorMessage = error.message || '';
    return transientPatterns.some((pattern) => pattern.test(errorMessage));
  }

  /**
   * Check if error is retryable
   * @private
   * @param {Error} error - Error to check
   * @returns {boolean} True if retryable
   */
  #isRetryableError(error) {
    const recovery = this.#determineRecoveryPotential(error, {});
    return (
      recovery === RECOVERY_POTENTIAL.IMMEDIATE ||
      recovery === RECOVERY_POTENTIAL.DELAYED ||
      recovery === RECOVERY_POTENTIAL.CONDITIONAL
    );
  }

  /**
   * Analyze error for additional insights
   * @private
   * @param {Error} error - Error to analyze
   * @param {Object} context - Execution context
   * @param {Object} classification - Error classification
   * @returns {Object} Error analysis
   */
  #analyzeError(error, context, classification) {
    return {
      errorType: error.constructor.name,
      hasStackTrace: Boolean(error.stack),
      stackDepth: error.stack ? error.stack.split('\n').length - 1 : 0,
      hasCause: Boolean(error.cause),
      contextPhase: context.phase || 'unknown',
      contextTiming: context.timing || null,
      isAsyncError: this.#isAsyncError(error),
      potentialCauses: this.#identifyPotentialCauses(error, context),
    };
  }

  /**
   * Generate troubleshooting steps
   * @private
   * @param {Error} error - Error to analyze
   * @param {Object} classification - Error classification
   * @returns {Array<string>} Troubleshooting steps
   */
  #generateTroubleshootingSteps(error, classification) {
    const steps = [];

    switch (classification.category) {
      case ERROR_CATEGORIES.VALIDATION:
        steps.push(
          'Check input parameters for required fields and correct types'
        );
        steps.push('Verify data format matches expected schema');
        steps.push('Validate business rules are satisfied');
        break;

      case ERROR_CATEGORIES.AUTHORIZATION:
        steps.push('Verify user has required permissions');
        steps.push('Check authentication token is valid and not expired');
        steps.push('Confirm role-based access control configuration');
        break;

      case ERROR_CATEGORIES.RESOURCE:
        steps.push('Verify referenced resource exists');
        steps.push('Check resource permissions and accessibility');
        steps.push('Confirm resource identifiers are correct');
        break;

      case ERROR_CATEGORIES.NETWORK:
        steps.push('Check network connectivity');
        steps.push('Verify service endpoints are reachable');
        steps.push('Review firewall and proxy configurations');
        break;

      case ERROR_CATEGORIES.TIMEOUT:
        steps.push('Check for performance bottlenecks');
        steps.push('Review timeout configuration settings');
        steps.push('Monitor resource usage and availability');
        break;

      case ERROR_CATEGORIES.LOGIC:
        steps.push('Review business logic implementation');
        steps.push('Check for null/undefined values');
        steps.push('Verify algorithm correctness and edge cases');
        break;

      case ERROR_CATEGORIES.SYSTEM:
        steps.push('Check system logs for additional details');
        steps.push('Monitor system resource usage');
        steps.push('Review system configuration and health');
        break;

      default:
        steps.push('Review error message and stack trace');
        steps.push('Check system logs for related errors');
        steps.push('Verify system configuration and dependencies');
    }

    // Add retry guidance if appropriate
    if (classification.isRetryable) {
      switch (classification.recoveryPotential) {
        case RECOVERY_POTENTIAL.IMMEDIATE:
          steps.push('Can retry immediately after addressing the issue');
          break;
        case RECOVERY_POTENTIAL.DELAYED:
          steps.push('Retry after a short delay (5-30 seconds)');
          break;
        case RECOVERY_POTENTIAL.CONDITIONAL:
          steps.push('Retry only after confirming conditions are met');
          break;
      }
    }

    return steps;
  }

  /**
   * Check if error is from async operation
   * @private
   * @param {Error} error - Error to check
   * @returns {boolean} True if async error
   */
  #isAsyncError(error) {
    if (!error.stack) return false;

    const asyncPatterns = [
      /async/i,
      /await/i,
      /Promise/i,
      /setTimeout/i,
      /setInterval/i,
    ];

    return asyncPatterns.some((pattern) => pattern.test(error.stack));
  }

  /**
   * Identify potential causes
   * @private
   * @param {Error} error - Error to analyze
   * @param {Object} context - Execution context
   * @returns {Array<string>} Potential causes
   */
  #identifyPotentialCauses(error, context) {
    const causes = [];
    const errorMessage = (error.message || '').toLowerCase();

    // Common cause patterns
    if (errorMessage.includes('null') || errorMessage.includes('undefined')) {
      causes.push('Null or undefined value in data processing');
    }

    if (
      errorMessage.includes('permission') ||
      errorMessage.includes('access')
    ) {
      causes.push('Insufficient permissions or access rights');
    }

    if (errorMessage.includes('timeout') || errorMessage.includes('deadline')) {
      causes.push('Operation exceeded time limits');
    }

    if (
      errorMessage.includes('network') ||
      errorMessage.includes('connection')
    ) {
      causes.push('Network connectivity or service availability issues');
    }

    if (context.phase === 'initialization') {
      causes.push('Configuration or dependency initialization failure');
    }

    if (context.retryCount > 0) {
      causes.push('Persistent issue not resolved by previous retry attempts');
    }

    return causes.length > 0
      ? causes
      : ['Unknown cause - requires investigation'];
  }
}
```

### 2. Stack Trace Analysis

#### File: `src/actions/tracing/stackTraceAnalyzer.js`

```javascript
/**
 * @file Stack trace analysis for error capture
 * Provides detailed analysis and formatting of JavaScript stack traces
 */

/**
 * Stack trace analyzer for processing and formatting error stack traces
 */
export class StackTraceAnalyzer {
  #projectPath;
  #logger;

  constructor({ projectPath = process.cwd(), logger }) {
    this.#projectPath = projectPath;
    this.#logger = logger;
  }

  /**
   * Parse and analyze a stack trace
   * @param {string} stackTrace - Raw stack trace string
   * @returns {Object} Parsed stack trace information
   */
  parseStackTrace(stackTrace) {
    if (!stackTrace || typeof stackTrace !== 'string') {
      return this.#createEmptyStackTrace();
    }

    const lines = stackTrace.split('\n');
    const frames = [];
    let errorMessage = '';

    // First line is usually the error message
    if (lines.length > 0 && !lines[0].trim().startsWith('at ')) {
      errorMessage = lines[0].trim();
    }

    // Parse stack frames
    lines.forEach((line, index) => {
      if (line.trim().startsWith('at ')) {
        const frame = this.#parseStackFrame(line.trim());
        if (frame) {
          frame.index = index;
          frames.push(frame);
        }
      }
    });

    return {
      errorMessage,
      frames,
      frameCount: frames.length,
      hasProjectFrames: frames.some((f) => f.isProjectCode),
      topProjectFrame: frames.find((f) => f.isProjectCode) || null,
      analysis: this.#analyzeStackTrace(frames),
    };
  }

  /**
   * Parse individual stack frame
   * @private
   * @param {string} line - Stack frame line
   * @returns {Object|null} Parsed frame or null if invalid
   */
  #parseStackFrame(line) {
    // Remove 'at ' prefix
    const cleaned = line.replace(/^\s*at\s+/, '');

    // Try to match different stack frame formats
    const patterns = [
      // Function at file:line:column
      /^(.+?)\s+\((.+):(\d+):(\d+)\)$/,
      // Anonymous function at file:line:column
      /^(.+):(\d+):(\d+)$/,
      // Function with no location info
      /^(.+)$/,
    ];

    for (const pattern of patterns) {
      const match = cleaned.match(pattern);
      if (match) {
        return this.#buildFrameObject(match);
      }
    }

    return null;
  }

  /**
   * Build frame object from regex match
   * @private
   * @param {Array} match - Regex match array
   * @returns {Object} Stack frame object
   */
  #buildFrameObject(match) {
    let functionName, fileName, lineNumber, columnNumber;

    if (match.length === 5) {
      // Function at file:line:column
      [, functionName, fileName, lineNumber, columnNumber] = match;
    } else if (match.length === 4) {
      // Anonymous function at file:line:column
      [, fileName, lineNumber, columnNumber] = match;
      functionName = '<anonymous>';
    } else {
      // Function name only
      functionName = match[1];
      fileName = '<unknown>';
      lineNumber = null;
      columnNumber = null;
    }

    return {
      functionName: functionName.trim(),
      fileName: fileName ? fileName.trim() : '<unknown>',
      lineNumber: lineNumber ? parseInt(lineNumber, 10) : null,
      columnNumber: columnNumber ? parseInt(columnNumber, 10) : null,
      isProjectCode: this.#isProjectCode(fileName),
      isNodeModules: fileName && fileName.includes('node_modules'),
      isNativeCode:
        fileName === '<unknown>' ||
        (fileName && fileName.includes('[native code]')),
      shortFileName: this.#getShortFileName(fileName),
    };
  }

  /**
   * Check if file is project code
   * @private
   * @param {string} fileName - File name to check
   * @returns {boolean} True if project code
   */
  #isProjectCode(fileName) {
    if (!fileName || fileName === '<unknown>') {
      return false;
    }

    // Normalize paths for comparison
    const normalizedFile = fileName.replace(/\\/g, '/');
    const normalizedProject = this.#projectPath.replace(/\\/g, '/');

    return (
      normalizedFile.includes(normalizedProject) &&
      !normalizedFile.includes('node_modules')
    );
  }

  /**
   * Get short file name for display
   * @private
   * @param {string} fileName - Full file path
   * @returns {string} Short file name
   */
  #getShortFileName(fileName) {
    if (!fileName || fileName === '<unknown>') {
      return '<unknown>';
    }

    // Extract just the file name and immediate parent directory
    const parts = fileName.split(/[/\\]/);
    if (parts.length >= 2) {
      return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
    }

    return parts[parts.length - 1];
  }

  /**
   * Analyze stack trace patterns
   * @private
   * @param {Array} frames - Stack frames
   * @returns {Object} Stack trace analysis
   */
  #analyzeStackTrace(frames) {
    const projectFrames = frames.filter((f) => f.isProjectCode);
    const nodeModulesFrames = frames.filter((f) => f.isNodeModules);
    const nativeFrames = frames.filter((f) => f.isNativeCode);

    return {
      totalFrames: frames.length,
      projectFrames: projectFrames.length,
      nodeModulesFrames: nodeModulesFrames.length,
      nativeFrames: nativeFrames.length,
      hasAsyncFrames: frames.some((f) => f.functionName.includes('async')),
      deepestProjectFrame: projectFrames[projectFrames.length - 1] || null,
      callDepth: frames.length,
      isShallow: frames.length <= 3,
      isDeep: frames.length > 20,
      uniqueFiles: [...new Set(frames.map((f) => f.fileName))].length,
    };
  }

  /**
   * Format stack trace for human readability
   * @param {Object} parsedTrace - Parsed stack trace
   * @param {Object} options - Formatting options
   * @returns {string} Formatted stack trace
   */
  formatStackTrace(parsedTrace, options = {}) {
    const {
      showProjectOnly = false,
      maxFrames = 20,
      includeLineNumbers = true,
      includeAnalysis = false,
    } = options;

    if (!parsedTrace || !parsedTrace.frames) {
      return 'No stack trace available';
    }

    const lines = [];

    // Add error message if available
    if (parsedTrace.errorMessage) {
      lines.push(`Error: ${parsedTrace.errorMessage}`);
      lines.push('');
    }

    // Filter and limit frames
    let frames = parsedTrace.frames;
    if (showProjectOnly) {
      frames = frames.filter((f) => f.isProjectCode);
    }
    frames = frames.slice(0, maxFrames);

    // Format frames
    frames.forEach((frame, index) => {
      let line = `  ${index + 1}. ${frame.functionName}`;

      if (frame.fileName !== '<unknown>') {
        line += ` (${frame.shortFileName}`;

        if (includeLineNumbers && frame.lineNumber) {
          line += `:${frame.lineNumber}`;
          if (frame.columnNumber) {
            line += `:${frame.columnNumber}`;
          }
        }

        line += ')';
      }

      // Add markers for special frame types
      if (frame.isProjectCode) {
        line += ' [PROJECT]';
      } else if (frame.isNodeModules) {
        line += ' [DEPENDENCY]';
      } else if (frame.isNativeCode) {
        line += ' [NATIVE]';
      }

      lines.push(line);
    });

    // Add truncation notice if frames were limited
    if (parsedTrace.frames.length > maxFrames) {
      lines.push(
        `  ... (${parsedTrace.frames.length - maxFrames} more frames)`
      );
    }

    // Add analysis if requested
    if (includeAnalysis && parsedTrace.analysis) {
      lines.push('');
      lines.push('Analysis:');
      lines.push(`  Total frames: ${parsedTrace.analysis.totalFrames}`);
      lines.push(`  Project frames: ${parsedTrace.analysis.projectFrames}`);
      lines.push(`  Call depth: ${parsedTrace.analysis.callDepth}`);
      if (parsedTrace.analysis.hasAsyncFrames) {
        lines.push('  Contains async calls');
      }
    }

    return lines.join('\n');
  }

  /**
   * Create empty stack trace object
   * @private
   * @returns {Object} Empty stack trace
   */
  #createEmptyStackTrace() {
    return {
      errorMessage: '',
      frames: [],
      frameCount: 0,
      hasProjectFrames: false,
      topProjectFrame: null,
      analysis: {
        totalFrames: 0,
        projectFrames: 0,
        nodeModulesFrames: 0,
        nativeFrames: 0,
        hasAsyncFrames: false,
        deepestProjectFrame: null,
        callDepth: 0,
        isShallow: true,
        isDeep: false,
        uniqueFiles: 0,
      },
    };
  }

  /**
   * Extract error location from stack trace
   * @param {Object} parsedTrace - Parsed stack trace
   * @returns {Object|null} Error location info
   */
  getErrorLocation(parsedTrace) {
    if (!parsedTrace || !parsedTrace.frames) {
      return null;
    }

    // Prefer project code frames
    const projectFrame = parsedTrace.frames.find((f) => f.isProjectCode);
    const firstFrame = parsedTrace.frames[0];

    const frame = projectFrame || firstFrame;

    if (!frame) {
      return null;
    }

    return {
      file: frame.fileName,
      shortFile: frame.shortFileName,
      function: frame.functionName,
      line: frame.lineNumber,
      column: frame.columnNumber,
      isProjectCode: frame.isProjectCode,
    };
  }
}
```

### 3. Enhanced ActionExecutionTrace with Error Capture

#### File: `src/actions/tracing/actionExecutionTrace.js` (Enhanced)

```javascript
// Additional imports for error handling
import { ErrorClassifier } from './errorClassification.js';
import { StackTraceAnalyzer } from './stackTraceAnalyzer.js';

/**
 * Enhanced ActionExecutionTrace with comprehensive error capture
 * Note: This enhances the existing ActionExecutionTrace class which already has:
 * - Basic error capture via captureError(error) method
 * - Timing integration via ExecutionPhaseTimer
 * - Constructor with enableTiming parameter
 */
export class ActionExecutionTrace {
  // ... existing fields ...
  #errorClassifier;
  #stackTraceAnalyzer;
  #errorContext;

  constructor({
    actionId,
    actorId,
    turnAction,
    enableTiming = true,
    enableErrorAnalysis = true, // NEW PARAMETER - add to existing constructor
  }) {
    // ... existing constructor code remains unchanged ...

    // NEW FUNCTIONALITY - add to existing constructor
    if (enableErrorAnalysis) {
      this.#errorClassifier = new ErrorClassifier({
        logger: console, // Fallback logger
      });
      this.#stackTraceAnalyzer = new StackTraceAnalyzer({
        projectPath: process.cwd(),
        logger: console,
      });
    }

    this.#errorContext = {
      phase: null,
      timing: null,
      retryCount: 0,
      executionState: {},
    };
  }

  /**
   * Enhanced error capture with comprehensive analysis
   * ENHANCEMENT: Modify existing captureError(error) method to:
   * captureError(error, context = {}) and add classification/analysis
   * @param {Error} error - Error that occurred
   * @param {Object} context - Additional error context (NEW PARAMETER)
   */
  captureError(error, context = {}) {
    // EXISTING ERROR CAPTURE CODE - keep as-is
    if (this.#startTime === null) {
      throw new Error(
        'Must call captureDispatchStart() before capturing error'
      );
    }

    const errorTime = this.#getHighPrecisionTime();

    // End timing if not already ended - ALREADY IMPLEMENTED
    if (this.#endTime === null) {
      this.#endTime = errorTime;
      this.#executionData.endTime = this.#endTime;
      this.#executionData.duration = this.#endTime - this.#startTime;
    }

    // Update error context
    this.#errorContext = {
      ...this.#errorContext,
      ...context,
      phase: context.phase || this.#getCurrentPhase(),
      timing: this.#getTimingContext(),
      captureTime: errorTime,
    };

    // Classify error if classifier available
    let classification = null;
    if (this.#errorClassifier) {
      try {
        classification = this.#errorClassifier.classifyError(
          error,
          this.#errorContext
        );
      } catch (classificationError) {
        console.warn(
          'Error classification failed:',
          classificationError.message
        );
      }
    }

    // Analyze stack trace if analyzer available
    let stackAnalysis = null;
    if (this.#stackTraceAnalyzer && error.stack) {
      try {
        stackAnalysis = this.#stackTraceAnalyzer.parseStackTrace(error.stack);
      } catch (analysisError) {
        console.warn('Stack trace analysis failed:', analysisError.message);
      }
    }

    // TIMING INTEGRATION - ALREADY EXISTS, ENHANCE WITH CLASSIFICATION
    if (
      this.#timingEnabled &&
      this.#phaseTimer &&
      this.#phaseTimer.isActive()
    ) {
      // ENHANCEMENT: Add error classification to existing timing integration
      this.#phaseTimer.addMarker('error_occurred', null, {
        errorType: error.constructor.name,
        errorMessage: error.message,
        errorCategory: classification?.category || 'unknown',
      });

      if (this.#endTime === errorTime) {
        this.#phaseTimer.endExecution({
          success: false,
          error: error.constructor.name,
          errorCategory: classification?.category || 'unknown',
        });
      }
    }

    // ENHANCE EXISTING ERROR DATA STORAGE
    // Base error data already captured, adding classification and analysis
    this.#executionData.error = {
      // EXISTING error information - already captured
      message: error.message || 'Unknown error',
      type: error.constructor.name || 'Error',
      name: error.name || error.constructor.name,
      stack: error.stack || null,
      timestamp: errorTime,

      // EXISTING extended error properties - already captured
      code: error.code || null,
      cause: error.cause || null,
      errno: error.errno || null,
      syscall: error.syscall || null,

      // EXISTING error context - enhance with new fields
      context: {
        phase: this.#errorContext.phase,
        executionDuration: this.#executionData.duration,
        retryCount: this.#errorContext.retryCount,
        actionId: this.#actionId,
        actorId: this.#actorId,
      },

      // NEW: Classification results
      classification: classification || {
        category: 'unknown',
        severity: 'medium',
        recoveryPotential: 'conditional',
        isTransient: false,
        isRetryable: false,
        confidence: 0,
      },

      // NEW: Stack trace analysis
      stackAnalysis: stackAnalysis || null,

      // NEW: Error location (from stack trace)
      location: stackAnalysis
        ? this.#stackTraceAnalyzer.getErrorLocation(stackAnalysis)
        : null,

      // NEW: Formatted stack trace for readability
      formattedStack:
        stackAnalysis && this.#stackTraceAnalyzer
          ? this.#stackTraceAnalyzer.formatStackTrace(stackAnalysis, {
              showProjectOnly: false,
              maxFrames: 15,
              includeLineNumbers: true,
              includeAnalysis: false,
            })
          : null,
    };

    // Add to execution phases
    this.#executionData.phases.push({
      phase: 'error_captured',
      timestamp: errorTime,
      description: `Error occurred: ${error.message}`,
      errorType: error.constructor.name,
      errorCategory: classification?.category || 'unknown',
      severity: classification?.severity || 'unknown',
    });
  }

  /**
   * Get current execution phase
   * @private
   * @returns {string} Current phase
   */
  #getCurrentPhase() {
    if (
      !this.#executionData.phases ||
      this.#executionData.phases.length === 0
    ) {
      return 'unknown';
    }

    const lastPhase =
      this.#executionData.phases[this.#executionData.phases.length - 1];
    return lastPhase.phase || 'unknown';
  }

  /**
   * Get timing context for error
   * @private
   * @returns {Object|null} Timing context
   */
  #getTimingContext() {
    if (!this.#timingEnabled || !this.#phaseTimer) {
      return null;
    }

    return {
      totalDuration: this.#executionData.duration,
      phaseDurations: this.#phaseTimer.getAllPhases().map((phase) => ({
        name: phase.name,
        duration: phase.duration,
      })),
    };
  }

  /**
   * Set error context for better error analysis
   * @param {Object} context - Error context
   */
  setErrorContext(context) {
    this.#errorContext = {
      ...this.#errorContext,
      ...context,
    };
  }

  /**
   * Get error details
   * @returns {Object|null} Error details or null if no error
   */
  getError() {
    return this.#executionData.error;
  }

  /**
   * Get error summary
   * @returns {Object|null} Error summary or null if no error
   */
  getErrorSummary() {
    if (!this.#executionData.error) {
      return null;
    }

    const error = this.#executionData.error;
    return {
      type: error.type,
      message: error.message,
      category: error.classification?.category || 'unknown',
      severity: error.classification?.severity || 'unknown',
      isRetryable: error.classification?.isRetryable || false,
      location: error.location
        ? {
            file: error.location.shortFile,
            function: error.location.function,
            line: error.location.line,
          }
        : null,
      troubleshooting: error.classification?.troubleshooting || [],
    };
  }

  /**
   * Generate error report
   * @returns {string} Human-readable error report
   */
  getErrorReport() {
    if (!this.#executionData.error) {
      return 'No error occurred during execution';
    }

    const error = this.#executionData.error;
    const lines = [
      'ACTION EXECUTION ERROR REPORT',
      '='.repeat(30),
      `Action: ${this.#actionId}`,
      `Actor: ${this.#actorId}`,
      `Error Type: ${error.type}`,
      `Message: ${error.message}`,
      `Category: ${error.classification?.category || 'unknown'}`,
      `Severity: ${error.classification?.severity || 'unknown'}`,
      `Phase: ${error.context?.phase || 'unknown'}`,
      `Duration: ${
        error.context?.executionDuration
          ? `${error.context.executionDuration.toFixed(2)}ms`
          : 'unknown'
      }`,
      '',
    ];

    // Add location information
    if (error.location) {
      lines.push('Error Location:');
      lines.push(`  File: ${error.location.shortFile}`);
      lines.push(`  Function: ${error.location.function}`);
      if (error.location.line) {
        lines.push(
          `  Line: ${error.location.line}${error.location.column ? ':' + error.location.column : ''}`
        );
      }
      lines.push('');
    }

    // Add troubleshooting steps
    if (error.classification?.troubleshooting?.length > 0) {
      lines.push('Troubleshooting Steps:');
      error.classification.troubleshooting.forEach((step, index) => {
        lines.push(`  ${index + 1}. ${step}`);
      });
      lines.push('');
    }

    // Add formatted stack trace
    if (error.formattedStack) {
      lines.push('Stack Trace:');
      lines.push(error.formattedStack);
    }

    return lines.join('\n');
  }

  /**
   * Check if error is recoverable
   * @returns {boolean} True if error is recoverable
   */
  isErrorRecoverable() {
    if (!this.#executionData.error) {
      return true; // No error, so recoverable
    }

    const recovery =
      this.#executionData.error.classification?.recoveryPotential;
    return (
      recovery === 'immediate' ||
      recovery === 'delayed' ||
      recovery === 'conditional'
    );
  }

  // ... rest of existing methods remain the same ...
}
```

## Implementation Tasks

### Phase 1: Error Classification System (45 minutes)

1. **Create ErrorClassifier class**
   - [ ] Implement error categorization rules and patterns
   - [ ] Add severity determination logic
   - [ ] Create recovery potential assessment
   - [ ] Add troubleshooting step generation

2. **Build classification rule engine**
   - [ ] Define error category constants and patterns
   - [ ] Implement pattern matching for error messages
   - [ ] Add context-based severity adjustment
   - [ ] Create recovery guidance system

### Phase 2: Stack Trace Analysis (45 minutes)

1. **Implement StackTraceAnalyzer**
   - [ ] Create stack frame parsing logic
   - [ ] Add project code detection
   - [ ] Implement stack trace formatting
   - [ ] Add analysis and insights generation

2. **Build trace analysis features**
   - [ ] Parse different stack trace formats
   - [ ] Identify project vs. dependency frames
   - [ ] Extract error location information
   - [ ] Generate human-readable stack traces

### Phase 3: Integration and Enhancement (30 minutes)

1. **Enhance ActionExecutionTrace**
   - [ ] Integrate error classification into existing captureError method
   - [ ] Add stack trace analysis to existing error capture
   - [ ] Enhance existing error context capture with new context parameter
   - [ ] Create NEW error reporting methods (getErrorSummary, getErrorReport, etc.)

2. **Add NEW error utilities** (these methods don't exist yet)
   - [ ] Error summary generation (getErrorSummary method)
   - [ ] Recoverable error detection (isErrorRecoverable method)
   - [ ] Error report formatting (getErrorReport method)
   - [ ] Context management (setErrorContext method)

## Code Examples

### Example 1: Basic Error Capture

```javascript
// ENHANCED: Add enableErrorAnalysis to existing constructor
const trace = new ActionExecutionTrace({
  actionId: 'core:go',
  actorId: 'player-1',
  turnAction: { actionDefinitionId: 'core:go' },
  enableTiming: true, // EXISTING parameter
  enableErrorAnalysis: true, // NEW parameter
});

trace.captureDispatchStart();

try {
  // Simulate action execution
  throw new Error('Validation failed: missing direction parameter');
} catch (error) {
  // ENHANCED: Use modified captureError signature with context parameter
  trace.captureError(error, {
    phase: 'validation',
    retryCount: 0,
  });
}

// NEW: Get enhanced error information
const errorSummary = trace.getErrorSummary(); // NEW method
console.log(`Error: ${errorSummary.message}`);
console.log(`Category: ${errorSummary.category}`); // NEW field
console.log(`Severity: ${errorSummary.severity}`); // NEW field
```

### Example 2: Error Classification

```javascript
const classifier = new ErrorClassifier({ logger });

const error = new Error('Database connection timeout after 30 seconds');
const classification = classifier.classifyError(error, {
  phase: 'data_access',
  retryCount: 2,
});

console.log(`Category: ${classification.category}`); // 'timeout'
console.log(`Severity: ${classification.severity}`); // 'medium'
console.log(`Retryable: ${classification.isRetryable}`); // true
console.log(`Recovery: ${classification.recoveryPotential}`); // 'delayed'
```

### Example 3: Stack Trace Analysis

```javascript
const analyzer = new StackTraceAnalyzer({ projectPath: __dirname });

const error = new Error('Test error');
const stackTrace = analyzer.parseStackTrace(error.stack);

console.log(`Project frames: ${stackTrace.analysis.projectFrames}`);
console.log(`Top project frame: ${stackTrace.topProjectFrame?.functionName}`);

const formatted = analyzer.formatStackTrace(stackTrace, {
  showProjectOnly: true,
  includeAnalysis: true,
});
console.log(formatted);
```

### Example 4: Error Recovery Assessment (ENHANCEMENT of existing error handling)

```javascript
// In CommandProcessor error handling - ENHANCING existing patterns
if (actionTrace) {
  // ENHANCED: Add context parameter to existing captureError call
  actionTrace.captureError(error, {
    phase: currentPhase,
    retryCount: attemptNumber,
  });

  // NEW: Get enhanced error analysis
  const errorSummary = actionTrace.getErrorSummary();

  // ENHANCED: Use classification for smarter retry logic
  if (errorSummary.isRetryable && attemptNumber < maxRetries) {
    const delay = errorSummary.category === 'timeout' ? 5000 : 1000;
    setTimeout(() => retryAction(), delay);
  } else {
    // ENHANCED: Use detailed error reporting
    logger.error(actionTrace.getErrorReport());
    return handlePermanentFailure();
  }
}
```

## Testing Requirements

### Unit Tests

#### File: `tests/unit/actions/tracing/errorClassification.unit.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  ErrorClassifier,
  ERROR_CATEGORIES,
  ERROR_SEVERITY,
} from '../../../../src/actions/tracing/errorClassification.js';
import { createMockLogger } from '../../../common/mocks/mockLogger.js';

describe('ErrorClassifier', () => {
  let classifier;
  let mockLogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    classifier = new ErrorClassifier({ logger: mockLogger });
  });

  describe('Error Categorization', () => {
    it('should classify validation errors correctly', () => {
      const error = new Error('Validation failed: missing required field');
      const classification = classifier.classifyError(error);

      expect(classification.category).toBe(ERROR_CATEGORIES.VALIDATION);
      expect(classification.severity).toBe(ERROR_SEVERITY.MEDIUM);
      expect(classification.isRetryable).toBe(true);
    });

    it('should classify authorization errors correctly', () => {
      const error = new Error('Unauthorized: insufficient permissions');
      const classification = classifier.classifyError(error);

      expect(classification.category).toBe(ERROR_CATEGORIES.AUTHORIZATION);
      expect(classification.severity).toBe(ERROR_SEVERITY.HIGH);
      expect(classification.recoveryPotential).toBe('manual');
    });

    it('should classify network errors correctly', () => {
      const error = new Error('Network timeout: connection failed');
      const classification = classifier.classifyError(error);

      expect(classification.category).toBe(ERROR_CATEGORIES.NETWORK);
      expect(classification.isTransient).toBe(true);
      expect(classification.recoveryPotential).toBe('delayed');
    });

    it('should classify system errors correctly', () => {
      const error = new Error('Critical system failure in core module');
      const classification = classifier.classifyError(error);

      expect(classification.category).toBe(ERROR_CATEGORIES.SYSTEM);
      expect(classification.severity).toBe(ERROR_SEVERITY.CRITICAL);
    });
  });

  describe('Context-Based Classification', () => {
    it('should adjust severity based on context', () => {
      const error = new Error('Operation failed');

      const initClassification = classifier.classifyError(error, {
        phase: 'initialization',
      });
      const normalClassification = classifier.classifyError(error, {
        phase: 'processing',
      });

      expect(initClassification.severity).toBe(ERROR_SEVERITY.CRITICAL);
      expect(normalClassification.severity).not.toBe(ERROR_SEVERITY.CRITICAL);
    });

    it('should consider retry count in recovery assessment', () => {
      const error = new Error('Temporary failure');

      const firstAttempt = classifier.classifyError(error, { retryCount: 0 });
      const manyRetries = classifier.classifyError(error, { retryCount: 5 });

      expect(firstAttempt.recoveryPotential).not.toBe('manual');
      expect(manyRetries.recoveryPotential).toBe('manual');
    });
  });

  describe('Troubleshooting Generation', () => {
    it('should generate relevant troubleshooting steps', () => {
      const error = new Error('Database connection failed');
      const classification = classifier.classifyError(error);

      expect(classification.troubleshooting).toBeInstanceOf(Array);
      expect(classification.troubleshooting.length).toBeGreaterThan(0);
      expect(
        classification.troubleshooting.some(
          (step) =>
            step.toLowerCase().includes('network') ||
            step.toLowerCase().includes('connection')
        )
      ).toBe(true);
    });

    it('should include retry guidance for retryable errors', () => {
      const error = new Error('Timeout occurred');
      const classification = classifier.classifyError(error);

      if (classification.isRetryable) {
        expect(
          classification.troubleshooting.some((step) =>
            step.toLowerCase().includes('retry')
          )
        ).toBe(true);
      }
    });
  });
});
```

#### File: `tests/unit/actions/tracing/stackTraceAnalyzer.unit.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { StackTraceAnalyzer } from '../../../../src/actions/tracing/stackTraceAnalyzer.js';

describe('StackTraceAnalyzer', () => {
  let analyzer;
  const projectPath = '/project/path';

  beforeEach(() => {
    analyzer = new StackTraceAnalyzer({
      projectPath,
      logger: console,
    });
  });

  describe('Stack Trace Parsing', () => {
    it('should parse standard V8 stack trace format', () => {
      const stackTrace = `Error: Test error
    at Object.testFunction (/project/path/src/test.js:10:5)
    at processAction (/project/path/src/actions.js:25:10)
    at Object.<anonymous> (/project/path/index.js:5:1)`;

      const parsed = analyzer.parseStackTrace(stackTrace);

      expect(parsed.errorMessage).toBe('Error: Test error');
      expect(parsed.frames).toHaveLength(3);
      expect(parsed.frames[0].functionName).toBe('Object.testFunction');
      expect(parsed.frames[0].fileName).toBe('/project/path/src/test.js');
      expect(parsed.frames[0].lineNumber).toBe(10);
      expect(parsed.frames[0].columnNumber).toBe(5);
    });

    it('should identify project code frames', () => {
      const stackTrace = `Error: Test error
    at projectFunction (/project/path/src/test.js:10:5)
    at nodeModule (${projectPath}/node_modules/some-package/index.js:100:10)
    at nativeFunction ([native code])`;

      const parsed = analyzer.parseStackTrace(stackTrace);

      expect(parsed.frames[0].isProjectCode).toBe(true);
      expect(parsed.frames[1].isNodeModules).toBe(true);
      expect(parsed.frames[2].isNativeCode).toBe(true);
    });

    it('should handle anonymous functions', () => {
      const stackTrace = `Error: Test error
    at /project/path/src/anonymous.js:15:20
    at <anonymous> (/project/path/src/callback.js:5:1)`;

      const parsed = analyzer.parseStackTrace(stackTrace);

      expect(parsed.frames[0].functionName).toBe('<anonymous>');
      expect(parsed.frames[1].functionName).toBe('<anonymous>');
    });
  });

  describe('Stack Trace Analysis', () => {
    it('should provide comprehensive analysis', () => {
      const stackTrace = `Error: Test error
    at function1 (/project/path/src/a.js:1:1)
    at function2 (/project/path/src/b.js:2:2)
    at async function3 (/project/path/src/c.js:3:3)
    at nodeFunction (${projectPath}/node_modules/pkg/index.js:10:10)`;

      const parsed = analyzer.parseStackTrace(stackTrace);
      const analysis = parsed.analysis;

      expect(analysis.totalFrames).toBe(4);
      expect(analysis.projectFrames).toBe(3);
      expect(analysis.nodeModulesFrames).toBe(1);
      expect(analysis.hasAsyncFrames).toBe(true);
      expect(analysis.uniqueFiles).toBe(4);
    });
  });

  describe('Stack Trace Formatting', () => {
    it('should format stack trace with options', () => {
      const stackTrace = `Error: Test error
    at testFunc (/project/path/src/test.js:10:5)
    at nodeFunc (${projectPath}/node_modules/pkg/index.js:1:1)`;

      const parsed = analyzer.parseStackTrace(stackTrace);

      const formatted = analyzer.formatStackTrace(parsed, {
        showProjectOnly: false,
        includeLineNumbers: true,
        includeAnalysis: true,
      });

      expect(formatted).toContain('Error: Test error');
      expect(formatted).toContain('testFunc');
      expect(formatted).toContain('test.js:10:5');
      expect(formatted).toContain('Analysis:');
    });

    it('should filter to project code only when requested', () => {
      const stackTrace = `Error: Test error
    at projectFunc (/project/path/src/test.js:10:5)
    at nodeFunc (${projectPath}/node_modules/pkg/index.js:1:1)`;

      const parsed = analyzer.parseStackTrace(stackTrace);

      const formatted = analyzer.formatStackTrace(parsed, {
        showProjectOnly: true,
      });

      expect(formatted).toContain('projectFunc');
      expect(formatted).not.toContain('nodeFunc');
    });
  });

  describe('Error Location Extraction', () => {
    it('should extract error location from stack trace', () => {
      const stackTrace = `Error: Test error
    at testFunction (/project/path/src/test.js:10:5)
    at nodeFunction (${projectPath}/node_modules/pkg/index.js:1:1)`;

      const parsed = analyzer.parseStackTrace(stackTrace);
      const location = analyzer.getErrorLocation(parsed);

      expect(location).toBeTruthy();
      expect(location.function).toBe('testFunction');
      expect(location.file).toBe('/project/path/src/test.js');
      expect(location.line).toBe(10);
      expect(location.column).toBe(5);
      expect(location.isProjectCode).toBe(true);
    });
  });
});
```

### Integration Tests

#### File: `tests/integration/actions/tracing/errorCaptureIntegration.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ActionExecutionTrace } from '../../../../src/actions/tracing/actionExecutionTrace.js';

describe('Error Capture Integration', () => {
  let trace;

  beforeEach(() => {
    trace = new ActionExecutionTrace({
      actionId: 'core:error_test',
      actorId: 'player-1',
      turnAction: { actionDefinitionId: 'core:error_test' },
      enableErrorAnalysis: true,
    });
  });

  it('should capture and analyze complete error information', () => {
    trace.captureDispatchStart();

    // Create a realistic error with stack trace
    const error = new Error('Validation failed: missing required parameter');
    error.code = 'VALIDATION_ERROR';

    // ENHANCED: Use modified signature with context parameter
    trace.captureError(error, {
      phase: 'validation',
      retryCount: 1,
    });

    // Verify ENHANCED error capture
    expect(trace.hasError).toBe(true); // EXISTING property
    expect(trace.isComplete).toBe(true); // EXISTING property

    const errorDetails = trace.getError(); // EXISTING method with NEW enhanced data
    expect(errorDetails.message).toBe(
      'Validation failed: missing required parameter'
    ); // EXISTING field
    expect(errorDetails.type).toBe('Error'); // EXISTING field
    expect(errorDetails.code).toBe('VALIDATION_ERROR'); // EXISTING field
    expect(errorDetails.classification).toBeTruthy(); // NEW field
    expect(errorDetails.context.phase).toBe('validation'); // ENHANCED field

    const errorSummary = trace.getErrorSummary(); // NEW method
    expect(errorSummary.category).toBe('validation'); // NEW field
    expect(errorSummary.isRetryable).toBe(true); // NEW field
    expect(errorSummary.troubleshooting.length).toBeGreaterThan(0); // NEW field
  });

  it('should generate comprehensive error report', () => {
    trace.captureDispatchStart();

    const error = new Error('Database connection timeout');
    // ENHANCED: Use enhanced captureError (backward compatible)
    trace.captureError(error);

    const report = trace.getErrorReport(); // NEW method
    expect(report).toContain('ACTION EXECUTION ERROR REPORT');
    expect(report).toContain('Database connection timeout');
    expect(report).toContain('Troubleshooting Steps:');
  });

  it('should handle errors without stack traces gracefully', () => {
    trace.captureDispatchStart();

    const error = new Error('Simple error');
    delete error.stack; // Remove stack trace

    expect(() => {
      // ENHANCED: Uses enhanced captureError
      trace.captureError(error);
    }).not.toThrow();

    const errorDetails = trace.getError(); // EXISTING method with NEW fields
    expect(errorDetails.stackAnalysis).toBeNull(); // NEW field
    expect(errorDetails.formattedStack).toBeNull(); // NEW field
    expect(errorDetails.location).toBeNull(); // NEW field
  });

  it('should integrate with JSON serialization', () => {
    trace.captureDispatchStart();

    const error = new Error('Serialization test error');
    // ENHANCED: Use enhanced captureError
    trace.captureError(error);

    const json = trace.toJSON(); // EXISTING method with NEW enhanced data
    expect(json.error).toBeTruthy(); // EXISTING field with NEW structure
    expect(json.error.message).toBe('Serialization test error'); // EXISTING field
    expect(json.error.classification).toBeTruthy(); // NEW field
    expect(json.error.context).toBeTruthy(); // ENHANCED field
    expect(json.execution.status).toBe('error'); // EXISTING field
  });
});
```

## Integration Points

### 1. ActionExecutionTrace Integration (ENHANCEMENT of existing class)

- **Builds on existing**: Enhances existing trace lifecycle and captureError method
- **Timing integration**: Uses existing ExecutionPhaseTimer integration
- **New capabilities**: Adds classification and analysis to existing error capture
- **Backward compatible**: Maintains existing JSON serialization format

### 2. CommandProcessor Integration (ENHANCEMENT of existing usage)

- **Existing context**: Leverages existing error context capture mechanisms
- **Enhanced retry logic**: Adds classification-based retry decisions to existing error handling
- **Current monitoring**: Integrates with existing logging patterns

### 3. Error Monitoring Integration (NEW capabilities)

- **Structured enhancement**: Adds classification data to existing error structures
- **Alert classification**: Enables automated alerting based on error categories
- **Performance tracking**: Monitors analysis overhead on existing error handling

## Error Handling

### Classification Errors

- Graceful fallback when classification fails
- Default classifications for unknown errors
- Logging of classification failures without breaking traces

### Stack Trace Analysis Errors

- Handling of malformed or missing stack traces
- Graceful degradation for unsupported stack formats
- Fallback behavior for analysis failures

### Serialization Errors

- Safe serialization of complex error objects
- Handling of circular references in error data
- Truncation of oversized error information

## Security Considerations

1. **Stack Trace Sanitization** - Remove sensitive paths and information
2. **Error Message Filtering** - Avoid exposing internal system details
3. **Context Data Protection** - Sanitize error context for sensitive information
4. **File Path Security** - Normalize and sanitize file paths in stack traces

## Dependencies

### Internal Dependencies

- HighPrecisionTimer for timing context
- Validation utilities for input checking
- Logger interface for error reporting

### External Dependencies

- None (pure JavaScript implementation using native Error APIs)

## Risks and Mitigation

| Risk                                      | Probability | Impact | Mitigation                                |
| ----------------------------------------- | ----------- | ------ | ----------------------------------------- |
| Error capture adding performance overhead | Medium      | Low    | Minimal implementation, optional analysis |
| Sensitive information in error traces     | Low         | High   | Comprehensive sanitization and filtering  |
| Memory usage from detailed error data     | Low         | Medium | Data size limits and cleanup              |
| Error in error capture breaking system    | Low         | High   | Extensive error handling and fallbacks    |

## Acceptance Criteria

- [ ] All error types captured with appropriate detail
- [ ] Error classification provides meaningful categorization
- [ ] Stack trace analysis works across different error formats
- [ ] Error context includes execution phase and timing information
- [ ] Troubleshooting suggestions are relevant and actionable
- [ ] Error capture performance overhead is minimal (<1ms)
- [ ] Integration with ActionExecutionTrace maintains compatibility
- [ ] JSON serialization includes complete error information
- [ ] Unit tests achieve >95% coverage
- [ ] Error handling prevents system failures

## Future Enhancements

1. **Machine Learning Classification** - AI-powered error categorization
2. **Error Correlation** - Link related errors across actions
3. **Automated Resolution** - Suggest automated fixes for common errors
4. **Error Trend Analysis** - Track error patterns over time
5. **Integration with External Tools** - Support for external error tracking

## Documentation Requirements

1. **Error Classification Guide** - How errors are categorized and analyzed
2. **Integration Guide** - How to add error capture to existing systems
3. **Troubleshooting Reference** - Complete guide to error resolution
4. **API Documentation** - Complete documentation of error capture APIs

## Definition of Done

- [ ] ErrorClassifier implemented with comprehensive rules
- [ ] StackTraceAnalyzer created with parsing and formatting
- [ ] ActionExecutionTrace enhanced with error capture
- [ ] Error context and analysis integration completed
- [ ] Unit tests written and passing (>95% coverage)
- [ ] Integration tests verify end-to-end error capture
- [ ] Performance tests validate minimal overhead
- [ ] Security review passed for sensitive data handling
- [ ] Code reviewed and approved
- [ ] Documentation updated
