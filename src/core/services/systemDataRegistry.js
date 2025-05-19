// src/core/services/systemDataRegistry.js

/**
 * @fileoverview Defines the SystemDataRegistry class, responsible for
 * managing access to various non-ECS data sources like repositories or
 * configurations needed by query handlers or other systems.
 */

// Import necessary types (using JSDoc for typedef)
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
// GameDataRepository isn't strictly imported, but its expected interface is used in query method logic.
// /** @typedef {import('./services/gameDataRepository.js').default} GameDataRepository */ // Optional for type checking

/**
 * A central registry for accessing non-ECS data sources.
 * Allows systems like QuerySystemDataHandler to retrieve data from registered
 * sources (e.g., GameDataRepository) using a standardized query mechanism.
 */
export class SystemDataRegistry {
    /**
     * The logger instance used by the registry itself.
     * @private
     * @type {ILogger}
     */
    #logger;

    /**
     * Internal storage for registered data source instances.
     * The key is a unique string identifier for the source, and the value
     * is the source instance itself.
     * @private
     * @type {Map<string, any>}
     */
    #dataSources;

    /**
     * Creates an instance of the SystemDataRegistry.
     * Requires a valid logger instance for internal operations.
     *
     * @param {ILogger} logger - An object conforming to the ILogger interface.
     * @throws {TypeError} If the provided logger is missing or invalid.
     */
    constructor(logger) {
        // Validate the logger first
        if (
            !logger ||
            typeof logger.info !== 'function' ||
            typeof logger.warn !== 'function' ||
            typeof logger.error !== 'function' ||
            typeof logger.debug !== 'function'
        ) {
            throw new TypeError(
                'SystemDataRegistry requires a valid ILogger instance with info, warn, error, and debug methods.'
            );
        }

        this.#logger = logger;
        this.#dataSources = new Map();
    }

    /**
     * Registers a data source instance with the registry.
     *
     * @param {string} sourceId - A unique, non-empty string identifier for the data source.
     * @param {any} sourceInstance - The actual data source instance (e.g., a repository). Must not be null or undefined.
     * @returns {void}
     */
    registerSource(sourceId, sourceInstance) {
        const methodName = 'SystemDataRegistry.registerSource';

        // --- Input Validation ---
        if (typeof sourceId !== 'string' || sourceId.trim() === '') {
            this.#logger.warn(
                `${methodName}: Invalid sourceId provided. Must be a non-empty string. Received:`,
                sourceId
            );
            return;
        }

        // Using == null checks for both null and undefined
        if (sourceInstance == null) {
            this.#logger.warn(
                `${methodName}: Invalid sourceInstance provided for sourceId '${sourceId}'. Must not be null or undefined.`
            );
            return;
        }

        // --- Overwrite Check & Logging ---
        if (this.#dataSources.has(sourceId)) {
            this.#logger.warn(
                `${methodName}: Overwriting existing source registration for sourceId '${sourceId}'.`
            );
        }

        // --- Storage ---
        this.#dataSources.set(sourceId, sourceInstance);

        // --- Success Logging ---
        this.#logger.debug(
            `${methodName}: Successfully registered source with sourceId '${sourceId}'.`
        );
    }

    /**
     * Queries a registered data source for specific information.
     *
     * @param {string} sourceId - The unique identifier of the data source to query.
     * @param {string | object} queryDetails - Details about the query. Can be a simple string
     * (like a method name) or an object for more complex queries.
     * @returns {any | undefined} The result of the query, or undefined if the source is not found,
     * the query is unsupported, or an error occurs during the query execution.
     */
    query(sourceId, queryDetails) {
        const methodName = 'SystemDataRegistry.query';

        // --- Source Lookup ---
        const sourceInstance = this.#dataSources.get(sourceId);

        if (!sourceInstance) {
            this.#logger.warn(`${methodName}: Data source with ID '${sourceId}' not found.`);
            return undefined; // AC: handles source-not-found
        }

        // --- Query Execution ---
        try {
            // ** Specific Case: GameDataRepository / worldName **
            // AC: query correctly calls gameDataRepository.getWorldName() for the specified case.
            // --- FIX: Corrected sourceId and queryDetails check ---
            if (sourceId === 'GameDataRepository' && queryDetails === 'getWorldName') {
                // Check if the method exists and is callable before attempting the call
                if (typeof sourceInstance.getWorldName === 'function') {
                    const result = sourceInstance.getWorldName();
                    this.#logger.debug(`${methodName}: Successfully queried '${sourceId}' for '${queryDetails}'.`);
                    return result;
                } else {
                    this.#logger.error(`${methodName}: Source '${sourceId}' does not have a callable 'getWorldName' method for query '${queryDetails}'.`);
                    return undefined; // Method not found on source
                }
            }
            // +++ NEW CASE: WorldContext +++
            else if (sourceId === 'WorldContext') { // Ensure this key matches what you register
                if (queryDetails && queryDetails.query_type === 'getTargetLocationForDirection') {
                    if (typeof sourceInstance.getTargetLocationForDirection === 'function') {
                        this.#logger.debug(`${methodName}: Forwarding 'getTargetLocationForDirection' query to 'WorldContext' with details: ${JSON.stringify(queryDetails)}`);
                        // The queryDetails object itself contains current_location_id and direction_taken
                        return sourceInstance.getTargetLocationForDirection(queryDetails);
                    } else {
                        this.#logger.error(`${methodName}: Source 'WorldContext' does not have a callable 'getTargetLocationForDirection' method.`);
                        return undefined;
                    }
                }
                // You could add more 'else if' blocks here for other query_types for WorldContext
                this.#logger.warn(`${methodName}: Unsupported query_type '${queryDetails ? queryDetails.query_type : 'N/A'}' for sourceId 'WorldContext'.`);
                return undefined;
            }
            // +++ END NEW CASE +++

            else {
                this.#logger.warn(`${methodName}: Query for sourceId '${sourceId}' with details '${JSON.stringify(queryDetails)}' is not currently supported.`);
                return undefined;
            }
        } catch (error) {
            // AC: query handles query-failed scenarios gracefully (returns undefined, logs errors).
            this.#logger.error(
                `${methodName}: Error executing query on source '${sourceId}' with details '${JSON.stringify(queryDetails)}':`,
                error
            );
            return undefined; // Return undefined on any error during query execution
        }
    }
}