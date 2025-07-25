/**
 * @file Error class for anatomy visualizer state management issues
 * @see src/errors/anatomyVisualizationError.js
 */

import { AnatomyVisualizationError } from './anatomyVisualizationError.js';

/**
 * Error thrown when anatomy visualizer state transitions or management fails.
 * Used for invalid state transitions, state corruption, initialization failures,
 * and state synchronization issues.
 *
 * @class
 * @augments {AnatomyVisualizationError}
 */
export class AnatomyStateError extends AnatomyVisualizationError {
  /**
   * Create a new AnatomyStateError instance.
   *
   * @param {string} message - The error message
   * @param {object} options - Error options
   * @param {string} options.currentState - Current state when error occurred
   * @param {string} options.targetState - Target state of failed transition
   * @param {string} options.operation - Operation that was attempted
   * @param {object} options.stateData - State data when error occurred
   * @param {string} options.reason - Specific reason for state error
   * @param {...*} options.rest - Additional options passed to parent class
   */
  constructor(message, options = {}) {
    const {
      currentState,
      targetState,
      operation,
      stateData,
      reason,
      ...parentOptions
    } = options;

    super(message, {
      code: 'ANATOMY_STATE_ERROR',
      severity: 'MEDIUM',
      context: `State transition from ${currentState || 'unknown'} to ${targetState || 'unknown'}`,
      userMessage: AnatomyStateError._getUserMessage(
        operation,
        currentState,
        targetState
      ),
      suggestions: AnatomyStateError._getSuggestions(operation, reason),
      ...parentOptions,
    });

    this.name = 'AnatomyStateError';
    this.currentState = currentState || null;
    this.targetState = targetState || null;
    this.operation = operation || null;
    this.stateData = stateData || null;
    this.reason = reason || null;
  }

  /**
   * Create an error for invalid state transition
   *
   * @param {string} currentState - Current state
   * @param {string} targetState - Target state that's invalid
   * @param {string} operation - Operation that triggered the transition
   * @returns {AnatomyStateError} Configured error instance
   */
  static invalidStateTransition(currentState, targetState, operation) {
    return new AnatomyStateError(
      `Invalid state transition from ${currentState} to ${targetState} during ${operation}`,
      {
        code: 'INVALID_STATE_TRANSITION',
        currentState,
        targetState,
        operation,
        reason: 'transition_not_allowed',
        severity: 'HIGH',
        recoverable: true,
        userMessage:
          'The anatomy visualizer is in an invalid state for this operation.',
        suggestions: [
          'Wait for the current operation to complete',
          'Try resetting the visualizer',
          'Refresh the page if the problem persists',
        ],
      }
    );
  }

  /**
   * Create an error for state initialization failure
   *
   * @param {string} reason - Reason for initialization failure
   * @param {Error} cause - Original error that caused initialization failure
   * @returns {AnatomyStateError} Configured error instance
   */
  static initializationFailed(reason, cause) {
    return new AnatomyStateError(`State initialization failed: ${reason}`, {
      code: 'STATE_INITIALIZATION_FAILED',
      currentState: 'UNINITIALIZED',
      targetState: 'IDLE',
      operation: 'initialization',
      reason,
      cause,
      severity: 'CRITICAL',
      recoverable: false,
      userMessage: 'The anatomy visualizer could not be initialized.',
      suggestions: [
        'Refresh the page to restart the visualizer',
        'Check your browser console for more details',
        'Ensure your browser supports required features',
      ],
    });
  }

  /**
   * Create an error for operation timeout
   *
   * @param {string} operation - Operation that timed out
   * @param {number} timeout - Timeout duration in milliseconds
   * @param {string} currentState - State when timeout occurred
   * @returns {AnatomyStateError} Configured error instance
   */
  static operationTimeout(operation, timeout, currentState) {
    return new AnatomyStateError(
      `Operation ${operation} timed out after ${timeout}ms in state ${currentState}`,
      {
        code: 'OPERATION_TIMEOUT',
        currentState,
        operation,
        reason: 'timeout',
        metadata: { timeout },
        severity: 'MEDIUM',
        recoverable: true,
        userMessage: 'The operation is taking longer than expected.',
        suggestions: [
          'Try the operation again',
          'Check your network connection',
          'The entity may have complex anatomy that takes time to process',
        ],
      }
    );
  }

  /**
   * Create an error for state corruption
   *
   * @param {string} currentState - Corrupted state
   * @param {object} stateData - Corrupted state data
   * @param {string} detectedIssue - Specific corruption detected
   * @returns {AnatomyStateError} Configured error instance
   */
  static stateCorruption(currentState, stateData, detectedIssue) {
    return new AnatomyStateError(
      `State corruption detected in ${currentState}: ${detectedIssue}`,
      {
        code: 'STATE_CORRUPTION',
        currentState,
        stateData,
        reason: detectedIssue,
        severity: 'HIGH',
        recoverable: false,
        userMessage: 'The anatomy visualizer state has become corrupted.',
        suggestions: [
          'Reset the visualizer to clear the corrupted state',
          'Refresh the page to restart completely',
          'Try selecting a different entity',
        ],
      }
    );
  }

  /**
   * Create an error for concurrent operation conflict
   *
   * @param {string} currentOperation - Currently running operation
   * @param {string} attemptedOperation - Operation that was attempted
   * @param {string} currentState - Current state
   * @returns {AnatomyStateError} Configured error instance
   */
  static concurrentOperationConflict(
    currentOperation,
    attemptedOperation,
    currentState
  ) {
    return new AnatomyStateError(
      `Cannot perform ${attemptedOperation} while ${currentOperation} is in progress in state ${currentState}`,
      {
        code: 'CONCURRENT_OPERATION_CONFLICT',
        currentState,
        operation: attemptedOperation,
        reason: 'concurrent_operation',
        metadata: { currentOperation, attemptedOperation },
        severity: 'MEDIUM',
        recoverable: true,
        userMessage: 'Another operation is currently in progress.',
        suggestions: [
          'Wait for the current operation to complete',
          'Try again in a few moments',
          'Cancel the current operation if possible',
        ],
      }
    );
  }

  /**
   * Create an error for missing required state data
   *
   * @param {string} currentState - Current state
   * @param {string} missingData - Type of data that's missing
   * @param {string} operation - Operation that requires the data
   * @returns {AnatomyStateError} Configured error instance
   */
  static missingRequiredStateData(currentState, missingData, operation) {
    return new AnatomyStateError(
      `Missing required state data '${missingData}' for operation ${operation} in state ${currentState}`,
      {
        code: 'MISSING_REQUIRED_STATE_DATA',
        currentState,
        operation,
        reason: `missing_${missingData}`,
        severity: 'HIGH',
        recoverable: true,
        userMessage: 'Required information is missing for this operation.',
        suggestions: [
          'Try starting the process over',
          'Select an entity first if none is selected',
          'Ensure all required steps have been completed',
        ],
      }
    );
  }

  /**
   * Get user-friendly message based on operation and states
   *
   * @private
   * @param {string} operation - Operation that was attempted
   * @param {string} currentState - Current state
   * @param {string} targetState - Target state
   * @returns {string} User-friendly message
   */
  static _getUserMessage(operation, currentState, targetState) {
    switch (operation) {
      case 'initialization':
        return 'The anatomy visualizer could not be started.';
      case 'entity_selection':
        return 'Could not select the entity for visualization.';
      case 'anatomy_loading':
        return 'Could not load anatomy data for the selected entity.';
      case 'rendering':
        return 'Could not render the anatomy visualization.';
      case 'reset':
        return 'Could not reset the anatomy visualizer.';
      case 'retry':
        return 'Could not retry the previous operation.';
      default:
        if (currentState === 'ERROR') {
          return 'The anatomy visualizer is in an error state.';
        }
        if (currentState === 'LOADING') {
          return 'An operation is already in progress.';
        }
        return 'The anatomy visualizer encountered a state error.';
    }
  }

  /**
   * Get suggestions based on operation and reason
   *
   * @private
   * @param {string} operation - Operation that was attempted
   * @param {string} reason - Specific reason for the error
   * @returns {Array<string>} Recovery suggestions
   */
  static _getSuggestions(operation, reason) {
    const baseSuggestions = [];

    switch (reason) {
      case 'transition_not_allowed':
        baseSuggestions.push('Wait for the current operation to complete');
        baseSuggestions.push('Try resetting the visualizer');
        break;
      case 'timeout':
        baseSuggestions.push('Try the operation again');
        baseSuggestions.push('Check your network connection');
        break;
      case 'concurrent_operation':
        baseSuggestions.push('Wait for the current operation to finish');
        baseSuggestions.push('Try again in a few moments');
        break;
      default:
        switch (operation) {
          case 'initialization':
            baseSuggestions.push('Refresh the page to restart');
            baseSuggestions.push('Check browser compatibility');
            break;
          case 'entity_selection':
            baseSuggestions.push('Try selecting a different entity');
            baseSuggestions.push('Ensure the entity has valid data');
            break;
          case 'anatomy_loading':
            baseSuggestions.push('Check your network connection');
            baseSuggestions.push('Try a different entity');
            break;
          case 'rendering':
            baseSuggestions.push('Try refreshing the page');
            baseSuggestions.push('Select an entity with simpler anatomy');
            break;
          default:
            baseSuggestions.push('Try refreshing the page');
            baseSuggestions.push('Reset the visualizer if possible');
        }
    }

    return baseSuggestions;
  }
}
