// src/bootstrapper/helpers.js

/**
 * @file Utility helpers used during application bootstrap stages.
 */

/**
 * @typedef {import('../dependencyInjection/appContainer.js').default} AppContainer
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * Resolves a service from the container and invokes its initialization method.
 * Logs success or failure for easier debugging during bootstrap.
 *
 * @param {AppContainer} container - The dependency injection container.
 * @param {string} token - The DI token used to resolve the service.
 * @param {string} initFnName - Name of the initialization method to invoke.
 * @param {ILogger} logger - Logger used for debug/warn/error output.
 * @param {...any} args - Arguments forwarded to the initialization method.
 * @returns {void}
 */
export function resolveAndInitialize(
  container,
  token,
  initFnName,
  logger,
  ...args
) {
  const stage = `${token} Init`;
  try {
    logger.debug(`${stage}: Resolving ${token}...`);
    const service = container.resolve(token);
    if (!service) {
      logger.warn(`${stage}: ${token} could not be resolved.`);
      return;
    }
    const initFn = service[initFnName];
    if (typeof initFn !== 'function') {
      throw new Error(`${token} missing ${initFnName}()`);
    }
    initFn.apply(service, args);
    logger.debug(`${stage}: Initialized successfully.`);
  } catch (err) {
    logger.error(`${stage}: Failed to initialize.`, err);
  }
}

/**
 * Attaches a click listener to a DOM button element if it exists.
 * Logs warnings when the element is missing.
 *
 * @param {Document} documentRef - Document to query for the button element.
 * @param {string} buttonId - Element ID of the button.
 * @param {Function} handler - Click handler function.
 * @param {ILogger} logger - Logger used for debug/warn output.
 * @param {string} stageName - Name of the bootstrap stage for log context.
 * @returns {void}
 */
export function setupButtonListener(
  documentRef,
  buttonId,
  handler,
  logger,
  stageName
) {
  const button = documentRef.getElementById(buttonId);
  if (button) {
    button.addEventListener('click', handler);
    logger.debug(
      `${stageName}: ${buttonId} listener attached to #${buttonId}.`
    );
  } else {
    logger.warn(
      `${stageName}: Could not find #${buttonId}. Listener not attached.`
    );
  }
}

// --- FILE END ---
