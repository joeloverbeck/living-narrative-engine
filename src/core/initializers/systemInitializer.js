// src/core/initializers/systemInitializer.js

/**
 * @fileoverview Defines the SystemInitializer class, responsible for
 * coordinating the initialization sequence of various core application systems
 * discovered via a configurable container tag.
 */

// Type imports for JSDoc
/** @typedef {import('../interfaces/container.js').IServiceResolver} IServiceResolver */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
// REMOVED: import {INITIALIZABLE} from "../tags.js";

/**
 * Service responsible for initializing essential systems of the application.
 * It uses an IServiceResolver to find systems marked with a specific
 * initialization tag and orchestrates their startup process.
 * This approach decouples the initializer from specific container implementations
 * and allows the initialization criteria (the tag) to be configured externally.
 */
class SystemInitializer {
    /** @type {IServiceResolver} */
    #resolver;
    /** @type {ILogger} */
    #logger;
    /** @type {string} */
    #initializationTag;

    /**
     * Creates an instance of SystemInitializer.
     *
     * @param {IServiceResolver} resolver - The service resolver (e.g., DI container) used to find initializable systems by tag. Must implement the `resolveByTag` method.
     * @param {ILogger} logger - The logging service instance. Used for logging initialization progress and potential issues.
     * @param {string} initializationTag - The tag used to identify systems that need initialization (e.g., 'initializableSystem'). Must be a non-empty string.
     * @throws {Error} If resolver, logger, or initializationTag is invalid or missing.
     */
    constructor(resolver, logger, initializationTag) {
        if (!resolver) {
            const errorMsg = 'SystemInitializer requires an IServiceResolver instance.';
            if (logger) logger.error(errorMsg); else console.error(errorMsg);
            throw new Error(errorMsg);
        }
        // Check specifically for the function, not just if the property exists
        if (typeof resolver.resolveByTag !== 'function') {
            const errorMsg = "SystemInitializer requires an IServiceResolver instance that supports 'resolveByTag'.";
            if (logger) logger.error(errorMsg); else console.error(errorMsg);
            throw new Error(errorMsg);
        }
        if (!logger) {
            // Log to console only if logger is truly missing, avoid double logging if resolver is also missing
            if (resolver && typeof resolver.resolveByTag === 'function') {
                console.error('SystemInitializer requires an ILogger instance.');
            }
            throw new Error('SystemInitializer requires an ILogger instance.');
        }
        if (!initializationTag || typeof initializationTag !== 'string' || initializationTag.trim() === '') {
            const errorMsg = 'SystemInitializer requires a non-empty string initializationTag.';
            logger.error(errorMsg);
            throw new Error(errorMsg);
        }

        this.#resolver = resolver;
        this.#logger = logger;
        this.#initializationTag = initializationTag;

        this.#logger.debug(`SystemInitializer instance created. Will initialize systems tagged with '${this.#initializationTag}'.`);
    }

    /**
     * Resolves systems tagged for initialization using the service resolver.
     * This private helper encapsulates the logic for querying the resolver,
     * handling potential resolution errors (synchronous or asynchronous),
     * and validating the result format.
     *
     * @private
     * @async                                       // <<< CHANGED: Mark as async
     * @returns {Promise<Array<any>>} An array of resolved systems. Returns an empty array
     * if the resolver returns a non-array value (after logging a warning).
     * @throws {Error} If the resolver's `resolveByTag` method throws a critical
     * error or returns a promise that rejects during the resolution process.
     * @memberof SystemInitializer
     */
    async _resolveSystems() { // <<< CHANGED: Add async keyword
        let resolvedSystems = [];
        try {
            this.#logger.debug(`SystemInitializer: Querying resolver for tag '${this.#initializationTag}'...`);
            // <<< CHANGED: Add await to handle potential promises >>>
            resolvedSystems = await this.#resolver.resolveByTag(this.#initializationTag);

            if (!Array.isArray(resolvedSystems)) {
                this.#logger.warn(`SystemInitializer: resolveByTag for tag '${this.#initializationTag}' did not return an array. Received: ${typeof resolvedSystems}. Treating as empty.`);
                resolvedSystems = [];
            }
            this.#logger.info(`SystemInitializer: Found ${resolvedSystems.length} systems tagged with '${this.#initializationTag}'.`);

            return resolvedSystems;

        } catch (resolveTagError) {
            // This catch block now correctly handles both sync errors and promise rejections from resolveByTag
            this.#logger.error(`SystemInitializer: Failed to resolve systems by tag '${this.#initializationTag}'. Initialization cannot proceed. Error: ${resolveTagError.message}`, resolveTagError);
            // Re-throw the error to ensure initializeAll's promise rejects
            throw new Error(`Failed to resolve initializable systems using tag '${this.#initializationTag}': ${resolveTagError.message}`);
        }
    }

    /**
     * Attempts to initialize a single provided system object.
     * It checks if the system is valid and has an `initialize` method,
     * calls it (asynchronously), and logs the outcome (success or error).
     * Errors during a specific system's initialization are logged but not
     * re-thrown, allowing the overall initialization process to continue.
     *
     * @private
     * @async
     * @param {any} system - The system object retrieved from the resolver.
     * Might be null, undefined, or an object lacking an `initialize` method.
     * @returns {Promise<void>} A promise that resolves once the initialization
     * attempt (including logging) is complete. It always resolves, even if
     * the system's `initialize` method throws an error.
     * @memberof SystemInitializer
     */
    async #_initializeSingleSystem(system) { // AC1: Private async helper method defined
        const systemName = system?.constructor?.name ?? 'UnnamedSystem'; // Get name for logging

        // Check if the resolved item is valid and has an initialize method
        if (system && typeof system.initialize === 'function') {
            this.#logger.info(`SystemInitializer: Initializing system: ${systemName}...`);
            try {
                // Type hint for clarity (assuming an implicit ISystem interface)
                /** @type {{ initialize: () => Promise<void> | void }} */
                // Await even if initialize is synchronous; handles both cases.
                await system.initialize(); // AC1: await system.initialize() call
                this.#logger.info(`SystemInitializer: System ${systemName} initialized successfully.`); // AC1: Success logging
            } catch (initError) {
                // AC1, AC2: Error handling and logging, does not throw
                this.#logger.error(`SystemInitializer: Error during initialization of system '${systemName}'. Continuing with others. Error: ${initError.message}`, initError);
            }
        } else {
            // Log if a resolved system lacks the initialize method or is invalid
            if (system) {
                // AC1: Logging for skipping (no initialize method)
                this.#logger.debug(`SystemInitializer: Resolved system '${systemName}' has no initialize() method or is not a function, skipping call.`);
            } else {
                // AC1: Logging for skipping (null/undefined entry)
                this.#logger.warn(`SystemInitializer: Encountered a null or undefined entry in resolved systems for tag '${this.#initializationTag}', skipping.`);
            }
        }
        // Promise resolves implicitly after the attempt/logging is done. AC2 satisfied.
    } // AC5: JSDoc added

    /**
     * Queries the service resolver for systems marked with the configured
     * initialization tag, then iterates through them sequentially, attempting
     * to initialize each one by calling its `initialize` method if present.
     *
     * This method handles errors during the execution of individual `initialize`
     * methods by logging them via the `_initializeSingleSystem` helper, without
     * halting the overall process. It ensures that systems requiring asynchronous
     * setup are properly initialized before the main application logic proceeds.
     *
     * Initialization proceeds sequentially (one system after another completes).
     * See note below about potential concurrency.
     *
     * @async
     * @returns {Promise<void>} A promise that resolves when the initialization loop
     * for all tagged systems has completed. Errors encountered for individual
     * systems are logged but do not cause the promise to reject, allowing
     * other systems to attempt initialization.
     * @fulfills {void} Successfully completed initialization loop for tagged systems.
     * @rejects {Error} If the underlying system resolution (via `_resolveSystems`) fails critically.
     */
    async initializeAll() {
        this.#logger.info(`SystemInitializer: Starting initialization for systems tagged with '${this.#initializationTag}'...`);

        // <<< CHANGED: Add await as _resolveSystems is now async >>>
        // Wrap in try/catch here to ensure the final log message doesn't run if resolution fails
        let systemsToInitialize = [];
        try {
            systemsToInitialize = await this._resolveSystems();
        } catch (error) {
            // Error is already logged by _resolveSystems.
            // We re-throw here to ensure the main promise rejects as expected by the test.
            throw error;
        }


        this.#logger.info(`SystemInitializer: Proceeding to initialize ${systemsToInitialize.length} resolved systems sequentially...`);

        // Iterate through the resolved tagged services and call the helper
        // to handle the initialization logic for each one.
        // Using a standard for...of loop with await ensures sequential initialization.
        // Each system's initialization must complete (or fail with logging) before
        // the next one starts.
        for (const system of systemsToInitialize) {
            // AC3: Loop body simplified to call the helper method
            await this.#_initializeSingleSystem(system);
        } // End of loop - AC4: Overall functionality (sequential, log errors, continue) remains

        /*
         * Note on Concurrency:
         * If system initializations were independent and potentially time-consuming (e.g., involving I/O),
         * running them concurrently could be faster. This could be achieved using Promise.allSettled:
         *
         * const initPromises = systemsToInitialize.map(system => this.#_initializeSingleSystem(system));
         * const results = await Promise.allSettled(initPromises);
         * // Optional: Log overall results summary based on 'results' array if needed.
         *
         * However, the current implementation maintains sequential initialization as per the original design
         * and implicit requirements, which is often safer unless concurrency is explicitly desired and tested.
         */

        this.#logger.info('SystemInitializer: Initialization loop for tagged systems completed.');
        // Promise resolves implicitly if _resolveSystems succeeded and loop finished
    }
}

export default SystemInitializer;