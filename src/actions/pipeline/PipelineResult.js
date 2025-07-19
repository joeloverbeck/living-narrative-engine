/**
 * @file Result object for pipeline execution
 * @see Pipeline.js
 */

/** @typedef {import('../errors/actionErrorTypes.js').ActionErrorContext} ActionErrorContext */
/** @typedef {import('../../interfaces/IActionDiscoveryService.js').DiscoveredActionInfo} DiscoveredActionInfo */

/**
 * @class PipelineResult
 * @description Represents the result of a pipeline stage execution
 */
export class PipelineResult {
  /**
   * Creates a PipelineResult instance
   *
   * @param {object} params - The result parameters
   * @param {boolean} params.success - Whether the stage completed successfully
   * @param {DiscoveredActionInfo[]} [params.actions] - Valid discovered actions
   * @param {ActionErrorContext[]} [params.errors] - Errors encountered during processing
   * @param {object} [params.data] - Additional data to pass to the next stage
   * @param {boolean} [params.continueProcessing] - Whether to continue to the next stage
   */
  constructor({
    success,
    actions = [],
    errors = [],
    data = {},
    continueProcessing = true,
  }) {
    this.success = success;
    this.actions = actions;
    this.errors = errors;
    this.data = data;
    this.continueProcessing = continueProcessing;
  }

  /**
   * Creates a successful result
   *
   * @param {object} [params] - Optional parameters
   * @param {DiscoveredActionInfo[]} [params.actions] - Valid discovered actions
   * @param {ActionErrorContext[]} [params.errors] - Errors encountered
   * @param {object} [params.data] - Additional data
   * @returns {PipelineResult}
   */
  static success(params = {}) {
    return new PipelineResult({
      success: true,
      ...params,
    });
  }

  /**
   * Creates a failure result
   *
   * @param {ActionErrorContext[]} errors - The errors that occurred
   * @param {object} [data] - Additional data
   * @returns {PipelineResult}
   */
  static failure(errors, data = {}) {
    return new PipelineResult({
      success: false,
      errors: Array.isArray(errors) ? errors : [errors],
      data,
      continueProcessing: false,
    });
  }

  /**
   * Merges another result into this one
   *
   * @param {PipelineResult} other - The other result to merge
   * @returns {PipelineResult} A new merged result
   */
  merge(other) {
    return new PipelineResult({
      success: this.success && other.success,
      actions: [...this.actions, ...other.actions],
      errors: [...this.errors, ...other.errors],
      data: { ...this.data, ...other.data },
      continueProcessing: this.continueProcessing && other.continueProcessing,
    });
  }
}

export default PipelineResult;
