/**
 * @file GlobalKeyHandler class
 * @description Listens to global keydown events and dispatches UI-related events.
 */

/** @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */

/**
 * Handles global keyboard shortcuts and dispatches corresponding UI events.
 */
class GlobalKeyHandler {
  /** @type {Document} */
  #document;
  /** @type {IValidatedEventDispatcher} */
  #validatedEventDispatcher;
  /** @type {(e: KeyboardEvent) => void} */
  #boundListener;

  /**
   * @param {Document} document - The DOM document to listen on.
   * @param {IValidatedEventDispatcher} validatedEventDispatcher - Dispatcher for UI events.
   */
  constructor(document, validatedEventDispatcher) {
    if (!document || typeof document.addEventListener !== 'function') {
      throw new Error('GlobalKeyHandler requires a valid Document.');
    }
    if (
      !validatedEventDispatcher ||
      typeof validatedEventDispatcher.dispatch !== 'function'
    ) {
      throw new Error(
        'GlobalKeyHandler requires a valid IValidatedEventDispatcher instance.'
      );
    }

    this.#document = document;
    this.#validatedEventDispatcher = validatedEventDispatcher;

    this.#boundListener = this.#handleKeyDown.bind(this);
    this.#document.addEventListener('keydown', this.#boundListener);
  }

  /**
   * Handles keydown events and dispatches matching UI events.
   *
   * @param {KeyboardEvent} event - The keydown event.
   * @private
   */
  #handleKeyDown(event) {
    if (
      event.key.toLowerCase() === 'i' &&
      !(event.target instanceof HTMLInputElement)
    ) {
      event.preventDefault();
      this.#validatedEventDispatcher
        .dispatch('ui:toggle_inventory', {})
        .catch((err) =>
          console.error(
            "GlobalKeyHandler: Failed to dispatch 'ui:toggle_inventory'",
            err
          )
        );
    }
  }

  /**
   * Removes listeners and cleans up resources.
   */
  dispose() {
    this.#document.removeEventListener('keydown', this.#boundListener);
  }
}

export default GlobalKeyHandler;
