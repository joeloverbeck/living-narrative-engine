// src/utils/errorUtils.js

import { StartupErrorHandler } from './startupErrorHandler.js';

/**
 * Sets an error message in a DOM element and makes it visible.
 *
 * @description Sets an error message in a DOM element and makes it visible.
 * @param {HTMLElement | null | undefined} targetEl - Element to display the message in.
 * @param {string} msg - Message to show.
 * @param {import('../interfaces/DomAdapter.js').DomAdapter} dom - DOM adapter instance.
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
 * @description Creates a temporary error element after the provided base element.
 * @param {HTMLElement | null | undefined} baseEl - Element to insert after.
 * @param {string} msg - Message for the new element.
 * @param {import('../interfaces/DomAdapter.js').DomAdapter} dom - DOM adapter instance.
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
 * @description Disables an input element and sets a placeholder.
 * @param {HTMLInputElement | null | undefined} el - Input to disable.
 * @param {string} placeholder - Placeholder text to set.
 * @param {import('../interfaces/DomAdapter.js').DomAdapter} dom - DOM adapter instance.
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
 * @typedef {object} FatalErrorUIElements
 * @property {HTMLElement | null | undefined} outputDiv - The main output area element.
 * @property {HTMLElement | null | undefined} errorDiv - The element for displaying errors.
 * @property {HTMLInputElement | null | undefined} inputElement - The user command input element.
 * @property {HTMLElement | null | undefined} titleElement - The title display element.
 */

/**
 * @typedef {object} FatalErrorDetails
 * @property {string} userMessage - Message to display to the user (e.g., in errorDiv or alert).
 * @property {string} consoleMessage - Message for console.error.
 * @property {Error} [errorObject] - The actual error object for console.error.
 * @property {string} [pageTitle] - Text for the h1 title element. Defaults to "Fatal Error!".
 * @property {string} [inputPlaceholder] - Placeholder text for the input element. Defaults to "Application failed to start."
 * @property {string} [phase] - The bootstrap phase where the error occurred (for logging, e.g., "DOM Check", "DI Config").
 */

/**
 * Displays a fatal startup error to the user, logs it, and updates UI elements.
 *
 * @param {FatalErrorUIElements} uiElements - References to key UI elements.
 * @param {FatalErrorDetails} errorDetails - Details about the error.
 * @param {import('../interfaces/coreServices.js').ILogger} [logger] - Optional logger instance.
 * @param {import('../interfaces/DomAdapter.js').DomAdapter} domAdapter - DOM adapter for custom element creation and DOM updates.
 * @param {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} [dispatcher] - Optional dispatcher for error events.
 * @returns {{displayed: boolean}} Whether the error was displayed in the DOM.
 */
export function displayFatalStartupError(
  uiElements,
  errorDetails,
  logger,
  domAdapter,
  dispatcher
) {
  const handler = new StartupErrorHandler(
    logger,
    domAdapter,
    dispatcher,
    'errorUtils'
  );
  return handler.displayFatalStartupError(uiElements, errorDetails);
}
