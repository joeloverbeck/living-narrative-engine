/**
 * @file Error thrown when parameter resolution fails
 * @description Error thrown when a parameter reference cannot be resolved in the execution context
 * @see GoapError.js - Base class for all GOAP errors
 */

import GoapError from './goapError.js';

/**
 * Error thrown when a parameter reference cannot be resolved in the execution context.
 * Provides detailed diagnostic information about where resolution failed.
 *
 * @class
 * @augments {GoapError}
 */
class ParameterResolutionError extends GoapError {
  // Preserve existing properties for backward compatibility
  #reference;
  #partialPath;
  #failedStep;
  #availableKeys;
  #contextType;
  #stepIndex;

  /**
   * Creates a new ParameterResolutionError instance
   *
   * @param {object} details - Error details
   * @param {string} details.reference - Original parameter reference string
   * @param {string} [details.partialPath] - Path successfully resolved before failure
   * @param {string} [details.failedStep] - The specific step where resolution failed
   * @param {string[]} [details.availableKeys] - Keys available at failure point
   * @param {string} [details.contextType] - Type of context (planning/refinement)
   * @param {number} [details.stepIndex] - Optional step index in refinement
   * @param {object} [options] - Additional options passed to GoapError
   * @param {string} [options.correlationId] - Custom correlation ID
   */
  constructor({ reference, partialPath, failedStep, availableKeys, contextType, stepIndex }, options = {}) {
    const message = ParameterResolutionError.#formatMessage({
      reference,
      partialPath,
      failedStep,
      availableKeys,
      contextType,
      stepIndex,
    });

    // Build context object for BaseError
    const context = {
      reference,
      partialPath,
      failedStep,
      availableKeys,
      contextType,
      stepIndex,
    };

    super(message, 'GOAP_PARAMETER_RESOLUTION_ERROR', context, options);

    // Preserve backward compatibility - store individual properties
    this.#reference = reference;
    this.#partialPath = partialPath;
    this.#failedStep = failedStep;
    this.#availableKeys = availableKeys;
    this.#contextType = contextType;
    this.#stepIndex = stepIndex;
  }

  // Getters for backward compatibility
  get reference() { return this.#reference; }
  get partialPath() { return this.#partialPath; }
  get failedStep() { return this.#failedStep; }
  get availableKeys() { return this.#availableKeys; }
  get contextType() { return this.#contextType; }
  get stepIndex() { return this.#stepIndex; }

  /**
   * Format error message with detailed diagnostic information
   *
   * @param {object} details - Error details
   * @param {string} details.reference - Original parameter reference string
   * @param {string} [details.partialPath] - Path successfully resolved before failure
   * @param {string} [details.failedStep] - The specific step where resolution failed
   * @param {string[]} [details.availableKeys] - Keys available at failure point
   * @param {string} [details.contextType] - Type of context (planning/refinement)
   * @param {number} [details.stepIndex] - Optional step index in refinement
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
