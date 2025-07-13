/**
 * @file Bridges state management with UI and event integration for anatomy visualizer
 * @see VisualizerState.js, AnatomyLoadingDetector.js
 */

import { validateDependency } from '../../utils/index.js';

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

  /**
   * Creates a new VisualizerStateController instance
   *
   * @param {object} dependencies - Required dependencies
   * @param {object} dependencies.visualizerState - VisualizerState instance
   * @param {object} dependencies.anatomyLoadingDetector - AnatomyLoadingDetector instance
   * @param {object} dependencies.eventDispatcher - Event dispatching service
   * @param {object} dependencies.logger - Logging service
   */
  constructor({
    visualizerState,
    anatomyLoadingDetector,
    eventDispatcher,
    logger,
  }) {
    // Initialize fields first
    this.#visualizerState = null;
    this.#anatomyLoadingDetector = null;
    this.#eventDispatcher = null;
    this.#logger = logger || console;
    this.#entityManager = null;
    this.#stateUnsubscribe = null;
    this.#disposed = false;

    // Validate dependencies
    validateDependency(visualizerState, 'visualizerState');
    validateDependency(anatomyLoadingDetector, 'anatomyLoadingDetector');
    validateDependency(eventDispatcher, 'eventDispatcher');

    // Set dependencies after validation
    this.#visualizerState = visualizerState;
    this.#anatomyLoadingDetector = anatomyLoadingDetector;
    this.#eventDispatcher = eventDispatcher;

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

    if (!entityId || typeof entityId !== 'string') {
      throw new Error('Entity ID must be a non-empty string');
    }

    const currentState = this.#visualizerState.getCurrentState();
    if (currentState === 'LOADING') {
      throw new Error(`Cannot select entity while in ${currentState} state`);
    }

    try {
      // Start entity selection
      this.#visualizerState.selectEntity(entityId);

      // Wait for entity creation and anatomy generation
      const success =
        await this.#anatomyLoadingDetector.waitForEntityWithAnatomy(entityId, {
          timeout: 10000, // 10 second timeout
          retryInterval: 100,
          useExponentialBackoff: true,
        });

      if (!success) {
        throw new Error(`Failed to load anatomy for entity: ${entityId}`);
      }

      // Get anatomy data and update state
      if (this.#entityManager) {
        await this.#processAnatomyData(entityId);
      } else {
        // In testing, we'll mock this behavior
        this.#logger.debug?.('EntityManager not available - using test mode');
      }
    } catch (error) {
      this.#logger.error('Entity selection failed:', error);
      this.#visualizerState.setError(error);
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
   * Handles an error by updating the state
   *
   * @param {Error} error - Error to handle
   */
  handleError(error) {
    this.#throwIfDisposed();

    this.#logger.error('VisualizerStateController error:', error);
    this.#visualizerState.setError(error);
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
        this.#eventDispatcher.dispatch('VISUALIZER_STATE_CHANGED', {
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
        throw new Error(`Entity not found: ${entityId}`);
      }

      const bodyComponent = entity.getComponentData('anatomy:body');
      if (!bodyComponent || !bodyComponent.body) {
        throw new Error(`No anatomy data found for entity: ${entityId}`);
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
}

export { VisualizerStateController };
