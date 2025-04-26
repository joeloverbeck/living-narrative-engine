// src/core/containerConfig.js

// --- Import DI tokens & helpers ---
import {tokens} from './tokens.js';
import {Registrar} from './dependencyInjection/registrarHelpers.js';

// --- Import Logger ---
import ConsoleLogger from './services/consoleLogger.js';
// --- Import Logger Interface for Type Hinting ---
/** @typedef {import('./interfaces/coreServices.js').ILogger} ILogger */

// --- Import registration bundle functions ---
import {registerLoaders} from './config/registrations/loadersRegistrations.js';
import {registerInfrastructure} from './config/registrations/infrastructureRegistrations.js';
import {registerUI} from './config/registrations/uiRegistrations.js';
import {registerDomainServices} from './config/registrations/domainServicesRegistrations.js';
import {registerQuestSystems} from './config/registrations/questRegistrations.js';
import {registerCoreSystems} from './config/registrations/coreSystemsRegistrations.js';
import {registerInterpreters} from './config/registrations/interpreterRegistrations.js';
import {registerInitializers} from './config/registrations/initializerRegistrations.js';
import {registerRuntime} from './config/registrations/runtimeRegistrations.js';

/** @typedef {import('./appContainer.js').default} AppContainer */

/**
 * Configures the application's dependency‑injection container.
 *
 * The function now delegates all granular registrations to small, focused
 * "bundle" modules.  This keeps the file readable while preserving the
 * explicit start‑up order.
 *
 * @param {AppContainer} container
 * @param {object} uiElements – external DOM references
 * @param {HTMLElement} uiElements.outputDiv
 * @param {HTMLInputElement} uiElements.inputElement
 * @param {HTMLElement} uiElements.titleElement
 */
export function configureContainer(
    container,
    {outputDiv, inputElement, titleElement},
) {
    const registrar = new Registrar(container);

    // --- Bootstrap logger early so bundles can use it ------------------------
    // CHANGE: Register ILogger using a factory function.
    // Use singletonFactory (or equivalent) from your Registrar helper if it exists,
    // otherwise, call container.register directly. Assuming registrar.singletonFactory exists:
    registrar.singletonFactory(tokens.ILogger, () => new ConsoleLogger());

    // CHANGE: Resolve the logger *after* it's registered to use it here.
    /** @type {ILogger} */
    const logger = container.resolve(tokens.ILogger);
    logger.info('Container Config: starting bundle registration…');


    // --- Core data infrastructure -------------------------------------------
    // This call will now correctly resolve the registered ILogger singleton.
    registerLoaders(container);
    registerInfrastructure(container);

    // --- UI (needs ValidatedEventDispatcher from infrastructure) ------------
    registerUI(container, {outputDiv, inputElement, titleElement});

    // --- Pure domain‑logic services -----------------------------------------
    registerDomainServices(container);

    // --- Feature / gameplay bundles -----------------------------------------
    registerQuestSystems(container);
    registerCoreSystems(container);

    // --- Logic interpretation layer -----------------------------------------
    registerInterpreters(container);

    // --- Initializers --------------------------------------------------------
    registerInitializers(container);

    // --- Runtime loop & input plumbing --------------------------------------
    registerRuntime(container);

    logger.info('Container Config: all bundles registered.');
}