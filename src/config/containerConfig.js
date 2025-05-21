// src/core/config/containerConfig.js

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
/** @typedef {import('../context/worldContext.js').default} WorldContext */ // <<< Added WorldContext import for type hint
/** @typedef {import('../services/perceptionUpdateService.js').default} PerceptionUpdateService */ // <<< ADDED IMPORT FOR TYPE HINT

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
/** @typedef {import('../../bootstrapper/UIBootstrapper.js').EssentialUIElements} EssentialUIElements */ // Added for type safety

/**
 * @callback ConfigureContainerFunction
 * @param {AppContainer} container - The application container instance.
 * @param {EssentialUIElements} uiReferences - References to essential UI elements.
 * @returns {void}
 */

/**
 * Configures the application's dependency‑injection container.
 *
 * The function now delegates all granular registrations to small, focused
 * "bundle" modules. This keeps the file readable while preserving the
 * explicit start‑up order.
 *
 * @param {AppContainer} container
 * @param {EssentialUIElements} uiElements – external DOM references. It expects an object like { outputDiv, inputElement, titleElement, document }.
 */
export function configureContainer(
    container,
    uiElements, // Renamed for clarity, its structure is EssentialUIElements
) {
    const registrar = new Registrar(container);
    const {outputDiv, inputElement, titleElement, document: doc} = uiElements; // Destructure including document

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
    // Pass the destructured elements including the document
    registerUI(container, {outputDiv, inputElement, titleElement, document: doc});

    // 3. Domain Logic Services (Business rules, core calculations)
    registerDomainServices(container); // Registers CommandProcessor, PlayerPromptService, PerceptionUpdateService etc.

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

    // --- Populate SystemDataRegistry ---
    try {
        logger.debug('Container Config: Populating SystemDataRegistry...');
        const systemDataRegistry = /** @type {SystemDataRegistry} */ (
            container.resolve(tokens.SystemDataRegistry)
        );

        // Register GameDataRepository (existing)
        const gameDataRepo = /** @type {GameDataRepository} */ (
            container.resolve(tokens.IGameDataRepository)
        );
        // Assuming GameDataRepository might not have handleQuery, but its own 'query' method
        // For it to be compatible with SystemDataRegistry, it would need a handleQuery adapter,
        // or SystemDataRegistry would need to be more flexible.
        // For now, if GameDataRepository is to be used via SystemDataRegistry, it must adhere to IQueryableDataSource.
        // Let's assume it's made compatible or not queried this way for this ticket.
        // If GameDataRepository does not have .handleQuery, this specific registration will log a warning by SystemDataRegistry.
        systemDataRegistry.registerSource('GameDataRepository', gameDataRepo); // Assuming GameDataRepo implements handleQuery or similar
        logger.info(`Container Config: Data source 'GameDataRepository' registered in SystemDataRegistry.`);


        const worldContextInstance = /** @type {WorldContext} */ ( // Added type hint
            container.resolve(tokens.IWorldContext)
        );
        const worldContextKey = 'WorldContext';
        logger.debug(`Container Config: Registering data source '${worldContextKey}' in SystemDataRegistry...`);
        systemDataRegistry.registerSource(worldContextKey, worldContextInstance);
        logger.info(`Container Config: Data source '${worldContextKey}' successfully registered in SystemDataRegistry.`);

        const perceptionUpdateServiceInstance = /** @type {PerceptionUpdateService} */ (
            container.resolve(tokens.PerceptionUpdateService)
        );
        const perceptionUpdateServiceKey = 'PerceptionUpdateService'; // This is the source_id
        logger.debug(`Container Config: Registering data source '${perceptionUpdateServiceKey}' in SystemDataRegistry...`);
        systemDataRegistry.registerSource(perceptionUpdateServiceKey, perceptionUpdateServiceInstance);
        logger.info(`Container Config: Data source '${perceptionUpdateServiceKey}' successfully registered in SystemDataRegistry.`);


    } catch (error) {
        logger.error('Container Config: CRITICAL ERROR during SystemDataRegistry population:', {
            message: error.message,
            stack: error.stack,
            errorObj: error
        });
        // It's often better to rethrow with the original error for a more complete stack trace.
        throw new Error(`Failed to populate SystemDataRegistry: ${error.message}`, {cause: error});
    }

    logger.info('Container Config: Configuration and registry population complete.');
}

// --- FILE END ---