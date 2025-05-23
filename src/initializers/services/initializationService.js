// src/initializers/services/initializationService.js

// --- Type Imports ---
/** @typedef {import('../../config/appContainer.js').default} AppContainer */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../events/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../../loaders/worldLoader.js').default} WorldLoader */
/** @typedef {import('../systemInitializer.js').default} SystemInitializer */
/** @typedef {import('../worldInitializer.js').default} WorldInitializer */
/** @typedef {import('../../setup/inputSetupService.js').default} InputSetupService */

// --- Interface Imports for JSDoc & `extends` ---
/** @typedef {import('../../interfaces/IInitializationService.js').InitializationResult} InitializationResult */
import {IInitializationService} from '../../interfaces/IInitializationService.js';
import {tokens} from '../../config/tokens.js';

/**
 * Service responsible for orchestrating the entire game initialization sequence.
 * @implements {IInitializationService}
 */
class InitializationService extends IInitializationService {
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
     */
    constructor({container, logger, validatedEventDispatcher}) {
        super();

        if (!container) {
            const errorMsg = 'InitializationService: Missing required dependency \'container\'.';
            console.error(errorMsg);
            throw new Error(errorMsg);
        }
        if (!logger || typeof logger.info !== 'function' || typeof logger.error !== 'function' || typeof logger.debug !== 'function') {
            const errorMsg = 'InitializationService: Missing or invalid required dependency \'logger\'.';
            console.error(errorMsg);
            try {
                container.resolve(tokens.ILogger)?.error(errorMsg);
            } catch (e) { /* Ignore */
            }
            throw new Error(errorMsg);
        }
        this.#logger = logger;

        if (!validatedEventDispatcher || typeof validatedEventDispatcher.dispatchValidated !== 'function') {
            const errorMsg = 'InitializationService: Missing or invalid required dependency \'validatedEventDispatcher\'.';
            this.#logger.error(errorMsg);
            throw new Error(errorMsg);
        }

        this.#container = container;
        this.#validatedEventDispatcher = validatedEventDispatcher;

        this.#logger.info('InitializationService: Instance created successfully with dependencies.');
    }

    /**
     * Runs the complete asynchronous sequence required to initialize the game for a specific world.
     * @async
     * @param {string} worldName - The identifier of the world to initialize.
     * @returns {Promise<InitializationResult>} The result of the initialization attempt.
     */
    async runInitializationSequence(worldName) {
        this.#logger.info(`InitializationService: Starting runInitializationSequence for world: ${worldName}.`);

        if (!worldName || typeof worldName !== 'string' || worldName.trim() === '') {
            const error = new TypeError('InitializationService requires a valid non-empty worldName.');
            this.#logger.error('InitializationService requires a valid non-empty worldName.');
            return {success: false, error: error};
        }

        try {
            this.#logger.debug('Resolving WorldLoader...');
            const worldLoader = /** @type {WorldLoader} */ (this.#container.resolve(tokens.WorldLoader));
            this.#logger.info('WorldLoader resolved. Loading world data...');
            await worldLoader.loadWorld(worldName);
            this.#logger.info(`InitializationService: World data loaded successfully for world: ${worldName}.`);

            this.#logger.debug('Resolving SystemInitializer...');
            const systemInitializer = /** @type {SystemInitializer} */ (this.#container.resolve(tokens.SystemInitializer));
            this.#logger.info('SystemInitializer resolved. Initializing tagged systems...');
            await systemInitializer.initializeAll();
            this.#logger.info('InitializationService: Tagged system initialization complete.');

            this.#logger.debug('Resolving WorldInitializer...');
            const worldInitializer = /** @type {WorldInitializer} */ (this.#container.resolve(tokens.WorldInitializer));
            this.#logger.info('WorldInitializer resolved. Initializing world entities...');
            const worldInitSuccess = await worldInitializer.initializeWorldEntities();
            if (!worldInitSuccess) {
                throw new Error('World initialization failed via WorldInitializer.');
            }
            this.#logger.info('InitializationService: Initial world entities instantiated and spatial index built.');

            this.#logger.debug('Resolving InputSetupService...');
            const inputSetupService = /** @type {InputSetupService} */ (this.#container.resolve(tokens.InputSetupService));
            this.#logger.info('InputSetupService resolved. Configuring input handler...');
            inputSetupService.configureInputHandler();
            this.#logger.info('InitializationService: Input handler configured.');

            this.#logger.debug('Resolving DomUiFacade to ensure UI components can be instantiated...');
            try {
                this.#container.resolve(tokens.DomUiFacade);
                // CORRECTED Log message to match test expectation
                this.#logger.info('InitializationService: DomUiFacade resolved, UI components instantiated.');
            } catch (uiResolveError) {
                this.#logger.warn('InitializationService: Failed to resolve DomUiFacade. UI might not function correctly if it was expected.', uiResolveError);
            }

            this.#logger.info(`InitializationService: Initialization sequence for world '${worldName}' completed successfully (GameLoop resolution removed).`);

            return {
                success: true,
                details: {message: `World '${worldName}' initialized.`}
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.#logger.error(`InitializationService: CRITICAL ERROR during initialization sequence for world '${worldName}': ${errorMessage}`, error);

            const failedPayload = {
                worldName,
                error: errorMessage,
                stack: error instanceof Error ? error.stack : undefined
            };
            this.#validatedEventDispatcher.dispatchValidated('initialization:initialization_service:failed', failedPayload, {allowSchemaNotFound: true})
                .then(() => this.#logger.debug("Dispatched 'initialization:initialization_service:failed' event.", failedPayload))
                .catch(e => this.#logger.error("Failed to dispatch 'initialization:initialization_service:failed' event", e));

            try {
                await this.#validatedEventDispatcher.dispatchValidated('ui:show_fatal_error', {
                    title: 'Fatal Initialization Error',
                    message: `Initialization failed for world '${worldName}'. Reason: ${errorMessage}`,
                    details: error instanceof Error ? error.stack : 'No stack available.'
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
                error: error instanceof Error ? error : new Error(errorMessage),
                details: {worldName}
            };
        }
    }
}

export default InitializationService;