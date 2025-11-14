/**
 * @file ValidationResultBuilder - Fluent API for constructing validation results
 *
 * Provides a builder pattern for creating standardized validation result objects
 * that are compatible with the ValidationReport structure. This eliminates manual
 * object construction and ensures consistency across all validators.
 * @example
 * const builder = new ValidationResultBuilder('my-recipe', 'path/to/recipe.json');
 * const result = builder
 *   .addError('MISSING_COMPONENT', 'Component not found', { componentId: 'body' })
 *   .addWarning('DEPRECATED_FIELD', 'Field is deprecated')
 *   .addInfo('OPTIMIZATION', 'Consider using property X')
 *   .setMetadata('validatorVersion', '1.0.0')
 *   .build();
 * @example
 * // Quick success result
 * const successResult = ValidationResultBuilder.success('my-recipe', 'path/to/recipe.json');
 */
class ValidationResultBuilder {
  #recipeId;
  #recipePath;
  #timestamp;
  #errors = [];
  #warnings = [];
  #suggestions = [];
  #passed = [];
  #metadata = {};

  /**
   * Creates a new ValidationResultBuilder instance.
   *
   * @param {string} recipeId - The ID of the recipe being validated (required)
   * @param {string} [recipePath] - Optional path to the recipe file
   * @throws {Error} If recipeId is not provided or is not a non-blank string
   */
  constructor(recipeId, recipePath = undefined) {
    if (!recipeId || typeof recipeId !== 'string' || recipeId.trim() === '') {
      throw new Error('recipeId is required and must be a non-blank string');
    }

    this.#recipeId = recipeId;
    this.#recipePath = recipePath;
    this.#timestamp = new Date().toISOString();
  }

  /**
   * Adds an error to the validation result.
   *
   * Errors indicate critical validation failures that prevent the recipe
   * from being used. The presence of any errors will set isValid to false.
   *
   * @param {string} type - Error type identifier (e.g., 'MISSING_COMPONENT')
   * @param {string} message - Human-readable error message
   * @param {object} [metadata] - Additional context (componentId, fix, etc.)
   * @returns {ValidationResultBuilder} This instance for method chaining
   */
  addError(type, message, metadata = {}) {
    this.#errors.push({
      type,
      severity: 'error',
      message,
      ...metadata,
    });
    return this;
  }

  /**
   * Adds a warning to the validation result.
   *
   * Warnings indicate potential issues that don't prevent the recipe from
   * being used, but may cause unexpected behavior or suboptimal results.
   *
   * @param {string} type - Warning type identifier
   * @param {string} message - Human-readable warning message
   * @param {object} [metadata] - Additional context
   * @returns {ValidationResultBuilder} This instance for method chaining
   */
  addWarning(type, message, metadata = {}) {
    this.#warnings.push({
      type,
      severity: 'warning',
      message,
      ...metadata,
    });
    return this;
  }

  /**
   * Adds an informational suggestion to the validation result.
   *
   * Info messages (suggestions) provide helpful guidance for optimization
   * or best practices. They don't indicate problems with the recipe.
   *
   * NOTE: Issues with severity 'info' are stored in the 'suggestions' array,
   * not 'infos', to match the ValidationReport structure.
   *
   * @param {string} type - Info type identifier
   * @param {string} message - Human-readable suggestion message
   * @param {object} [metadata] - Additional context
   * @returns {ValidationResultBuilder} This instance for method chaining
   */
  addInfo(type, message, metadata = {}) {
    this.#suggestions.push({
      type,
      severity: 'info',
      message,
      ...metadata,
    });
    return this;
  }

  /**
   * Adds multiple issues at once, automatically categorizing by severity.
   *
   * This method is useful when collecting issues from sub-validators or
   * when processing a batch of validation results.
   *
   * @param {Array<object>} issues - Array of issue objects with 'severity' property
   * @returns {ValidationResultBuilder} This instance for method chaining
   * @example
   * builder.addIssues([
   *   { severity: 'error', type: 'ERR1', message: 'Error 1' },
   *   { severity: 'warning', type: 'WARN1', message: 'Warning 1' },
   *   { severity: 'info', type: 'INFO1', message: 'Info 1' }
   * ]);
   */
  addIssues(issues) {
    for (const issue of issues) {
      if (issue.severity === 'error') {
        this.#errors.push(issue);
      } else if (issue.severity === 'warning') {
        this.#warnings.push(issue);
      } else if (issue.severity === 'info') {
        this.#suggestions.push(issue);
      }
    }
    return this;
  }

  /**
   * Adds a success message to the validation result.
   *
   * Passed messages document validation checks that completed successfully,
   * providing positive feedback about what was validated.
   *
   * @param {string} message - Human-readable success message
   * @param {object} [metadata] - Optional metadata (check, details, etc.)
   * @returns {ValidationResultBuilder} This instance for method chaining
   */
  addPassed(message, metadata = {}) {
    this.#passed.push({ message, ...metadata });
    return this;
  }

  /**
   * Sets global metadata for the validation result.
   *
   * Metadata is spread at the top level of the result object and can be used
   * to store additional context like validator version, validation duration, etc.
   *
   * @param {string} key - Metadata key
   * @param {string|number|boolean|object|Array} value - Metadata value
   * @returns {ValidationResultBuilder} This instance for method chaining
   */
  setMetadata(key, value) {
    this.#metadata[key] = value;
    return this;
  }

  /**
   * Builds and returns the final validation result object.
   *
   * The result is frozen to prevent accidental modification after creation.
   * The isValid property is automatically calculated based on the presence
   * of errors (isValid = errors.length === 0).
   *
   * @returns {object} Frozen validation result object compatible with ValidationReport
   * @property {string} recipeId - Recipe identifier
   * @property {string|undefined} recipePath - Optional recipe file path
   * @property {string} timestamp - ISO timestamp of validation
   * @property {Array} errors - Error issues (severity: 'error')
   * @property {Array} warnings - Warning issues (severity: 'warning')
   * @property {Array} suggestions - Info issues (severity: 'info')
   * @property {Array} passed - Success messages
   * @property {boolean} isValid - True if no errors present
   */
  build() {
    const result = {
      recipeId: this.#recipeId,
      recipePath: this.#recipePath,
      timestamp: this.#timestamp,
      errors: this.#errors,
      warnings: this.#warnings,
      suggestions: this.#suggestions,
      passed: this.#passed,
      isValid: this.#errors.length === 0,
      ...this.#metadata,
    };

    return Object.freeze(result);
  }

  /**
   * Static helper method to quickly create a successful validation result.
   *
   * This is a convenience method for cases where validation passes without
   * any issues. All issue arrays will be empty and isValid will be true.
   *
   * @param {string} recipeId - Recipe identifier
   * @param {string} [recipePath] - Optional recipe file path
   * @param {object} [metadata] - Optional metadata to include
   * @returns {object} Frozen successful validation result
   * @example
   * const result = ValidationResultBuilder.success('my-recipe', 'path.json', {
   *   validatorVersion: '1.0.0',
   *   validationDuration: 42
   * });
   */
  static success(recipeId, recipePath = undefined, metadata = {}) {
    const builder = new ValidationResultBuilder(recipeId, recipePath);
    for (const [key, value] of Object.entries(metadata)) {
      builder.setMetadata(key, value);
    }
    return builder.build();
  }
}

export default ValidationResultBuilder;
