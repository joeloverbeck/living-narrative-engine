// src/core/containerConfig.js

// --- Import DI tokens & helpers ---
import {tokens} from './tokens.js';
import {Registrar} from './dependencyInjection/registrarHelpers.js';

// --- Import Logger ---
import ConsoleLogger from './services/consoleLogger.js';

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
    // --- Bootstrap logger early so bundles can use it ------------------------
    const registrar = new Registrar(container);
    const logger = new ConsoleLogger();
    registrar.instance(tokens.ILogger, logger);
    logger.info('Container Config: starting bundle registration…');

    // --- Core data infrastructure -------------------------------------------
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
