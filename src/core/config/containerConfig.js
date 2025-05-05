// src/core/config/containerConfig.js
// ****** MODIFIED FILE ******

// --- Import DI tokens & helpers ---
import {tokens} from './tokens.js'; // Corrected path assuming tokens.js is in the same directory
import {Registrar} from './registrarHelpers.js'; // Corrected path assuming registrarHelpers.js is one level up

// --- Import Logger ---
import ConsoleLogger from '../services/consoleLogger.js'; // Corrected path assuming consoleLogger is in ../services/
// --- Import Logger Interface for Type Hinting ---
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
// --- Import necessary types for registry population ---
/** @typedef {import('../services/systemServiceRegistry.js').SystemServiceRegistry} SystemServiceRegistry */
/** @typedef {import('../services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../services/systemDataRegistry.js').SystemDataRegistry} SystemDataRegistry */

// --- Import registration bundle functions ---
import {registerLoaders} from './registrations/loadersRegistrations.js';
import {registerInfrastructure} from './registrations/infrastructureRegistrations.js';
import {registerUI} from './registrations/uiRegistrations.js';
import {registerDomainServices} from './registrations/domainServicesRegistrations.js';
import {registerCoreSystems} from './registrations/coreSystemsRegistrations.js';
import {registerInterpreters} from './registrations/interpreterRegistrations.js';
import {registerInitializers} from './registrations/initializerRegistrations.js';
import {registerRuntime} from './registrations/runtimeRegistrations.js';
import {registerOrchestration} from './registrations/orchestrationRegistrations.js';
import { registerAdapters } from './registrations/adapterRegistrations.js';

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
    registrar.singletonFactory(tokens.ILogger, () => new ConsoleLogger());

    /** @type {ILogger} */
    const logger = container.resolve(tokens.ILogger);
    logger.info('Container Config: starting bundle registration…');

    // --- Core data infrastructure -------------------------------------------
    registerLoaders(container);
    // Infrastructure must come after Loaders if loaders define interfaces used here
    registerInfrastructure(container); // Registers SystemServiceRegistry, GameDataRepository, SystemDataRegistry (Ticket #7), IValidatedEventDispatcher, ISafeEventDispatcher

    // --- UI (needs ValidatedEventDispatcher from infrastructure) ------------
    // Pass outputDiv and titleElement along, and assume document is globally accessible or handle differently
    registerUI(container, {outputDiv, inputElement, titleElement, document: window.document}); // Pass required elements + document

    // --- Pure domain‑logic services -----------------------------------------
    registerDomainServices(container); // Registers CommandProcessor, ActionExecutor etc.

    // --- Port Adapters (depend on infrastructure, domain services) ----------
    // >>> ADDED: Register Port Adapters <<<
    // Need to be registered after dispatchers (infra) are available.
    registerAdapters(container); // Registers ICommandInputPort, IPromptOutputPort, ITurnEndPort implementations

    // --- Feature / gameplay bundles -----------------------------------------
    // These might depend on the Ports/Adapters in the future, so register Adapters first.
    registerCoreSystems(container); // Registers TurnManager, Player/AI Turn Handlers etc.

    // --- Logic interpretation layer -----------------------------------------
    registerInterpreters(container); // Register handlers and interpreters

    // --- Initializers (Sub-components like SystemInitializer, not the main orchestration) ---
    registerInitializers(container);

    // --- Runtime loop & input plumbing --------------------------------------
    registerRuntime(container); // Registers InputSetupService

    // --- High-level Orchestration Services (Init/Shutdown) -----------------
    // <<< ADDED: Register orchestration services AFTER their dependencies (Logger, VED, GameLoop) are registered.
    registerOrchestration(container);

    logger.info('Container Config: all core bundles registered.');

    // --- Populate Registries (Post-Registration Steps) ---
    // This section executes *after* all service registrations are complete,
    // ensuring the required instances are available for resolution.

    // --- Populate SystemServiceRegistry (Sub-Ticket 6.6) ---
    try {
        logger.debug('Container Config: Populating SystemServiceRegistry...');
        const systemServiceRegistry = /** @type {SystemServiceRegistry} */ (
            container.resolve(tokens.SystemServiceRegistry)
        );
        const gameDataRepoForSSR = /** @type {GameDataRepository} */ ( // Renamed to avoid conflict below
            container.resolve(tokens.GameDataRepository)
        );
        const serviceKey = 'GameDataRepository';
        logger.debug(`Container Config: Registering service '${serviceKey}' in SystemServiceRegistry...`);
        systemServiceRegistry.registerService(serviceKey, gameDataRepoForSSR);
        logger.info(`Container Config: Service '${serviceKey}' successfully registered in SystemServiceRegistry.`);
    } catch (error) {
        logger.error('Container Config: CRITICAL ERROR during SystemServiceRegistry population:', error);
        throw new Error(`Failed to populate SystemServiceRegistry: ${error.message}`);
    }

    // --- Populate SystemDataRegistry (Ticket #7) ---
    try {
        logger.debug('Container Config: Populating SystemDataRegistry...');

        // 1. Resolve the SystemDataRegistry instance (registered in infrastructureRegistrations)
        const systemDataRegistry = /** @type {SystemDataRegistry} */ (
            container.resolve(tokens.SystemDataRegistry)
        );

        // 2. Resolve the GameDataRepository instance (registered in infrastructureRegistrations)
        const gameDataRepo = /** @type {GameDataRepository} */ (
            container.resolve(tokens.GameDataRepository)
        );

        // 3. Define the string key (as per ticket description)
        const dataSourceKey = 'GameDataRepository';

        // 4. Call the registry's registration method
        logger.debug(`Container Config: Registering data source '${dataSourceKey}' in SystemDataRegistry...`);
        systemDataRegistry.registerSource(dataSourceKey, gameDataRepo); // AC: GameDataRepository registered with ID "GameDataRepository"

        logger.info(`Container Config: Data source '${dataSourceKey}' successfully registered in SystemDataRegistry.`);

    } catch (error) {
        // Log an error if resolution or registration fails
        logger.error('Container Config: CRITICAL ERROR during SystemDataRegistry population:', error);
        // Re-throw the error to potentially halt application startup if essential
        throw new Error(`Failed to populate SystemDataRegistry: ${error.message}`);
    }
    // --- End SystemDataRegistry Population ---

    logger.info('Container Config: Configuration and registry population complete.');
}
