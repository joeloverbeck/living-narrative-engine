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
 * @returns {{success: boolean, error?: Error}} Result object describing success or failure.
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
      const err = new Error(`${token} could not be resolved.`);
      logger.warn(`${stage}: ${err.message}`);
      return { success: false, error: err };
    }
    const initFn = service[initFnName];
    if (typeof initFn !== 'function') {
      throw new Error(`${token} missing ${initFnName}()`);
    }
    initFn.apply(service, args);
    logger.debug(`${stage}: Initialized successfully.`);
    return { success: true };
  } catch (err) {
    logger.error(`${stage}: Failed to initialize.`, err);
    return { success: false, error: err };
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

/**
 * @description Determines if the game engine should be stopped based on its current status.
 * @param {import('../engine/gameEngine.js').default} gameEngine - The game engine instance to inspect.
 * @returns {boolean} True if the engine is running and should be stopped.
 */
export function shouldStopEngine(gameEngine) {
  return (
    !!gameEngine &&
    typeof gameEngine.getEngineStatus === 'function' &&
    gameEngine.getEngineStatus().isLoopRunning === true
  );
}

/**
 * @description Attaches a 'beforeunload' event handler to the provided window reference.
 * @param {Window} windowRef - The window object on which to listen for 'beforeunload'.
 * @param {Function} handler - The event handler function.
 * @returns {void}
 */
export function attachBeforeUnload(windowRef, handler) {
  windowRef.addEventListener('beforeunload', handler);
}

// --- FILE END ---
