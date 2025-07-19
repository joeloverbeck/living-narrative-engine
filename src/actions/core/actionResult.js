/**
 * @file Result object pattern for consistent error handling across the action pipeline
 * @see reports/actions-pipeline-refactoring-analysis.md Priority 2
 */

/**
 * Represents the result of an action operation, encapsulating success/failure state
 * along with the value or errors.
 *
 * This pattern provides:
 * - Consistent error handling across the pipeline
 * - Composable operations with map/flatMap
 * - Elimination of null checks and exception handling
 * - Simplified test assertions
 */
export class ActionResult {
  /**
   * @param {boolean} success - Whether the operation succeeded
   * @param {*} value - The result value if successful
   * @param {Array<Error | object>} errors - Array of errors if failed
   */
  constructor(success, value = null, errors = []) {
    this.success = success;
    this.value = value;
    this.errors = errors;
    Object.freeze(this);
  }

  /**
   * Creates a successful result
   *
   * @param {*} value - The success value
   * @returns {ActionResult}
   */
  static success(value) {
    return new ActionResult(true, value, []);
  }

  /**
   * Creates a failed result
   *
   * @param {Error|Array<Error>|string|Array<string>} errors - The error(s)
   * @returns {ActionResult}
   */
  static failure(errors) {
    // Normalize errors to array format
    const errorArray = Array.isArray(errors) ? errors : [errors];

    // Convert non-Error objects to Error objects for consistency
    const normalizedErrors = errorArray.map((err) => {
      if (err instanceof Error) {
        return err;
      }
      // Convert any non-Error to Error object
      const errorMessage = err?.message || String(err);
      const error = new Error(errorMessage);

      // Preserve additional properties if it's an object
      if (err && typeof err === 'object') {
        Object.keys(err).forEach((key) => {
          if (key !== 'message') {
            error[key] = err[key];
          }
        });
      }

      return error;
    });

    return new ActionResult(false, null, normalizedErrors);
  }

  /**
   * Transforms the value if successful
   *
   * @param {Function} fn - Function to transform the value
   * @returns {ActionResult} New result with transformed value or same failure
   */
  map(fn) {
    if (!this.success) {
      return this;
    }

    try {
      const newValue = fn(this.value);
      return ActionResult.success(newValue);
    } catch (error) {
      return ActionResult.failure(error);
    }
  }

  /**
   * Chains operations that return ActionResult
   *
   * @param {Function} fn - Function that returns an ActionResult
   * @returns {ActionResult} The result of the chained operation
   */
  flatMap(fn) {
    if (!this.success) {
      return this;
    }

    try {
      const result = fn(this.value);
      if (!(result instanceof ActionResult)) {
        throw new Error('flatMap function must return an ActionResult');
      }
      return result;
    } catch (error) {
      return ActionResult.failure(error);
    }
  }

  /**
   * Combines multiple ActionResults, succeeding only if all succeed
   *
   * @param {Array<ActionResult>} results - Results to combine
   * @returns {ActionResult} Combined result with array of values or accumulated errors
   */
  static combine(results) {
    const errors = [];
    const values = [];

    for (const result of results) {
      if (!result.success) {
        errors.push(...result.errors);
      } else {
        values.push(result.value);
      }
    }

    if (errors.length > 0) {
      return ActionResult.failure(errors);
    }

    return ActionResult.success(values);
  }

  /**
   * Gets the value or throws if failed
   *
   * @returns {*} The value
   * @throws {Error} If the result is a failure
   */
  getOrThrow() {
    if (!this.success) {
      const message = this.errors.map((e) => e.message || String(e)).join('; ');
      throw new Error(`ActionResult failure: ${message}`);
    }
    return this.value;
  }

  /**
   * Gets the value or returns a default
   *
   * @param {*} defaultValue - Value to return if failed
   * @returns {*} The value or default
   */
  getOrDefault(defaultValue) {
    return this.success ? this.value : defaultValue;
  }

  /**
   * Executes a function if successful
   *
   * @param {Function} fn - Function to execute with the value
   * @returns {ActionResult} The same result (for chaining)
   */
  ifSuccess(fn) {
    if (this.success) {
      fn(this.value);
    }
    return this;
  }

  /**
   * Executes a function if failed
   *
   * @param {Function} fn - Function to execute with the errors
   * @returns {ActionResult} The same result (for chaining)
   */
  ifFailure(fn) {
    if (!this.success) {
      fn(this.errors);
    }
    return this;
  }

  /**
   * Converts the result to a plain object for serialization
   *
   * @returns {object} Plain object representation
   */
  toJSON() {
    return {
      success: this.success,
      value: this.value,
      errors: this.errors.map((e) => ({
        message: e.message || String(e),
        stack: e.stack,
        name: e.name,
        ...(e.code && { code: e.code }),
        ...(e.context && { context: e.context }),
      })),
    };
  }

  /**
   * Creates an ActionResult from a plain object
   *
   * @param {object} obj - Object with success, value, and errors properties
   * @returns {ActionResult}
   */
  static fromJSON(obj) {
    const errors = (obj.errors || []).map((e) => {
      const error = new Error(e.message);
      error.name = e.name || 'Error';
      if (e.code) error.code = e.code;
      if (e.context) error.context = e.context;
      return error;
    });

    return new ActionResult(obj.success, obj.value, errors);
  }
}

export default ActionResult;
