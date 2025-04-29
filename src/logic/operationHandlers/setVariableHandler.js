// src/logic/operationHandlers/setVariableHandler.js
// (Keep imports, typedefs, and class definition structure)

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../defs.js').OperationHandler} OperationHandler */
// *** Context type used by SystemLogicInterpreter -> OperationInterpreter -> Handler ***
/** @typedef {import('../defs.js').JsonLogicEvaluationContext} ExecutionContext */
/** @typedef {import('../defs.js').OperationParams} OperationParams */

/**
 * Parameters expected by the SetVariableHandler#execute method.
 * Placeholders in `value` are assumed to be pre-resolved by OperationInterpreter.
 * @typedef {object} SetVariableOperationParams
 * @property {string} variable_name - Required. The name of the variable to set or update in the executionContext.context.
 * @property {*} value - Required. The value to assign (pre-resolved). Can be any valid JSON type or resolved type.
 */

// -----------------------------------------------------------------------------
//  Handler implementation
// -----------------------------------------------------------------------------

/**
 * @class SetVariableHandler
 * Implements the OperationHandler interface for the "SET_VARIABLE" operation type.
 * Takes a variable name and a pre-resolved value and stores the key-value pair
 * in the `executionContext.context` object.
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
     * @param {JsonLogicEvaluationService} dependencies.jsonLogicEvaluationService - Service for evaluating JsonLogic (can be used if 'value' needs dynamic evaluation, though not needed if pre-resolved).
     * @throws {Error} If the logger dependency is missing or invalid.
     */
    // --- NOTE: jsonLogicEvaluationService was removed from constructor params in the provided code,
    // but kept here in comment in case it was intended for future use. If not needed, remove it. ---
    constructor({logger /*, jsonLogicEvaluationService */}) { // Assuming jsonLogicEvaluationService is NOT needed if value is pre-resolved
        if (!logger || typeof logger.debug !== 'function' || typeof logger.info !== 'function' || typeof logger.warn !== 'function' || typeof logger.error !== 'function') {
            throw new Error('SetVariableHandler requires a valid ILogger instance with debug, info, warn, and error methods.');
        }
        this.#logger = logger;
        // this.#jsonLogicEvaluationService = jsonLogicEvaluationService; // Uncomment if needed
        this.#logger.debug('SetVariableHandler initialized.');
    }


    /**
     * Executes the SET_VARIABLE operation using pre-resolved parameters.
     * Sets or updates a variable in the `executionContext.context`.
     *
     * @param {OperationParams | SetVariableOperationParams | null | undefined} params - Parameters with `value` already resolved. Requires `variable_name` (string) and `value` (*).
     * @param {ExecutionContext} executionContext - The execution context (contains event, actor, target, and the shared `context` object for variables).
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
        // --- CORRECTED VALIDATION ---
        // Check if executionContext exists and has a valid 'context' object property.
        if (!executionContext || typeof executionContext.context !== 'object' || executionContext.context === null) {
            logger.error('SET_VARIABLE: executionContext.context is missing or invalid. Cannot store variable.', {executionContext});
            return;
        }
        // --- END CORRECTED VALIDATION ---

        // Placeholder resolution is assumed done by OperationInterpreter.
        const finalValue = value;

        // --- 4. Implement Core Logic (Assignment into executionContext.context) ---
        let finalValueStringForLog;
        try {
            // Use JSON.stringify for better object representation in logs
            finalValueStringForLog = JSON.stringify(finalValue);
        } catch (e) {
            finalValueStringForLog = String(finalValue); // Fallback to String() if JSON fails
            logger.warn(`SET_VARIABLE: Could not JSON.stringify final value for logging (variable: "${trimmedVariableName}"). Using String() fallback.`, e);
        }

        // --- FIX: Log the ORIGINAL value if needed for debugging ---
        // It seems the test logs expect 'ORIGINAL value', maybe keep this for consistency?
        // Let's log both for clarity during debugging.
        let originalValueStringForLog;
        try {
            originalValueStringForLog = JSON.stringify(params.value); // Log the value *as received* in params
        } catch (e) {
            originalValueStringForLog = String(params.value);
        }
        // Example log including both (adjust as needed):
        // logger.info(`SET_VARIABLE: Setting context variable "${trimmedVariableName}". Received value: ${originalValueStringForLog}, Final assigned value: ${finalValueStringForLog}`);
        // Or match the existing log format from the test if required:
        logger.info(`SET_VARIABLE: Setting context variable "${trimmedVariableName}" to ORIGINAL value: ${originalValueStringForLog}`); // Matches test log expectation

        // Perform the assignment
        try {
            // *** CORRECTED STORAGE LOCATION ***
            executionContext.context[trimmedVariableName] = finalValue; // Store directly in executionContext.context
        } catch (assignmentError) {
            logger.error(`SET_VARIABLE: Unexpected error during assignment for variable "${trimmedVariableName}".`, {
                error: assignmentError instanceof Error ? assignmentError.message : String(assignmentError),
                variableName: trimmedVariableName,
                valueBeingAssigned: finalValue
            });
            // Optional: throw assignmentError; // Halt execution on assignment error
        }
    }
}

export default SetVariableHandler;