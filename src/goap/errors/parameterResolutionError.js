/**
 * @file Error thrown when parameter resolution fails
 */

/**
 * Error thrown when a parameter reference cannot be resolved in the execution context.
 * Provides detailed diagnostic information about where resolution failed.
 */
class ParameterResolutionError extends Error {
  /**
   * @param {object} details - Error details
   * @param {string} details.reference - Original parameter reference string
   * @param {string} [details.partialPath] - Path successfully resolved before failure
   * @param {string} [details.failedStep] - The specific step where resolution failed
   * @param {string[]} [details.availableKeys] - Keys available at failure point
   * @param {string} [details.contextType] - Type of context (planning/refinement)
   * @param {number} [details.stepIndex] - Optional step index in refinement
   */
  constructor({ reference, partialPath, failedStep, availableKeys, contextType, stepIndex }) {
    const message = ParameterResolutionError.#formatMessage({
      reference,
      partialPath,
      failedStep,
      availableKeys,
      contextType,
      stepIndex,
    });

    super(message);
    this.name = 'ParameterResolutionError';
    this.reference = reference;
    this.partialPath = partialPath;
    this.failedStep = failedStep;
    this.availableKeys = availableKeys;
    this.contextType = contextType;
    this.stepIndex = stepIndex;

    // Maintain proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ParameterResolutionError);
    }
  }

  /**
   * Format error message with detailed diagnostic information
   *
   * @param {object} details - Error details
   * @param details.reference
   * @param details.partialPath
   * @param details.failedStep
   * @param details.availableKeys
   * @param details.contextType
   * @param details.stepIndex
   * @returns {string} Formatted error message
   */
  static #formatMessage({ reference, partialPath, failedStep, availableKeys, contextType, stepIndex }) {
    let message = `Parameter '${reference}' not found in context`;

    if (partialPath) {
      message += `\n  Resolved: ${partialPath}`;
    }

    if (failedStep) {
      message += `\n  Failed at: ${failedStep}`;
    }

    if (availableKeys && availableKeys.length > 0) {
      message += `\n  Available keys: [${availableKeys.map((k) => `"${k}"`).join(', ')}]`;
    }

    if (contextType) {
      message += `\n  Context: ${contextType}`;
      if (stepIndex !== undefined) {
        message += ` step ${stepIndex}`;
      }
    }

    return message;
  }
}

export default ParameterResolutionError;
