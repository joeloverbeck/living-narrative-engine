// src/logic/operationHandlers/setVariableHandler.js

// -----------------------------------------------------------------------------
//  SET_VARIABLE Handler
//  Sets or updates a variable within the current rule execution context.
//  Handles placeholder resolution for values starting with '$'.
// -----------------------------------------------------------------------------

// --- Utility Imports ---
import resolvePath from '../../utils/resolvePath.js'; // <-- ADDED: Import resolvePath utility

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../defs.js').OperationHandler} OperationHandler */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../defs.js').OperationParams} OperationParams */
/** @typedef {import('../../../data/schemas/operation.schema.json').$defs.SetVariableParameters} SetVariableParameters */ // More specific type if needed, but schema path might change

/**
 * Parameters expected by the SetVariableHandler#execute method.
 * Derived from operation.schema.json definition for SET_VARIABLE.
 *
 * @typedef {object} SetVariableOperationParams
 * @property {string} variable_name - Required. The name of the variable to set or update in the evaluationContext.context. Must not be empty or contain only whitespace.
 * @property {*} value - Required. The value to assign to the variable. Can be any valid JSON type. If the value is a string starting with '$', it will be treated as a placeholder path and resolved against the executionContext.evaluationContext.
 */

// -----------------------------------------------------------------------------
//  Handler implementation
// -----------------------------------------------------------------------------

/**
 * @class SetVariableHandler
 * Implements the OperationHandler interface for the "SET_VARIABLE" operation type.
 * Takes a variable name and a value. If the value is a string starting with '$',
 * it resolves the placeholder path against the `executionContext.evaluationContext`.
 * Stores the resulting key-value pair in the
 * `executionContext.evaluationContext.context` object.
 *
 * @implements {OperationHandler}
 */
class SetVariableHandler {
    /**
     * @private
     * @readonly
     * @type {ILogger}
     */
    #logger;

    /**
     * Creates an instance of SetVariableHandler.
     * @param {object} dependencies - Dependencies object.
     * @param {ILogger} dependencies.logger - The logging service instance.
     * @throws {Error} If the logger dependency is missing or invalid.
     */
    constructor({ logger }) {
        // Validate the logger dependency
        if (!logger || typeof logger.debug !== 'function' || typeof logger.info !== 'function' || typeof logger.warn !== 'function' || typeof logger.error !== 'function') {
            throw new Error('SetVariableHandler requires a valid ILogger instance with debug, info, warn, and error methods.');
        }
        this.#logger = logger;
        this.#logger.debug('SetVariableHandler initialized.');
    }

    /**
     * Executes the SET_VARIABLE operation.
     * Sets or updates a variable in the `executionContext.evaluationContext.context`.
     * Performs placeholder resolution if `params.value` is a string starting with '$'.
     *
     * @param {OperationParams | SetVariableOperationParams | null | undefined} params - The parameters for the operation. Requires `variable_name` (string) and `value` (*).
     * @param {ExecutionContext} executionContext - The context of the execution, providing `evaluationContext` for resolution and storage.
     * @returns {void}
     * @implements {OperationHandler}
     */
    execute(params, executionContext) {
        // --- Get logger (prefer context logger if available) ---
        const logger = executionContext?.logger ?? this.#logger;

        // --- 1. Validate Parameters ---
        if (!params || typeof params !== 'object') {
            logger.error('SET_VARIABLE: Missing or invalid parameters object.', { params });
            return;
        }

        const { variable_name, value } = params; // Keep original `value` for reference

        // Validate variable_name
        if (typeof variable_name !== 'string' || !variable_name.trim()) {
            logger.error('SET_VARIABLE: Invalid or missing "variable_name" parameter. Must be a non-empty string.', { variable_name });
            return;
        }
        const trimmedVariableName = variable_name.trim();

        // Validate value: must be defined
        if (value === undefined) {
            logger.error(`SET_VARIABLE: Missing "value" parameter for variable "${trimmedVariableName}".`, { params });
            return;
        }

        // --- 2. Validate Execution Context ---
        // Ensure the target context and evaluation context exist and are objects
        if (!executionContext?.evaluationContext?.context || typeof executionContext.evaluationContext.context !== 'object' || executionContext.evaluationContext.context === null || typeof executionContext.evaluationContext !== 'object' || executionContext.evaluationContext === null) {
            logger.error('SET_VARIABLE: executionContext or evaluationContext or evaluationContext.context is missing or invalid. Cannot resolve or store variable.', { executionContext });
            return;
        }

        // --- 3. Resolve Placeholder (if applicable) ---
        let finalValue = value; // Default to the original value
        let resolutionAttempted = false;
        let resolvedValueString = '[Not resolved]'; // For logging

        if (typeof value === 'string' && value.startsWith('$')) {
            resolutionAttempted = true;
            const placeholderPath = value.slice(1); // Remove leading '$'

            // Check for empty path after removing '$'
            if (!placeholderPath) {
                logger.warn(`SET_VARIABLE: Value was '$' with no path. Using empty string as path for resolution against context root for variable "${trimmedVariableName}".`);
                // Allow resolvePath to handle empty string path if desired, or treat as error
                // Current resolvePath might throw on empty string - let's see behavior.
                // Decision: Log warning, let resolvePath proceed (likely returns undefined or throws).
            } else {
                logger.debug(`SET_VARIABLE: Detected placeholder "${value}" for variable "${trimmedVariableName}". Attempting to resolve path "${placeholderPath}"...`);
            }


            try {
                // Use the entire evaluationContext as the root for resolution
                // This allows accessing event, actor, target, context etc.
                const resolvedValue = resolvePath(executionContext.evaluationContext, placeholderPath);
                finalValue = resolvedValue; // Use the result, even if undefined

                // Log the outcome of the resolution
                if (resolvedValue === undefined) {
                    logger.warn(`SET_VARIABLE: Placeholder path "${placeholderPath}" resolved to UNDEFINED in executionContext.evaluationContext for variable "${trimmedVariableName}". Storing undefined.`);
                    resolvedValueString = 'undefined';
                } else {
                    // Safely stringify the resolved value for logging
                    try {
                        resolvedValueString = JSON.stringify(resolvedValue);
                    } catch (e) {
                        resolvedValueString = '[Could not stringify resolved value]';
                        logger.warn(`SET_VARIABLE: Could not stringify resolved value for logging (variable: "${trimmedVariableName}", path: "${placeholderPath}").`, e);
                    }
                    logger.debug(`SET_VARIABLE: Placeholder path "${placeholderPath}" resolved successfully for variable "${trimmedVariableName}". Resolved value: ${resolvedValueString}`);
                }

            } catch (resolveError) {
                // Catch errors from resolvePath (e.g., invalid path type)
                logger.error(`SET_VARIABLE: Error during resolvePath for path "${placeholderPath}" (variable: "${trimmedVariableName}"). Assigning UNDEFINED.`, {
                    error: resolveError,
                    originalValue: value,
                    pathAttempted: placeholderPath
                });
                finalValue = undefined; // Assign undefined on resolution error, as per AC decision.
                resolvedValueString = '[Error during resolution]';
            }
        } else {
            // Value is not a string starting with '$', no resolution needed.
            logger.debug(`SET_VARIABLE: Value for variable "${trimmedVariableName}" is not a placeholder string starting with '$'. Using original value directly.`);
        }

        // --- 4. Implement Core Logic (Assignment) ---
        // Log the final value being assigned
        let finalValueStringForLog;
        try {
            finalValueStringForLog = JSON.stringify(finalValue);
        } catch (e) {
            finalValueStringForLog = '[Could not stringify final value]';
            logger.warn(`SET_VARIABLE: Could not stringify final value for assignment logging (variable: "${trimmedVariableName}").`, e);
        }

        if (resolutionAttempted) {
            logger.info(`SET_VARIABLE: Setting context variable "${trimmedVariableName}" to RESOLVED value: ${finalValueStringForLog} (Original placeholder: "${value}")`);
        } else {
            // Log original value if no resolution attempted/needed
            let originalValueStringForLog;
            try {
                originalValueStringForLog = JSON.stringify(value);
            } catch { originalValueStringForLog = '[Could not stringify]'; }
            logger.info(`SET_VARIABLE: Setting context variable "${trimmedVariableName}" to ORIGINAL value: ${originalValueStringForLog}`);
        }

        // Perform the assignment
        try {
            executionContext.evaluationContext.context[trimmedVariableName] = finalValue;
            // Optional: Log success after setting
            // logger.debug(`SET_VARIABLE: Successfully set context variable "${trimmedVariableName}".`);
        } catch (assignmentError) {
            logger.error(`SET_VARIABLE: Unexpected error during assignment for variable "${trimmedVariableName}".`, {
                error: assignmentError,
                variableName: trimmedVariableName,
                valueBeingAssigned: finalValue // Log the value that caused the error
            });
            // Consider if assignment errors should halt execution (re-throw)
            // throw assignmentError;
        }
    }
}

// Export the class as the default export
export default SetVariableHandler;