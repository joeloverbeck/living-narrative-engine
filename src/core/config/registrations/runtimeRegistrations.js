// src/core/config/registrations/runtimeRegistrations.js
import {tokens} from '../../tokens.js';
import {Registrar} from '../../dependencyInjection/registrarHelpers.js';
import GameLoop from "../../gameLoop.js";
import InputSetupService from "../../setup/inputSetupService.js";

export function registerRuntime(container) {
    const r = new Registrar(container);
    const log = container.resolve(tokens.ILogger);

    r.singletonFactory(tokens.GameLoop, c => new GameLoop({
        gameStateManager: c.resolve(tokens.GameStateManager),
        inputHandler: c.resolve(tokens.InputHandler),
        commandParser: c.resolve(tokens.CommandParser),
        actionExecutor: c.resolve(tokens.ActionExecutor),
        eventBus: c.resolve(tokens.EventBus),
        entityManager: c.resolve(tokens.EntityManager),
        gameDataRepository: c.resolve(tokens.GameDataRepository),
        actionDiscoverySystem: c.resolve(tokens.ActionDiscoverySystem),
        validatedEventDispatcher: c.resolve(tokens.ValidatedEventDispatcher),
        logger: c.resolve(tokens.ILogger)
    }));

    r.singletonFactory(tokens.InputSetupService, c => new InputSetupService({
        container: c,
        logger: c.resolve(tokens.ILogger),
        validatedEventDispatcher: c.resolve(tokens.ValidatedEventDispatcher),
        gameLoop: c.resolve(tokens.GameLoop)
    }));

    log.info('Runtime Registration: complete.');
}