// src/dependencyInjection/registrations/runtimeRegistrations.js
// ****** MODIFIED FILE ******
import { tokens } from '../tokens.js';
import { Registrar } from '../registrarHelpers.js';
// REMOVED: GameLoop import (no longer directly instantiated here)
// import GameLoop from "../../gameLoop.js";
import InputSetupService from '../../setup/inputSetupService.js';

// --- Import Interfaces for Type Hinting ---
/** @typedef {import('../../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../appContainer.js').default} AppContainer */
/** @typedef {import('../../../interfaces/coreServices.js').IWorldContext} IGameStateManager */
// REMOVED: IInputHandler (Not directly used by GameLoop or other registrations here)
// REMOVED: ICommandParser (Delegated to CommandProcessor)
// REMOVED: IActionExecutor (Delegated to CommandProcessor via TurnHandlers) // <<< REMOVED
/** @typedef {import('../../events/eventBus.js').default} EventBus */ // Assuming EventBus is concrete (Needed? Check if InputSetup needs it) -> No, uses VED
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */ // Assuming EntityManager is concrete
/** @typedef {import('../../data/gameDataRepository.js').GameDataRepository} GameDataRepository */ // Assuming concrete
/** @typedef {import('../../../interfaces/coreServices.js').IActionDiscoverySystem} IActionDiscoverySystem */
/** @typedef {import('../../../interfaces/coreServices.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../../../interfaces/coreServices.js').ITurnManager} ITurnManager */
/** @typedef {import('../../turns/interfaces/ITurnHandlerResolver.js').ITurnHandlerResolver} ITurnHandlerResolver */

/**
 * Registers runtime services like TurnManager and input setup.
 * NOTE: GameLoop registration has been removed from this file.
 *
 * @export
 * @param {AppContainer} container - The application's DI container.
 */
export function registerRuntime(container) {
  const r = new Registrar(container);
  /** @type {ILogger} */
  const log = container.resolve(tokens.ILogger); // Use explicit type
  log.info('Runtime Registration: Starting...'); // <<< Moved log up

  // ====================================================================
  // REMOVED: Register GameLoop as Singleton
  // The GameLoop instance is now expected to be created and managed
  // elsewhere, likely within the main application bootstrapping process
  // or initialization service, *after* the container is configured.
  // ====================================================================
  // r.singletonFactory(tokens.GameLoop, c => { ... }); // <<< ENTIRE BLOCK REMOVED
  // log.info(`Runtime Registration: Registered ${tokens.GameLoop} (Singleton).`); // <<< REMOVED

  r.singletonFactory(
    tokens.InputSetupService,
    (c) =>
      new InputSetupService({
        container: c,
        logger: c.resolve(tokens.ILogger),
        validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
        // REMOVED: GameLoop injection - InputSetupService no longer interacts directly with GameLoop.
        // gameLoop: c.resolve(tokens.GameLoop) // <<< LINE REMOVED
      })
  );
  log.info(
    `Runtime Registration: Registered ${tokens.InputSetupService} (Singleton).`
  );

  // Note: Other runtime services like TurnManager, TurnHandlerResolver etc.
  // are assumed to be registered elsewhere (e.g., serviceRegistrations.js or coreRegistrations.js)

  log.info('Runtime Registration: complete.');
}
