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
 * @returns {HTMLElement | null} The created element, or null if not created.
 */
export function createTemporaryErrorElement(baseEl, msg) {
  if (!baseEl || !(baseEl instanceof HTMLElement)) {
    return null;
  }
  const temporaryErrorElement = document.createElement('div');
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
 * Displays a fatal startup error to the user, logs it to the console, and updates UI elements.
 *
 * @param {FatalErrorUIElements} uiElements - References to key UI elements.
 * @param {FatalErrorDetails} errorDetails - Details about the error.
 * @param {import('../interfaces/coreServices.js').ILogger} [logger] - Optional logger instance.
 */
export function displayFatalStartupError(uiElements, errorDetails, logger) {
  const log = getModuleLogger('errorUtils', logger);
  const { outputDiv, errorDiv, titleElement, inputElement } = uiElements;
  const {
    userMessage,
    consoleMessage,
    errorObject,
    pageTitle = 'Fatal Error!',
    inputPlaceholder = 'Application failed to start.',
    phase = 'Unknown Phase',
  } = errorDetails;

  // 1. Log to logger.error
  log.error(
    `[Bootstrapper Error - Phase: ${phase}] ${consoleMessage}`,
    errorObject || ''
  );

  // 2. Attempt to display userMessage in errorDiv
  let displayedInErrorDiv = false;
  try {
    displayedInErrorDiv = showErrorInElement(errorDiv, userMessage);
  } catch (e) {
    log.error(
      'displayFatalStartupError: Failed to set textContent on errorDiv.',
      e
    );
  }

  // 3. Fallback to dynamic creation if errorDiv not available/failed, but outputDiv is
  if (!displayedInErrorDiv) {
    try {
      const tmpEl = createTemporaryErrorElement(outputDiv, userMessage);
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

  // 4. Ultimate fallback to alert if no DOM display was feasible
  if (!displayedInErrorDiv) {
    alert(userMessage);
    log.info(
      'displayFatalStartupError: Displayed error using alert() as a fallback.'
    );
  }

  // 5. If titleElement is available, set its textContent
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

  // 6. If inputElement is available, disable it and set placeholder
  try {
    disableInput(inputElement, inputPlaceholder);
  } catch (e) {
    log.error(
      'displayFatalStartupError: Failed to disable or set placeholder on inputElement.',
      e
    );
  }
}
