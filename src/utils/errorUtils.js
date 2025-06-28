// src/utils/errorUtils.js

import { StartupErrorHandler } from './startupErrorHandler.js';

/**
 * @typedef {import('./errorTypes.js').FatalErrorUIElements} FatalErrorUIElements
 * @typedef {import('./errorTypes.js').FatalErrorDetails} FatalErrorDetails
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
