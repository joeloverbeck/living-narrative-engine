// src/core/config/registrations/initializerRegistrations.js
import {tokens} from '../../tokens.js';
import {Registrar} from '../../dependencyInjection/registrarHelpers.js';
import GameStateInitializer from '../../gameStateInitializer.js';
import WorldInitializer from '../../worldInitializer.js';
import SystemInitializer from '../../initializers/systemInitializer.js';

export const INITIALIZABLE = ['initializableSystem'];

export function registerInitializers(container) {
    const r = new Registrar(container);
    const log = container.resolve(tokens.ILogger);

    r.tagged(INITIALIZABLE).single(tokens.GameStateInitializer, GameStateInitializer,
        [tokens.EntityManager, tokens.GameStateManager, tokens.GameDataRepository,
            tokens.ValidatedEventDispatcher, tokens.ILogger]);

    r.tagged(INITIALIZABLE).single(tokens.WorldInitializer, WorldInitializer,
        [tokens.EntityManager, tokens.GameStateManager, tokens.GameDataRepository]);

    // SystemInitializer stays un-tagged
    r.single(tokens.SystemInitializer, SystemInitializer, [/* (container + logger via factory) */]);

    log.info('Initializer Registration: complete.');
}