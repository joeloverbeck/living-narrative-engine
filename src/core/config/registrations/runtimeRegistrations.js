// src/core/config/registrations/runtimeRegistrations.js
import {tokens} from '../tokens.js';
import {Registrar} from '../../dependencyInjection/registrarHelpers.js';
import GameLoop from "../../gameLoop.js";
import InputSetupService from "../../setup/inputSetupService.js";

export function registerRuntime(container) {
    const r = new Registrar(container);
    const log = container.resolve(tokens.ILogger);

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
        turnOrderService: c.resolve(tokens.ITurnOrderService),
        logger: c.resolve(tokens.ILogger)
    }));

    r.singletonFactory(tokens.InputSetupService, c => new InputSetupService({
        container: c,
        logger: c.resolve(tokens.ILogger),
        validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
        gameLoop: c.resolve(tokens.GameLoop)
    }));

    log.info('Runtime Registration: complete.');
}