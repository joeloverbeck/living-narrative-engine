// src/utils/errorUtils.js

import { getModuleLogger } from './loggerUtils.js';

/**
 * Sets an error message in a DOM element and makes it visible.
 *
 * @description Sets an error message in a DOM element and makes it visible.
 * @param {HTMLElement | null | undefined} targetEl - Element to display the message in.
 * @param {string} msg - Message to show.
 * @returns {boolean} True if the message was displayed.
 */
export function showErrorInElement(targetEl, msg) {
  if (!targetEl || !(targetEl instanceof HTMLElement)) {
    return false;
  }
  targetEl.textContent = msg;
  targetEl.style.display = 'block';
  return true;
}

/**
 * Creates a temporary error element after the provided base element.
 *
 * @description Creates a temporary error element after the provided base element.
 * @param {HTMLElement | null | undefined} baseEl - Element to insert after.
 * @param {string} msg - Message for the new element.
 * @param {function(string): HTMLElement} [createElement] - Element creation function. Defaults to `document.createElement`.
 * @returns {HTMLElement | null} The created element, or null if not created.
 */
export function createTemporaryErrorElement(
  baseEl,
  msg,
  createElement = (tag) => document.createElement(tag)
) {
  if (!baseEl || !(baseEl instanceof HTMLElement)) {
    return null;
  }
  const temporaryErrorElement = createElement('div');
  temporaryErrorElement.id = 'temp-startup-error';
  temporaryErrorElement.textContent = msg;
  temporaryErrorElement.style.color = 'red';
  temporaryErrorElement.style.padding = '10px';
  temporaryErrorElement.style.border = '1px solid red';
  temporaryErrorElement.style.marginTop = '10px';
  baseEl.insertAdjacentElement('afterend', temporaryErrorElement);
  return temporaryErrorElement;
}

/**
 * Disables an input element and sets a placeholder.
 *
 * @description Disables an input element and sets a placeholder.
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
 * Logs details about a fatal startup error.
 *
 * @param {import('../interfaces/coreServices.js').ILogger} log - Logger instance.
 * @param {string} phase - The bootstrap phase during which the error occurred.
 * @param {string} consoleMessage - Message to log to the console.
 * @param {Error} [errorObject] - Optional error object for stack trace logging.
 * @returns {void}
 * @private
 */
function logStartupError(log, phase, consoleMessage, errorObject) {
  log.error(
    `[Bootstrapper Error - Phase: ${phase}] ${consoleMessage}`,
    errorObject || ''
  );
}

/**
 * Attempts to show an error message in the DOM or falls back to alert().
 *
 * @param {object} params - Parameters object.
 * @param {HTMLElement | null | undefined} params.errorDiv - Element for displaying errors.
 * @param {HTMLElement | null | undefined} params.outputDiv - Main output area element.
 * @param {function(string): HTMLElement} params.create - Element creation function.
 * @param {function(string): void} params.showAlert - Alert function to display messages.
 * @param {import('../interfaces/coreServices.js').ILogger} params.log - Logger instance.
 * @param {string} params.userMessage - Message to display to the user.
 * @returns {void}
 * @private
 */
function displayErrorMessage({
  errorDiv,
  outputDiv,
  create,
  showAlert,
  log,
  userMessage,
}) {
  let displayedInErrorDiv = false;
  try {
    displayedInErrorDiv = showErrorInElement(errorDiv, userMessage);
  } catch (e) {
    log.error(
      'displayFatalStartupError: Failed to set textContent on errorDiv.',
      e
    );
  }

  if (!displayedInErrorDiv) {
    try {
      const tmpEl = createTemporaryErrorElement(outputDiv, userMessage, create);
      if (tmpEl) {
        log.info(
          'displayFatalStartupError: Displayed error in a dynamically created element near outputDiv.'
        );
        displayedInErrorDiv = true;
      }
    } catch (e) {
      log.error(
        'displayFatalStartupError: Failed to create or append temporary error element.',
        e
      );
    }
  }

  if (!displayedInErrorDiv) {
    showAlert(userMessage);
    log.info(
      'displayFatalStartupError: Displayed error using alert() as a fallback.'
    );
  }
}

/**
 * Updates the title and disables the input element when a fatal error occurs.
 *
 * @param {object} params - Parameters object.
 * @param {HTMLElement | null | undefined} params.titleElement - Page title element.
 * @param {HTMLInputElement | null | undefined} params.inputElement - Command input element.
 * @param {string} params.pageTitle - Text to set for the title element.
 * @param {string} params.inputPlaceholder - Placeholder text for the input element.
 * @param {import('../interfaces/coreServices.js').ILogger} params.log - Logger instance.
 * @returns {void}
 * @private
 */
function updateElements({
  titleElement,
  inputElement,
  pageTitle,
  inputPlaceholder,
  log,
}) {
  try {
    if (titleElement && titleElement instanceof HTMLElement) {
      titleElement.textContent = pageTitle;
    }
  } catch (e) {
    log.error(
      'displayFatalStartupError: Failed to set textContent on titleElement.',
      e
    );
  }

  try {
    disableInput(inputElement, inputPlaceholder);
  } catch (e) {
    log.error(
      'displayFatalStartupError: Failed to disable or set placeholder on inputElement.',
      e
    );
  }
}

/**
 * Displays a fatal startup error to the user, logs it to the console, and updates UI elements.
 *
 * @param {FatalErrorUIElements} uiElements - References to key UI elements.
 * @param {FatalErrorDetails} errorDetails - Details about the error.
 * @param {import('../interfaces/coreServices.js').ILogger} [logger] - Optional logger instance.
 * @param {{createElement?: function(string): HTMLElement, alert?: function(string): void}} [domAdapter] - DOM adapter for custom element creation and alerts.
 */
export function displayFatalStartupError(
  uiElements,
  errorDetails,
  logger,
  domAdapter
) {
  const log = getModuleLogger('errorUtils', logger);
  const { outputDiv, errorDiv, titleElement, inputElement } = uiElements;
  const create =
    domAdapter?.createElement ?? ((tag) => document.createElement(tag));
  const showAlert = domAdapter?.alert ?? alert;
  const {
    userMessage,
    consoleMessage,
    errorObject,
    pageTitle = 'Fatal Error!',
    inputPlaceholder = 'Application failed to start.',
    phase = 'Unknown Phase',
  } = errorDetails;

  logStartupError(log, phase, consoleMessage, errorObject);

  displayErrorMessage({
    errorDiv,
    outputDiv,
    create,
    showAlert,
    log,
    userMessage,
  });

  updateElements({
    titleElement,
    inputElement,
    pageTitle,
    inputPlaceholder,
    log,
  });
}
