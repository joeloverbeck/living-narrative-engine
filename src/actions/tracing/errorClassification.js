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
   *
   * @param {Error} error - Error to classify
   * @param {object} context - Execution context
   * @returns {object} Error classification and analysis
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
   *
   * @private
   */
  #initializeClassificationRules() {
    this.#classificationRules = new Map([
      // Resource not found errors - most specific first
      [
        /not found.*entity|entity.*not found|resource.*not found|not found.*resource/i,
        {
          category: ERROR_CATEGORIES.RESOURCE,
          severity: ERROR_SEVERITY.MEDIUM,
          recovery: RECOVERY_POTENTIAL.CONDITIONAL,
        },
      ],

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

      // Resource errors - broader pattern
      [
        /not found|resource|file|entity/i,
        {
          category: ERROR_CATEGORIES.RESOURCE,
          severity: ERROR_SEVERITY.MEDIUM,
          recovery: RECOVERY_POTENTIAL.CONDITIONAL,
        },
      ],

      // Network timeout errors - most specific pattern first
      [
        /network.*timeout|timeout.*network|connection.*timeout|timeout.*connection/i,
        {
          category: ERROR_CATEGORIES.NETWORK,
          severity: ERROR_SEVERITY.MEDIUM,
          recovery: RECOVERY_POTENTIAL.DELAYED,
        },
      ],

      // Timeout errors - more specific pattern
      [
        /timeout|expired|deadline/i,
        {
          category: ERROR_CATEGORIES.TIMEOUT,
          severity: ERROR_SEVERITY.MEDIUM,
          recovery: RECOVERY_POTENTIAL.DELAYED,
        },
      ],

      // Network errors - broader pattern
      [
        /network|connection|fetch|http/i,
        {
          category: ERROR_CATEGORIES.NETWORK,
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
   *
   * @private
   * @param {Error} error - Error to categorize
   * @returns {string} Error category
   */
  #determineCategory(error) {
    // Handle null/undefined errors gracefully
    if (!error) {
      return ERROR_CATEGORIES.UNKNOWN;
    }

    const errorMessage = error.message || '';
    const errorType = error.constructor?.name || '';
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
   *
   * @private
   * @param {Error} error - Error to analyze
   * @param {object} context - Execution context
   * @returns {string} Error severity
   */
  #determineSeverity(error, context) {
    // Handle null/undefined error
    if (!error) {
      return ERROR_SEVERITY.LOW;
    }

    // Handle null/undefined context gracefully
    const safeContext = context || {};

    // Check context for severity indicators
    if (safeContext.phase === 'initialization') {
      return ERROR_SEVERITY.CRITICAL; // Early failures are often critical
    }

    if (safeContext.isRetry) {
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
   *
   * @private
   * @param {Error} error - Error to analyze
   * @param {object} context - Execution context
   * @returns {string} Recovery potential
   */
  #determineRecoveryPotential(error, context) {
    const category = this.#determineCategory(error);
    const safeContext = context || {};

    // Context-based recovery assessment
    if (safeContext.retryCount >= 3) {
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
   *
   * @private
   * @param {Error} error - Error to check
   * @returns {boolean} True if transient
   */
  #isTransientError(error) {
    if (!error) {
      return false;
    }

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
   *
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
   *
   * @private
   * @param {Error} error - Error to analyze
   * @param {object} context - Execution context
   * @param {object} classification - Error classification
   * @returns {object} Error analysis
   */
  #analyzeError(error, context, classification) {
    const safeContext = context || {};
    // Handle null/undefined errors gracefully
    const safeError = error || {};
    return {
      errorType: safeError.constructor ? safeError.constructor.name : 'Unknown',
      hasStackTrace: Boolean(safeError.stack),
      stackDepth: safeError.stack ? safeError.stack.split('\n').length - 1 : 0,
      hasCause: Boolean(safeError.cause),
      contextPhase: safeContext.phase || 'unknown',
      contextTiming: safeContext.timing || null,
      isAsyncError: this.#isAsyncError(safeError),
      potentialCauses: this.#identifyPotentialCauses(safeError, context),
    };
  }

  /**
   * Generate troubleshooting steps
   *
   * @private
   * @param {Error} error - Error to analyze
   * @param {object} classification - Error classification
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
   *
   * @private
   * @param {Error} error - Error to check
   * @returns {boolean} True if async error
   */
  #isAsyncError(error) {
    if (!error || !error.stack) return false;

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
   *
   * @private
   * @param {Error} error - Error to analyze
   * @param {object} context - Execution context
   * @returns {Array<string>} Potential causes
   */
  #identifyPotentialCauses(error, context) {
    const causes = [];
    const errorMessage = (error.message || '').toLowerCase();
    const safeContext = context || {};

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

    if (safeContext.phase === 'initialization') {
      causes.push('Configuration or dependency initialization failure');
    }

    if (safeContext.retryCount > 0) {
      causes.push('Persistent issue not resolved by previous retry attempts');
    }

    return causes.length > 0
      ? causes
      : ['Unknown cause - requires investigation'];
  }
}
