/**
 * @file Handles save button feedback animations
 * @see src/modManager/animations/CascadeAnimator.js
 */

/**
 * @typedef {object} SaveFeedbackAnimatorOptions
 * @property {object} logger - Logger instance for debug output
 * @property {number} [successDuration=2000] - Duration to show success state (ms)
 * @property {number} [errorDuration=3000] - Duration to show error state (ms)
 */

/**
 * Animation states
 *
 * @enum {string}
 */
const SaveState = {
  IDLE: 'idle',
  SAVING: 'saving',
  SUCCESS: 'success',
  ERROR: 'error',
};

/**
 * Animates save button feedback states
 */
export class SaveFeedbackAnimator {
  #logger;
  #successDuration;
  #errorDuration;
  #currentState;
  #resetTimer;

  /**
   * Creates a new SaveFeedbackAnimator instance.
   *
   * @param {SaveFeedbackAnimatorOptions} options - Configuration options
   */
  constructor({ logger, successDuration = 2000, errorDuration = 3000 }) {
    this.#logger = logger;
    this.#successDuration = successDuration;
    this.#errorDuration = errorDuration;
    this.#currentState = SaveState.IDLE;
    this.#resetTimer = null;
  }

  /**
   * Show saving state
   *
   * @param {HTMLElement} button - The save button element
   */
  showSaving(button) {
    if (!button) return;

    this.#clearResetTimer();
    this.#removeAllStateClasses(button);

    button.classList.add('save-button--saving');
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');

    this.#updateContent(button, '⏳', 'Saving...');
    this.#currentState = SaveState.SAVING;

    this.#logger.debug('Save feedback: showing saving state');
  }

  /**
   * Show success state
   *
   * @param {HTMLElement} button - The save button element
   * @param {() => void} [onReset] - Optional callback when state resets
   */
  showSuccess(button, onReset) {
    if (!button) return;

    this.#clearResetTimer();
    this.#removeAllStateClasses(button);

    button.classList.add('save-button--success');
    button.disabled = true;
    button.removeAttribute('aria-busy');

    this.#updateContent(button, '✅', 'Saved!');
    this.#currentState = SaveState.SUCCESS;

    this.#logger.debug('Save feedback: showing success state');

    this.#resetTimer = setTimeout(() => {
      this.reset(button);
      if (onReset) onReset();
    }, this.#successDuration);
  }

  /**
   * Show error state
   *
   * @param {HTMLElement} button - The save button element
   * @param {() => void} [onReset] - Optional callback when state resets
   */
  showError(button, onReset) {
    if (!button) return;

    this.#clearResetTimer();
    this.#removeAllStateClasses(button);

    button.classList.add('save-button--error');
    button.disabled = false; // Keep enabled for retry
    button.removeAttribute('aria-busy');
    button.setAttribute('aria-invalid', 'true');

    this.#updateContent(button, '❌', 'Save Failed');
    this.#currentState = SaveState.ERROR;

    this.#logger.debug('Save feedback: showing error state');

    this.#resetTimer = setTimeout(() => {
      this.reset(button);
      if (onReset) onReset();
    }, this.#errorDuration);
  }

  /**
   * Reset to idle state
   *
   * @param {HTMLElement} button - The save button element
   */
  reset(button) {
    if (!button) return;

    this.#clearResetTimer();
    this.#removeAllStateClasses(button);

    button.disabled = false;
    button.removeAttribute('aria-busy');
    button.removeAttribute('aria-invalid');

    this.#updateContent(button, '💾', 'Save Configuration');
    this.#currentState = SaveState.IDLE;

    this.#logger.debug('Save feedback: reset to idle state');
  }

  /**
   * Get current state
   *
   * @returns {string} The current animation state
   */
  getState() {
    return this.#currentState;
  }

  /**
   * Check if in a transient (non-idle) state
   *
   * @returns {boolean} True if currently animating
   */
  isTransient() {
    return this.#currentState !== SaveState.IDLE;
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.#clearResetTimer();
    this.#currentState = SaveState.IDLE;
    this.#logger.debug('Save feedback animator destroyed');
  }

  /**
   * Remove all state classes from button
   *
   * @param {HTMLElement} button - The button element to clear classes from
   */
  #removeAllStateClasses(button) {
    button.classList.remove(
      'save-button--saving',
      'save-button--success',
      'save-button--error'
    );
  }

  /**
   * Update button icon and text content
   *
   * @param {HTMLElement} button - The button element to update
   * @param {string} icon - The icon emoji to display
   * @param {string} text - The text label to display
   */
  #updateContent(button, icon, text) {
    const iconElement = button.querySelector('.save-button__icon');
    const textElement = button.querySelector('.save-button__text');

    if (iconElement) iconElement.textContent = icon;
    if (textElement) textElement.textContent = text;
  }

  /**
   * Clear any pending reset timer
   */
  #clearResetTimer() {
    if (this.#resetTimer !== null) {
      clearTimeout(this.#resetTimer);
      this.#resetTimer = null;
    }
  }
}

export { SaveState };
export default SaveFeedbackAnimator;
