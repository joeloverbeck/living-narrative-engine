// src/core/config/registrations/initializerRegistrations.js
// --- FILE START ---

import {tokens} from '../tokens.js';
import {Registrar} from '../registrarHelpers.js';
import WorldInitializer from '../../initializers/worldInitializer.js';
import SystemInitializer from '../../initializers/systemInitializer.js';
// Import the necessary tag constant (Task 2: Verified, already present)
import {INITIALIZABLE} from "../tags.js";


export function registerInitializers(container) {
    const r = new Registrar(container);
    const log = container.resolve(tokens.ILogger); // For logging within this function

    // --- WorldInitializer (Ticket 15) ---
    // Updated to use factory for object dependency constructor
    r.singletonFactory(
        tokens.WorldInitializer,
        (c) => {
            const dependencies = {
                entityManager: c.resolve(tokens.IEntityManager), // Use interface token
                worldContext: c.resolve(tokens.IWorldContext),
                gameDataRepository: c.resolve(tokens.IGameDataRepository), // Use interface token
                validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
                logger: c.resolve(tokens.ILogger),
                // VVVVVV ADDED LINE VVVVVV
                spatialIndexManager: c.resolve(tokens.ISpatialIndexManager) // Add the missing dependency
                // ^^^^^^ ADDED LINE ^^^^^^
            };
            return new WorldInitializer(dependencies);
        }
    );
    log.debug(`Initializer Registration: Registered ${tokens.WorldInitializer} (with VED and ISpatialIndexManager dependencies).`);


    // --- SystemInitializer (Ticket 15) ---
    // Updated to use factory for object dependency constructor
    r.singletonFactory(
        tokens.SystemInitializer,
        (c) => {
            const dependencies = {
                resolver: c, // Pass the container (AppContainer) as the resolver
                logger: c.resolve(tokens.ILogger),
                validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
                initializationTag: INITIALIZABLE[0] // Pass the tag string
            };
            // AC1: Passes container (IServiceResolver), logger (ILogger), VED, and tag (string).
            // AC2: Passes the correct tag string.
            return new SystemInitializer(dependencies);
        }
    );
    log.debug(`Initializer Registration: Registered ${tokens.SystemInitializer} (with VED dependency).`);
    // --- End Registration ---

    log.info('Initializer Registration: complete.');
}

// --- FILE END ---