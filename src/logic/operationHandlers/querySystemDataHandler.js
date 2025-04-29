// src/logic/operationHandlers/querySystemDataHandler.js

/**
 * @fileoverview Defines the QuerySystemDataHandler class, responsible for
 * executing the QUERY_SYSTEM_DATA operation. It queries non-ECS data sources
 * via the SystemDataRegistry and stores the result in the evaluation context.
 */

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../core/services/systemDataRegistry.js').SystemDataRegistry} SystemDataRegistry */
/** @typedef {import('../defs.js').OperationHandler} OperationHandler */
// *** Corrected JSDoc Import: The second argument represents the whole execution environment ***
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../defs.js').OperationParams} OperationParams */

/**
 * Parameters expected by the QuerySystemDataHandler#execute method.
 * @typedef {object} QuerySystemDataParams
 * @property {string} source_id - Required. The unique identifier of the data source registered in SystemDataRegistry.
 * @property {string | object} query_details - Required. Details about the query (e.g., method name, query object). Passed directly to `SystemDataRegistry.query`.
 * @property {string} result_variable - Required. The variable name within `executionContext.evaluationContext.context` where the query result will be stored.
 */

/**
 * @class QuerySystemDataHandler
 * Implements the OperationHandler interface for the "QUERY_SYSTEM_DATA" operation type.
 * Fetches data from a registered system data source (like a repository) using the
 * SystemDataRegistry and stores the result in the rule's dynamic evaluation context.
 * Uses constructor-injected logger and SystemDataRegistry.
 *
 * @implements {OperationHandler}
 */
class QuerySystemDataHandler {
    /**
     * @private
     * @readonly
     * @type {ILogger}
     */
    #logger; // Injected dependency

    /**
     * @private
     * @readonly
     * @type {SystemDataRegistry}
     */
    #systemDataRegistry; // Injected dependency

    /**
     * Creates an instance of QuerySystemDataHandler.
     * @param {object} dependencies - Dependencies object.
     * @param {ILogger} dependencies.logger - The logging service instance.
     * @param {SystemDataRegistry} dependencies.systemDataRegistry - The central registry for system data sources.
     * @throws {TypeError} If logger or systemDataRegistry dependencies are missing or invalid.
     */
    constructor({logger, systemDataRegistry}) {
        // 1. Validate Logger dependency
        if (!logger || typeof logger.info !== 'function' || typeof logger.warn !== 'function' || typeof logger.error !== 'function' || typeof logger.debug !== 'function') {
            throw new TypeError('QuerySystemDataHandler requires a valid ILogger instance with info, warn, error, and debug methods.');
        }
        this.#logger = logger;

        // 2. Validate SystemDataRegistry dependency
        if (!systemDataRegistry || typeof systemDataRegistry.query !== 'function') {
            this.#logger.error('QuerySystemDataHandler: Invalid SystemDataRegistry dependency provided.', {systemDataRegistry});
            throw new TypeError('QuerySystemDataHandler requires a valid SystemDataRegistry instance with a query method.');
        }
        this.#systemDataRegistry = systemDataRegistry;

        this.#logger.debug('QuerySystemDataHandler: Instance created successfully.');
    }

    /**
     * Executes the QUERY_SYSTEM_DATA operation.
     * Validates parameters, calls systemDataRegistry.query(), handles errors,
     * and stores the result (or undefined) in `executionContext.evaluationContext.context[params.result_variable]`.
     * Uses the constructor-injected logger ONLY.
     *
     * @param {OperationParams | QuerySystemDataParams | null | undefined} params - The parameters for the operation.
     * @param {ExecutionContext} executionContext - The overall execution environment containing the evaluation context.
     * @returns {undefined} Operation handlers typically return void/undefined.
     * @implements {OperationHandler}
     */
    execute(params, executionContext) { // *** RENAMED PARAMETER ***
        // 1. Get logger from constructor-injected dependency.
        const logger = this.#logger;

        // 2. Validate 'params' structure
        if (params === null || typeof params !== 'object') {
            logger.error('QUERY_SYSTEM_DATA: Missing or invalid parameters object.', {params});
            return undefined;
        }

        const {source_id, query_details, result_variable} = params;

        if (typeof source_id !== 'string' || !source_id.trim()) {
            logger.error('QUERY_SYSTEM_DATA: Missing or invalid required "source_id" parameter (must be non-empty string).', {params});
            return undefined;
        }
        const trimmedSourceId = source_id.trim();

        if (query_details === undefined) {
            logger.error('QUERY_SYSTEM_DATA: Missing required "query_details" parameter.', {params});
            return undefined;
        }

        if (typeof result_variable !== 'string' || !result_variable.trim()) {
            logger.error('QUERY_SYSTEM_DATA: Missing or invalid required "result_variable" parameter (must be non-empty string).', {params});
            return undefined;
        }
        const trimmedResultVariable = result_variable.trim();

        // --- CORRECTED VALIDATION ---
        // 3. Validate the target context object within executionContext.evaluationContext.
        // Check the nested structure properly.
        const evaluationCtx = executionContext?.evaluationContext; // Safely access nested property
        if (!evaluationCtx || typeof evaluationCtx.context !== 'object' || evaluationCtx.context === null) {
            // Log the whole executionContext that was passed and caused the failure
            logger.error(
                'QUERY_SYSTEM_DATA: executionContext.evaluationContext.context is missing or invalid. Cannot store result.',
                {executionContext: executionContext} // Log the problematic structure
            );
            return undefined; // Cannot store if the target 'context' object doesn't exist
        }
        // --- END CORRECTED VALIDATION ---


        logger.debug(`QUERY_SYSTEM_DATA: Attempting to query source "${trimmedSourceId}" with details: ${JSON.stringify(query_details)}. Storing result in context variable "${trimmedResultVariable}".`);

        // Initialize result to undefined.
        let result = undefined;
        try {
            // 4. Call systemDataRegistry.query
            result = this.#systemDataRegistry.query(trimmedSourceId, query_details);

        } catch (error) {
            // Catch errors during query execution
            logger.error(`QUERY_SYSTEM_DATA: Error occurred while executing query on source "${trimmedSourceId}". Storing 'undefined' in "${trimmedResultVariable}".`, {
                sourceId: trimmedSourceId,
                queryDetails: query_details,
                resultVariable: trimmedResultVariable,
                error: error instanceof Error ? error.message : String(error),
            });
            // 'result' remains undefined.
        }

        // 5. Store the result (or undefined) in the correct context location.
        try {
            // *** CORRECTED STORAGE LOCATION ***
            evaluationCtx.context[trimmedResultVariable] = result;
        } catch (contextError) {
            logger.error(`QUERY_SYSTEM_DATA: Failed to store result in context variable "${trimmedResultVariable}" after query.`, {
                resultVariable: trimmedResultVariable,
                resultValue: result,
                contextError: contextError instanceof Error ? contextError.message : String(contextError),
            });
            // Still return undefined as per handler convention.
            return undefined;
        }

        // 6. Add logging for the outcome.
        if (result !== undefined) {
            let resultString;
            try {
                resultString = JSON.stringify(result);
            } catch {
                resultString = '[Could not stringify result]';
            }
            logger.debug(`QUERY_SYSTEM_DATA: Successfully queried source "${trimmedSourceId}". Stored result in "${trimmedResultVariable}": ${resultString}`);
        } else {
            // Covers query() returning undefined OR errors caught above.
            logger.warn(`QUERY_SYSTEM_DATA: Query to source "${trimmedSourceId}" failed or returned no result. Stored 'undefined' in "${trimmedResultVariable}".`);
        }

        // Operation handlers typically return void/undefined.
        return undefined;
    }
}

// Export the class as the default export
export default QuerySystemDataHandler;