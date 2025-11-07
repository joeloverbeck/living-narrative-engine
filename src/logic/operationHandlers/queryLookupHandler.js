/**
 * @file Handler for QUERY_LOOKUP operation
 *
 * Retrieves entries from lookup tables defined in mod content (e.g., lexicons, mappings) and
 * stores them in execution context for use in rule message generation and conditional logic.
 *
 * Operation flow:
 * 1. Validate parameters (lookup_id, entry_key, result_variable, optional missing_value)
 * 2. Retrieve lookup table from data registry by namespaced ID
 * 3. Check if lookup exists and has entries object
 * 4. Fetch entry by key or use missing_value fallback
 * 5. Store retrieved entry or missing_value in specified context variable
 *
 * Related files:
 * @see data/schemas/operations/queryLookup.schema.json - Operation schema
 * @see src/dependencyInjection/tokens/tokens-core.js - QueryLookupHandler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 *
 * @extends BaseOperationHandler
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IDataRegistry.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../defs.js').OperationHandler} OperationHandler */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../defs.js').OperationParams} OperationParams */

import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import { assertParamsObject } from '../../utils/handlerUtils/paramsUtils.js';
import { ensureEvaluationContext } from '../../utils/evaluationContextUtils.js';
import { writeContextVariable } from '../../utils/contextVariableUtils.js';
import BaseOperationHandler from './baseOperationHandler.js';

/**
 * @typedef {object} QueryLookupOperationParams
 * @property {string} lookup_id - Namespaced ID of the lookup table (e.g., "music:mood_lexicon")
 * @property {string} entry_key - Key to retrieve from the lookup's entries object
 * @property {string} result_variable - Variable name to store the result in executionContext.evaluationContext.context
 * @property {*} [missing_value] - Optional value to return if lookup or entry is missing (defaults to undefined)
 */

/**
 * @class QueryLookupHandler
 * @description Implements the OperationHandler interface for the "QUERY_LOOKUP" operation type.
 * Retrieves entries from lookup tables defined in mod content and stores them in the execution context.
 * @implements {OperationHandler}
 */
class QueryLookupHandler extends BaseOperationHandler {
  #dataRegistry;
  #dispatcher;

  /**
   * @param {object} deps - Dependencies object
   * @param {IDataRegistry} deps.dataRegistry - Data registry for lookup table access
   * @param {ILogger} deps.logger - Logger service
   * @param {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} deps.safeEventDispatcher - Event dispatcher
   */
  constructor({ dataRegistry, logger, safeEventDispatcher }) {
    super('QueryLookupHandler', {
      logger: { value: logger },
      dataRegistry: {
        value: dataRegistry,
        requiredMethods: ['get'],
      },
      safeEventDispatcher: {
        value: safeEventDispatcher,
        requiredMethods: ['dispatch'],
      },
    });
    this.#dataRegistry = dataRegistry;
    this.#dispatcher = safeEventDispatcher;
  }

  /**
   * Validate parameters and context for QueryLookupHandler#execute.
   *
   * @param {QueryLookupOperationParams} params - Raw parameters object
   * @param {ExecutionContext} executionContext - Current execution context
   * @param {ILogger} logger - Logger for diagnostics
   * @returns {{
   *   lookupId: string,
   *   entryKey: string,
   *   resultVar: string,
   *   trimmedResultVar: string,
   *   missingValue: *
   * }|null} Normalized values or null when validation fails
   * @private
   */
  #validateParams(params, executionContext, logger) {
    if (
      !assertParamsObject(params, this.#dispatcher, 'QueryLookupHandler')
    ) {
      return null;
    }

    if (!ensureEvaluationContext(executionContext, this.#dispatcher, logger)) {
      return null;
    }

    const { lookup_id, entry_key, result_variable, missing_value } = params;

    if (typeof lookup_id !== 'string' || !lookup_id.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'QueryLookupHandler: Missing or invalid required "lookup_id" parameter (must be non-empty string).',
        { params }
      );
      return null;
    }

    if (typeof entry_key !== 'string' || !entry_key.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'QueryLookupHandler: Missing or invalid required "entry_key" parameter (must be non-empty string).',
        { params }
      );
      return null;
    }

    if (typeof result_variable !== 'string' || !result_variable.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'QueryLookupHandler: Missing or invalid required "result_variable" parameter (must be non-empty string).',
        { params }
      );
      return null;
    }

    const trimmedLookupId = lookup_id.trim();
    const trimmedEntryKey = entry_key.trim();
    const trimmedResultVar = result_variable.trim();

    return {
      lookupId: trimmedLookupId,
      entryKey: trimmedEntryKey,
      resultVar: trimmedResultVar,
      trimmedResultVar: trimmedResultVar,
      missingValue: missing_value,
    };
  }

  /**
   * Retrieve a lookup entry and store the result in context.
   *
   * @param {string} lookupId - Lookup table identifier
   * @param {string} entryKey - Entry key to fetch
   * @param {string} resultVar - Context variable name for storage
   * @param {string} trimmedResultVar - Trimmed variable name for logging
   * @param {*} missingValue - Value to store when lookup or entry is missing
   * @param {ExecutionContext} executionContext - Current execution context
   * @param {ILogger} logger - Logger for diagnostics
   * @returns {void}
   * @private
   */
  #fetchAndStoreLookup(
    lookupId,
    entryKey,
    resultVar,
    trimmedResultVar,
    missingValue,
    executionContext,
    logger
  ) {
    logger.debug(
      `QueryLookupHandler: Attempting to query entry "${entryKey}" from lookup "${lookupId}". Storing result in context variable "${trimmedResultVar}".`
    );

    try {
      const lookup = this.#dataRegistry.get('lookups', lookupId);

      if (!lookup) {
        logger.debug(
          `QueryLookupHandler: Lookup "${lookupId}" not found in data registry. Storing missing_value.`
        );

        writeContextVariable(
          resultVar,
          missingValue,
          executionContext,
          this.#dispatcher,
          logger
        );

        const missingString =
          missingValue === null
            ? 'null'
            : missingValue === undefined
              ? 'undefined'
              : typeof missingValue === 'object'
                ? JSON.stringify(missingValue)
                : missingValue;

        logger.debug(
          `QueryLookupHandler: Stored '${missingString}' in "${trimmedResultVar}" (lookup not found).`
        );
        return;
      }

      if (!lookup.entries || typeof lookup.entries !== 'object') {
        logger.warn(
          `QueryLookupHandler: Lookup "${lookupId}" found but has no entries object. Storing missing_value.`
        );

        writeContextVariable(
          resultVar,
          missingValue,
          executionContext,
          this.#dispatcher,
          logger
        );
        return;
      }

      const entry = lookup.entries[entryKey];

      if (entry === undefined) {
        logger.debug(
          `QueryLookupHandler: Entry "${entryKey}" not found in lookup "${lookupId}". Storing missing_value.`
        );

        writeContextVariable(
          resultVar,
          missingValue,
          executionContext,
          this.#dispatcher,
          logger
        );

        const missingString =
          missingValue === null
            ? 'null'
            : missingValue === undefined
              ? 'undefined'
              : typeof missingValue === 'object'
                ? JSON.stringify(missingValue)
                : missingValue;

        logger.debug(
          `QueryLookupHandler: Stored '${missingString}' in "${trimmedResultVar}" (entry not found).`
        );
        return;
      }

      writeContextVariable(
        resultVar,
        entry,
        executionContext,
        this.#dispatcher,
        logger
      );

      const resultString =
        entry === null
          ? 'null'
          : typeof entry === 'object'
            ? JSON.stringify(entry)
            : entry;

      logger.debug(
        `QueryLookupHandler: Successfully queried entry "${entryKey}" from lookup "${lookupId}". Result stored in "${trimmedResultVar}": ${resultString}`
      );
    } catch (error) {
      safeDispatchError(
        this.#dispatcher,
        `QueryLookupHandler: Error during lookup query for "${lookupId}" entry "${entryKey}".`,
        {
          error: error.message,
          stack: error.stack,
          params: {
            lookupId,
            entryKey,
            resultVar,
            trimmedResultVar,
            missingValue,
          },
        }
      );

      const stored = writeContextVariable(
        resultVar,
        missingValue,
        executionContext,
        this.#dispatcher,
        logger
      );

      if (stored.success) {
        const missingString =
          missingValue === null
            ? 'null'
            : missingValue === undefined
              ? 'undefined'
              : typeof missingValue === 'object'
                ? JSON.stringify(missingValue)
                : missingValue;

        logger.warn(
          `QueryLookupHandler: Stored '${missingString}' in "${trimmedResultVar}" due to error.`
        );
      }
    }
  }

  /**
   * Execute the QUERY_LOOKUP operation.
   *
   * @param {QueryLookupOperationParams} params - Operation parameters
   * @param {ExecutionContext} executionContext - Current execution context
   * @returns {void}
   */
  execute(params, executionContext) {
    const logger = this.getLogger(executionContext);
    const validated = this.#validateParams(params, executionContext, logger);
    if (!validated) return;

    const {
      lookupId,
      entryKey,
      resultVar,
      trimmedResultVar,
      missingValue,
    } = validated;

    this.#fetchAndStoreLookup(
      lookupId,
      entryKey,
      resultVar,
      trimmedResultVar,
      missingValue,
      executionContext,
      logger
    );
  }
}

export default QueryLookupHandler;
