// src/logic/operationHandlers/querySystemDataHandler.js

/**
 * @fileoverview Defines the QuerySystemDataHandler class, responsible for
 * executing the QUERY_SYSTEM_DATA operation. It queries non-ECS data sources
 * via the SystemDataRegistry and stores the result in the execution context.
 */

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../core/services/systemDataRegistry.js').SystemDataRegistry} SystemDataRegistry */ // Corrected path from previous request
/** @typedef {import('../defs.js').OperationHandler} OperationHandler */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../defs.js').OperationParams} OperationParams */

/**
 * Parameters expected by the QuerySystemDataHandler#execute method.
 * @typedef {object} QuerySystemDataParams
 * @property {string} source_id - Required. The unique identifier of the data source registered in SystemDataRegistry.
 * @property {string | object} query_details - Required. Details about the query (e.g., method name, query object). Passed directly to `SystemDataRegistry.query`.
 * @property {string} result_variable - Required. The variable name within `evaluationContext.context` where the query result will be stored.
 */

/**
 * @class QuerySystemDataHandler
 * Implements the OperationHandler interface for the "QUERY_SYSTEM_DATA" operation type.
 * Fetches data from a registered system data source (like a repository) using the
 * SystemDataRegistry and stores the result in the rule's execution context.
 *
 * @implements {OperationHandler}
 */
class QuerySystemDataHandler {
    /**
     * @private
     * @readonly
     * @type {ILogger}
     */
    #logger;

    /**
     * @private
     * @readonly
     * @type {SystemDataRegistry}
     */
    #systemDataRegistry;

    /**
     * Creates an instance of QuerySystemDataHandler.
     * @param {object} dependencies - Dependencies object.
     * @param {ILogger} dependencies.logger - The logging service instance.
     * @param {SystemDataRegistry} dependencies.systemDataRegistry - The central registry for system data sources.
     * @throws {TypeError} If logger or systemDataRegistry dependencies are missing or invalid.
     */
    constructor({ logger, systemDataRegistry }) {
        // 1. Validate Logger dependency
        if (!logger || typeof logger.info !== 'function' || typeof logger.warn !== 'function' || typeof logger.error !== 'function' || typeof logger.debug !== 'function') {
            throw new TypeError('QuerySystemDataHandler requires a valid ILogger instance with info, warn, error, and debug methods.');
        }
        this.#logger = logger;

        // 2. Validate SystemDataRegistry dependency
        if (!systemDataRegistry || typeof systemDataRegistry.query !== 'function') {
            // Log the error before throwing, as logger is now validated and available
            this.#logger.error('QuerySystemDataHandler: Invalid SystemDataRegistry dependency provided.', { systemDataRegistry });
            throw new TypeError('QuerySystemDataHandler requires a valid SystemDataRegistry instance with a query method.');
        }
        this.#systemDataRegistry = systemDataRegistry;

        this.#logger.debug('QuerySystemDataHandler: Instance created successfully.');
    }

    /**
     * Executes the QUERY_SYSTEM_DATA operation.
     * Validates parameters, calls systemDataRegistry.query(), handles errors,
     * and stores the result (or undefined) in executionContext.evaluationContext.context.
     *
     * @param {OperationParams | QuerySystemDataParams | null | undefined} params - The parameters for the operation.
     * @param {ExecutionContext} executionContext - The context of the execution, used for logging and storing results.
     * @returns {undefined} Operation handlers typically return void/undefined.
     * @implements {OperationHandler}
     */
    execute(params, executionContext) {
        // 1. Get logger from executionContext or fallback to injected logger.
        const logger = executionContext?.logger ?? this.#logger;

        // 2. Validate 'params' structure (source_id, query_details, result_variable).
        if (!params || typeof params !== 'object') {
            logger.error('QUERY_SYSTEM_DATA: Missing or invalid parameters object.', { params });
            return undefined;
        }

        const { source_id, query_details, result_variable } = params;

        if (typeof source_id !== 'string' || !source_id.trim()) {
            logger.error('QUERY_SYSTEM_DATA: Missing or invalid required "source_id" parameter (must be non-empty string).', { params });
            return undefined;
        }
        const trimmedSourceId = source_id.trim();

        // query_details can be almost anything, just needs to be defined. SystemDataRegistry handles its specifics.
        if (query_details === undefined) {
            logger.error('QUERY_SYSTEM_DATA: Missing required "query_details" parameter.', { params });
            return undefined;
        }

        if (typeof result_variable !== 'string' || !result_variable.trim()) {
            logger.error('QUERY_SYSTEM_DATA: Missing or invalid required "result_variable" parameter (must be non-empty string).', { params });
            return undefined;
        }
        const trimmedResultVariable = result_variable.trim();

        // 3. Validate 'executionContext.evaluationContext.context' exists.
        if (!executionContext?.evaluationContext?.context || typeof executionContext.evaluationContext.context !== 'object') {
            logger.error('QUERY_SYSTEM_DATA: evaluationContext.context is missing or invalid. Cannot store result.', { executionContext });
            return undefined;
        }

        logger.debug(`QUERY_SYSTEM_DATA: Attempting to query source "${trimmedSourceId}" with details: ${JSON.stringify(query_details)}. Storing result in context variable "${trimmedResultVariable}".`);

        // Initialize result to undefined. It will be overwritten on success.
        let result = undefined;
        try {
            // 4. Call this.#systemDataRegistry.query(params.source_id, params.query_details).
            result = this.#systemDataRegistry.query(trimmedSourceId, query_details);
            // AC: execute correctly calls systemDataRegistry.query with parameters from params.

        } catch (error) {
            // Catch potential synchronous errors thrown by the registry's query method itself.
            logger.error(`QUERY_SYSTEM_DATA: Error occurred while executing query on source "${trimmedSourceId}". Storing 'undefined' in "${trimmedResultVariable}".`, {
                sourceId: trimmedSourceId,
                queryDetails: query_details,
                resultVariable: trimmedResultVariable,
                error: error.message,
                // Optionally include stack for deeper debugging if needed: stack: error.stack
            });
            // 'result' remains undefined as initialized.
            // AC: Query failures (return undefined or throw) result in undefined being stored and appropriate errors/warnings logged.
        }

        // 5. Store the result (or undefined on failure/error) in executionContext.evaluationContext.context[params.result_variable].
        try {
            executionContext.evaluationContext.context[trimmedResultVariable] = result;
        } catch (contextError) {
            logger.error(`QUERY_SYSTEM_DATA: Failed to store result in context variable "${trimmedResultVariable}" after query.`, {
                resultVariable: trimmedResultVariable,
                resultValue: result, // Log the value that failed to be stored
                contextError: contextError.message,
            });
            // Even if storing fails, we don't re-throw, just log the issue.
            return undefined; // Still return undefined as per handler convention.
        }


        // 6. Add appropriate debug/error logging for the outcome.
        if (result !== undefined) {
            // AC: Successful query results are stored in the correct context variable.
            let resultString;
            try {
                resultString = JSON.stringify(result);
            } catch {
                resultString = '[Could not stringify result]';
            }
            logger.debug(`QUERY_SYSTEM_DATA: Successfully queried source "${trimmedSourceId}". Stored result in "${trimmedResultVariable}": ${resultString}`);
        } else {
            // This covers cases where query() returned undefined (e.g., source not found, query not supported)
            // OR where an error was caught during the query call.
            // AC: Query failures (return undefined or throw) result in undefined being stored and appropriate errors/warnings logged. (Error logged in catch, warning implied here if registry returned undefined)
            logger.warn(`QUERY_SYSTEM_DATA: Query to source "${trimmedSourceId}" failed or returned no result. Stored 'undefined' in "${trimmedResultVariable}".`);
        }

        // Operation handlers typically return void/undefined.
        return undefined;
    }
}

// Export the class as the default export
export default QuerySystemDataHandler;