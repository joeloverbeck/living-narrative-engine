// src/services/welcomeMessageService.js

/**
 * @fileoverview Defines the WelcomeMessageService.
 * This service listens for engine initialization and displays welcome messages.
 */

// --- Type Imports ---
/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('./validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../core/interfaces/coreServices.js').ILogger} ILogger */
// --- Required for Dependencies' Dependencies (for type checking/clarity) ---
/** @typedef {import('../core/interfaces/coreServices.js').IDataRegistry} IDataRegistry */ // GameDataRepo needs this
/** @typedef {import('../core/interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */ // ValidatedDispatcher needs this
/** @typedef {import('../core/eventBus.js').EventPayload} EventPayload */ // Import EventPayload type for handler

/**
 * @class WelcomeMessageService
 * Listens for the 'event:engine_initialized' event and dispatches appropriate
 * welcome messages (title, general message) using the ValidatedEventDispatcher,
 * retrieving the official world name from the GameDataRepository.
 */
class WelcomeMessageService {
    /** @private @type {EventBus} */
    #eventBus;
    /** @private @type {GameDataRepository} */
    #gameDataRepository;
    /** @private @type {ValidatedEventDispatcher} */
    #validatedDispatcher;
    /** @private @type {ILogger} */
    #logger;

    /**
     * Creates an instance of WelcomeMessageService.
     * @param {object} dependencies - The service dependencies.
     * @param {EventBus} dependencies.eventBus - Used to subscribe to engine events ('event:engine_initialized').
     * @param {GameDataRepository} dependencies.gameDataRepository - Used to get the official world name from the loaded manifest.
     * @param {ValidatedEventDispatcher} dependencies.validatedDispatcher - Used to dispatch UI events ('event:set_title', 'event:display_message').
     * @param {ILogger} dependencies.logger - Used for logging service activity.
     * @throws {Error} If any required dependency is missing or invalid.
     */
    constructor({ eventBus, gameDataRepository, validatedDispatcher, logger }) {
        // AC4 (Ticket 6.3): Dependency Validation Checks
        if (!eventBus || typeof eventBus.subscribe !== 'function') {
            console.error("WelcomeMessageService Constructor Error: Missing or invalid dependency 'eventBus'.");
            throw new Error("WelcomeMessageService: Missing or invalid dependency 'eventBus'.");
        }
        if (!gameDataRepository || typeof gameDataRepository.getWorldName !== 'function') {
            console.error("WelcomeMessageService Constructor Error: Missing or invalid dependency 'gameDataRepository'.");
            throw new Error("WelcomeMessageService: Missing or invalid dependency 'gameDataRepository'.");
        }
        if (!validatedDispatcher || typeof validatedDispatcher.dispatchValidated !== 'function') {
            console.error("WelcomeMessageService Constructor Error: Missing or invalid dependency 'validatedDispatcher'.");
            throw new Error("WelcomeMessageService: Missing or invalid dependency 'validatedDispatcher'.");
        }
        if (!logger || typeof logger.info !== 'function' || typeof logger.error !== 'function') {
            console.error("WelcomeMessageService Constructor Error: Missing or invalid dependency 'logger'.");
            throw new Error("WelcomeMessageService: Missing or invalid dependency 'logger'.");
        }

        // AC5 (Ticket 6.3): Store Dependencies as Private Members
        this.#eventBus = eventBus;
        this.#gameDataRepository = gameDataRepository;
        this.#validatedDispatcher = validatedDispatcher;
        this.#logger = logger;

        this.#logger.info("WelcomeMessageService: Instance created successfully.");
    }

    /**
     * Initializes the service by subscribing to relevant events.
     * This should be called after the service instance is created and dependencies are injected,
     * typically via a central initializer (like SystemInitializer).
     */
    init() {
        this.#logger.info("WelcomeMessageService: Initializing (subscribing to events)...");
        try {
            // AC1: Subscribe to 'event:engine_initialized' and bind the handler
            this.#eventBus.subscribe('event:engine_initialized', this.#handleEngineInitialized.bind(this));
            this.#logger.info("WelcomeMessageService: Successfully subscribed to 'event:engine_initialized' event.");
        } catch (error) {
            this.#logger.error("WelcomeMessageService: Failed to subscribe to 'event:engine_initialized' event during init.", error);
            // Depending on requirements, might want to re-throw or handle gracefully
            // For now, log the error and potentially allow the app to continue without this feature.
        }
    }

    // AC2: Create private handler method #handleEngineInitialized
    /**
     * Handles the 'event:engine_initialized' event.
     * Retrieves the world name and dispatches welcome messages.
     * @private
     * @async - Marked async because dispatchValidated is async.
     * @param {EventPayload} event - The full event object from EventBus.
     * @param {object} event.data - The event payload/data.
     * @param {string} event.data.inputWorldName - The name of the world used during initialization (fallback).
     */
    async #handleEngineInitialized(event) {
        this.#logger.info(`WelcomeMessageService: Received 'event:engine_initialized' event.`);

        // AC9: Add try...catch block for error handling
        try {
            // AC3: Retrieve inputWorldName from event payload and validate/log
            const inputWorldName = event?.data?.inputWorldName;
            if (!inputWorldName) {
                this.#logger.warn("WelcomeMessageService: 'event:engine_initialized' event received without 'inputWorldName' in payload. Using default.", event);
                // Cannot proceed reliably without any name, could default but better to log and maybe exit handler
                // For robustness, let's assign a placeholder and continue, logging the issue
                // determinedName below will handle this potential null/undefined state.
            } else {
                this.#logger.info(`WelcomeMessageService: Received inputWorldName: '${inputWorldName}'`);
            }

            // AC4: Retrieve official world name using GameDataRepository
            let officialName = null;
            try {
                officialName = this.#gameDataRepository.getWorldName();
                this.#logger.info(`WelcomeMessageService: Retrieved official world name from repository: '${officialName ?? 'Not Found/Empty'}'`);
            } catch (repoError) {
                this.#logger.error("WelcomeMessageService: Error retrieving world name from GameDataRepository.", repoError);
                // Continue, will fallback to inputWorldName
            }

            // AC5: Implement conditional logic to determine the name to use
            let determinedName = '';
            let isFallback = false;

            if (officialName && typeof officialName === 'string' && officialName.trim() !== '') {
                // Use official name if it's a non-empty string
                determinedName = officialName.trim();
                isFallback = false;
                this.#logger.info(`WelcomeMessageService: Using official world name: '${determinedName}'`);
            } else {
                // Use inputWorldName as fallback if official name is invalid/missing
                // Also handle the case where inputWorldName itself might be missing (from AC3 check)
                determinedName = inputWorldName || 'an Unnamed World'; // Provide a default if inputWorldName is also missing
                isFallback = true;
                // AC8: Add specific warning log for fallback case
                this.#logger.warn(`WelcomeMessageService: Official world name not available. Falling back to name: '${determinedName}'.`);
            }

            // AC6: Dispatch event:set_title using determinedName
            this.#logger.debug(`WelcomeMessageService: Dispatching event:set_title with text: '${determinedName}'`);
            await this.#validatedDispatcher.dispatchValidated('event:set_title', { text: determinedName });

            // AC7: Dispatch event:display_message with appropriate text and fallback indication
            const welcomeText = `Welcome to ${determinedName}!${isFallback ? ' (Name from input)' : ''}`;
            this.#logger.debug(`WelcomeMessageService: Dispatching event:display_message with text: '${welcomeText}'`);
            await this.#validatedDispatcher.dispatchValidated('event:display_message', {
                text: welcomeText,
                type: 'info' // As specified in AC7 example
            });

            // AC8: Add general success log
            this.#logger.info(`WelcomeMessageService: Successfully dispatched welcome messages for world: '${determinedName}'.`);

        } catch (error) {
            // AC9: Log errors using logger.error
            this.#logger.error(`WelcomeMessageService: Error occurred during handling of 'event:engine_initialized' event:`, error);
            // Do not re-throw; allow the rest of the application to proceed if possible.
        }
    }
}

export default WelcomeMessageService;
