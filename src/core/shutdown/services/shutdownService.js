// src/core/shutdown/services/shutdownService.js

// --- Type Imports ---
/** @typedef {import('../../config/appContainer.js').default} AppContainer */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */ // Corrected path from original
/** @typedef {import('../../gameLoop.js').default} GameLoop */

// --- Interface Definition (JSDoc) ---

/**
 * Conceptual interface for the Shutdown Service.
 * Defines the contract for orchestrating the orderly shutdown of the game engine.
 * @interface IShutdownService
 */
/**
 * Runs the complete asynchronous sequence required to shut down the game engine.
 * This typically includes stopping the game loop, cleaning up resources,
 * calling shutdown methods on relevant systems, and potentially disposing container singletons.
 * @function
 * @name IShutdownService#runShutdownSequence
 * @returns {Promise<void>} A promise that resolves when the shutdown sequence is complete. It should generally not reject unless a critical, unrecoverable error occurs during shutdown.
 */

// --- Class Definition ---

import {SHUTDOWNABLE} from "../../config/tags.js";

/**
 * Service responsible for orchestrating the orderly shutdown of the game engine and its components.
 * It coordinates stopping the game loop, cleaning up systems, and releasing resources.
 * @implements {IShutdownService} // Conceptually implements the defined interface
 */
class ShutdownService {
    /** @private @type {AppContainer} */
    #container;
    /** @private @type {ILogger} */
    #logger;
    /** @private @type {ValidatedEventDispatcher} */
    #validatedEventDispatcher;
    /** @private @type {GameLoop | null} */
    #gameLoop = null;

    /**
     * Creates a new ShutdownService instance.
     * @param {object} dependencies - The required service dependencies.
     * @param {AppContainer} dependencies.container - The application's dependency container.
     * @param {ILogger} dependencies.logger - The logging service.
     * @param {ValidatedEventDispatcher} dependencies.validatedEventDispatcher - The validated event dispatcher.
     * @param {GameLoop} dependencies.gameLoop - The main game loop instance. IMPORTANT: This might not be running or even fully initialized when the service is created, handle potentially null/stopped state in runSequence.
     * @throws {Error} If any required dependency (container, logger, validatedEventDispatcher, gameLoop instance itself) is missing or invalid.
     */
    constructor({ container, logger, validatedEventDispatcher, gameLoop }) {
        // --- Dependency Validation ---
        if (!container) {
            const errorMsg = 'ShutdownService: Missing required dependency \'container\'.';
            console.error(errorMsg); // Fallback log
            throw new Error(errorMsg);
        }
        if (!logger || typeof logger.info !== 'function' || typeof logger.error !== 'function' || typeof logger.debug !== 'function' || typeof logger.warn !== 'function') {
            const errorMsg = 'ShutdownService: Missing or invalid required dependency \'logger\'.';
            console.error(errorMsg); // Fallback log
            if (container) { // Attempt to use logger from container if available
                try { container.resolve('ILogger')?.error(errorMsg); } catch (e) { /* Ignore */ }
            }
            throw new Error(errorMsg);
        }
        if (!validatedEventDispatcher || typeof validatedEventDispatcher.dispatchValidated !== 'function') {
            const errorMsg = 'ShutdownService: Missing or invalid required dependency \'validatedEventDispatcher\'.';
            logger.error(errorMsg);
            throw new Error(errorMsg);
        }
        // Check for gameLoop object and necessary properties/methods
        if (!gameLoop || typeof gameLoop !== 'object' || typeof gameLoop.isRunning !== 'boolean' || typeof gameLoop.stop !== 'function') {
            const errorMsg = 'ShutdownService: Missing or invalid required dependency \'gameLoop\'. Expected a GameLoop instance with isRunning and stop().';
            // Use logger if available, otherwise console.error
            if (logger && logger.error) {
                logger.error(errorMsg);
            } else {
                console.error(errorMsg);
            }
            throw new Error(errorMsg);
        }


        // --- Store Dependencies ---
        this.#container = container;
        this.#logger = logger;
        this.#validatedEventDispatcher = validatedEventDispatcher;
        this.#gameLoop = gameLoop; // Store the provided GameLoop instance

        this.#logger.info('ShutdownService: Instance created successfully with dependencies.');
    }

    /**
     * Runs the core part of the shutdown sequence: stopping the game loop,
     * shutting down tagged systems, and basic logging. Dispatches shutdown events.
     * @returns {Promise<void>} A promise that resolves when this part of the sequence is complete.
     */
    async runShutdownSequence() {
        this.#logger.info('ShutdownService: runShutdownSequence called. Starting shutdown sequence...');

        // Dispatch 'started' event (using await/try-catch)
        const startPayload = {}; // Context might be added later if needed
        try {
            await this.#validatedEventDispatcher.dispatchValidated('shutdown:shutdown_service:started', startPayload, { allowSchemaNotFound: true });
            this.#logger.debug("Dispatched 'shutdown:shutdown_service:started' event.");
        } catch (e) {
            this.#logger.error("Failed to dispatch 'shutdown:shutdown_service:started' event", e);
        }


        // Dispatch UI message (using await/try-catch)
        try {
            await this.#validatedEventDispatcher.dispatchValidated('ui:show_message', {
                text: 'System shutting down...',
                type: 'info'
            }, { allowSchemaNotFound: true });
            this.#logger.debug('ShutdownService: Dispatched ui:show_message event.');
        } catch (eventError) {
            this.#logger.error('ShutdownService: Failed to dispatch shutdown start UI event.', eventError);
        }

        try {
            // 1. Stop the Game Loop
            if (this.#gameLoop.isRunning) {
                this.#logger.info('ShutdownService: Stopping GameLoop...');
                // The actual stop() might throw, which is caught by the outer try-catch
                this.#gameLoop.stop();
                this.#logger.info('ShutdownService: GameLoop stop() method called.');
            } else {
                this.#logger.info('ShutdownService: GameLoop instance found but already stopped or not running.');
            }

            // 2. Shutdown Tagged Systems
            this.#logger.info("ShutdownService: Attempting to shut down systems tagged as SHUTDOWNABLE...");
            let shutdownableSystems = [];
            let resolveErrorOccurred = false;
            try {
                // Use the correct tag imported
                shutdownableSystems = this.#container.resolveByTag(SHUTDOWNABLE[0]); // Assuming SHUTDOWNABLE is ['shutdownable']
                this.#logger.info(`ShutdownService: Found ${shutdownableSystems.length} systems tagged as SHUTDOWNABLE.`);
            } catch (resolveError) {
                resolveErrorOccurred = true;
                this.#logger.error("ShutdownService: CRITICAL ERROR resolving SHUTDOWNABLE systems. Cannot proceed with tagged system shutdown.", resolveError);
                // Don't re-throw here, allow singleton disposal etc.
            }

            if (!resolveErrorOccurred) {
                for (const system of shutdownableSystems) {
                    const systemName = system?.constructor?.name ?? 'UnknownSystem';
                    if (system && typeof system.shutdown === 'function') {
                        this.#logger.debug(`ShutdownService: Attempting to call shutdown() on system: ${systemName}...`);
                        try {
                            // Assuming system.shutdown() is synchronous. If it CAN be async, add await.
                            // For now, assume sync based on tests.
                            system.shutdown();
                            this.#logger.info(`ShutdownService: Successfully called shutdown() on system: ${systemName}.`);
                        } catch (shutdownError) {
                            this.#logger.error(`ShutdownService: Error during shutdown() call for system: ${systemName}. Continuing...`, shutdownError);
                            // Continue with the next system
                        }
                    } else {
                        this.#logger.warn(`ShutdownService: System tagged SHUTDOWNABLE (${systemName}) does not have a valid shutdown() method.`);
                    }
                }
                this.#logger.info("ShutdownService: Finished processing SHUTDOWNABLE systems.");
            }

            // 3. Dispose Container Singletons
            this.#logger.info('ShutdownService: Checking container for singleton disposal...');
            if (this.#container && typeof this.#container.disposeSingletons === 'function') {
                this.#logger.info('ShutdownService: Attempting to dispose container singletons...');
                try {
                    this.#container.disposeSingletons();
                    this.#logger.info('ShutdownService: Container singletons disposed successfully.');
                } catch (disposeError) {
                    this.#logger.error('ShutdownService: Error occurred during container.disposeSingletons().', disposeError);
                    // Don't re-throw, shutdown should proceed as much as possible
                }
            } else {
                this.#logger.warn('ShutdownService: Container does not have a disposeSingletons method or container is unavailable. Skipping singleton disposal.');
            }

            // --- Final Success ---
            this.#logger.info('ShutdownService: Shutdown sequence finished.');

            // Dispatch 'completed' event (using await/try-catch)
            const completedPayload = {}; // Context might be added later if needed
            try {
                await this.#validatedEventDispatcher.dispatchValidated('shutdown:shutdown_service:completed', completedPayload, { allowSchemaNotFound: true });
                this.#logger.debug("Dispatched 'shutdown:shutdown_service:completed' event.");
            } catch(e) {
                this.#logger.error("Failed to dispatch 'shutdown:shutdown_service:completed' event", e);
            }

        } catch (error) { // Catch critical errors from gameLoop.stop() or potentially others *before* singleton disposal
            this.#logger.error('ShutdownService: CRITICAL ERROR during main shutdown sequence:', error);

            // Dispatch 'failed' event (using await/try-catch within the catch block)
            const failedPayload = { error: error?.message || 'Unknown error', stack: error?.stack };
            try {
                await this.#validatedEventDispatcher.dispatchValidated('shutdown:shutdown_service:failed', failedPayload, { allowSchemaNotFound: true });
                this.#logger.debug("Dispatched 'shutdown:shutdown_service:failed' event.", failedPayload);
            } catch (e) {
                // Log the error that occurred trying to dispatch the failure event
                this.#logger.error("Failed to dispatch 'shutdown:shutdown_service:failed' event", e);
            }

            // Decide if the error should be re-thrown or just logged.
            // Generally, shutdown should try to complete as much as possible.
            // Re-throwing here would prevent any potential cleanup outside this service.
            // throw error; // Optionally re-throw if the error is absolutely fatal and needs upstream handling
        }
    }
}

export default ShutdownService;