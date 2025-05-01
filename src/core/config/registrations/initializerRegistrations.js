// src/core/config/registrations/initializerRegistrations.js
import {tokens} from '../tokens.js';
import {Registrar} from '../../dependencyInjection/registrarHelpers.js';
import GameStateInitializer from '../../initializers/gameStateInitializer.js';
import WorldInitializer from '../../initializers/worldInitializer.js';
import SystemInitializer from '../../initializers/systemInitializer.js';
// Import the necessary tag constant (Task 2: Verified, already present)
import {INITIALIZABLE} from "../tags.js";


export function registerInitializers(container) {
    const r = new Registrar(container);
    const log = container.resolve(tokens.ILogger); // For logging within this function

    // --- GameStateInitializer ---
    // Already correctly registered with a dependency object constructor
    r.singletonFactory(
        tokens.GameStateInitializer,
        (c) => {
            const dependencies = {
                entityManager: c.resolve(tokens.EntityManager),
                gameStateManager: c.resolve(tokens.IGameStateManager),
                gameDataRepository: c.resolve(tokens.GameDataRepository),
                validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
                logger: c.resolve(tokens.ILogger)
            };
            return new GameStateInitializer(dependencies);
        }
    );
    log.debug(`Initializer Registration: Registered ${tokens.GameStateInitializer}.`);


    // --- WorldInitializer (Ticket 15) ---
    // Updated to use factory for object dependency constructor
    r.singletonFactory(
        tokens.WorldInitializer,
        (c) => {
            const dependencies = {
                entityManager: c.resolve(tokens.EntityManager),
                gameStateManager: c.resolve(tokens.IGameStateManager),
                gameDataRepository: c.resolve(tokens.GameDataRepository),
                validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher), // <<< ADDED Ticket 15
                logger: c.resolve(tokens.ILogger) // <<< ADDED (assuming it needs logger too)
            };
            return new WorldInitializer(dependencies);
        }
    );
    log.debug(`Initializer Registration: Registered ${tokens.WorldInitializer} (with VED dependency).`);


    // --- SystemInitializer (Ticket 15) ---
    // Updated to use factory for object dependency constructor
    r.singletonFactory(
        tokens.SystemInitializer,
        (c) => {
            const dependencies = {
                resolver: c, // Pass the container (AppContainer) as the resolver
                logger: c.resolve(tokens.ILogger),
                validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher), // <<< ADDED Ticket 15
                initializationTag: INITIALIZABLE[0] // Pass the tag string
            };
            // AC1: Passes container (IServiceResolver), logger (ILogger), VED, and tag (string).
            // AC2: Passes the correct tag string.
            return new SystemInitializer(dependencies); // <<< UPDATED LINE
        }
    );
    log.debug(`Initializer Registration: Registered ${tokens.SystemInitializer} (with VED dependency).`);
    // --- End Registration ---

    log.info('Initializer Registration: complete.');
}