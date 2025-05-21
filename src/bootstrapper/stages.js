// src/bootstrapper/stages.js

import {UIBootstrapper} from './UIBootstrapper.js'; // Path relative to this file in the same directory
import AppContainer from '../config/appContainer.js'; // Adjusted path to import AppContainer

/**
 * @typedef {import('./UIBootstrapper.js').EssentialUIElements} EssentialUIElements
 */

/**
 * @typedef {import('../config/containerConfig.js').ConfigureContainerFunction} ConfigureContainerFunction
 */

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../config/appContainer.js').default} AppContainer */

/** @typedef {import('../config/tokens.js').tokens} DiTokens */

/**
 * Bootstrap Stage: Ensures critical DOM elements are present.
 * This function utilizes the UIBootstrapper to gather essential elements.
 * If elements are missing, UIBootstrapper's gatherEssentialElements method will throw an error.
 * This stage catches that error and re-throws it with a specific phase.
 *
 * @async
 * @param {Document} doc - The global document object.
 * @returns {Promise<EssentialUIElements>} A promise that resolves with an object containing references to the DOM elements if found.
 * @throws {Error} If `gatherEssentialElements` (called internally) fails because elements are missing. The error will have a `phase` property set to 'UI Element Validation'.
 */
export async function ensureCriticalDOMElementsStage(doc) {
    console.log('Bootstrap Stage: Validating DOM elements...');
    const uiBootstrapper = new UIBootstrapper();
    try {
        const essentialUIElements = uiBootstrapper.gatherEssentialElements(doc);
        console.log('Bootstrap Stage: Validating DOM elements... DONE.');
        return essentialUIElements;
    } catch (error) {
        const stageError = new Error(`UI Element Validation Failed: ${error.message}`, {cause: error});
        stageError.phase = 'UI Element Validation';
        // Log using console.error as logger is not available yet.
        console.error(`Bootstrap Stage: ensureCriticalDOMElementsStage failed. ${stageError.message}`, error);
        throw stageError;
    }
}

/**
 * Bootstrap Stage: Sets up the Dependency Injection (DI) container.
 * This function instantiates AppContainer and calls the provided configuration function.
 *
 * @async
 * @param {EssentialUIElements} uiReferences - The object containing DOM element references.
 * @param {ConfigureContainerFunction} containerConfigFunc - A reference to the configureContainer function.
 * @returns {Promise<AppContainer>} A promise that resolves with the configured AppContainer instance.
 * @throws {Error} If DI container configuration fails. The error will have a `phase` property set to 'DI Container Setup'.
 */
export async function setupDIContainerStage(uiReferences, containerConfigFunc) {
    console.log('Bootstrap Stage: Setting up DI container...');
    const container = new AppContainer();

    try {
        // uiReferences already contains document, so we pass it along
        // The configureContainer function expects { outputDiv, inputElement, titleElement, document }
        // EssentialUIElements matches this structure.
        containerConfigFunc(container, uiReferences);
    } catch (registrationError) {
        const errorMsg = `Fatal Error during service registration: ${registrationError.message}.`;
        const stageError = new Error(errorMsg, {cause: registrationError});
        stageError.phase = 'DI Container Setup';
        // Log using console.error as logger is not available yet.
        console.error(`Bootstrap Stage: setupDIContainerStage failed. ${errorMsg}`, registrationError);
        throw stageError;
    }

    console.log('Bootstrap Stage: Setting up DI container... DONE.');
    return container;
}

/**
 * Bootstrap Stage: Resolves essential core services, particularly the logger.
 *
 * @async
 * @param {AppContainer} container - The configured AppContainer instance.
 * @param {DiTokens} diTokens - The DI tokens object.
 * @returns {Promise<{logger: ILogger}>} An object containing the resolved logger.
 * @throws {Error} If the ILogger service cannot be resolved or is invalid. The error will have a `phase` property set to 'Core Services Resolution'.
 */
export async function resolveCoreServicesStage(container, diTokens) {
    // Log using console.log initially, as logger isn't resolved yet.
    console.log("Bootstrap Stage: Resolving core services (Logger)...");

    /** @type {ILogger} */
    let logger;

    try {
        logger = container.resolve(diTokens.ILogger);
        if (!logger || typeof logger.info !== 'function') { // Basic validation
            throw new Error('ILogger resolved to an invalid object.');
        }
    } catch (resolveError) {
        const errorMsg = `Fatal Error: Could not resolve essential ILogger service: ${resolveError.message}.`;
        const stageError = new Error(errorMsg, {cause: resolveError});
        stageError.phase = 'Core Services Resolution';
        // Log using console.error as logger resolution itself failed.
        console.error(`Bootstrap Stage: resolveCoreServicesStage failed. ${errorMsg}`, resolveError);
        throw stageError;
    }

    // Log using the newly resolved logger.
    logger.info("Bootstrap Stage: Resolving core services (Logger)... DONE. Logger resolved successfully.");

    return {logger};
}