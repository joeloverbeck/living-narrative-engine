// src/dependencyInjection/registrations/initializerRegistrations.js
// --- FILE START ---

import { tokens } from '../tokens.js';
import { Registrar } from '../registrarHelpers.js';
import WorldInitializer from '../../initializers/worldInitializer.js';
import SystemInitializer from '../../initializers/systemInitializer.js';
// Import the necessary tag constant (Task 2: Verified, already present)
import { INITIALIZABLE } from '../tags.js';

/**
 *
 * @param container
 */
export function registerInitializers(container) {
  const r = new Registrar(container);
  const log = container.resolve(tokens.ILogger); // For logging within this function

  // --- WorldInitializer (Ticket 15 & Current Ticket) ---
  // Updated to use factory for object dependency constructor
  r.singletonFactory(tokens.WorldInitializer, (c) => {
    const dependencies = {
      entityManager: c.resolve(tokens.IEntityManager),
      worldContext: c.resolve(tokens.IWorldContext),
      gameDataRepository: c.resolve(tokens.IGameDataRepository),
      validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
      logger: c.resolve(tokens.ILogger),
      scopeRegistry: c.resolve(tokens.IScopeRegistry),
    };
    return new WorldInitializer(dependencies);
  });
  log.debug(
    `Initializer Registration: Registered ${tokens.WorldInitializer} with ScopeRegistry injection.`
  );

  // --- SystemInitializer (Ticket 15) ---
  // Updated to use factory for object dependency constructor
  r.singletonFactory(tokens.SystemInitializer, (c) => {
    const dependencies = {
      resolver: c, // Pass the container (AppContainer) as the resolver
      logger: c.resolve(tokens.ILogger),
      validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
      initializationTag: INITIALIZABLE[0], // Pass the tag string
    };
    return new SystemInitializer(dependencies);
  });
  log.debug(
    `Initializer Registration: Registered ${tokens.SystemInitializer} (with VED dependency).`
  );
  // --- End Registration ---

  log.debug('Initializer Registration: complete.');
}

// --- FILE END ---
