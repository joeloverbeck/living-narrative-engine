// src/logic/operationHandlers/setVariableHandler.js

// --- Utility Imports ---
// import resolvePath from '../../utils/resolvePath.js'; // No longer needed here

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../defs.js').OperationHandler} OperationHandler */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */ // ** Corrected type for 2nd arg **
/** @typedef {import('../defs.js').OperationParams} OperationParams */

/**
 * Parameters expected by the SetVariableHandler#execute method.
 * Placeholders in `value` are assumed to be pre-resolved by OperationInterpreter.
 * @typedef {object} SetVariableOperationParams
 * @property {string} variable_name - Required. The name of the variable to set or update in the evaluationContext.context.
 * @property {*} value - Required. The value to assign (pre-resolved). Can be any valid JSON type or resolved type.
 */

// -----------------------------------------------------------------------------
//  Handler implementation
// -----------------------------------------------------------------------------

/**
 * @class SetVariableHandler
 * Implements the OperationHandler interface for the "SET_VARIABLE" operation type.
 * Takes a variable name and a pre-resolved value and stores the key-value pair
 * in the `executionContext.evaluationContext.context` object.
 *
 * @implements {OperationHandler}
 */
class SetVariableHandler {
    /** @private @readonly @type {ILogger} */
    #logger;

    /**
     * Creates an instance of SetVariableHandler.
     * @param {object} dependencies - Dependencies object.
     * @param {ILogger} dependencies.logger - The logging service instance.
     * @throws {Error} If the logger dependency is missing or invalid.
     */
    constructor({logger}) {
        if (!logger || typeof logger.debug !== 'function' || typeof logger.info !== 'function' || typeof logger.warn !== 'function' || typeof logger.error !== 'function') {
            throw new Error('SetVariableHandler requires a valid ILogger instance with debug, info, warn, and error methods.');
        }
        this.#logger = logger;
        this.#logger.debug('SetVariableHandler initialized.');
    }

    /**
     * Executes the SET_VARIABLE operation using pre-resolved parameters.
     * Sets or updates a variable in the `executionContext.evaluationContext.context`.
     *
     * @param {OperationParams | SetVariableOperationParams | null | undefined} params - Parameters with `value` already resolved. Requires `variable_name` (string) and `value` (*).
     * @param {ExecutionContext} executionContext - The overall execution environment containing services and the target context for storage.
     * @returns {void}
     * @implements {OperationHandler}
     */
    execute(params, executionContext) {
        const logger = this.#logger;

        // --- 1. Validate Parameters ---
        if (!params || typeof params !== 'object') {
            logger.error('SET_VARIABLE: Missing or invalid parameters object.', {params});
            return;
        }

        const {variable_name, value} = params; // 'value' is now the resolved value

        // Validate variable_name
        if (typeof variable_name !== 'string' || !variable_name.trim()) {
            logger.error('SET_VARIABLE: Invalid or missing "variable_name" parameter. Must be a non-empty string.', {variable_name});
            return;
        }
        const trimmedVariableName = variable_name.trim(); // Use trimmed name for storage

        // Validate resolved value: must be defined (can be null)
        if (value === undefined) {
            // Log that the resolution likely resulted in undefined
            logger.error(`SET_VARIABLE: Resolved "value" is undefined for variable "${trimmedVariableName}". Assignment skipped. Check placeholder resolution.`, {params});
            // If assignment of undefined is desired, remove this check. For now, skipping seems safer.
            return;
        }

        // --- 2. Validate target context ---
        const evaluationCtx = executionContext?.evaluationContext;
        if (!evaluationCtx || typeof evaluationCtx.context !== 'object' || evaluationCtx.context === null) {
            logger.error('SET_VARIABLE: executionContext.evaluationContext.context is missing or invalid. Cannot store variable.', {executionContext});
            return;
        }

        // --- REMOVED Placeholder Resolution Logic ---
        // The 'value' received here is the final, resolved value.
        const finalValue = value;

        // --- 4. Implement Core Logic (Assignment into evaluationContext.context) ---
        let finalValueStringForLog;
        try {
            finalValueStringForLog = JSON.stringify(finalValue);
        } catch (e) {
            finalValueStringForLog = '[Could not stringify final value]';
            logger.warn(`SET_VARIABLE: Could not stringify final value for assignment logging (variable: "${trimmedVariableName}").`, e);
        }

        logger.info(`SET_VARIABLE: Setting context variable "${trimmedVariableName}" to resolved value: ${finalValueStringForLog}`);

        // Perform the assignment
        try {
            evaluationCtx.context[trimmedVariableName] = finalValue;
        } catch (assignmentError) {
            logger.error(`SET_VARIABLE: Unexpected error during assignment for variable "${trimmedVariableName}".`, {
                error: assignmentError.message,
                variableName: trimmedVariableName,
                valueBeingAssigned: finalValue
            });
            // throw assignmentError; // Optional: Halt execution on assignment error
        }
    }
}

export default SetVariableHandler;