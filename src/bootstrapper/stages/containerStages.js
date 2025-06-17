// src/bootstrapper/stages/containerStages.js
/* eslint-disable no-console */

// eslint-disable-next-line no-unused-vars
import { tokens } from '../../dependencyInjection/tokens.js';
import { stageSuccess, stageFailure } from '../helpers.js';

/**
 * @typedef {import('../UIBootstrapper.js').EssentialUIElements} EssentialUIElements
 */
/**
 * @typedef {import('../../dependencyInjection/containerConfig.js').ConfigureContainerFunction} ConfigureContainerFunction
 */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {typeof tokens} TokensObject */
/** @typedef {import('../../types/stageResult.js').StageResult} StageResult */
/** @typedef {import('../../dependencyInjection/appContainer.js').default} AppContainer */

/**
 * Bootstrap Stage: Sets up the Dependency Injection (DI) container.
 * This function instantiates AppContainer and calls the provided configuration function.
 *
 * @async
 * @param {EssentialUIElements} uiReferences - The object containing DOM element references.
 * @param {ConfigureContainerFunction} containerConfigFunc - A reference to the configureContainer function.
 * @param {{ createAppContainer: function(): AppContainer }} options
 *  - Factory provider for an AppContainer instance.
 * @returns {Promise<StageResult>} Result object with the configured AppContainer on success.
 */
export async function setupDIContainerStage(
  uiReferences,
  containerConfigFunc,
  { createAppContainer }
) {
  const container = createAppContainer();

  try {
    containerConfigFunc(container, uiReferences);
  } catch (registrationError) {
    const errorMsg = `Fatal Error during service registration: ${registrationError.message}.`;
    console.error(
      `Bootstrap Stage: setupDIContainerStage failed. ${errorMsg}`,
      registrationError
    );
    return stageFailure('DI Container Setup', errorMsg, registrationError);
  }
  return stageSuccess(container);
}

/**
 * Bootstrap Stage: Resolves core services.
 * Currently only the logger is required, but additional core services will be added soon.
 *
 * Upcoming core services:
 * - Event bus
 * - Configuration access
 *
 * @async
 * @param {AppContainer} container - The configured AppContainer instance.
 * @param {TokensObject} diTokens - The DI tokens object.
 * @returns {Promise<StageResult>} Result object with the resolved logger on success.
 */
export async function resolveLoggerStage(container, diTokens) {
  console.log('Bootstrap Stage: Resolving logger service...');
  /** @type {ILogger} */
  let logger;

  try {
    logger = container.resolve(diTokens.ILogger);
    if (!logger) {
      throw new Error('ILogger resolved to an invalid object.');
    }
  } catch (resolveError) {
    const errorMsg = `Fatal Error: Could not resolve essential ILogger service: ${resolveError.message}.`;
    console.error(
      `Bootstrap Stage: resolveLoggerStage failed. ${errorMsg}`,
      resolveError
    );
    return stageFailure('Core Services Resolution', errorMsg, resolveError);
  }
  logger.debug(
    'Bootstrap Stage: Resolving logger service... DONE. Logger resolved successfully.'
  );
  return stageSuccess({ logger });
}
