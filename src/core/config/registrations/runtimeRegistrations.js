// src/core/config/registrations/runtimeRegistrations.js
// ****** MODIFIED FILE ******
import {tokens} from '../tokens.js';
import {Registrar} from '../../dependencyInjection/registrarHelpers.js';
import GameLoop from "../../gameLoop.js";
import InputSetupService from "../../setup/inputSetupService.js";

// --- Import Interfaces for Type Hinting --- // <<< Added import block
/** @typedef {import('../../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../appContainer.js').default} AppContainer */
/** @typedef {import('../../../interfaces/coreServices.js').IGameStateManager} IGameStateManager */
// REMOVED: /** @typedef {import('../../../interfaces/coreServices.js').IInputHandler} IInputHandler */
// REMOVED: /** @typedef {import('../../../interfaces/coreServices.js').ICommandParser} ICommandParser */
/** @typedef {import('../../../interfaces/coreServices.js').IActionExecutor} IActionExecutor */
/** @typedef {import('../../eventBus.js').default} EventBus */ // Assuming EventBus is concrete
/** @typedef {import('../../../entities/entityManager.js').default} EntityManager */ // Assuming EntityManager is concrete
/** @typedef {import('../../services/gameDataRepository.js').GameDataRepository} GameDataRepository */ // Assuming concrete
/** @typedef {import('../../../interfaces/coreServices.js').IActionDiscoverySystem} IActionDiscoverySystem */
/** @typedef {import('../../../interfaces/coreServices.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../../../interfaces/coreServices.js').ITurnManager} ITurnManager */
/** @typedef {import('../../interfaces/ITurnHandlerResolver.js').ITurnHandlerResolver} ITurnHandlerResolver */ // <<< Added import

/**
 * Registers runtime services like GameLoop, TurnManager, and input setup.
 *
 * @export
 * @param {AppContainer} container - The application's DI container.
 */
export function registerRuntime(container) {
    const r = new Registrar(container);
    /** @type {ILogger} */
    const log = container.resolve(tokens.ILogger); // Use explicit type

    // Register GameLoop as Singleton
    r.singletonFactory(tokens.GameLoop, c => {
        log.debug(`Runtime Registration: Factory creating ${tokens.GameLoop}...`); // <<< Added logging
        // Resolve dependencies
        /** @type {IGameStateManager} */
        const gameStateManager = c.resolve(tokens.IGameStateManager);
        // REMOVED: /** @type {IInputHandler} */
        // REMOVED: const inputHandler = c.resolve(tokens.IInputHandler);
        // REMOVED: /** @type {ICommandParser} */
        // REMOVED: const commandParser = c.resolve(tokens.ICommandParser);
        /** @type {IActionExecutor} */
        const actionExecutor = c.resolve(tokens.IActionExecutor);
        /** @type {EventBus} */
        const eventBus = c.resolve(tokens.EventBus);
        /** @type {EntityManager} */
        const entityManager = c.resolve(tokens.EntityManager);
        /** @type {GameDataRepository} */
        const gameDataRepository = c.resolve(tokens.GameDataRepository);
        /** @type {IActionDiscoverySystem} */
        const actionDiscoverySystem = c.resolve(tokens.IActionDiscoverySystem);
        /** @type {IValidatedEventDispatcher} */
        const validatedEventDispatcher = c.resolve(tokens.IValidatedEventDispatcher);
        /** @type {ITurnManager} */
        const turnManager = c.resolve(tokens.ITurnManager);
        /** @type {ILogger} */
        const logger = c.resolve(tokens.ILogger);
        /** @type {ITurnHandlerResolver} */ // <<< Added resolution
        const turnHandlerResolver = c.resolve(tokens.TurnHandlerResolver); // Use confirmed token 'TurnHandlerResolver'

        // Basic validation (optional but good practice)
        if (!gameStateManager) throw new Error(`GameLoop Factory: Failed to resolve dependency: ${tokens.IGameStateManager}`);
        // REMOVED: if (!inputHandler) throw new Error(`GameLoop Factory: Failed to resolve dependency: ${tokens.IInputHandler}`);
        // REMOVED: if (!commandParser) throw new Error(`GameLoop Factory: Failed to resolve dependency: ${tokens.ICommandParser}`);
        if (!actionExecutor) throw new Error(`GameLoop Factory: Failed to resolve dependency: ${tokens.IActionExecutor}`);
        if (!eventBus) throw new Error(`GameLoop Factory: Failed to resolve dependency: ${tokens.EventBus}`);
        if (!entityManager) throw new Error(`GameLoop Factory: Failed to resolve dependency: ${tokens.EntityManager}`);
        if (!gameDataRepository) throw new Error(`GameLoop Factory: Failed to resolve dependency: ${tokens.GameDataRepository}`);
        if (!actionDiscoverySystem) throw new Error(`GameLoop Factory: Failed to resolve dependency: ${tokens.IActionDiscoverySystem}`);
        if (!validatedEventDispatcher) throw new Error(`GameLoop Factory: Failed to resolve dependency: ${tokens.IValidatedEventDispatcher}`);
        if (!turnManager) throw new Error(`GameLoop Factory: Failed to resolve dependency: ${tokens.ITurnManager}`);
        if (!logger) throw new Error(`GameLoop Factory: Failed to resolve dependency: ${tokens.ILogger}`);
        if (!turnHandlerResolver) throw new Error(`GameLoop Factory: Failed to resolve dependency: ${tokens.TurnHandlerResolver}`); // <<< Added validation

        log.debug(`Runtime Registration: Dependencies for ${tokens.GameLoop} resolved.`);

        // Create GameLoop instance with injected dependencies
        const gameLoopInstance = new GameLoop({
            gameStateManager,
            // REMOVED: inputHandler,
            // REMOVED: commandParser,
            actionExecutor,
            eventBus,
            entityManager,
            gameDataRepository,
            actionDiscoverySystem,
            validatedEventDispatcher,
            turnManager,
            logger,
            turnHandlerResolver // <<< Added injection
        });
        log.debug(`Runtime Registration: ${tokens.GameLoop} instance created.`);
        return gameLoopInstance;
    });
    log.info(`Runtime Registration: Registered ${tokens.GameLoop} (Singleton).`); // <<< Added log


    r.singletonFactory(tokens.InputSetupService, c => new InputSetupService({
        container: c,
        logger: c.resolve(tokens.ILogger),
        validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
        // GameLoop potentially needed here if InputSetup interacts directly with GameLoop state,
        // but primary command flow goes through EventBus -> GameLoop -> TurnManager
        gameLoop: c.resolve(tokens.GameLoop)
    }));
    log.info(`Runtime Registration: Registered ${tokens.InputSetupService} (Singleton).`); // <<< Added log

    log.info('Runtime Registration: complete.');
}