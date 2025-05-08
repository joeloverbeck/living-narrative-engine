// src/core/config/containerConfig.js
// ****** MODIFIED FILE ******

// --- Import DI tokens & helpers ---
import {tokens} from './tokens.js';
import {Registrar} from './registrarHelpers.js';

// --- Import Logger ---
import ConsoleLogger from '../services/consoleLogger.js';
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
import {registerAdapters} from './registrations/adapterRegistrations.js';

/** @typedef {import('./appContainer.js').default} AppContainer */

/**
 * Configures the application's dependency‑injection container.
 *
 * The function now delegates all granular registrations to small, focused
 * "bundle" modules. This keeps the file readable while preserving the
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

    // --- Registration Order ---
    // 1. Loaders & Core Infrastructure (Data access, basic services)
    registerLoaders(container);
    registerInfrastructure(container); // Registers EventDispatchers, Registries etc. (Assumed to register GameDataRepository under IGameDataRepository)

    // 2. UI Layer (Depends on Infrastructure like EventDispatchers)
    registerUI(container, {outputDiv, inputElement, titleElement, document: window.document});

    // 3. Domain Logic Services (Business rules, core calculations)
    registerDomainServices(container); // Registers CommandProcessor, PlayerPromptService etc.

    // 4. Logic Interpretation Layer (Depends on Domain Services, Infrastructure)
    registerInterpreters(container); // Registers CommandOutcomeInterpreter, OperationInterpreter etc.

    // 5. Port Adapters (Depends on Infrastructure, Domain Services)
    registerAdapters(container); // Registers ICommandInputPort, IPromptOutputPort, ITurnEndPort implementations

    // 6. Core Systems & Gameplay Bundles (Depends on Interpreters, Adapters, Domain Services)
    registerCoreSystems(container); // Registers TurnManager, Player/AI Turn Handlers etc.

    // 7. Initializers (Depend on registered systems/services)
    registerInitializers(container);

    // 8. Runtime loop & input plumbing (Depends on various services)
    registerRuntime(container);

    // 9. High-level Orchestration Services (Depend on initializers, runtime)
    registerOrchestration(container);

    logger.info('Container Config: all core bundles registered.');

    // --- Populate Registries (Post-Registration Steps) ---
    // --- Populate SystemServiceRegistry ---
    try {
        logger.debug('Container Config: Populating SystemServiceRegistry...');
        const systemServiceRegistry = /** @type {SystemServiceRegistry} */ (
            container.resolve(tokens.SystemServiceRegistry)
        );
        // VVVVVV MODIFIED LINE VVVVVV
        // Resolve using the interface token, as this seems to be how GameDataRepository is registered.
        const gameDataRepoForSSR = /** @type {GameDataRepository} */ (
            container.resolve(tokens.IGameDataRepository)
        );
        // ^^^^^^ MODIFIED LINE ^^^^^^
        const serviceKey = 'GameDataRepository'; // The key for SystemServiceRegistry can remain the concrete name
        logger.debug(`Container Config: Registering service '${serviceKey}' (resolved via IGameDataRepository) in SystemServiceRegistry...`);
        systemServiceRegistry.registerService(serviceKey, gameDataRepoForSSR);
        logger.info(`Container Config: Service '${serviceKey}' successfully registered in SystemServiceRegistry.`);
    } catch (error) {
        logger.error('Container Config: CRITICAL ERROR during SystemServiceRegistry population:', error);
        throw new Error(`Failed to populate SystemServiceRegistry: ${error.message}`);
    }

    // --- Populate SystemDataRegistry ---
    try {
        logger.debug('Container Config: Populating SystemDataRegistry...');
        const systemDataRegistry = /** @type {SystemDataRegistry} */ (
            container.resolve(tokens.SystemDataRegistry)
        );
        // VVVVVV MODIFIED LINE VVVVVV
        // Resolve using the interface token here as well for consistency.
        const gameDataRepo = /** @type {GameDataRepository} */ (
            container.resolve(tokens.IGameDataRepository)
        );
        // ^^^^^^ MODIFIED LINE ^^^^^^
        const dataSourceKey = 'GameDataRepository'; // The key for SystemDataRegistry can remain the concrete name
        logger.debug(`Container Config: Registering data source '${dataSourceKey}' (resolved via IGameDataRepository) in SystemDataRegistry...`);
        systemDataRegistry.registerSource(dataSourceKey, gameDataRepo);
        logger.info(`Container Config: Data source '${dataSourceKey}' successfully registered in SystemDataRegistry.`);
    } catch (error) {
        logger.error('Container Config: CRITICAL ERROR during SystemDataRegistry population:', error);
        throw new Error(`Failed to populate SystemDataRegistry: ${error.message}`);
    }
    // --- End SystemDataRegistry Population ---

    logger.info('Container Config: Configuration and registry population complete.');
}