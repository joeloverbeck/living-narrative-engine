// src/shutdown/services/shutdownService.js

// --- Type Imports ---
/** @typedef {import('../../dependencyInjection/appContainer.js').default} AppContainer */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../events/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
// REMOVED: GameLoop import no longer needed
// /** @typedef {import('../../gameLoop.js').default} GameLoop */
/** @typedef {import('../../turns/interfaces/ITurnManager.js').ITurnManager} ITurnManager */ // <<< ADDED

// --- Interface Definition (JSDoc) ---
/**
 * Conceptual interface for the Shutdown Service.
 * Defines the contract for orchestrating the orderly shutdown of the game engine.
 *
 * @interface IShutdownService
 */
/**
 * Runs the complete asynchronous sequence required to shut down the game engine.
 * This typically includes stopping turn processing via TurnManager, cleaning up resources,
 * calling shutdown methods on relevant systems, and potentially disposing container singletons.
 *
 * @function
 * @name IShutdownService#runShutdownSequence
 * @returns {Promise<void>} A promise that resolves when the shutdown sequence is complete.
 */

// --- Class Definition ---

import { SHUTDOWNABLE } from '../../dependencyInjection/tags.js';
import { tokens } from '../../dependencyInjection/tokens.js'; // <<< ADDED for resolving TurnManager
import EventDispatchService from '../../events/eventDispatchService.js';

/**
 * Service responsible for orchestrating the orderly shutdown of the game engine and its components.
 * It coordinates stopping turn processing, cleaning up systems, and releasing resources.
 *
 * @implements {IShutdownService} // Conceptually implements the defined interface
 */
class ShutdownService {
  #container;
  #logger;
  #validatedEventDispatcher;
  /** @type {EventDispatchService} */
  #eventDispatchService;
  // REMOVED: GameLoop dependency
  // /** @private @type {GameLoop | null} */
  // #gameLoop = null;

  /**
   * Creates a new ShutdownService instance.
   *
   * @param {object} dependencies - The required service dependencies.
   * @param {AppContainer} dependencies.container - The application's dependency container.
   * @param {ILogger} dependencies.logger - The logging service.
   * @param {ValidatedEventDispatcher} dependencies.validatedEventDispatcher - The validated event dispatcher.
   * @param {EventDispatchService} [dependencies.eventDispatchService] - Optional event dispatch service.
   * @throws {Error} If any required dependency (container, logger, validatedEventDispatcher) is missing or invalid.
   */
  constructor({
    container,
    logger,
    validatedEventDispatcher,
    eventDispatchService,
  }) {
    // --- Dependency Validation ---
    if (!container) {
      const errorMsg =
        "ShutdownService: Missing required dependency 'container'.";
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    if (
      !logger ||
      typeof logger.error !== 'function' ||
      typeof logger.debug !== 'function' ||
      typeof logger.warn !== 'function'
    ) {
      const errorMsg =
        "ShutdownService: Missing or invalid required dependency 'logger'.";
      console.error(errorMsg);
      if (container) {
        try {
          container.resolve('ILogger')?.error(errorMsg);
        } catch (e) {
          /* Ignore */
        }
      }
      throw new Error(errorMsg);
    }

    // FIX: Check for the correct 'dispatch' method name
    if (
      !validatedEventDispatcher ||
      typeof validatedEventDispatcher.dispatch !== 'function'
    ) {
      const errorMsg =
        "ShutdownService: Missing or invalid required dependency 'validatedEventDispatcher'.";
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    // --- Store Dependencies ---
    this.#container = container;
    this.#logger = logger;
    this.#validatedEventDispatcher = validatedEventDispatcher;
    this.#eventDispatchService =
      eventDispatchService ?? new EventDispatchService();

    this.#logger.debug(
      'ShutdownService: Instance created successfully with dependencies.'
    );
  }

  /**
   * Runs the core part of the shutdown sequence: stopping turn processing via TurnManager,
   * shutting down tagged systems, disposing singletons, and logging. Dispatches shutdown events.
   *
   * @returns {Promise<void>} A promise that resolves when this part of the sequence is complete.
   */
  async runShutdownSequence() {
    this.#logger.debug(
      'ShutdownService: runShutdownSequence called. Starting shutdown sequence...'
    );

    const startPayload = {};
    await this.#dispatchWithLogging(
      'shutdown:shutdown_service:started',
      startPayload
    );

    try {
      await this.#validatedEventDispatcher.dispatch(
        'ui:show_message',
        {
          text: 'System shutting down...',
          type: 'info',
        },
        { allowSchemaNotFound: true }
      );
      this.#logger.debug("Dispatched 'ui:show_message' event.");
    } catch (eventError) {
      this.#logger.error(
        'ShutdownService: Failed to dispatch shutdown start UI event.',
        eventError
      );
    }

    let turnManager = null; // Define here for access in catch/finally
    try {
      // 1. Stop Turn Processing via TurnManager (Ticket 2.2 Task 4)
      this.#logger.debug(
        'ShutdownService: Resolving and stopping TurnManager...'
      );
      try {
        turnManager = /** @type {ITurnManager} */ (
          this.#container.resolve(tokens.ITurnManager)
        );
        await turnManager.stop();
        this.#logger.debug(
          'ShutdownService: TurnManager stop() method called successfully.'
        );
      } catch (tmError) {
        // Log error but continue shutdown
        this.#logger.error(
          'ShutdownService: Error resolving or stopping TurnManager. Continuing shutdown...',
          tmError
        );
        // Optionally dispatch a specific failure event for TurnManager stop
      }

      // 2. Shutdown Tagged Systems
      this.#logger.debug(
        'ShutdownService: Attempting to shut down systems tagged as SHUTDOWNABLE...'
      );
      let shutdownableSystems = [];
      let resolveErrorOccurred = false;
      try {
        shutdownableSystems = this.#container.resolveByTag(SHUTDOWNABLE[0]);
        this.#logger.debug(
          `ShutdownService: Found ${shutdownableSystems.length} systems tagged as SHUTDOWNABLE.`
        );
      } catch (resolveError) {
        resolveErrorOccurred = true;
        this.#logger.error(
          'ShutdownService: CRITICAL ERROR resolving SHUTDOWNABLE systems. Cannot proceed with tagged system shutdown.',
          resolveError
        );
      }

      if (!resolveErrorOccurred) {
        for (const system of shutdownableSystems) {
          const systemName = system?.constructor?.name ?? 'UnknownSystem';
          if (system && typeof system.shutdown === 'function') {
            this.#logger.debug(
              `ShutdownService: Attempting to call shutdown() on system: ${systemName}...`
            );
            try {
              // Assume sync for now
              system.shutdown();
              this.#logger.debug(
                `ShutdownService: Successfully called shutdown() on system: ${systemName}.`
              );
            } catch (shutdownError) {
              this.#logger.error(
                `ShutdownService: Error during shutdown() call for system: ${systemName}. Continuing...`,
                shutdownError
              );
            }
          } else {
            this.#logger.warn(
              `ShutdownService: System tagged SHUTDOWNABLE (${systemName}) does not have a valid shutdown() method.`
            );
          }
        }
        this.#logger.debug(
          'ShutdownService: Finished processing SHUTDOWNABLE systems.'
        );
      }

      // 3. Dispose Container Singletons
      this.#logger.debug(
        'ShutdownService: Checking container for singleton disposal...'
      );
      if (
        this.#container &&
        typeof this.#container.disposeSingletons === 'function'
      ) {
        this.#logger.debug(
          'ShutdownService: Attempting to dispose container singletons...'
        );
        try {
          this.#container.disposeSingletons();
          this.#logger.debug(
            'ShutdownService: Container singletons disposed successfully.'
          );
        } catch (disposeError) {
          this.#logger.error(
            'ShutdownService: Error occurred during container.disposeSingletons().',
            disposeError
          );
        }
      } else {
        this.#logger.warn(
          'ShutdownService: Container does not have a disposeSingletons method or container is unavailable. Skipping singleton disposal.'
        );
      }

      // --- Final Success ---
      this.#logger.debug('ShutdownService: Shutdown sequence finished.');
      const completedPayload = {};
      await this.#dispatchWithLogging(
        'shutdown:shutdown_service:completed',
        completedPayload
      );
    } catch (error) {
      // Catch critical errors *before* singleton disposal (though TurnManager stop is now handled gracefully)
      this.#logger.error(
        'ShutdownService: CRITICAL ERROR during main shutdown sequence (excluding singleton disposal):',
        error
      );
      const failedPayload = {
        error: error?.message || 'Unknown error',
        stack: error?.stack,
      };
      await this.#dispatchWithLogging(
        'shutdown:shutdown_service:failed',
        failedPayload
      );
      // Optionally re-throw if needed, but usually shutdown should continue
    }
  }

  /**
   * Helper for dispatching shutdown related events with consistent logging.
   *
   * @param {string} eventId - The event identifier.
   * @param {object} payload - The payload to dispatch with the event.
   * @returns {Promise<void>} Resolves when dispatch attempt completes.
   * @private
   */
  async #dispatchWithLogging(eventId, payload) {
    await this.#eventDispatchService.dispatch(
      this.#validatedEventDispatcher,
      eventId,
      payload,
      {
        logger: this.#logger,
        eventOptions: { allowSchemaNotFound: true },
        context: '',
      }
    );
  }
}

export default ShutdownService;
