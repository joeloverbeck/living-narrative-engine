// src/core/config/registrations/initializerRegistrations.js
import {tokens} from '../tokens.js';
import {Registrar} from '../../dependencyInjection/registrarHelpers.js';
import GameStateInitializer from '../../gameStateInitializer.js';
import WorldInitializer from '../../worldInitializer.js';
import SystemInitializer from '../../initializers/systemInitializer.js';
// Import the necessary tag constant (Task 2: Verified, already present)
import {INITIALIZABLE} from "../tags.js";


export function registerInitializers(container) {
    const r = new Registrar(container);
    const log = container.resolve(tokens.ILogger); // For logging within this function

    r.tagged(INITIALIZABLE).singletonFactory( // Use singletonFactory
        tokens.GameStateInitializer,          // Token
        (c) => {                              // Custom factory, receives container 'c'
            // Resolve all individual dependencies
            const entityManager = c.resolve(tokens.EntityManager);
            const gameStateManager = c.resolve(tokens.GameStateManager);
            const gameDataRepository = c.resolve(tokens.GameDataRepository);
            const validatedEventDispatcher = c.resolve(tokens.ValidatedEventDispatcher);
            const logger = c.resolve(tokens.ILogger);

            // Create the single dependency object expected by the constructor
            const dependencies = {
                entityManager,
                gameStateManager,
                gameDataRepository,
                validatedEventDispatcher,
                logger
            };

            // Call the constructor correctly with the single object
            return new GameStateInitializer(dependencies);
        }
    );


    // Register WorldInitializer - ASSUMING its constructor takes separate args
    // If WorldInitializer ALSO expects a single object, it needs the same fix as above.
    r.tagged(INITIALIZABLE).single(tokens.WorldInitializer, WorldInitializer,
        [tokens.EntityManager, tokens.GameStateManager, tokens.GameDataRepository]);


    // --- Registration for SystemInitializer using singletonFactory ---
    // Task 1: Identified instantiation point within this factory
    r.singletonFactory(
        tokens.SystemInitializer, // The key/token for this service
        (c) => {                  // The factory function. 'c' IS the AppContainer instance
            const logger = c.resolve(tokens.ILogger);
            // Task 3: Modify the new SystemInitializer(...) call
            // Pass AppContainer (c), ILogger (logger), and the tag string (INITIALIZABLE[0])
            // AC1: Passes container (IServiceResolver), logger (ILogger), and tag (string).
            // AC2: Passes the correct tag string.
            return new SystemInitializer(c, logger, INITIALIZABLE[0]); // <<< UPDATED LINE
        }
    );
    // --- End Registration ---

    log.info('Initializer Registration: complete.');
}