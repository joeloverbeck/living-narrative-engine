/**
 * @file Shared UI state management for character-builder pages
 * @description Provides consistent state management across character-builder interfaces
 */

/**
 * UI states for character-builder pages
 */
export const UI_STATES = {
  EMPTY: 'empty',
  LOADING: 'loading',
  RESULTS: 'results',
  ERROR: 'error',
};

/**
 * Manages UI state transitions for character-builder pages
 */
export class UIStateManager {
  #elements;
  #currentState = null;

  /**
   * @param {object} elements - DOM element references
   * @param {HTMLElement} elements.emptyState - Empty state container
   * @param {HTMLElement} elements.loadingState - Loading state container
   * @param {HTMLElement} elements.errorState - Error state container
   * @param {HTMLElement} elements.resultsState - Results state container
   */
  constructor(elements) {
    this.#elements = elements;
    this.#validateElements();
  }

  /**
   * Validate required elements
   *
   * @private
   */
  #validateElements() {
    const required = [
      'emptyState',
      'loadingState',
      'errorState',
      'resultsState',
    ];
    for (const key of required) {
      if (!this.#elements[key]) {
        throw new Error(`UIStateManager: Missing required element: ${key}`);
      }
    }
  }

  /**
   * Show a specific state
   *
   * @param {string} state - State to show (from UI_STATES)
   * @param {string} [message] - Optional message for loading/error states
   */
  showState(state, message = null) {
    if (!Object.values(UI_STATES).includes(state)) {
      throw new Error(`UIStateManager: Invalid state: ${state}`);
    }

    // Hide all states
    this.#hideAllStates();

    // Show the requested state
    const element = this.#getStateElement(state);
    if (element) {
      element.style.display = 'block';

      // Update message if provided (including empty string)
      if (
        message !== null &&
        (state === UI_STATES.LOADING || state === UI_STATES.ERROR)
      ) {
        this.#updateStateMessage(state, message);
      }
    }

    this.#currentState = state;
  }

  /**
   * Show error state with message
   *
   * @param {string} message - Error message to display
   */
  showError(message) {
    this.showState(UI_STATES.ERROR, message);
  }

  /**
   * Show loading state with message
   *
   * @param {string} message - Loading message to display
   */
  showLoading(message = 'Loading...') {
    this.showState(UI_STATES.LOADING, message);
  }

  /**
   * Get current state
   *
   * @returns {string|null} Current state
   */
  getCurrentState() {
    return this.#currentState;
  }

  /**
   * Hide all state elements
   *
   * @private
   */
  #hideAllStates() {
    Object.values(this.#elements).forEach((element) => {
      if (element) {
        element.style.display = 'none';
      }
    });
  }

  /**
   * Get DOM element for a state
   *
   * @private
   * @param {string} state - State name
   * @returns {HTMLElement|null} DOM element
   */
  #getStateElement(state) {
    const elementMap = {
      [UI_STATES.EMPTY]: this.#elements.emptyState,
      [UI_STATES.LOADING]: this.#elements.loadingState,
      [UI_STATES.ERROR]: this.#elements.errorState,
      [UI_STATES.RESULTS]: this.#elements.resultsState,
    };
    return elementMap[state] || null;
  }

  /**
   * Update message for loading or error states
   *
   * @private
   * @param {string} state - State name
   * @param {string} message - Message to display
   */
  #updateStateMessage(state, message) {
    const element = this.#getStateElement(state);
    if (!element) return;

    let messageElement;
    if (state === UI_STATES.LOADING) {
      messageElement = element.querySelector('p');
    } else if (state === UI_STATES.ERROR) {
      messageElement = element.querySelector('.error-message, p');
    }

    if (messageElement) {
      messageElement.textContent = message;
    }
  }
}

export default UIStateManager;
