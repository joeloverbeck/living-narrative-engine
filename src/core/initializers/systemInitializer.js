// src/core/initializers/systemInitializer.js

/**
 * @fileoverview Defines the SystemInitializer class, responsible for
 * coordinating the initialization sequence of various core application systems.
 */

// Type imports for JSDoc
/** @typedef {import('../appContainer.js').default} AppContainer */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
// Explicit type import for systems that might have an initialize method
/** @typedef {import('../../systems/baseSystem.js').default} BaseSystem */
/** @typedef {import('../../systems/interfaces/ISystem.js').ISystem} ISystem */

/**
 * Service responsible for initializing essential systems of the application.
 * It uses the AppContainer to resolve necessary dependencies and orchestrates
 * the startup process for systems that require asynchronous initialization.
 */
class SystemInitializer {
    /** @type {AppContainer} */
    #container;
    /** @type {ILogger} */
    #logger;

    /**
     * List of system keys (registered in the AppContainer) that should be
     * checked for an `initialize` method and potentially initialized.
     * This list is based on the original logic in GameEngine.#initialize.
     * @private
     * @static
     * @readonly
     * @type {string[]}
     */
    static #systemsToInitialize = [
        'GameRuleSystem', 'EquipmentEffectSystem', 'EquipmentSlotSystem',
        'InventorySystem', 'CombatSystem', 'DeathSystem', 'HealthSystem', 'StatusEffectSystem',
        'LockSystem', 'OpenableSystem', 'WorldPresenceSystem', 'ItemUsageSystem',
        'NotificationUISystem', 'PerceptionSystem', 'BlockerSystem', 'MovementSystem',
        'MoveCoordinatorSystem', 'QuestSystem', 'QuestStartTriggerSystem',
        'ActionDiscoverySystem', 'WelcomeMessageService'
        // Add other system keys here if they need explicit async initialization
    ];

    /**
     * Creates an instance of SystemInitializer.
     *
     * @param {AppContainer} container - The application's dependency injection container. Used to resolve system instances.
     * @param {ILogger} logger - The logging service instance. Used for logging initialization progress and potential issues.
     * @throws {Error} If container or logger is not provided.
     */
    constructor(container, logger) {
        if (!container) {
            throw new Error("SystemInitializer requires an AppContainer instance.");
        }
        if (!logger) {
            // Attempt a console log as a last resort if logger is missing, but still throw.
            console.error("SystemInitializer requires an ILogger instance.");
            throw new Error("SystemInitializer requires an ILogger instance.");
        }

        this.#container = container;
        this.#logger = logger;

        this.#logger.debug("SystemInitializer instance created.");
    }

    /**
     * Iterates through a predefined list of core systems, resolves them using the
     * application container, and calls their `initialize` method if it exists.
     * This method handles errors during both system resolution and the execution
     * of the `initialize` method, logging them without halting the overall process.
     * It ensures that systems requiring asynchronous setup are properly initialized
     * before the main game loop or application logic proceeds.
     *
     * @async
     * @returns {Promise<void>} A promise that resolves when the initialization loop
     * for all specified systems has completed. Errors encountered for individual
     * systems are logged but do not cause the promise to reject, allowing
     * other systems to attempt initialization.
     */
    async initializeSystems() {
        this.#logger.info("SystemInitializer: Starting system initialization loop...");

        for (const key of SystemInitializer.#systemsToInitialize) {
            let system = null; // Declare system variable outside try block for wider scope if needed

            // --- 1. Resolve System ---
            this.#logger.debug(`SystemInitializer: Attempting to resolve system: ${key}...`);
            try {
                system = this.#container.resolve(key);
            } catch (resolveError) {
                this.#logger.error(`SystemInitializer: Failed to resolve system '${key}'. Skipping initialization. Error: ${resolveError.message}`, resolveError);
                continue; // Move to the next system key
            }

            // --- 2. Check for and Call initialize() ---
            if (system && typeof system.initialize === 'function') {
                this.#logger.info(`SystemInitializer: Initializing system: ${key}...`);
                try {
                    // Explicitly type hint for clarity, though check already performed
                    /** @type {ISystem & { initialize: () => Promise<void> }} */
                    const initializableSystem = system;
                    await initializableSystem.initialize();
                    this.#logger.info(`SystemInitializer: System ${key} initialized successfully.`);
                } catch (initError) {
                    this.#logger.error(`SystemInitializer: Error during initialization of system '${key}'. Continuing with others. Error: ${initError.message}`, initError);
                    // Continue loop implicitly happens here
                }
            } else {
                // Check if the system was resolved but just lacks the method
                if (system) {
                    this.#logger.debug(`SystemInitializer: Resolved system '${key}' has no initialize() method, skipping call.`);
                } else {
                    // This case should technically be caught by the resolution error handler above,
                    // but adding a log here for completeness in case resolve returns null/undefined without throwing.
                    this.#logger.debug(`SystemInitializer: System '${key}' could not be resolved or is null/undefined, skipping initialize call.`);
                }
            }
        } // End of loop

        this.#logger.info("SystemInitializer: System initialization loop completed.");
        // The promise resolves implicitly here when the async function completes.
    }
}

export default SystemInitializer;