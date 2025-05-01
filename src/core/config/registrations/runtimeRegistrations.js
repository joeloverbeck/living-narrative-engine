// src/core/config/registrations/runtimeRegistrations.js
import {tokens} from '../tokens.js';
import {Registrar} from '../../dependencyInjection/registrarHelpers.js';
import GameLoop from "../../gameLoop.js";
import TurnManager from "../../turnManager.js"; // <<< ADDED
import InputSetupService from "../../setup/inputSetupService.js";

export function registerRuntime(container) {
    const r = new Registrar(container);
    const log = container.resolve(tokens.ILogger);

    // Register TurnManager as Singleton (Ticket 2.2 Task 1)
    r.singletonFactory(tokens.ITurnManager, c => new TurnManager({
        turnOrderService: c.resolve(tokens.ITurnOrderService),
        entityManager: c.resolve(tokens.EntityManager),
        logger: c.resolve(tokens.ILogger),
        dispatcher: c.resolve(tokens.IValidatedEventDispatcher)
    }));

    r.singletonFactory(tokens.GameLoop, c => new GameLoop({
        gameStateManager: c.resolve(tokens.IGameStateManager),
        inputHandler: c.resolve(tokens.IInputHandler),
        commandParser: c.resolve(tokens.ICommandParser),
        actionExecutor: c.resolve(tokens.IActionExecutor),
        eventBus: c.resolve(tokens.EventBus),
        entityManager: c.resolve(tokens.EntityManager),
        gameDataRepository: c.resolve(tokens.GameDataRepository),
        actionDiscoverySystem: c.resolve(tokens.IActionDiscoverySystem),
        validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
        turnManager: c.resolve(tokens.ITurnManager), // Already depends on ITurnManager
        logger: c.resolve(tokens.ILogger)
    }));

    r.singletonFactory(tokens.InputSetupService, c => new InputSetupService({
        container: c,
        logger: c.resolve(tokens.ILogger),
        validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
        // GameLoop potentially needed here if InputSetup interacts directly with GameLoop state,
        // but primary command flow goes through EventBus -> GameLoop -> TurnManager
        gameLoop: c.resolve(tokens.GameLoop)
    }));

    log.info('Runtime Registration: complete.');
}