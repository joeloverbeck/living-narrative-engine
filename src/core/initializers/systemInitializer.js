// src/core/initializers/systemInitializer.js

/**
 * @fileoverview Defines the SystemInitializer class, responsible for
 * coordinating the initialization sequence of various core application systems
 * discovered via container tags.
 */

// Type imports for JSDoc
/** @typedef {import('../appContainer.js').default} AppContainer */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../systems/interfaces/ISystem.js').ISystem} ISystem */ // Keep ISystem for type safety

/**
 * Service responsible for initializing essential systems of the application.
 * It uses the AppContainer to resolve systems tagged as 'initializableSystem'
 * and orchestrates their startup process.
 */
class SystemInitializer {
    /** @type {AppContainer} */
    #container;
    /** @type {ILogger} */
    #logger;
    /** @type {string} */
    #initializationTag = 'initializableSystem'; // Store tag name

    /**
     * Creates an instance of SystemInitializer.
     *
     * @param {AppContainer} container - The application's dependency injection container. Used to resolve system instances by tag.
     * @param {ILogger} logger - The logging service instance. Used for logging initialization progress and potential issues.
     * @throws {Error} If container or logger is not provided.
     */
    constructor(container, logger) {
        if (!container) {
            throw new Error("SystemInitializer requires an AppContainer instance.");
        }
        // AC3a: Check if the container has the required resolveByTag method (defensive check)
        if (typeof container.resolveByTag !== 'function') {
            // Log and throw if the container doesn't support the needed feature
            const errorMsg = "SystemInitializer requires an AppContainer instance that supports 'resolveByTag'.";
            if (logger) {
                logger.error(errorMsg);
            } else {
                console.error(errorMsg);
            }
            throw new Error(errorMsg);
        }
        if (!logger) {
            console.error("SystemInitializer requires an ILogger instance.");
            throw new Error("SystemInitializer requires an ILogger instance.");
        }

        this.#container = container;
        this.#logger = logger;

        this.#logger.debug("SystemInitializer instance created.");
    }

    /**
     * Queries the AppContainer for services tagged as 'initializableSystem',
     * iterates through the resolved services, and calls their `initialize`
     * method if it exists.
     *
     * This method handles errors during the execution of the `initialize` method,
     * logging them without halting the overall process. It ensures that systems
     * requiring asynchronous setup are properly initialized before the main
     * game loop or application logic proceeds.
     *
     * @async
     * @returns {Promise<void>} A promise that resolves when the initialization loop
     * for all tagged systems has completed. Errors encountered for individual
     * systems are logged but do not cause the promise to reject, allowing
     * other systems to attempt initialization.
     * @fulfills {void} Successfully completed initialization loop for tagged systems.
     * @rejects {Error} If the container's `resolveByTag` method itself throws an error.
     */
    async initializeAll() { // Renamed from initializeSystems
        this.#logger.info(`SystemInitializer: Starting initialization for systems tagged with '${this.#initializationTag}'...`);

        let resolvedSystems = [];
        try {
            // AC3b: Query the AppContainer for all services registered with the initializableSystem tag.
            this.#logger.debug(`SystemInitializer: Querying container for tag '${this.#initializationTag}'...`);
            // CORRECT: Added 'await' here
            resolvedSystems = await this.#container.resolveByTag(this.#initializationTag);
            // Ensure resolvedSystems is actually iterable (e.g., an array) even if resolveByTag could potentially return something else on success
            if (!Array.isArray(resolvedSystems)) {
                // Handle cases where resolveByTag might succeed but not return an array as expected
                this.#logger.warn(`SystemInitializer: resolveByTag for tag '${this.#initializationTag}' did not return an array. Received: ${typeof resolvedSystems}. Treating as empty.`);
                resolvedSystems = []; // Default to empty array to prevent iteration errors
            }
            this.#logger.info(`SystemInitializer: Found ${resolvedSystems.length} systems tagged with '${this.#initializationTag}'.`);

        } catch (resolveTagError) {
            // This block will now correctly catch the rejection from 'await'
            this.#logger.error(`SystemInitializer: Failed to resolve systems by tag '${this.#initializationTag}'. Initialization cannot proceed. Error: ${resolveTagError.message}`, resolveTagError);
            // Re-throw critical error if tag resolution fails, as it prevents expected initialization
            throw new Error(`Failed to resolve initializable systems: ${resolveTagError.message}`);
        }

        // AC3c: Iterate through the resolved tagged services and call their initialize() method if it exists.
        // This loop will now only run if resolveByTag succeeded and returned an array.
        for (const system of resolvedSystems) {
            const systemName = system?.constructor?.name ?? 'UnnamedSystem'; // Get name for logging

            // Check if the resolved item is valid and has an initialize method
            if (system && typeof system.initialize === 'function') {
                this.#logger.info(`SystemInitializer: Initializing system: ${systemName}...`);
                try {
                    // Type hint for clarity
                    /** @type {ISystem & { initialize: () => Promise<void> }} */
                    const initializableSystem = system;
                    await initializableSystem.initialize(); // Keep awaiting individual initializations
                    this.#logger.info(`SystemInitializer: System ${systemName} initialized successfully.`);
                } catch (initError) {
                    this.#logger.error(`SystemInitializer: Error during initialization of system '${systemName}'. Continuing with others. Error: ${initError.message}`, initError);
                    // Continue loop implicitly
                }
            } else {
                // Log if a resolved system lacks the initialize method
                if (system) {
                    this.#logger.debug(`SystemInitializer: Resolved system '${systemName}' has no initialize() method or is not a function, skipping call.`);
                } else {
                    // This case should be less likely if resolveByTag filters null/undefined, but good to have
                    this.#logger.warn(`SystemInitializer: Encountered a null or undefined entry in resolved systems for tag '${this.#initializationTag}', skipping.`);
                }
            }
        } // End of loop

        this.#logger.info(`SystemInitializer: Initialization loop for tagged systems completed.`);
        // Promise resolves implicitly
    }
}

export default SystemInitializer;