/**
 * @file Failure Injection Helper for E2E Tests
 * @description Utilities for injecting failures at various points in the action
 * execution pipeline to test recovery mechanisms and error handling
 */

import {
  ACTION_EXECUTION_FAILED,
  ACTION_VALIDATION_FAILED,
  SYSTEM_ERROR_OCCURRED,
} from '../../../../src/constants/eventIds.js';

/**
 * Creates a failure injector for testing error scenarios
 *
 * @param {object} facades - Object containing facade services
 * @param {Function} mockFn - Mock function creator (typically jest.fn)
 * @returns {object} Failure injection utilities
 */
export function createFailureInjector(facades, mockFn) {
  if (!facades || !mockFn) {
    throw new Error('createFailureInjector: Missing required parameters');
  }

  const errorEvents = [];
  const resourceTracker = {
    timers: new Set(),
    restoreFunctions: new Set(),
    eventListeners: new Set(),
    mockReplacements: new Map(),
  };

  // Track error events
  if (facades.entityService && facades.entityService.subscribeToEvent) {
    const actionFailedHandler = (event) => errorEvents.push(event);
    const validationFailedHandler = (event) => errorEvents.push(event);
    const systemErrorHandler = (event) => errorEvents.push(event);

    facades.entityService.subscribeToEvent(ACTION_EXECUTION_FAILED, actionFailedHandler);
    facades.entityService.subscribeToEvent(ACTION_VALIDATION_FAILED, validationFailedHandler);
    facades.entityService.subscribeToEvent(SYSTEM_ERROR_OCCURRED, systemErrorHandler);

    // Track listeners for cleanup
    resourceTracker.eventListeners.add({
      service: facades.entityService,
      event: ACTION_EXECUTION_FAILED,
      handler: actionFailedHandler,
    });
    resourceTracker.eventListeners.add({
      service: facades.entityService,
      event: ACTION_VALIDATION_FAILED,
      handler: validationFailedHandler,
    });
    resourceTracker.eventListeners.add({
      service: facades.entityService,
      event: SYSTEM_ERROR_OCCURRED,
      handler: systemErrorHandler,
    });
  }

  return {
    /**
     * Inject a failure at a specific pipeline stage
     *
     * @param {string} stage - The pipeline stage to fail at
     * @param {Error} error - The error to throw
     */
    injectPipelineStageFailure(
      stage,
      error = new Error('Pipeline stage failure')
    ) {
      switch (stage) {
        case 'ComponentFilteringStage':
          if (facades.actionService.filterComponents) {
            facades.actionService.filterComponents =
              mockFn().mockRejectedValueOnce(error);
          }
          break;

        case 'PrerequisiteEvaluationStage':
          if (facades.actionService.evaluatePrerequisites) {
            facades.actionService.evaluatePrerequisites =
              mockFn().mockRejectedValueOnce(error);
          }
          break;

        case 'TargetResolutionStage':
          if (facades.actionService.resolveTargets) {
            facades.actionService.resolveTargets =
              mockFn().mockRejectedValueOnce(error);
          }
          break;

        case 'ActionFormattingStage':
          if (facades.actionService.formatAction) {
            facades.actionService.formatAction =
              mockFn().mockRejectedValueOnce(error);
          }
          break;

        default:
          throw new Error(`Unknown pipeline stage: ${stage}`);
      }
    },

    /**
     * Inject a service failure
     *
     * @param {string} serviceName - Name of the service to fail
     * @param {string} methodName - Method that should fail
     * @param {Error} error - The error to throw
     */
    injectServiceFailure(
      serviceName,
      methodName,
      error = new Error('Service failure')
    ) {
      const service = facades[serviceName];
      if (!service) {
        throw new Error(`Service not found: ${serviceName}`);
      }

      if (!service[methodName]) {
        throw new Error(`Method not found: ${serviceName}.${methodName}`);
      }

      // Store original method
      const originalMethod = service[methodName];
      const key = `${serviceName}.${methodName}`;
      resourceTracker.mockReplacements.set(key, originalMethod);

      // Replace with failing mock
      service[methodName] = mockFn().mockRejectedValueOnce(error);

      // Create and track restore function
      const restoreFunction = () => {
        service[methodName] = originalMethod;
        resourceTracker.mockReplacements.delete(key);
      };
      
      resourceTracker.restoreFunctions.add(restoreFunction);
      return restoreFunction;
    },

    /**
     * Inject an entity manager failure during state update
     *
     * @param {string} operation - The operation to fail (update, create, remove)
     * @param {Error} error - The error to throw
     */
    injectEntityManagerFailure(
      operation,
      error = new Error('Entity manager failure')
    ) {
      if (!facades.entityService) {
        throw new Error('Entity service not available');
      }

      switch (operation) {
        case 'update':
          facades.entityService.updateEntity =
            mockFn().mockRejectedValueOnce(error);
          break;

        case 'create':
          facades.entityService.createEntity =
            mockFn().mockRejectedValueOnce(error);
          break;

        case 'remove':
          facades.entityService.removeEntity =
            mockFn().mockRejectedValueOnce(error);
          break;

        case 'updateComponent':
          facades.entityService.updateComponent =
            mockFn().mockRejectedValueOnce(error);
          break;

        default:
          throw new Error(`Unknown entity operation: ${operation}`);
      }
    },

    /**
     * Inject an event bus failure
     *
     * @param {Error} error - The error to throw
     */
    injectEventBusFailure(error = new Error('Event bus failure')) {
      if (facades.entityService && facades.entityService.dispatchEvent) {
        const originalDispatch = facades.entityService.dispatchEvent;
        facades.entityService.dispatchEvent =
          mockFn().mockRejectedValueOnce(error);

        return () => {
          facades.entityService.dispatchEvent = originalDispatch;
        };
      }
    },

    /**
     * Inject a turn manager failure
     *
     * @param {string} operation - The operation to fail
     * @param {Error} error - The error to throw
     */
    injectTurnManagerFailure(
      operation,
      error = new Error('Turn manager failure')
    ) {
      if (!facades.turnExecutionFacade) {
        throw new Error('Turn execution facade not available');
      }

      switch (operation) {
        case 'advanceTurn':
          facades.turnExecutionFacade.advanceTurn =
            mockFn().mockRejectedValueOnce(error);
          break;

        case 'processTurn':
          facades.turnExecutionFacade.processTurn =
            mockFn().mockRejectedValueOnce(error);
          break;

        case 'recordAction':
          facades.turnExecutionFacade.recordAction =
            mockFn().mockRejectedValueOnce(error);
          break;

        default:
          throw new Error(`Unknown turn operation: ${operation}`);
      }
    },

    /**
     * Simulate a partial execution failure
     *
     * @param {number} failAfterMs - Milliseconds to wait before failing
     * @param {Error} error - The error to throw
     */
    injectDelayedFailure(
      failAfterMs,
      error = new Error('Delayed execution failure')
    ) {
      return new Promise((_, reject) => {
        setTimeout(() => reject(error), failAfterMs);
      });
    },

    /**
     * Inject validation failure for specific action
     *
     * @param {string} actionId - The action ID to fail validation for
     * @param {string} reason - Validation failure reason
     */
    injectActionValidationFailure(actionId, reason = 'Validation failed') {
      if (facades.actionService && facades.actionService.validateAction) {
        const originalValidate = facades.actionService.validateAction;

        facades.actionService.validateAction = mockFn().mockImplementation(
          async (action) => {
            if (action.actionId === actionId) {
              return {
                success: false,
                error: reason,
                validationErrors: [{ field: 'actionId', message: reason }],
              };
            }
            return originalValidate(action);
          }
        );

        return () => {
          facades.actionService.validateAction = originalValidate;
        };
      }
    },

    /**
     * Get all error events that have been dispatched
     *
     * @returns {Array} Array of error events
     */
    getErrorEvents() {
      return [...errorEvents];
    },

    /**
     * Clear tracked error events
     */
    clearErrorEvents() {
      errorEvents.length = 0;
    },

    /**
     * Clean up all tracked resources
     */
    async cleanupAllResources() {
      // Clear all timers
      for (const timerId of resourceTracker.timers) {
        clearTimeout(timerId);
      }
      resourceTracker.timers.clear();

      // Remove all event listeners
      for (const listener of resourceTracker.eventListeners) {
        if (listener.service && listener.service.unsubscribeFromEvent) {
          listener.service.unsubscribeFromEvent(listener.event, listener.handler);
        }
      }
      resourceTracker.eventListeners.clear();

      // Restore all mocked methods
      for (const restoreFunction of resourceTracker.restoreFunctions) {
        try {
          restoreFunction();
        } catch (error) {
          console.warn('Error restoring mock function:', error);
        }
      }
      resourceTracker.restoreFunctions.clear();

      // Clear mock replacements map
      resourceTracker.mockReplacements.clear();

      // Clear error events
      errorEvents.length = 0;
    },

    /**
     * Create a mock that fails after N successful calls
     *
     * @param {Function} originalMethod - The original method
     * @param {number} successCount - Number of successful calls before failure
     * @param {Error} error - The error to throw
     * @returns {Function} Mock function
     */
    createFailAfterNCallsMock(originalMethod, successCount, error) {
      let callCount = 0;

      return mockFn().mockImplementation(async (...args) => {
        callCount++;
        if (callCount > successCount) {
          throw error;
        }
        return originalMethod(...args);
      });
    },

    /**
     * Inject random failures with specified probability
     *
     * @param {object} service - Service to inject failures into
     * @param {string} methodName - Method name to wrap
     * @param {number} failureProbability - Probability of failure (0-1)
     * @param {Error} error - The error to throw on failure
     */
    injectRandomFailure(
      service,
      methodName,
      failureProbability,
      error = new Error('Random failure')
    ) {
      const originalMethod = service[methodName];

      service[methodName] = mockFn().mockImplementation(async (...args) => {
        if (Math.random() < failureProbability) {
          throw error;
        }
        return originalMethod(...args);
      });

      return () => {
        service[methodName] = originalMethod;
      };
    },

    /**
     * Simulate cascading failures
     *
     * @param {Array} failureSequence - Array of {service, method, error, delay} objects
     */
    async injectCascadingFailures(failureSequence) {
      const restoreFunctions = [];

      for (const failure of failureSequence) {
        if (failure.delay) {
          // Use promise-based delay that can be tracked and cleaned up
          await new Promise((resolve) => {
            const timerId = setTimeout(resolve, failure.delay);
            resourceTracker.timers.add(timerId);
            // Auto-remove from tracker when timer completes
            setTimeout(() => resourceTracker.timers.delete(timerId), failure.delay + 1);
          });
        }

        const restore = this.injectServiceFailure(
          failure.service,
          failure.method,
          failure.error
        );

        if (restore) {
          restoreFunctions.push(restore);
        }
      }

      return async () => {
        // Wait for all delays to complete before restoring
        await new Promise(resolve => {
          if (resourceTracker.timers.size === 0) {
            resolve();
          } else {
            const checkInterval = setInterval(() => {
              if (resourceTracker.timers.size === 0) {
                clearInterval(checkInterval);
                resolve();
              }
            }, 10);
            // Safety timeout
            setTimeout(() => {
              clearInterval(checkInterval);
              resolve();
            }, 1000);
          }
        });

        for (const restore of restoreFunctions) {
          restore();
        }
      };
    },
  };
}

/**
 * Creates predefined error scenarios for common test cases
 */
export const ErrorScenarios = {
  NETWORK_TIMEOUT: new Error('Network timeout'),
  SERVICE_UNAVAILABLE: new Error('Service temporarily unavailable'),
  INVALID_STATE: new Error('Invalid game state'),
  PERMISSION_DENIED: new Error('Permission denied'),
  RESOURCE_EXHAUSTED: new Error('Resource exhausted'),
  DATA_CORRUPTION: new Error('Data corruption detected'),
  CONCURRENT_MODIFICATION: new Error('Concurrent modification detected'),

  /**
   * Create a custom error with additional context
   *
   * @param {string} message - Error message
   * @param {object} context - Additional error context
   * @returns {Error} Custom error
   */
  createContextualError(message, context) {
    const error = new Error(message);
    error.context = context;
    error.timestamp = Date.now();
    return error;
  },
};
