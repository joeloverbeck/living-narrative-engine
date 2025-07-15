/**
 * @file Bridges state management with UI and event integration for anatomy visualizer
 * @see VisualizerState.js, AnatomyLoadingDetector.js, ErrorRecovery.js
 */

import { validateDependency } from '../../utils/index.js';
import { AnatomyDataError } from '../../errors/anatomyDataError.js';
import { AnatomyStateError } from '../../errors/anatomyStateError.js';
import { ErrorClassifier } from './ErrorClassifier.js';
import { ErrorRecovery } from './ErrorRecovery.js';
import { ErrorReporter } from './ErrorReporter.js';
import { RetryStrategy } from './RetryStrategy.js';

/**
 * Controller that coordinates VisualizerState and AnatomyLoadingDetector with
 * UI components and event systems. Replaces the problematic timeout-based
 * approach with proper state-driven anatomy visualization.
 *
 * @class VisualizerStateController
 */
class VisualizerStateController {
  #visualizerState;
  #anatomyLoadingDetector;
  #eventDispatcher;
  #logger;
  #entityManager;
  #stateUnsubscribe;
  #disposed;
  #errorRecovery;
  #errorReporter;
  #retryStrategy;

  /**
   * Creates a new VisualizerStateController instance
   *
   * @param {object} dependencies - Required dependencies
   * @param {object} dependencies.visualizerState - VisualizerState instance
   * @param {object} dependencies.anatomyLoadingDetector - AnatomyLoadingDetector instance
   * @param {object} dependencies.eventDispatcher - Event dispatching service
   * @param {object} dependencies.entityManager - Entity management service
   * @param {object} dependencies.logger - Logging service
   * @param {object} dependencies.errorRecovery - Error recovery service (optional)
   * @param {object} dependencies.errorReporter - Error reporting service (optional)
   * @param {object} dependencies.retryStrategy - Retry strategy service (optional)
   */
  constructor({
    visualizerState,
    anatomyLoadingDetector,
    eventDispatcher,
    entityManager,
    logger,
    errorRecovery,
    errorReporter,
    retryStrategy,
  }) {
    // Initialize fields first
    this.#visualizerState = null;
    this.#anatomyLoadingDetector = null;
    this.#eventDispatcher = null;
    this.#logger = logger || console;
    this.#entityManager = null;
    this.#stateUnsubscribe = null;
    this.#disposed = false;
    this.#errorRecovery = null;
    this.#errorReporter = null;
    this.#retryStrategy = null;

    // Validate dependencies
    validateDependency(visualizerState, 'visualizerState');
    validateDependency(anatomyLoadingDetector, 'anatomyLoadingDetector');
    validateDependency(eventDispatcher, 'eventDispatcher');
    validateDependency(entityManager, 'entityManager');

    // Set dependencies after validation
    this.#visualizerState = visualizerState;
    this.#anatomyLoadingDetector = anatomyLoadingDetector;
    this.#eventDispatcher = eventDispatcher;
    this.#entityManager = entityManager;

    // Initialize error handling components if provided
    this.#errorRecovery = errorRecovery || this._createDefaultErrorRecovery();
    this.#errorReporter = errorReporter || this._createDefaultErrorReporter();
    this.#retryStrategy = retryStrategy || this._createDefaultRetryStrategy();

    // Subscribe to state changes only after successful validation
    this.#stateUnsubscribe = this.#visualizerState.subscribe(
      this.#handleStateChange.bind(this)
    );
  }

  /**
   * Selects an entity and starts the anatomy loading workflow
   *
   * @param {string} entityId - Entity ID to select and visualize
   * @returns {Promise<void>}
   */
  async selectEntity(entityId) {
    this.#throwIfDisposed();

    // Validate input
    if (!entityId || typeof entityId !== 'string') {
      const error = new AnatomyStateError(
        'Entity ID must be a non-empty string',
        {
          code: 'INVALID_ENTITY_ID',
          currentState: this.#visualizerState.getCurrentState(),
          operation: 'entity_selection',
          reason: 'invalid_input',
          severity: 'MEDIUM',
          recoverable: true,
        }
      );
      await this._handleErrorWithRecovery(error, 'entity_selection');
      return;
    }

    // Check current state
    const currentState = this.#visualizerState.getCurrentState();
    if (currentState === 'LOADING') {
      const error = new AnatomyStateError(
        `Cannot select entity while in ${currentState} state`,
        {
          code: 'INVALID_STATE_TRANSITION',
          currentState,
          targetState: 'LOADING',
          operation: 'entity_selection',
          reason: 'concurrent_operation',
          severity: 'MEDIUM',
          recoverable: true,
        }
      );
      await this._handleErrorWithRecovery(error, 'entity_selection');
      return;
    }

    const operationId = `select_entity_${entityId}`;

    try {
      // Use retry strategy for entity selection
      await this.#retryStrategy.execute(
        operationId,
        async () => {
          // Start entity selection
          this.#visualizerState.selectEntity(entityId);

          // Wait for entity creation and anatomy generation
          const success =
            await this.#anatomyLoadingDetector.waitForEntityWithAnatomy(
              entityId,
              {
                timeout: 10000, // 10 second timeout
                retryInterval: 100,
                useExponentialBackoff: true,
              }
            );

          if (!success) {
            throw AnatomyStateError.operationTimeout(
              'entity_loading',
              10000,
              this.#visualizerState.getCurrentState()
            );
          }

          // Get anatomy data and update state
          await this.#processAnatomyData(entityId);
        },
        {
          maxAttempts: 2,
          strategy: RetryStrategy.STRATEGY_TYPES.LINEAR,
          context: {
            operation: 'entity_selection',
            component: 'VisualizerStateController',
            data: { entityId },
          },
        }
      );
    } catch (error) {
      await this._handleErrorWithRecovery(error, 'entity_selection', {
        entityId,
        retryCallback: () => this.selectEntity(entityId),
      });
    }
  }

  /**
   * Starts the rendering process
   */
  startRendering() {
    this.#throwIfDisposed();

    const currentState = this.#visualizerState.getCurrentState();
    if (currentState !== 'LOADED') {
      throw new Error(`Cannot start rendering from ${currentState} state`);
    }

    this.#visualizerState.startRendering();
  }

  /**
   * Completes the rendering process
   */
  completeRendering() {
    this.#throwIfDisposed();

    const currentState = this.#visualizerState.getCurrentState();
    if (currentState !== 'RENDERING') {
      throw new Error(`Cannot complete rendering from ${currentState} state`);
    }

    this.#visualizerState.completeRendering();
  }

  /**
   * Handles an error by updating the state and triggering recovery mechanisms
   *
   * @param {Error} error - Error to handle
   * @param {object} context - Additional context about the error
   */
  async handleError(error, context = {}) {
    this.#throwIfDisposed();

    await this._handleErrorWithRecovery(
      error,
      context.operation || 'unknown',
      context
    );
  }

  /**
   * Retries the last operation from error state
   */
  retry() {
    this.#throwIfDisposed();

    const currentState = this.#visualizerState.getCurrentState();
    if (currentState !== 'ERROR') {
      throw new Error('Cannot retry when not in ERROR state');
    }

    this.#visualizerState.retry();
  }

  /**
   * Resets the state machine to IDLE
   */
  reset() {
    this.#throwIfDisposed();
    this.#visualizerState.reset();
  }

  /**
   * Gets the current state
   *
   * @returns {string} Current state
   */
  getCurrentState() {
    this.#throwIfDisposed();
    return this.#visualizerState.getCurrentState();
  }

  /**
   * Gets the currently selected entity
   *
   * @returns {string|null} Selected entity ID
   */
  getSelectedEntity() {
    this.#throwIfDisposed();
    return this.#visualizerState.getSelectedEntity();
  }

  /**
   * Gets the current anatomy data
   *
   * @returns {object|null} Anatomy data
   */
  getAnatomyData() {
    this.#throwIfDisposed();
    return this.#visualizerState.getAnatomyData();
  }

  /**
   * Gets the current error
   *
   * @returns {Error|null} Current error
   */
  getError() {
    this.#throwIfDisposed();
    return this.#visualizerState.getError();
  }

  /**
   * Checks if the controller has been disposed
   *
   * @returns {boolean} True if disposed
   */
  isDisposed() {
    return this.#disposed;
  }

  /**
   * Disposes the controller and cleans up resources
   */
  dispose() {
    if (this.#disposed) {
      return;
    }

    // Unsubscribe from state changes
    if (this.#stateUnsubscribe) {
      try {
        this.#stateUnsubscribe();
      } catch (error) {
        this.#logger?.warn?.('Error unsubscribing from state changes:', error);
      }
    }

    // Dispose dependencies
    try {
      if (
        this.#visualizerState &&
        typeof this.#visualizerState.dispose === 'function'
      ) {
        this.#visualizerState.dispose();
      }
      if (
        this.#anatomyLoadingDetector &&
        typeof this.#anatomyLoadingDetector.dispose === 'function'
      ) {
        this.#anatomyLoadingDetector.dispose();
      }
      if (
        this.#errorRecovery &&
        typeof this.#errorRecovery.dispose === 'function'
      ) {
        this.#errorRecovery.dispose();
      }
      if (
        this.#errorReporter &&
        typeof this.#errorReporter.dispose === 'function'
      ) {
        this.#errorReporter.dispose();
      }
      if (
        this.#retryStrategy &&
        typeof this.#retryStrategy.dispose === 'function'
      ) {
        this.#retryStrategy.dispose();
      }
    } catch (error) {
      this.#logger?.warn?.('Error disposing dependencies:', error);
    }

    this.#disposed = true;
  }

  /**
   * Sets the entity manager (for testing purposes)
   *
   * @param {object} entityManager - Entity manager instance
   * @private
   */
  _setEntityManager(entityManager) {
    this.#entityManager = entityManager;
  }

  /**
   * Handles state changes from VisualizerState
   *
   * @param {object} stateData - State change data
   * @private
   */
  #handleStateChange(stateData) {
    // Don't handle state changes if disposed
    if (this.#disposed) {
      return;
    }

    // Dispatch state change event for UI components
    try {
      if (
        this.#eventDispatcher &&
        typeof this.#eventDispatcher.dispatch === 'function'
      ) {
        this.#eventDispatcher.dispatch('anatomy:visualizer_state_changed', {
          ...stateData,
        });
      }
    } catch (error) {
      this.#logger?.warn?.('Error dispatching state change event:', error);
    }
  }

  /**
   * Processes anatomy data from an entity
   *
   * @param {string} entityId - Entity ID to process
   * @returns {Promise<void>}
   * @private
   */
  async #processAnatomyData(entityId) {
    try {
      const entity = await this.#entityManager.getEntityInstance(entityId);
      if (!entity) {
        throw AnatomyDataError.missingAnatomyData(entityId, 'entity');
      }

      const bodyComponent = entity.getComponentData('anatomy:body');
      if (!bodyComponent || !bodyComponent.body) {
        throw AnatomyDataError.missingAnatomyData(entityId, 'anatomy:body');
      }

      // Validate anatomy structure
      if (!this._validateAnatomyStructure(bodyComponent.body)) {
        throw AnatomyDataError.invalidAnatomyStructure(
          entityId,
          bodyComponent.body,
          'Invalid anatomy structure detected'
        );
      }

      // Update state with anatomy data
      this.#visualizerState.setAnatomyData(bodyComponent.body);
    } catch (error) {
      this.#logger.error(
        `Failed to process anatomy data for entity ${entityId}:`,
        error
      );
      throw error; // Re-throw to trigger error state
    }
  }

  /**
   * Throws error if controller has been disposed
   *
   * @private
   */
  #throwIfDisposed() {
    if (this.#disposed) {
      throw new Error('VisualizerStateController has been disposed');
    }
  }

  /**
   * Handle an error with comprehensive recovery mechanisms
   *
   * @private
   * @param {Error} error - Error to handle
   * @param {string} operation - Operation that failed
   * @param {object} context - Additional context
   * @returns {Promise<void>}
   */
  async _handleErrorWithRecovery(error, operation, context = {}) {
    try {
      // Report the error
      await this.#errorReporter.report(error, {
        operation,
        component: 'VisualizerStateController',
        ...context,
      });

      // Attempt recovery
      const recoveryResult = await this.#errorRecovery.handleError(error, {
        operation,
        data: context,
        retryCallback: context.retryCallback,
        fallbackOptions: context.fallbackOptions || {},
      });

      if (recoveryResult.success) {
        this.#logger.info(
          `Error recovery successful for operation: ${operation}`
        );

        // Apply recovery result if needed
        if (recoveryResult.result) {
          this._applyRecoveryResult(recoveryResult.result, operation);
        }
      } else {
        // Recovery failed, update state with error
        this.#visualizerState.setError(error);
      }
    } catch (recoveryError) {
      this.#logger.error('Error recovery failed:', recoveryError);
      // Fallback to basic error handling
      this.#visualizerState.setError(error);
    }
  }

  /**
   * Apply recovery result to the visualizer state
   *
   * @private
   * @param {object} result - Recovery result
   * @param {string} operation - Operation being recovered
   */
  _applyRecoveryResult(result, operation) {
    try {
      if (result.emptyVisualization) {
        // Show empty state
        this.#visualizerState.setAnatomyData(null);
        this.#visualizerState.completeRendering();
      } else if (result.partialVisualization) {
        // Continue with available data
        // State should already be set from partial data
      } else if (result.stateReset) {
        // Reset the visualizer state
        this.#visualizerState.reset();
      } else if (result.textFallback || result.simpleLayout) {
        // These would be handled by the renderer
        // Just complete the loading process
        this.#visualizerState.completeRendering();
      }
    } catch (applyError) {
      this.#logger.warn('Failed to apply recovery result:', applyError);
    }
  }

  /**
   * Validate anatomy structure for basic correctness
   *
   * @private
   * @param {object} anatomyData - Anatomy data to validate
   * @returns {boolean} True if structure is valid
   */
  _validateAnatomyStructure(anatomyData) {
    if (!anatomyData || typeof anatomyData !== 'object') {
      return false;
    }

    // Check for required root field
    if (!anatomyData.root) {
      return false;
    }

    // Basic structure validation - could be expanded
    return true;
  }

  /**
   * Create default error recovery instance
   *
   * @private
   * @returns {ErrorRecovery} Default error recovery instance
   */
  _createDefaultErrorRecovery() {
    return new ErrorRecovery(
      {
        logger: this.#logger,
        eventDispatcher: this.#eventDispatcher,
      },
      {
        maxRetryAttempts: 2,
        retryDelayMs: 1000,
        useExponentialBackoff: true,
      }
    );
  }

  /**
   * Create default error reporter instance
   *
   * @private
   * @returns {ErrorReporter} Default error reporter instance
   */
  _createDefaultErrorReporter() {
    return new ErrorReporter(
      {
        logger: this.#logger,
        eventDispatcher: this.#eventDispatcher,
      },
      {
        enableMetrics: false, // Disabled by default for now
        reportLevels: ['CRITICAL', 'HIGH'],
        maxStackTraceLines: 5,
      }
    );
  }

  /**
   * Create default retry strategy instance
   *
   * @private
   * @returns {RetryStrategy} Default retry strategy instance
   */
  _createDefaultRetryStrategy() {
    return new RetryStrategy(
      {
        logger: this.#logger,
      },
      {
        maxAttempts: 2,
        baseDelayMs: 1000,
        strategy: RetryStrategy.STRATEGY_TYPES.LINEAR,
        circuitBreakerThreshold: 3,
        circuitBreakerTimeoutMs: 30000,
      }
    );
  }
}

export { VisualizerStateController };
