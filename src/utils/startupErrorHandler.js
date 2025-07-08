// src/utils/startupErrorHandler.js

import { getModuleLogger } from './loggerUtils.js';
import { safeDispatchError } from './safeDispatchErrorUtils.js';

/**
 * Displays an error message inside a DOM element.
 *
 * @param {HTMLElement | null | undefined} targetEl - Element to display the message in.
 * @param {string} msg - Message to show.
 * @param {DomAdapter} dom - DOM adapter instance.
 * @returns {boolean} True if the message was displayed.
 */
export function showErrorInElement(targetEl, msg, dom) {
  if (!targetEl || !(targetEl instanceof HTMLElement)) {
    return false;
  }
  dom.setTextContent(targetEl, msg);
  dom.setStyle(targetEl, 'display', 'block');
  return true;
}

/**
 * Creates a temporary error element after the provided base element.
 *
 * @param {HTMLElement | null | undefined} baseEl - Element to insert after.
 * @param {string} msg - Message for the new element.
 * @param {DomAdapter} dom - DOM adapter instance.
 * @returns {HTMLElement | null} The created element, or null if not created.
 */
export function createTemporaryErrorElement(baseEl, msg, dom) {
  if (!baseEl || !(baseEl instanceof HTMLElement)) {
    return null;
  }
  const temporaryErrorElement = dom.createElement('div');
  temporaryErrorElement.id = 'temp-startup-error';
  dom.setTextContent(temporaryErrorElement, msg);
  dom.setStyle(temporaryErrorElement, 'color', 'red');
  dom.setStyle(temporaryErrorElement, 'padding', '10px');
  dom.setStyle(temporaryErrorElement, 'border', '1px solid red');
  dom.setStyle(temporaryErrorElement, 'marginTop', '10px');
  dom.insertAfter(baseEl, temporaryErrorElement);
  return temporaryErrorElement;
}

/**
 * Disables an input element and sets a placeholder.
 *
 * @param {HTMLInputElement | null | undefined} el - Input to disable.
 * @param {string} placeholder - Placeholder text to set.
 * @returns {boolean} True if the element was updated.
 */
export function disableInput(el, placeholder) {
  if (!el || !(el instanceof HTMLInputElement)) {
    return false;
  }
  el.disabled = true;
  el.placeholder = placeholder;
  return true;
}

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
    /** @type {(message: string) => void} */
    // @ts-ignore - domAdapter may not define alert in its interface
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
    return showErrorInElement(targetEl, msg, this.dom);
  }

  /**
   * Creates a temporary error element after the provided element.
   *
   * @param {HTMLElement | null | undefined} baseEl - Element to insert after.
   * @param {string} msg - Error message for the new element.
   * @returns {HTMLElement | null} The created element or null.
   */
  createTemporaryErrorElement(baseEl, msg) {
    return createTemporaryErrorElement(baseEl, msg, this.dom);
  }

  /**
   * Disables an input element and sets its placeholder.
   *
   * @param {HTMLInputElement | null | undefined} el - Input element.
   * @param {string} placeholder - Placeholder text.
   * @returns {boolean} True if updated.
   */
  disableInput(el, placeholder) {
    return disableInput(el, placeholder);
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
        const err = e instanceof Error ? e : new Error(String(e));
        safeDispatchError(
          this.dispatcher,
          'displayFatalStartupError: Failed to set textContent on errorDiv.',
          { error: err.message }
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
          const err = e instanceof Error ? e : new Error(String(e));
          safeDispatchError(
            this.dispatcher,
            'displayFatalStartupError: Failed to create or append temporary error element.',
            { error: err.message }
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
        const err = e instanceof Error ? e : new Error(String(e));
        safeDispatchError(this.dispatcher, msg, {
          raw: err.message,
          stack: err.stack,
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
        const err = e instanceof Error ? e : new Error(String(e));
        safeDispatchError(this.dispatcher, msg, {
          raw: err.message,
          stack: err.stack,
        });
      } else {
        this.log.error(msg, e);
      }
    }
  }

  /**
   * Handles a fatal startup error by logging and updating the UI.
   *
   * @param {import('./errorTypes.js').FatalErrorUIElements} uiElements - UI refs.
   * @param {import('./errorTypes.js').FatalErrorDetails} errorDetails - Error info.
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
