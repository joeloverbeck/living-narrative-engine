// src/renderers/baseModalRenderer.js

/**
 * @file Defines BaseModalRenderer, an abstract class for managing common modal dialog behaviors.
 */

/**
 * @typedef {import('./boundDomRendererBase.js').ElementsConfig} ElementsConfigType // Alias for clarity
 */

/**
 * @typedef {ElementsConfigType & {
 * statusMessageElement?: string // Make it clear statusMessageElement is part of the expected config
 * }} ModalElementsConfig
 */

import { BoundDomRendererBase } from './boundDomRendererBase.js';

/**
 * @class BaseModalRenderer
 * @augments BoundDomRendererBase
 * @abstract
 * @description Provides a common structure and standardized methods for modal dialog behavior.
 * Manages visibility, core DOM element bindings, basic event handling (close, Escape),
 * status messages, and lifecycle hooks for subclasses.
 *
 * Subclasses must provide an `elementsConfig` that includes at least `modalElement` and `closeButton`.
 * To utilize the built-in status message functionality, `elementsConfig` should also include
 * a `statusMessageElement` key mapping to a CSS selector for the element designated to display
 * these messages.
 *
 * Subclasses should implement abstract/protected methods like `_onShow`, `_onHide`,
 * and `_getInitialFocusElement`. For displaying local feedback within the modal,
 * subclasses **must** use `this._displayStatusMessage()` and `this._clearStatusMessage()`.
 * @example
 * // elementsConfig for a subclass:
 * // {
 * //   modalElement: '#my-modal',
 * //   closeButton: '#my-modal-close-btn',
 * //   statusMessageElement: '#my-modal-status', // For local feedback
 * //   confirmButton: '#my-modal-confirm-btn'
 * // }
 */
export class BaseModalRenderer extends BoundDomRendererBase {
  /**
   * Indicates whether the modal is currently visible.
   * @type {boolean}
   * @protected
   */
  isVisible = false;

  /**
   * Stores the element that had focus before the modal was shown, to return focus on hide.
   * @type {HTMLElement | null}
   * @private
   */
  _previouslyFocusedElement = null;

  /**
   * Defines the keys of elements within `this.elements` that should be disabled/enabled
   * by `_setOperationInProgress`. Subclasses can override this or extend it.
   * @type {string[]}
   * @protected
   */
  _operationInProgressAffectedElements = ['confirmButton', 'cancelButton']; // Example keys

  /**
   * Duration in milliseconds for the hide animation.
   * Used to delay setting display: none.
   * @type {number}
   * @protected
   */
  _hideAnimationDuration = 300; // Default, can be overridden or made configurable

  /**
   * Stores the currently applied CSS class for the status message type (e.g., 'status-message-error').
   * Used to easily remove the previous type class when displaying a new message.
   * @type {string | null}
   * @private
   */
  _currentStatusTypeClass = null;

  /**
   * Constructs a BaseModalRenderer instance.
   * @param {object} dependencies - The dependencies for the renderer.
   * @param {import('../interfaces/coreServices.js').ILogger} dependencies.logger - The logger instance.
   * @param {import('../interfaces/IDocumentContext.js').IDocumentContext} dependencies.documentContext - The document context abstraction.
   * @param {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} dependencies.validatedEventDispatcher - The event dispatcher.
   * @param {ModalElementsConfig} dependencies.elementsConfig - Configuration for DOM elements.
   * Must include `modalElement` and `closeButton`. `statusMessageElement` is optional but recommended for feedback.
   * @param {...any} otherDeps - Other dependencies that might be passed to BoundDomRendererBase.
   */
  constructor({
    logger,
    documentContext,
    validatedEventDispatcher,
    elementsConfig,
    ...otherDeps
  }) {
    super({
      logger,
      documentContext,
      validatedEventDispatcher,
      elementsConfig,
      ...otherDeps,
    });

    if (!this.elements.modalElement) {
      this.logger.error(
        `${this._logPrefix} 'modalElement' is not defined in 'elementsConfig' or not found in the DOM. Modal functionality will be severely impaired.`
      );
      // Consider throwing an error if critical elements like modalElement are missing.
    }
    if (
      !this.elements.closeButton &&
      Object.keys(elementsConfig).includes('closeButton')
    ) {
      this.logger.error(
        `${this._logPrefix} 'closeButton' was configured in 'elementsConfig' but not found in the DOM.`
      );
    } else if (!Object.keys(elementsConfig).includes('closeButton')) {
      this.logger.warn(
        `${this._logPrefix} 'closeButton' was not specified in 'elementsConfig'. Modal may not be closable via a dedicated button.`
      );
    }

    // Check for statusMessageElement (optional, but log if configured and not found)
    if (
      !this.elements.statusMessageElement &&
      Object.keys(elementsConfig).includes('statusMessageElement')
    ) {
      this.logger.warn(
        `${this._logPrefix} 'statusMessageElement' was configured in 'elementsConfig' but not found in the DOM. Local status messages will not be displayed.`
      );
    } else if (this.elements.statusMessageElement) {
      this.logger.debug(
        `${this._logPrefix} 'statusMessageElement' bound successfully. Local status messages are available.`
      );
    }

    this.isVisible = false;
    this._bindCoreModalEvents();

    if (this.elements.modalElement) {
      this.elements.modalElement.setAttribute('aria-hidden', 'true');
      // Initial display style (e.g., 'none') should be handled by CSS.
    }
  }

  /**
   * Binds core event listeners for the modal (e.g., close button, Escape key).
   * @private
   */
  _bindCoreModalEvents() {
    if (this.elements.closeButton) {
      this._addDomListener(
        this.elements.closeButton,
        'click',
        this.hide.bind(this)
      );
    } else {
      this.logger.debug(
        `${this._logPrefix} Close button element not available for binding events.`
      );
    }

    if (this.elements.modalElement) {
      // Click on backdrop to close
      this._addDomListener(this.elements.modalElement, 'click', (event) => {
        if (event.target === this.elements.modalElement) {
          this.logger.debug(
            `${this._logPrefix} Backdrop clicked, hiding modal.`
          );
          this.hide();
        }
      });
    }

    // Escape key to close
    this._addDomListener(this.documentContext.document, 'keydown', (event) => {
      if (event.key === 'Escape' && this.isVisible) {
        this.logger.debug(
          `${this._logPrefix} Escape key pressed, hiding modal.`
        );
        this.hide();
      }
    });
  }

  /**
   * Shows the modal.
   * Sets visibility, updates ARIA attributes, clears status messages,
   * calls the _onShow lifecycle hook, and manages focus.
   */
  show() {
    if (this.isVisible) {
      this.logger.warn(
        `${this._logPrefix} show() called when modal is already visible.`
      );
      return;
    }
    if (!this.elements.modalElement) {
      this.logger.error(
        `${this._logPrefix} Cannot show modal, 'modalElement' is not available.`
      );
      return;
    }

    this._previouslyFocusedElement = /** @type {HTMLElement} */ (
      this.documentContext.document.activeElement
    );

    this.isVisible = true;
    // Ensure display is 'flex' (or appropriate) before adding 'visible' for transition
    this.elements.modalElement.style.display = 'flex';

    // Use requestAnimationFrame to ensure the 'display' style is applied
    // before the 'visible' class is added, allowing CSS transitions to work reliably.
    requestAnimationFrame(() => {
      if (this.elements.modalElement) {
        // Check if still valid in async callback
        this.elements.modalElement.classList.add('visible');
        this.elements.modalElement.setAttribute('aria-hidden', 'false');
      }
    });

    this._clearStatusMessage(); // Clear status messages from previous interactions [Ticket 8]

    try {
      this._onShow(); // Call subclass logic
    } catch (error) {
      this.logger.error(
        `${this._logPrefix} Error in _onShow lifecycle hook.`,
        error
      );
    }

    const elementToFocus = this._getInitialFocusElement();
    if (elementToFocus && typeof elementToFocus.focus === 'function') {
      elementToFocus.focus();
    } else {
      this.logger.debug(
        `${this._logPrefix} No specific initial focus element. Trying fallbacks.`
      );
      if (
        this.elements.modalElement.hasAttribute('tabindex') &&
        typeof this.elements.modalElement.focus === 'function'
      ) {
        this.elements.modalElement.focus();
      } else if (
        this.elements.closeButton &&
        typeof this.elements.closeButton.focus === 'function'
      ) {
        this.elements.closeButton.focus();
      } else {
        this.logger.warn(
          `${this._logPrefix} Could not find any element to focus in the modal.`
        );
      }
    }

    this.logger.info(`${this._logPrefix} Modal shown.`);
  }

  /**
   * Hides the modal.
   * Sets visibility, updates ARIA attributes, calls the _onHide lifecycle hook,
   * and manages returning focus.
   * Incorporates a delay for CSS animations/transitions.
   */
  hide() {
    if (!this.isVisible) {
      return;
    }
    if (!this.elements.modalElement) {
      this.logger.error(
        `${this._logPrefix} Cannot hide modal, 'modalElement' is not available.`
      );
      this.isVisible = false;
      return;
    }

    this.isVisible = false;
    this.elements.modalElement.classList.remove('visible');
    this.elements.modalElement.setAttribute('aria-hidden', 'true');

    try {
      this._onHide();
    } catch (error) {
      this.logger.error(
        `${this._logPrefix} Error in _onHide lifecycle hook.`,
        error
      );
    }

    const returnFocusElement = this._getReturnFocusElement();
    if (returnFocusElement && typeof returnFocusElement.focus === 'function') {
      returnFocusElement.focus();
    } else if (
      this._previouslyFocusedElement &&
      typeof this._previouslyFocusedElement.focus === 'function'
    ) {
      if (
        this.documentContext.document.body.contains(
          this._previouslyFocusedElement
        ) &&
        this._previouslyFocusedElement.offsetParent !== null
      ) {
        this._previouslyFocusedElement.focus();
      } else {
        this.logger.debug(
          `${this._logPrefix} Previously focused element is no longer focusable.`
        );
      }
    } else {
      this.logger.debug(
        `${this._logPrefix} No specific element to return focus to.`
      );
    }
    this._previouslyFocusedElement = null;

    setTimeout(() => {
      if (!this.isVisible && this.elements.modalElement) {
        this.elements.modalElement.style.display = 'none';
      }
    }, this._hideAnimationDuration);

    this.logger.info(`${this._logPrefix} Modal hidden.`);
  }

  /**
   * Protected lifecycle hook called by show() after the modal is made visible
   * and ARIA attributes are set, but before focus is managed.
   * Subclasses should implement this to populate content, fetch data, etc.
   * @protected
   */
  _onShow() {
    // Default implementation is empty. Subclasses should override.
  }

  /**
   * Protected lifecycle hook called by hide() just before the modal is
   * visually hidden (or starts its hide animation).
   * Subclasses should implement this for cleanup, saving state, etc.
   * @protected
   */
  _onHide() {
    // Default implementation is empty. Subclasses should override.
  }

  /**
   * Protected method for subclasses to specify which element should receive focus
   * when the modal opens.
   * @protected
   * @returns {HTMLElement | null} The element to focus, or null if no specific element.
   */
  _getInitialFocusElement() {
    if (
      this.elements.closeButton &&
      typeof this.elements.closeButton.focus === 'function'
    ) {
      return /** @type {HTMLElement} */ (this.elements.closeButton);
    }
    if (
      this.elements.modalElement &&
      this.elements.modalElement.hasAttribute('tabindex') &&
      typeof this.elements.modalElement.focus === 'function'
    ) {
      return /** @type {HTMLElement} */ (this.elements.modalElement);
    }
    this.logger.debug(
      `${this._logPrefix} No default initial focus element identified. Override in subclass or ensure modal/closeButton is focusable.`
    );
    return null;
  }

  /**
   * (Optional) Protected method for subclasses to specify where focus should
   * return when the modal closes.
   * @protected
   * @returns {HTMLElement | null} The element to focus, or null.
   */
  _getReturnFocusElement() {
    return null; // Subclasses can override
  }

  // --- Status Message Methods (Ticket 8) ---

  /**
   * Displays a status message within the modal's designated status message area.
   * This method should be used by subclasses for all local feedback.
   *
   * The `statusMessageElement` must be defined in `elementsConfig` during construction
   * for this method to have any effect.
   * @param {string} message - The message text to display.
   * @param {string} [type] - The type of message (e.g., 'info', 'error', 'success', 'warning').
   * This will be used to apply a CSS class `status-message-${type}`. A base class
   * `status-message-area` is assumed to be on the element or will be added if necessary.
   * @protected
   */
  _displayStatusMessage(message, type = 'info') {
    const statusEl = /** @type {HTMLElement} */ (
      this.elements.statusMessageElement
    );
    if (!statusEl) {
      this.logger.warn(
        `${this._logPrefix} '_displayStatusMessage' called, but 'statusMessageElement' is not available. Message: "${message}" (type: ${type})`
      );
      return;
    }

    statusEl.textContent = message;

    // Ensure base class is present (can be added in HTML or here for robustness)
    if (!statusEl.classList.contains('status-message-area')) {
      statusEl.classList.add('status-message-area');
    }

    // Remove previous type-specific class, if any
    if (this._currentStatusTypeClass) {
      statusEl.classList.remove(this._currentStatusTypeClass);
    }

    // Add new type-specific class
    const newTypeClass = `status-message-${type}`;
    statusEl.classList.add(newTypeClass);
    this._currentStatusTypeClass = newTypeClass; // Store for next removal

    // Ensure the element is visible (if it's styled to be hidden when empty)
    statusEl.style.display = ''; // Or 'block', 'inline-block' etc., depending on CSS design

    this.logger.debug(
      `${this._logPrefix} Displayed status message: "${message}" (type: ${type})`
    );
  }

  /**
   * Clears any existing status message in the modal's status message area
   * and resets its type-specific styling.
   * This method should be used by subclasses to clear local feedback.
   *
   * The `statusMessageElement` must be defined in `elementsConfig` for this method to work.
   * @protected
   */
  _clearStatusMessage() {
    const statusEl = /** @type {HTMLElement} */ (
      this.elements.statusMessageElement
    );
    if (!statusEl) {
      // This is a common operation (e.g., on show), so debug level if element missing.
      this.logger.debug(
        `${this._logPrefix} '_clearStatusMessage' called, but 'statusMessageElement' is not available. No message to clear.`
      );
      return;
    }

    statusEl.textContent = '';

    // Remove previous type-specific class
    if (this._currentStatusTypeClass) {
      statusEl.classList.remove(this._currentStatusTypeClass);
      this._currentStatusTypeClass = null;
    }

    // Optional: Hide the element if it should not take up space when empty,
    // depends on CSS. If CSS handles it via :empty pseudo-class or similar, this isn't needed.
    // statusEl.style.display = 'none';

    this.logger.debug(`${this._logPrefix} Status message cleared.`);
  }

  // --- Operation In Progress Helper ---

  /**
   * Sets the disabled state of predefined operational elements (e.g., confirm/cancel buttons)
   * to indicate that an operation is in progress.
   * @param {boolean} inProgress - True to disable elements, false to enable them.
   * @protected
   */
  _setOperationInProgress(inProgress) {
    if (
      !this._operationInProgressAffectedElements ||
      this._operationInProgressAffectedElements.length === 0
    ) {
      this.logger.debug(
        `${this._logPrefix} No elements configured for '_setOperationInProgress'.`
      );
      return;
    }

    this._operationInProgressAffectedElements.forEach((elementKey) => {
      const element = /** @type {HTMLButtonElement | HTMLInputElement} */ (
        this.elements[elementKey]
      );
      if (element && typeof element.disabled !== 'undefined') {
        element.disabled = inProgress;
      } else if (this.elements[elementKey]) {
        this.logger.warn(
          `${this._logPrefix} Element "${elementKey}" found for '_setOperationInProgress' but does not support 'disabled' property.`
        );
      } else {
        this.logger.debug(
          `${this._logPrefix} Element "${elementKey}" not found for _setOperationInProgress (may be optional for this modal).`
        );
      }
    });
    this.logger.debug(
      `${this._logPrefix} Operation in progress state set to ${inProgress}. Affected elements: ${this._operationInProgressAffectedElements.join(', ')}.`
    );
  }

  /**
   * Cleans up resources, primarily by calling the superclass's destroy method
   * which handles DOM event listeners and VED subscriptions.
   */
  destroy() {
    this.logger.debug(`${this._logPrefix} Starting destruction process.`);
    if (this.isVisible) {
      // Ensure modal is properly hidden and state is updated if destroyed while visible
      // This hide might have animations; consider implications if destroy needs to be immediate.
      this.hide();
    }

    super.destroy(); // Handles VED subscriptions and DOM listeners removal

    this._previouslyFocusedElement = null; // Clear reference
    this.logger.info(`${this._logPrefix} Destroyed.`);
  }
}
