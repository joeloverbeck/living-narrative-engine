/**
 * @file Scope Evaluation Tracer
 * @description Captures step-by-step resolver execution, filter evaluations,
 * and provides formatted trace output for debugging scope resolution issues.
 */

/**
 * ScopeEvaluationTracer class for debugging scope resolution.
 * Captures resolver execution flow, filter evaluations per entity,
 * and provides formatted human-readable trace output.
 *
 * @class
 * @example
 * const tracer = new ScopeEvaluationTracer();
 * tracer.enable();
 * tracer.logStep('SourceResolver', "resolve(kind='actor')", ctx, result);
 * tracer.logFilterEvaluation('entity-123', logic, true, context);
 * console.log(tracer.format());
 */
export class ScopeEvaluationTracer {
  constructor() {
    this.#enabled = false;
    this.#steps = [];
    this.#startTime = null;
  }

  #enabled;
  #steps;
  #startTime;

  /**
   * Enable tracing and reset start time.
   */
  enable() {
    this.#enabled = true;
    this.#startTime = Date.now();
  }

  /**
   * Disable tracing.
   */
  disable() {
    this.#enabled = false;
  }

  /**
   * Check if tracing is currently enabled.
   *
   * @returns {boolean} True if tracing is active.
   */
  isEnabled() {
    return this.#enabled;
  }

  /**
   * Log a resolver execution step.
   *
   * @param {string} resolverName - Name of the resolver (e.g., 'SourceResolver').
   * @param {string} operation - Description of the operation (e.g., "resolve(kind='actor')").
   * @param {unknown} input - Input value to the resolver.
   * @param {unknown} output - Output value from the resolver.
   * @param {object} [details] - Additional details about the step.
   */
  logStep(resolverName, operation, input, output, details = {}) {
    if (!this.#enabled) {
      return;
    }

    this.#steps.push({
      timestamp: Date.now(),
      type: 'RESOLVER_STEP',
      resolver: resolverName,
      operation,
      input: this.#serializeValue(input),
      output: this.#serializeValue(output),
      details,
    });
  }

  /**
   * Log a filter evaluation for a specific entity.
   *
   * @param {string} entityId - ID of the entity being evaluated.
   * @param {object} logic - JSON Logic object used for filtering.
   * @param {boolean} result - Whether the entity passed the filter.
   * @param {object} evalContext - Evaluation context used.
   * @param {object|null} [breakdown] - Optional breakdown of the evaluation.
   */
  logFilterEvaluation(entityId, logic, result, evalContext, breakdown = null) {
    if (!this.#enabled) {
      return;
    }

    this.#steps.push({
      timestamp: Date.now(),
      type: 'FILTER_EVALUATION',
      entityId,
      logic,
      result,
      context: evalContext,
      breakdown,
    });
  }

  /**
   * Log an error that occurred during evaluation.
   *
   * @param {string} phase - Phase where the error occurred.
   * @param {Error} error - The error object.
   * @param {object} [context] - Additional context about the error.
   */
  logError(phase, error, context = {}) {
    if (!this.#enabled) {
      return;
    }

    this.#steps.push({
      timestamp: Date.now(),
      type: 'ERROR',
      phase,
      error: {
        message: error.message || String(error),
        name: error.name || 'Error',
        stack: error.stack || '',
      },
      context,
    });
  }

  /**
   * Get raw trace data with summary statistics.
   *
   * @returns {object} Object containing steps array and summary.
   */
  getTrace() {
    const summary = this.#calculateSummary();
    return {
      steps: this.#steps,
      summary,
    };
  }

  /**
   * Get human-readable formatted output.
   *
   * @returns {string} Formatted trace output.
   */
  format() {
    if (this.#steps.length === 0) {
      return 'SCOPE EVALUATION TRACE:\n' +
        '================================================================================\n' +
        'No steps recorded.\n' +
        '================================================================================\n';
    }

    const lines = [];
    lines.push('SCOPE EVALUATION TRACE:');
    lines.push('================================================================================');
    lines.push('');

    let stepNumber = 1;
    let currentFilterStepNumber = null;
    const filterEvaluations = [];

    for (const step of this.#steps) {
      if (step.type === 'RESOLVER_STEP') {
        // Flush any pending filter evaluations
        if (filterEvaluations.length > 0) {
          lines.push(...this.#formatFilterEvaluations(
            currentFilterStepNumber,
            filterEvaluations
          ));
          filterEvaluations.length = 0;
          stepNumber++;
        }

        // Format resolver step
        lines.push(`${stepNumber}. [${step.resolver}] ${step.operation}`);
        lines.push(`   Input: ${this.#formatSerializedValue(step.input)}`);
        lines.push(`   Output: ${this.#formatSerializedValue(step.output)}`);
        lines.push('');
        stepNumber++;
      } else if (step.type === 'FILTER_EVALUATION') {
        // Collect filter evaluations
        if (filterEvaluations.length === 0) {
          currentFilterStepNumber = stepNumber;
        }
        filterEvaluations.push(step);
      } else if (step.type === 'ERROR') {
        // Flush any pending filter evaluations
        if (filterEvaluations.length > 0) {
          lines.push(...this.#formatFilterEvaluations(
            currentFilterStepNumber,
            filterEvaluations
          ));
          filterEvaluations.length = 0;
          stepNumber++;
        }

        // Format error
        lines.push(`${stepNumber}. [ERROR] ${step.phase}`);
        lines.push(`   Error: ${step.error.name}: ${step.error.message}`);
        if (Object.keys(step.context).length > 0) {
          lines.push(`   Context: ${JSON.stringify(step.context)}`);
        }
        lines.push('');
        stepNumber++;
      }
    }

    // Flush any remaining filter evaluations
    if (filterEvaluations.length > 0) {
      lines.push(...this.#formatFilterEvaluations(
        currentFilterStepNumber,
        filterEvaluations
      ));
    }

    // Add summary
    const summary = this.#calculateSummary();
    lines.push('================================================================================');
    lines.push(`Summary: ${summary.totalSteps} steps, ${summary.duration}ms, Final size: ${summary.finalOutputSize}`);

    return lines.join('\n');
  }

  /**
   * Clear all trace data and reset start time.
   * Preserves the enabled state.
   */
  clear() {
    this.#steps = [];
    this.#startTime = this.#enabled ? Date.now() : null;
  }

  /**
   * Serialize a value for storage in trace data.
   * Handles Set, Array, Object, and primitive types.
   * Limits large collections to first 10 items.
   *
   * @private
   * @param {unknown} value - Value to serialize.
   * @returns {object} Serialized value representation.
   */
  #serializeValue(value) {
    if (value instanceof Set) {
      const values = Array.from(value).slice(0, 10);
      return {
        type: 'Set',
        size: value.size,
        values,
        truncated: value.size > 10,
      };
    }

    if (Array.isArray(value)) {
      const values = value.slice(0, 10);
      return {
        type: 'Array',
        size: value.length,
        values,
        truncated: value.length > 10,
      };
    }

    if (value && typeof value === 'object' && value.constructor === Object) {
      return {
        type: 'Object',
        keys: Object.keys(value),
      };
    }

    // Primitives and other types
    const type = typeof value;
    return {
      type: type.charAt(0).toUpperCase() + type.slice(1),
      value,
    };
  }

  /**
   * Format a serialized value for display.
   *
   * @private
   * @param {object} serialized - Serialized value from #serializeValue.
   * @returns {string} Formatted string.
   */
  #formatSerializedValue(serialized) {
    if (serialized.type === 'Set' || serialized.type === 'Array') {
      const items = serialized.values.map(v =>
        typeof v === 'string' ? `'${v}'` : String(v)
      ).join(', ');
      const suffix = serialized.truncated ? '...' : '';
      return `${serialized.type} (${serialized.size} item${serialized.size !== 1 ? 's' : ''}) [${items}${suffix}]`;
    }

    if (serialized.type === 'Object') {
      return `Object {${serialized.keys.join(', ')}}`;
    }

    return `${serialized.type}: ${String(serialized.value)}`;
  }

  /**
   * Format filter evaluations for a single FilterResolver step.
   *
   * @private
   * @param {number} stepNumber - Step number to display.
   * @param {Array} evaluations - Array of filter evaluation steps.
   * @returns {Array<string>} Formatted lines.
   */
  #formatFilterEvaluations(stepNumber, evaluations) {
    const lines = [];
    lines.push(`${stepNumber}. [FilterResolver] Evaluating ${evaluations.length} entit${evaluations.length !== 1 ? 'ies' : 'y'}`);
    lines.push('');

    // Group by result and format
    for (const evaluation of evaluations) {
      const symbol = evaluation.result ? '✓' : '✗';
      const status = evaluation.result ? 'PASS' : 'FAIL';

      lines.push(`   Entity: ${evaluation.entityId}`);
      lines.push(`   Result: ${status} ${symbol}`);

      if (evaluation.breakdown) {
        lines.push('   Breakdown:');
        lines.push(...this.#formatBreakdown(evaluation.breakdown, 5));
      }

      lines.push('');
    }

    // Calculate output
    const passedEntities = evaluations.filter(e => e.result).map(e => e.entityId);
    const outputSerialized = this.#serializeValue(new Set(passedEntities));
    lines.push(`   Output: ${this.#formatSerializedValue(outputSerialized)}`);
    lines.push('');

    return lines;
  }

  /**
   * Format a breakdown object recursively.
   * Handles both FilterClauseAnalyzer breakdowns and generic objects.
   *
   * @private
   * @param {object} breakdown - Breakdown object.
   * @param {number} indent - Current indentation level.
   * @returns {Array<string>} Formatted lines.
   */
  #formatBreakdown(breakdown, indent = 0) {
    const lines = [];
    const prefix = ' '.repeat(indent);

    if (typeof breakdown !== 'object' || breakdown === null) {
      return lines;
    }

    // Check if this is a FilterClauseAnalyzer breakdown structure
    if (breakdown.type && ['operator', 'variable', 'value'].includes(breakdown.type)) {
      return this.#formatFilterClauseBreakdown(breakdown, indent);
    }

    // Generic object formatting (fallback for other breakdown types)
    for (const [key, value] of Object.entries(breakdown)) {
      if (typeof value === 'boolean') {
        const symbol = value ? '✓' : '✗';
        lines.push(`${prefix}${symbol} ${key}`);
      } else if (typeof value === 'object') {
        lines.push(`${prefix}${key}:`);
        lines.push(...this.#formatBreakdown(value, indent + 2));
      } else {
        lines.push(`${prefix}${key}: ${value}`);
      }
    }

    return lines;
  }

  /**
   * Format a FilterClauseAnalyzer breakdown tree.
   * Shows operators with ✓/✗ symbols and recursively formats children.
   *
   * @private
   * @param {object} breakdown - FilterClauseAnalyzer breakdown node.
   * @param {number} indent - Current indentation level.
   * @returns {Array<string>} Formatted lines.
   */
  #formatFilterClauseBreakdown(breakdown, indent = 0) {
    const lines = [];
    const prefix = ' '.repeat(indent);

    if (breakdown.type === 'operator') {
      const symbol = breakdown.result ? '✓' : '✗';
      lines.push(`${prefix}${symbol} ${breakdown.operator}: ${breakdown.description}`);

      if (breakdown.children && Array.isArray(breakdown.children)) {
        for (const child of breakdown.children) {
          lines.push(...this.#formatFilterClauseBreakdown(child, indent + 2));
        }
      }
    } else if (breakdown.type === 'variable') {
      lines.push(`${prefix}  ${breakdown.description}`);
    } else if (breakdown.type === 'value') {
      const valueStr = typeof breakdown.value === 'string'
        ? `"${breakdown.value}"`
        : String(breakdown.value);
      lines.push(`${prefix}  value: ${valueStr}`);
    }

    return lines;
  }

  /**
   * Calculate summary statistics from trace data.
   *
   * @private
   * @returns {object} Summary object.
   */
  #calculateSummary() {
    const resolverSteps = this.#steps.filter(s => s.type === 'RESOLVER_STEP');
    const filterEvaluations = this.#steps.filter(s => s.type === 'FILTER_EVALUATION');
    const errors = this.#steps.filter(s => s.type === 'ERROR');

    const resolversUsed = [...new Set(resolverSteps.map(s => s.resolver))];

    // Get final output from last resolver step
    let finalOutput = null;
    let finalOutputSize = 0;
    for (let i = this.#steps.length - 1; i >= 0; i--) {
      if (this.#steps[i].type === 'RESOLVER_STEP') {
        finalOutput = this.#steps[i].output;
        finalOutputSize = finalOutput.size || 0;
        break;
      }
    }

    const duration = this.#startTime ? Date.now() - this.#startTime : 0;

    return {
      totalSteps: this.#steps.length,
      resolverSteps: resolverSteps.length,
      filterEvaluations: filterEvaluations.length,
      errors: errors.length,
      duration,
      resolversUsed,
      finalOutput,
      finalOutputSize,
    };
  }
}
