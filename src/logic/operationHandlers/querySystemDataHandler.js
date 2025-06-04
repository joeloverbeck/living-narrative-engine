// src/logic/operationHandlers/querySystemDataHandler.js

/**
 * @file Defines the QuerySystemDataHandler class, responsible for
 * executing the QUERY_SYSTEM_DATA operation. It queries non-ECS data sources
 * via the SystemDataRegistry and stores the result in the evaluation context.
 */

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../services/systemDataRegistry.js').SystemDataRegistry} SystemDataRegistry */
/** @typedef {import('../defs.js').OperationHandler} OperationHandler */
// This typedef should represent the actual nested structure received by handlers.
// Let's assume 'ExecutionContext' in defs.js is this nested structure.
/** @typedef {import('../defs.js').ExecutionContext} NestedExecutionContext */

/** @typedef {import('../defs.js').OperationParams} OperationParams */

/**
 * Parameters expected by the QuerySystemDataHandler#execute method.
 *
 * @typedef {object} QuerySystemDataParams
 * @property {string} source_id - Required. The unique identifier of the data source.
 * @property {string | object} query_details - Required. Details about the query.
 * @property {string} result_variable - Required. Variable name within `nestedExecutionContext.evaluationContext.context`.
 */

class QuerySystemDataHandler {
  #logger;
  #systemDataRegistry;

  constructor({ logger, systemDataRegistry }) {
    if (
      !logger ||
      typeof logger.info !== 'function' ||
      typeof logger.warn !== 'function' ||
      typeof logger.error !== 'function' ||
      typeof logger.debug !== 'function'
    ) {
      throw new TypeError(
        'QuerySystemDataHandler requires a valid ILogger instance with info, warn, error, and debug methods.'
      );
    }
    this.#logger = logger;

    if (!systemDataRegistry || typeof systemDataRegistry.query !== 'function') {
      this.#logger.error(
        'QuerySystemDataHandler: Invalid SystemDataRegistry dependency provided.',
        { systemDataRegistry }
      );
      throw new TypeError(
        'QuerySystemDataHandler requires a valid SystemDataRegistry instance with a query method.'
      );
    }
    this.#systemDataRegistry = systemDataRegistry;
    this.#logger.debug(
      'QuerySystemDataHandler: Instance created successfully.'
    );
  }

  execute(params, nestedExecutionContext) {
    // Parameter renamed for clarity
    const logger = this.#logger; // Use constructor-injected logger as per existing class logic

    if (params === null || typeof params !== 'object') {
      logger.error('QUERY_SYSTEM_DATA: Missing or invalid parameters object.', {
        params,
      });
      return undefined;
    }

    const { source_id, query_details, result_variable } = params;

    if (typeof source_id !== 'string' || !source_id.trim()) {
      logger.error(
        'QUERY_SYSTEM_DATA: Missing or invalid required "source_id" parameter (must be non-empty string).',
        { receivedParams: params }
      );
      return undefined;
    }
    const trimmedSourceId = source_id.trim();

    if (query_details === undefined) {
      logger.error(
        'QUERY_SYSTEM_DATA: Missing required "query_details" parameter.',
        { receivedParams: params }
      );
      return undefined;
    }

    if (typeof result_variable !== 'string' || !result_variable.trim()) {
      logger.error(
        'QUERY_SYSTEM_DATA: Missing or invalid required "result_variable" parameter (must be non-empty string).',
        { receivedParams: params }
      );
      return undefined;
    }
    const trimmedResultVariable = result_variable.trim();

    // --- CORRECTED CONTEXT VALIDATION to target the nested variable store ---
    if (
      !nestedExecutionContext?.evaluationContext?.context ||
      typeof nestedExecutionContext.evaluationContext.context !== 'object' ||
      nestedExecutionContext.evaluationContext.context === null
    ) {
      logger.error(
        'QUERY_SYSTEM_DATA: nestedExecutionContext.evaluationContext.context is missing or invalid. Cannot store result.',
        { receivedFullContext: nestedExecutionContext } // Log the whole context for debugging
      );
      return undefined;
    }
    // --- END CORRECTION ---

    logger.debug(
      `QUERY_SYSTEM_DATA: Attempting to query source "${trimmedSourceId}" with details: ${JSON.stringify(query_details)}. Storing result in context variable "${trimmedResultVariable}".`
    );

    let result = undefined;
    try {
      result = this.#systemDataRegistry.query(trimmedSourceId, query_details);
    } catch (error) {
      logger.error(
        `QUERY_SYSTEM_DATA: Error occurred while executing query on source "${trimmedSourceId}". Storing 'undefined' in "${trimmedResultVariable}".`,
        {
          sourceId: trimmedSourceId,
          queryDetails: query_details,
          resultVariable: trimmedResultVariable,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        }
      );
      // result remains undefined
    }

    try {
      // --- CORRECTED RESULT STORAGE to use the nested path ---
      nestedExecutionContext.evaluationContext.context[trimmedResultVariable] =
        result;
      // --- END CORRECTION ---
    } catch (contextError) {
      logger.error(
        `QUERY_SYSTEM_DATA: Failed to store result in context variable "${trimmedResultVariable}" after query.`,
        {
          resultVariable: trimmedResultVariable,
          resultValue: result,
          contextError:
            contextError instanceof Error
              ? contextError.message
              : String(contextError),
        }
      );
      // Potentially, the result from query was successful, but storage failed.
      // Depending on desired behavior, you might not want to return undefined here if the query itself was ok.
      // For now, keeping the original flow of returning if storage fails.
      return undefined;
    }

    if (result !== undefined) {
      let resultString;
      try {
        resultString = JSON.stringify(result);
      } catch {
        resultString = '[Could not stringify result]';
      }
      logger.debug(
        `QUERY_SYSTEM_DATA: Successfully queried source "${trimmedSourceId}". Stored result in "${trimmedResultVariable}": ${resultString}`
      );
    } else {
      // This log will trigger if the query itself returned undefined OR if an error during query happened.
      logger.warn(
        `QUERY_SYSTEM_DATA: Query to source "${trimmedSourceId}" returned undefined or an error occurred during query. Stored 'undefined' in "${trimmedResultVariable}".`
      );
    }

    return undefined;
  }
}

export default QuerySystemDataHandler;
