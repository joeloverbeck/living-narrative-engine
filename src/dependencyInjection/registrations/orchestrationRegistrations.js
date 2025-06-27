// src/dependencyInjection/registrations/orchestrationRegistrations.js

/**
 * @file Registers high-level orchestration services like InitializationService and ShutdownService.
 */

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../appContainer.js').default} AppContainer */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../events/validatedEventDispatcher.js').default} ValidatedEventDispatcher */

// --- Service Imports ---
import InitializationService from '../../initializers/services/initializationService.js'; // Adjusted path
import ShutdownService from '../../shutdown/services/shutdownService.js'; // Adjusted path
import { ThoughtPersistenceListener } from '../../ai/thoughtPersistenceListener.js';
import { NotesPersistenceListener } from '../../ai/notesPersistenceListener.js';

// --- DI & Helper Imports ---
import { tokens } from '../tokens.js';
import { Registrar } from '../registrarHelpers.js'; // Adjusted path

/**
 * Registers the InitializationService and ShutdownService.
 *
 * @export
 * @param {AppContainer} container - The application's DI container.
 */
export function registerOrchestration(container) {
  const registrar = new Registrar(container);
  /** @type {ILogger} */
  const logger = container.resolve(tokens.ILogger); // Assumes ILogger is already registered
  logger.debug('Orchestration Registration: Starting...');

  // --- Initialization Service ---
  // Singleton lifecycle is appropriate as it manages a global process.
  registrar.singletonFactory(tokens.IInitializationService, (c) => {
    logger.debug(
      `Orchestration Registration: Factory creating ${tokens.IInitializationService}...`
    );
    const initLogger = c.resolve(tokens.ILogger);
    const initDispatcher = c.resolve(tokens.IValidatedEventDispatcher);
    const modsLoader = c.resolve(tokens.ModsLoader);
    const scopeRegistry = c.resolve(tokens.IScopeRegistry);
    const dataRegistry = c.resolve(tokens.IDataRegistry);
    const llmAdapter = c.resolve(tokens.LLMAdapter);
    const llmConfigLoader = c.resolve(tokens.LlmConfigLoader);
    const systemInitializer = c.resolve(tokens.SystemInitializer);
    const worldInitializer = c.resolve(tokens.WorldInitializer);
    const safeEventDispatcher = c.resolve(tokens.ISafeEventDispatcher);
    const entityManager = c.resolve(tokens.IEntityManager);
    const domUiFacade = c.resolve(tokens.DomUiFacade);
    const actionIndex = c.resolve(tokens.ActionIndex);
    const gameDataRepository = c.resolve(tokens.IGameDataRepository);

    if (!initLogger)
      throw new Error(
        `InitializationService Factory: Failed to resolve dependency: ${tokens.ILogger}`
      );
    if (!initDispatcher)
      throw new Error(
        `InitializationService Factory: Failed to resolve dependency: ${tokens.IValidatedEventDispatcher}`
      );
    if (!modsLoader)
      throw new Error(
        `InitializationService Factory: Failed to resolve dependency: ${tokens.ModsLoader}`
      );
    if (!systemInitializer)
      throw new Error(
        `InitializationService Factory: Failed to resolve dependency: ${tokens.SystemInitializer}`
      );
    if (!worldInitializer)
      throw new Error(
        `InitializationService Factory: Failed to resolve dependency: ${tokens.WorldInitializer}`
      );
    const thoughtListener = new ThoughtPersistenceListener({
      logger: initLogger,
      entityManager,
    });
    const notesListener = new NotesPersistenceListener({
      logger: initLogger,
      entityManager,
      dispatcher: safeEventDispatcher,
    });
    const spatialIndexManager = c.resolve(tokens.ISpatialIndexManager);
    return new InitializationService({
      log: { logger: initLogger },
      events: { validatedEventDispatcher: initDispatcher, safeEventDispatcher },
      llm: { llmAdapter, llmConfigLoader },
      persistence: {
        entityManager,
        domUiFacade,
        actionIndex,
        gameDataRepository,
        thoughtListener,
        notesListener,
        spatialIndexManager,
      },
      coreSystems: {
        modsLoader,
        scopeRegistry,
        dataRegistry,
        systemInitializer,
        worldInitializer,
      },
    });
  });
  logger.debug(
    `Orchestration Registration: Registered ${tokens.IInitializationService} (Singleton).`
  );

  // --- Shutdown Service ---
  // Singleton lifecycle is appropriate.
  registrar.singletonFactory(tokens.ShutdownService, (c) => {
    logger.debug(
      `Orchestration Registration: Factory creating ${tokens.ShutdownService}...`
    );
    // Ensure all dependencies are resolved using the CORRECT tokens
    const shutdownLogger = c.resolve(tokens.ILogger);
    const shutdownDispatcher = c.resolve(tokens.IValidatedEventDispatcher); // <<< CHECK THIS ONE TOO! It should also use 'I'
    const shutdownGameLoop = c.resolve(tokens.GameLoop);

    // Validate resolved dependencies
    if (!shutdownLogger)
      throw new Error(
        `ShutdownService Factory: Failed to resolve dependency: ${tokens.ILogger}`
      );
    if (!shutdownDispatcher)
      throw new Error(
        `ShutdownService Factory: Failed to resolve dependency: ${tokens.IValidatedEventDispatcher}`
      );
    if (!shutdownGameLoop)
      throw new Error(
        `ShutdownService Factory: Failed to resolve dependency: ${tokens.GameLoop}`
      );

    // Note: GameLoop might not be fully ready or even resolved when the container is configured,
    // but the service constructor validates it upon injection.
    // The service's `runShutdownSequence` method should handle cases where the loop isn't running.
    return new ShutdownService({
      container: c, // Pass the container itself
      logger: shutdownLogger,
      validatedEventDispatcher: shutdownDispatcher,
      gameLoop: shutdownGameLoop, // GameLoop is resolved here
    });
  });
  logger.debug(
    `Orchestration Registration: Registered ${tokens.ShutdownService} (Singleton).`
  );

  logger.debug('Orchestration Registration: Complete.');
}
