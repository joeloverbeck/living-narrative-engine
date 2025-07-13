/**
 * @file Observable state machine for anatomy visualizer
 * @see AnatomyVisualizerUI.js
 */

/**
 * Valid states for the anatomy visualizer
 *
 * @readonly
 * @enum {string}
 */
const VISUALIZER_STATES = {
  IDLE: 'IDLE',
  LOADING: 'LOADING',
  LOADED: 'LOADED',
  ERROR: 'ERROR',
  RENDERING: 'RENDERING',
  READY: 'READY',
};

/**
 * Valid state transitions map
 *
 * @readonly
 */
const VALID_TRANSITIONS = {
  [VISUALIZER_STATES.IDLE]: [
    VISUALIZER_STATES.LOADING,
    VISUALIZER_STATES.ERROR,
  ],
  [VISUALIZER_STATES.LOADING]: [
    VISUALIZER_STATES.LOADED,
    VISUALIZER_STATES.ERROR,
  ],
  [VISUALIZER_STATES.LOADED]: [
    VISUALIZER_STATES.RENDERING,
    VISUALIZER_STATES.ERROR,
    VISUALIZER_STATES.IDLE,
  ],
  [VISUALIZER_STATES.ERROR]: [
    VISUALIZER_STATES.LOADING,
    VISUALIZER_STATES.IDLE,
  ],
  [VISUALIZER_STATES.RENDERING]: [
    VISUALIZER_STATES.READY,
    VISUALIZER_STATES.ERROR,
  ],
  [VISUALIZER_STATES.READY]: [VISUALIZER_STATES.IDLE, VISUALIZER_STATES.ERROR],
};

/**
 * Observable state machine for managing anatomy visualizer state transitions
 * and data. Provides proper state management to replace timing-based hacks.
 *
 * @class VisualizerState
 */
class VisualizerState {
  #currentState;
  #selectedEntity;
  #anatomyData;
  #error;
  #observers;
  #disposed;

  constructor() {
    this.#currentState = VISUALIZER_STATES.IDLE;
    this.#selectedEntity = null;
    this.#anatomyData = null;
    this.#error = null;
    this.#observers = new Set();
    this.#disposed = false;
  }

  /**
   * Gets the current state
   *
   * @returns {string} Current state value
   */
  getCurrentState() {
    this.#throwIfDisposed();
    return this.#currentState;
  }

  /**
   * Gets the currently selected entity ID
   *
   * @returns {string|null} Selected entity ID or null
   */
  getSelectedEntity() {
    this.#throwIfDisposed();
    return this.#selectedEntity;
  }

  /**
   * Gets the current anatomy data
   *
   * @returns {object|null} Anatomy data or null
   */
  getAnatomyData() {
    this.#throwIfDisposed();
    return this.#anatomyData;
  }

  /**
   * Gets the current error
   *
   * @returns {Error|null} Current error or null
   */
  getError() {
    this.#throwIfDisposed();
    return this.#error;
  }

  /**
   * Selects an entity and transitions to LOADING state
   *
   * @param {string} entityId - Entity ID to select
   */
  selectEntity(entityId) {
    this.#throwIfDisposed();
    if (!entityId || typeof entityId !== 'string') {
      throw new Error('Entity ID must be a non-empty string');
    }

    this.#selectedEntity = entityId;
    this.#setState(VISUALIZER_STATES.LOADING);
  }

  /**
   * Sets anatomy data and transitions to LOADED state
   *
   * @param {object} anatomyData - Anatomy data object
   */
  setAnatomyData(anatomyData) {
    this.#throwIfDisposed();
    if (!anatomyData || typeof anatomyData !== 'object') {
      throw new Error('Anatomy data must be a non-null object');
    }

    this.#anatomyData = anatomyData;
    this.#error = null; // Clear any previous errors
    this.#setState(VISUALIZER_STATES.LOADED);
  }

  /**
   * Starts rendering and transitions to RENDERING state
   */
  startRendering() {
    this.#throwIfDisposed();
    this.#validateTransition(VISUALIZER_STATES.RENDERING);
    this.#setState(VISUALIZER_STATES.RENDERING);
  }

  /**
   * Completes rendering and transitions to READY state
   */
  completeRendering() {
    this.#throwIfDisposed();
    this.#validateTransition(VISUALIZER_STATES.READY);
    this.#setState(VISUALIZER_STATES.READY);
  }

  /**
   * Sets an error and transitions to ERROR state
   *
   * @param {Error} error - Error object
   */
  setError(error) {
    this.#throwIfDisposed();
    if (!(error instanceof Error)) {
      throw new Error('Error must be an Error instance');
    }

    this.#error = error;
    this.#setState(VISUALIZER_STATES.ERROR);
  }

  /**
   * Resets the state machine to IDLE
   */
  reset() {
    this.#throwIfDisposed();
    this.#selectedEntity = null;
    this.#anatomyData = null;
    this.#error = null;
    this.#setState(VISUALIZER_STATES.IDLE);
  }

  /**
   * Retries from ERROR state by returning to LOADING with same entity
   */
  retry() {
    this.#throwIfDisposed();
    if (this.#currentState !== VISUALIZER_STATES.ERROR) {
      throw new Error('Can only retry from ERROR state');
    }
    if (!this.#selectedEntity) {
      throw new Error('Cannot retry without previous entity selection');
    }

    this.#error = null;
    this.#setState(VISUALIZER_STATES.LOADING);
  }

  /**
   * Subscribes to state changes
   *
   * @param {Function} observer - Observer function that receives state change data
   * @returns {Function} Unsubscribe function
   */
  subscribe(observer) {
    this.#throwIfDisposed();
    if (typeof observer !== 'function') {
      throw new Error('Observer must be a function');
    }

    this.#observers.add(observer);

    // Return unsubscribe function
    return () => {
      this.#observers.delete(observer);
    };
  }

  /**
   * Disposes the state machine and cleans up all observers
   */
  dispose() {
    if (this.#disposed) {
      return;
    }

    this.#observers.clear();
    this.#disposed = true;
  }

  /**
   * Sets the current state and notifies observers
   *
   * @param {string} newState - New state to transition to
   * @private
   */
  #setState(newState) {
    const previousState = this.#currentState;
    this.#currentState = newState;

    // Notify observers
    this.#notifyObservers(previousState, newState);
  }

  /**
   * Notifies all observers of state change
   *
   * @param {string} previousState - Previous state
   * @param {string} currentState - Current state
   * @private
   */
  #notifyObservers(previousState, currentState) {
    const stateData = {
      previousState,
      currentState,
      selectedEntity: this.#selectedEntity,
      anatomyData: this.#anatomyData,
      error: this.#error,
    };

    // Notify observers, handling any exceptions gracefully
    for (const observer of this.#observers) {
      try {
        observer(stateData);
      } catch (err) {
        // Log observer errors but don't let them break state transitions
        console.warn('Observer error in VisualizerState:', err);
      }
    }
  }

  /**
   * Validates if transition to new state is allowed
   *
   * @param {string} newState - State to transition to
   * @private
   */
  #validateTransition(newState) {
    const allowedTransitions = VALID_TRANSITIONS[this.#currentState];
    if (!allowedTransitions || !allowedTransitions.includes(newState)) {
      throw new Error(
        `Invalid state transition from ${this.#currentState} to ${newState}`
      );
    }
  }

  /**
   * Throws error if the state machine has been disposed
   *
   * @private
   */
  #throwIfDisposed() {
    if (this.#disposed) {
      throw new Error('VisualizerState has been disposed');
    }
  }
}

export { VisualizerState, VISUALIZER_STATES };
