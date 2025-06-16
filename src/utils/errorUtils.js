// src/utils/errorUtils.js
/* eslint-disable no-console */

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
 */
export function displayFatalStartupError(uiElements, errorDetails) {
  const { outputDiv, errorDiv, titleElement, inputElement } = uiElements;
  const {
    userMessage,
    consoleMessage,
    errorObject,
    pageTitle = 'Fatal Error!',
    inputPlaceholder = 'Application failed to start.',
    phase = 'Unknown Phase',
  } = errorDetails;

  // 1. Log to console.error
  console.error(
    `[Bootstrapper Error - Phase: ${phase}] ${consoleMessage}`,
    errorObject || ''
  );

  // 2. Attempt to display userMessage in errorDiv
  let displayedInErrorDiv = false;
  if (errorDiv && errorDiv instanceof HTMLElement) {
    try {
      errorDiv.textContent = userMessage;
      errorDiv.style.display = 'block'; // Ensure it's visible
      displayedInErrorDiv = true;
    } catch (e) {
      console.error(
        'displayFatalStartupError: Failed to set textContent on errorDiv.',
        e
      );
    }
  }

  // 3. Fallback to dynamic creation if errorDiv not available/failed, but outputDiv is
  if (!displayedInErrorDiv && outputDiv && outputDiv instanceof HTMLElement) {
    try {
      const temporaryErrorElement = document.createElement('div');
      temporaryErrorElement.id = 'temp-startup-error';
      temporaryErrorElement.textContent = userMessage;
      temporaryErrorElement.style.color = 'red';
      temporaryErrorElement.style.padding = '10px';
      temporaryErrorElement.style.border = '1px solid red';
      temporaryErrorElement.style.marginTop = '10px';
      outputDiv.insertAdjacentElement('afterend', temporaryErrorElement); // Append near outputDiv
      console.log(
        'displayFatalStartupError: Displayed error in a dynamically created element near outputDiv.'
      );
      displayedInErrorDiv = true; // Consider this as having displayed the error in a DOM element
    } catch (e) {
      console.error(
        'displayFatalStartupError: Failed to create or append temporary error element.',
        e
      );
    }
  }

  // 4. Ultimate fallback to alert if no DOM display was feasible
  if (!displayedInErrorDiv) {
    alert(userMessage);
    console.log(
      'displayFatalStartupError: Displayed error using alert() as a fallback.'
    );
  }

  // 5. If titleElement is available, set its textContent
  if (titleElement && titleElement instanceof HTMLElement) {
    try {
      titleElement.textContent = pageTitle;
    } catch (e) {
      console.error(
        'displayFatalStartupError: Failed to set textContent on titleElement.',
        e
      );
    }
  }

  // 6. If inputElement is available, disable it and set placeholder
  if (inputElement && inputElement instanceof HTMLInputElement) {
    try {
      inputElement.disabled = true;
      inputElement.placeholder = inputPlaceholder;
    } catch (e) {
      console.error(
        'displayFatalStartupError: Failed to disable or set placeholder on inputElement.',
        e
      );
    }
  }
}
