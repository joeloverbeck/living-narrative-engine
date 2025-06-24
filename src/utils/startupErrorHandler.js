// src/utils/startupErrorHandler.js

import { getModuleLogger } from './loggerUtils.js';
import { safeDispatchError } from './safeDispatchErrorUtils.js';

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../interfaces/DomAdapter.js').DomAdapter} DomAdapter
 * @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 */

/**
 * Handles fatal startup errors by logging, updating the DOM,
 * and notifying the dispatcher if provided.
 *
 * @class
 */
export class StartupErrorHandler {
  /**
   * @param {ILogger | undefined | null} logger - Optional logger instance.
   * @param {DomAdapter} domAdapter - Adapter used for DOM manipulation.
   * @param {ISafeEventDispatcher | undefined | null} dispatcher - Optional dispatcher for error events.
   * @param {string} [moduleName] - Prefix for logger messages.
   */
  constructor(logger, domAdapter, dispatcher, moduleName = 'errorUtils') {
    this.log = getModuleLogger(moduleName, logger);
    this.dom = domAdapter;
    this.dispatcher = dispatcher || null;
    this.alert = domAdapter.alert;
  }

  /**
   * Logs startup error details and optionally dispatches an error event.
   *
   * @param {string} phase - Bootstrap phase where the error occurred.
   * @param {string} consoleMessage - Message to log.
   * @param {Error | undefined} errorObject - Optional error for stack traces.
   * @returns {void}
   */
  logStartupError(phase, consoleMessage, errorObject) {
    if (this.dispatcher) {
      safeDispatchError(
        this.dispatcher,
        `[Bootstrapper Error - Phase: ${phase}] ${consoleMessage}`,
        { error: errorObject?.message || errorObject || '' }
      );
    } else {
      this.log.error(
        `[Bootstrapper Error - Phase: ${phase}] ${consoleMessage}`,
        errorObject || ''
      );
    }
  }

  /**
   * Shows an error message inside a DOM element.
   *
   * @param {HTMLElement | null | undefined} targetEl - Element to display in.
   * @param {string} msg - Message to show.
   * @returns {boolean} True if message displayed.
   */
  showErrorInElement(targetEl, msg) {
    if (!targetEl || !(targetEl instanceof HTMLElement)) {
      return false;
    }
    this.dom.setTextContent(targetEl, msg);
    this.dom.setStyle(targetEl, 'display', 'block');
    return true;
  }

  /**
   * Creates a temporary error element after the provided element.
   *
   * @param {HTMLElement | null | undefined} baseEl - Element to insert after.
   * @param {string} msg - Error message for the new element.
   * @returns {HTMLElement | null} The created element or null.
   */
  createTemporaryErrorElement(baseEl, msg) {
    if (!baseEl || !(baseEl instanceof HTMLElement)) {
      return null;
    }
    const el = this.dom.createElement('div');
    el.id = 'temp-startup-error';
    this.dom.setTextContent(el, msg);
    this.dom.setStyle(el, 'color', 'red');
    this.dom.setStyle(el, 'padding', '10px');
    this.dom.setStyle(el, 'border', '1px solid red');
    this.dom.setStyle(el, 'marginTop', '10px');
    this.dom.insertAfter(baseEl, el);
    return el;
  }

  /**
   * Disables an input element and sets its placeholder.
   *
   * @param {HTMLInputElement | null | undefined} el - Input element.
   * @param {string} placeholder - Placeholder text.
   * @returns {boolean} True if updated.
   */
  disableInput(el, placeholder) {
    if (!el || !(el instanceof HTMLInputElement)) {
      return false;
    }
    el.disabled = true;
    el.placeholder = placeholder;
    return true;
  }

  /**
   * Attempts to display the user message in the DOM, falling back to alert.
   *
   * @param {object} params - Parameters object.
   * @param {HTMLElement | null | undefined} params.errorDiv - Element for errors.
   * @param {HTMLElement | null | undefined} params.outputDiv - Main output element.
   * @param {string} params.userMessage - Message for the user.
   * @returns {{displayed: boolean}} Whether shown in the DOM.
   */
  displayErrorMessage({ errorDiv, outputDiv, userMessage }) {
    let displayedInErrorDiv = false;
    try {
      displayedInErrorDiv = this.showErrorInElement(errorDiv, userMessage);
    } catch (e) {
      if (this.dispatcher) {
        safeDispatchError(
          this.dispatcher,
          'displayFatalStartupError: Failed to set textContent on errorDiv.',
          { error: e?.message || e }
        );
      } else {
        this.log.error(
          'displayFatalStartupError: Failed to set textContent on errorDiv.',
          e
        );
      }
    }

    if (!displayedInErrorDiv) {
      try {
        const tmpEl = this.createTemporaryErrorElement(outputDiv, userMessage);
        if (tmpEl) {
          this.log.info(
            'displayFatalStartupError: Displayed error in a dynamically created element near outputDiv.'
          );
          displayedInErrorDiv = true;
        }
      } catch (e) {
        if (this.dispatcher) {
          safeDispatchError(
            this.dispatcher,
            'displayFatalStartupError: Failed to create or append temporary error element.',
            { error: e?.message || e }
          );
        } else {
          this.log.error(
            'displayFatalStartupError: Failed to create or append temporary error element.',
            e
          );
        }
      }
    }

    if (!displayedInErrorDiv) {
      this.alert(userMessage);
      this.log.info(
        'displayFatalStartupError: Displayed error using alert() as a fallback.'
      );
    }

    return { displayed: displayedInErrorDiv };
  }

  /**
   * Updates the page title and disables the input after a fatal error.
   *
   * @param {object} params - Parameter object.
   * @param {HTMLElement | null | undefined} params.titleElement - Title element.
   * @param {HTMLInputElement | null | undefined} params.inputElement - Input element.
   * @param {string} params.pageTitle - Text for the title element.
   * @param {string} params.inputPlaceholder - Placeholder for the input.
   * @returns {void}
   */
  updateElements({ titleElement, inputElement, pageTitle, inputPlaceholder }) {
    try {
      if (titleElement && titleElement instanceof HTMLElement) {
        this.dom.setTextContent(titleElement, pageTitle);
      }
    } catch (e) {
      const msg =
        'displayFatalStartupError: Failed to set textContent on titleElement.';
      if (this.dispatcher) {
        safeDispatchError(this.dispatcher, msg, {
          raw: e?.message || e,
          stack: e?.stack,
        });
      } else {
        this.log.error(msg, e);
      }
    }

    try {
      this.disableInput(inputElement, inputPlaceholder);
    } catch (e) {
      const msg =
        'displayFatalStartupError: Failed to disable or set placeholder on inputElement.';
      if (this.dispatcher) {
        safeDispatchError(this.dispatcher, msg, {
          raw: e?.message || e,
          stack: e?.stack,
        });
      } else {
        this.log.error(msg, e);
      }
    }
  }

  /**
   * Handles a fatal startup error by logging and updating the UI.
   *
   * @param {import('./errorUtils.js').FatalErrorUIElements} uiElements - UI refs.
   * @param {import('./errorUtils.js').FatalErrorDetails} errorDetails - Error info.
   * @returns {{displayed: boolean}} Whether the error was shown in the DOM.
   */
  displayFatalStartupError(uiElements, errorDetails) {
    const { outputDiv, errorDiv, titleElement, inputElement } = uiElements;
    const {
      userMessage,
      consoleMessage,
      errorObject,
      pageTitle = 'Fatal Error!',
      inputPlaceholder = 'Application failed to start.',
      phase = 'Unknown Phase',
    } = errorDetails;

    this.logStartupError(phase, consoleMessage, errorObject);

    const { displayed } = this.displayErrorMessage({
      errorDiv,
      outputDiv,
      userMessage,
    });

    this.updateElements({
      titleElement,
      inputElement,
      pageTitle,
      inputPlaceholder,
    });

    return { displayed };
  }
}
