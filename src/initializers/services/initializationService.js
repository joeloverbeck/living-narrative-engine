// src/core/initializers/services/initializationService.js

// --- Type Imports ---
/** @typedef {import('../../config/appContainer.js').default} AppContainer */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../events/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
// GameLoop import removed as it's no longer resolved or returned here
// /** @typedef {import('../../gameLoop.js').default} GameLoop */
/** @typedef {import('../../loaders/worldLoader.js').default} WorldLoader */
/** @typedef {import('../systemInitializer.js').default} SystemInitializer */
/** @typedef {import('../gameStateInitializer.js').default} GameStateInitializer */
/** @typedef {import('../worldInitializer.js').default} WorldInitializer */
/** @typedef {import('../../setup/inputSetupService.js').default} InputSetupService */

// --- Interface & Type Definitions (JSDoc) ---

/**
 * Represents the outcome of the game initialization sequence.
 * @typedef {object} InitializationResult
 * @property {boolean} success - Indicates whether the initialization sequence completed successfully.
 * // @property {GameLoop} [gameLoop] - ... <<< REMOVED
 * @property {Error} [error] - An error object containing details if initialization failed (success is false).
 */

/**
 * Conceptual interface for the Initialization Service.
 * Defines the contract for orchestrating the full game initialization process.
 * @interface IInitializationService
 */
/**
 * Runs the complete asynchronous sequence required to initialize the game for a specific world.
 * This includes loading data, setting up core systems, instantiating initial entities,
 * configuring input, and preparing the game loop.
 * @function
 * @name IInitializationService#runInitializationSequence
 * @param {string} worldName - The identifier of the world to initialize.
 * @returns {Promise<InitializationResult>} A promise resolving with the result of the initialization attempt.
 */

// --- Class Definition ---

import {tokens} from '../../config/tokens.js'; // <<< CORRECTED IMPORT PATH

/**
 * Service responsible for orchestrating the entire game initialization sequence.
 * It coordinates various sub-services and steps to load data, set up the game state,
 * and prepare the engine for starting the game loop. Handles error reporting via events.
 * NOTE: This service no longer resolves or returns the GameLoop instance.
 * @implements {IInitializationService} // Conceptually implements the defined interface
 */
class InitializationService {
    /** @private @type {AppContainer} */
    #container;
    /** @private @type {ILogger} */
    #logger;
    /** @private @type {ValidatedEventDispatcher} */
    #validatedEventDispatcher;

    /**
     * Creates a new InitializationService instance.
     * @param {object} dependencies - The required service dependencies.
     * @param {AppContainer} dependencies.container - The application's dependency container.
     * @param {ILogger} dependencies.logger - The logging service.
     * @param {ValidatedEventDispatcher} dependencies.validatedEventDispatcher - The validated event dispatcher.
     * @throws {Error} If any required dependency is missing or invalid.
     */
    constructor({container, logger, validatedEventDispatcher}) {
        // --- Dependency Validation ---
        if (!container) {
            const errorMsg = 'InitializationService: Missing required dependency \'container\'.';
            console.error(errorMsg);
            throw new Error(errorMsg);
        }
        if (!logger || typeof logger.info !== 'function' || typeof logger.error !== 'function' || typeof logger.debug !== 'function') {
            const errorMsg = 'InitializationService: Missing or invalid required dependency \'logger\'.';
            console.error(errorMsg);
            if (container) {
                try {
                    container.resolve('ILogger')?.error(errorMsg);
                } catch (e) { /* Ignore resolve error */
                }
            }
            throw new Error(errorMsg);
        }
        if (!validatedEventDispatcher || typeof validatedEventDispatcher.dispatchValidated !== 'function') {
            const errorMsg = 'InitializationService: Missing or invalid required dependency \'validatedEventDispatcher\'.';
            logger.error(errorMsg);
            throw new Error(errorMsg);
        }

        // --- Store Dependencies ---
        this.#container = container;
        this.#logger = logger;
        this.#validatedEventDispatcher = validatedEventDispatcher;

        this.#logger.info('InitializationService: Instance created successfully with dependencies.');
    }

    /**
     * Runs the complete asynchronous sequence required to initialize the game for a specific world.
     * This orchestrates loading, system initialization, state setup, entity creation, and input configuration.
     * It NO LONGER resolves the GameLoop instance. Catches errors, logs them, dispatches UI error events,
     * and returns a simple success/failure result object.
     * @param {string} worldName - The identifier of the world to initialize.
     * @returns {Promise<InitializationResult>} A promise resolving with the result of the initialization attempt.
     */
    async runInitializationSequence(worldName) {
        this.#logger.info(`InitializationService: Starting runInitializationSequence for world: ${worldName}.`);

        if (!worldName || typeof worldName !== 'string' || worldName.trim() === '') {
            const error = new Error('InitializationService requires a valid non-empty worldName.');
            this.#logger.error(error.message);
            return {success: false, error: error};
        }

        try {
            // --- 1. Load World Data ---
            this.#logger.debug('Resolving WorldLoader...');
            const worldLoader = /** @type {WorldLoader} */ (this.#container.resolve('WorldLoader'));
            this.#logger.info('WorldLoader resolved. Loading world data...');
            await worldLoader.loadWorld(worldName);
            this.#logger.info(`InitializationService: World data loaded successfully for world: ${worldName}.`);

            // --- 2. Initialize Tagged Systems ---
            this.#logger.debug('Resolving SystemInitializer...');
            const systemInitializer = /** @type {SystemInitializer} */ (this.#container.resolve('SystemInitializer'));
            this.#logger.info('SystemInitializer resolved. Initializing tagged systems...');
            await systemInitializer.initializeAll();
            this.#logger.info('InitializationService: Tagged system initialization complete.');

            // --- 4. Instantiate Initial World Entities & Build Spatial Index ---
            this.#logger.debug('Resolving WorldInitializer...');
            const worldInitializer = /** @type {WorldInitializer} */ (this.#container.resolve('WorldInitializer'));
            this.#logger.info('WorldInitializer resolved. Initializing world entities...');
            const worldInitSuccess = await worldInitializer.initializeWorldEntities();
            if (!worldInitSuccess) {
                // Note: WorldInitializer now throws on critical failure, so this check might be redundant
                // but kept for safety. It should be caught by the main try/catch block.
                throw new Error('World initialization failed via WorldInitializer.');
            }
            this.#logger.info('InitializationService: Initial world entities instantiated and spatial index built.');

            // --- 5. Configure Input Handler ---
            this.#logger.debug('Resolving InputSetupService...');
            const inputSetupService = /** @type {InputSetupService} */ (this.#container.resolve('InputSetupService'));
            this.#logger.info('InputSetupService resolved. Configuring input handler...');
            inputSetupService.configureInputHandler(); // This should now throw on critical error
            this.#logger.info('InitializationService: Input handler configured.');

            this.#logger.debug('Resolving DomUiFacade to instantiate UI components...');
            try {
                this.#container.resolve(tokens.DomUiFacade); // Resolve the facade using the CORRECT token
                this.#logger.info('InitializationService: DomUiFacade resolved, UI components instantiated.');
            } catch (uiResolveError) {
                // If resolving the UI fails, it's serious but maybe not fatal for headless operation?
                // Log it clearly but maybe don't throw, depending on requirements.
                this.#logger.error('InitializationService: Failed to resolve DomUiFacade. UI might not function correctly.', uiResolveError);
                // Optionally: throw uiResolveError; // if UI is absolutely essential
            }

            // --- Success ---
            this.#logger.info(`InitializationService: Initialization sequence for world '${worldName}' completed successfully (GameLoop resolution removed).`);

            // Return simplified success object, without gameLoop
            return {
                success: true
            }; // <<< MODIFIED RETURN

        } catch (error) {
            this.#logger.error(`InitializationService: CRITICAL ERROR during initialization sequence for world '${worldName}':`, error);

            // --- Ticket 16: Dispatch 'failed' event ---
            const failedPayload = {worldName, error: error?.message || 'Unknown error', stack: error?.stack};
            this.#validatedEventDispatcher.dispatchValidated('initialization:initialization_service:failed', failedPayload, {allowSchemaNotFound: true})
                .then(() => this.#logger.debug("Dispatched 'initialization:initialization_service:failed' event.", failedPayload))
                .catch(e => this.#logger.error("Failed to dispatch 'initialization:initialization_service:failed' event", e));
            // --- End Ticket 16 ---

            // Dispatch UI error events (existing logic)
            try {
                await this.#validatedEventDispatcher.dispatchValidated('ui:show_fatal_error', {
                    title: 'Fatal Initialization Error',
                    message: `Initialization failed for world '${worldName}'. Reason: ${error.message || 'Unknown error'}`,
                    details: error.stack // Provide stack trace for detailed view if UI supports it
                });
                await this.#validatedEventDispatcher.dispatchValidated('textUI:disable_input', {
                    message: 'Fatal error during initialization. Cannot continue.'
                });
                this.#logger.info('InitializationService: Dispatched ui:show_fatal_error and textUI:disable_input events.');
            } catch (dispatchError) {
                this.#logger.error(`InitializationService: Failed to dispatch UI error events after initialization failure:`, dispatchError);
            }

            return {
                success: false,
                error: error // Return the original error that caused the sequence to fail
            };
        }
    }
}

export default InitializationService;