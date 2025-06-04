// src/logic/operationHandlers/setVariableHandler.js

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../defs.js').OperationHandler} OperationHandler */
/** @typedef {import('../defs.js').JsonLogicEvaluationContext} BaseJsonLogicEvaluationContext */ // Renamed for clarity
/** @typedef {import('../defs.js').ExecutionContext} OperationExecutionContext */ // The nested context passed to handlers
/** @typedef {import('../defs.js').OperationParams} OperationParams */
// <<< Ensure JsonLogicEvaluationService is NOT imported or used >>>

// <<< ADDED Import: jsonLogic directly >>>
import jsonLogic from 'json-logic-js';

/**
 * Parameters expected by the SetVariableHandler#execute method.
 * Placeholders in `value` are assumed to be pre-resolved by OperationInterpreter.
 * If the pre-resolved `value` is an object, it may be treated as JsonLogic to be evaluated.
 *
 * @typedef {object} SetVariableOperationParams
 * @property {string} variable_name - Required. The name of the variable to set or update in the executionContext.evaluationContext.context.
 * @property {*} value - Required. The value to assign (pre-resolved). Can be any valid JSON type, resolved type, or a JsonLogic object to be evaluated against executionContext.evaluationContext.
 */

// -----------------------------------------------------------------------------
//  Handler implementation
// -----------------------------------------------------------------------------

/**
 * @class SetVariableHandler
 * Implements the OperationHandler interface for the "SET_VARIABLE" operation type.
 * Takes a variable name and a pre-resolved value. If the value is identified as
 * JsonLogic (a plain object), it evaluates it using `jsonLogic.apply` against the
 * `executionContext.evaluationContext`. Otherwise, it uses the value directly.
 * Stores the final key-value pair in the `executionContext.evaluationContext.context` object.
 * @implements {OperationHandler}
 */
class SetVariableHandler {
  #logger;

  /**
   * Creates an instance of SetVariableHandler.
   *
   * @param {object} dependencies - Dependencies object.
   * @param {ILogger} dependencies.logger - The logging service instance.
   * @throws {Error} If dependencies are missing or invalid.
   */
  constructor({ logger }) {
    if (
      !logger ||
      typeof logger.debug !== 'function' ||
      typeof logger.info !== 'function' ||
      typeof logger.warn !== 'function' ||
      typeof logger.error !== 'function'
    ) {
      throw new Error(
        'SetVariableHandler requires a valid ILogger instance with debug, info, warn, and error methods.'
      );
    }
    this.#logger = logger;
    this.#logger.debug('SetVariableHandler initialized.');
  }

  /**
   * Executes the SET_VARIABLE operation using pre-resolved parameters.
   * If the 'value' parameter is a plain object, it attempts to evaluate it as JsonLogic
   * using `jsonLogic.apply` with `executionContext.evaluationContext` as the data source.
   * Otherwise, uses the value directly.
   * Sets or updates a variable in `executionContext.evaluationContext.context`.
   *
   * @param {OperationParams | SetVariableOperationParams | null | undefined} params - Parameters with `value` potentially pre-resolved. Requires `variable_name` (string) and `value` (*).
   * @param {OperationExecutionContext} executionContext - The operation execution context. Expects this to be the nested structure
   * (e.g., finalNestedExecutionContext from SystemLogicInterpreter) containing an `evaluationContext`
   * property, which in turn contains the `context` object for variable storage.
   * @returns {void}
   * @implements {OperationHandler}
   */
  execute(params, executionContext) {
    const logger = this.#logger;

    // --- 1. Validate Parameters ---
    if (!params || typeof params !== 'object') {
      logger.error('SET_VARIABLE: Missing or invalid parameters object.', {
        params,
      });
      return;
    }

    const { variable_name, value } = params;

    if (typeof variable_name !== 'string' || !variable_name.trim()) {
      logger.error(
        'SET_VARIABLE: Invalid or missing "variable_name" parameter. Must be a non-empty string.',
        { variable_name }
      );
      return;
    }
    const trimmedVariableName = variable_name.trim();

    if (value === undefined) {
      // This check is important because placeholder resolution might result in 'undefined'
      // if a placeholder cannot be found. We should not store a literal 'undefined'
      // unless explicitly intended by a JsonLogic rule that evaluates to undefined.
      logger.error(
        `SET_VARIABLE: Resolved "value" is undefined for variable "${trimmedVariableName}". Assignment skipped. Check placeholder resolution or JsonLogic evaluation if applicable.`,
        { params }
      );
      return;
    }

    // --- 2. Validate target variable store within executionContext ---
    // The variableStore is expected to be executionContext.evaluationContext.context
    const evaluationCtx = executionContext?.evaluationContext;
    const variableStore = evaluationCtx?.context;

    if (typeof variableStore !== 'object' || variableStore === null) {
      logger.error(
        'SET_VARIABLE: executionContext.evaluationContext.context is missing or invalid. Cannot store variable.',
        {
          hasExecutionContext: !!executionContext,
          hasEvaluationContext: !!evaluationCtx,
          typeOfVariableStore: typeof variableStore,
        }
      );
      return;
    }

    // --- 3. Evaluate Value if it's JsonLogic ---
    let finalValue;
    let evaluationOccurred = false;
    let evaluationThrewError = false; // <<< New flag to track if the try/catch caught an error

    const dataForJsonLogicEvaluation = evaluationCtx;

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      if (Object.keys(value).length > 0) {
        logger.debug(
          `SET_VARIABLE: Value for "${trimmedVariableName}" is a non-empty object. Attempting JsonLogic evaluation using executionContext.evaluationContext as data source.`
        );
        if (!dataForJsonLogicEvaluation) {
          logger.error(
            `SET_VARIABLE: Cannot evaluate JsonLogic value for variable "${trimmedVariableName}" because executionContext.evaluationContext is missing or invalid. Storing 'undefined'. Original value: ${JSON.stringify(value)}`,
            { hasExecutionContext: !!executionContext }
          );
          finalValue = undefined;
          evaluationOccurred = true;
          // evaluationThrewError = true; // Technically, this path is an error in setup, not JsonLogic eval itself.
          // The crucial part is that finalValue becomes undefined and evaluationOccurred is true.
          // The subsequent check will handle this. Let's see if this needs to be true.
          // If dataForJsonLogicEvaluation is missing, it's an issue *before* jsonLogic.apply is called.
          // The `evaluationThrewError` flag is specifically for errors *from* jsonLogic.apply().
        } else {
          try {
            finalValue = jsonLogic.apply(value, dataForJsonLogicEvaluation);
            evaluationOccurred = true;
            let evalResultString;
            try {
              evalResultString = JSON.stringify(finalValue);
            } catch {
              evalResultString = String(finalValue);
            }
            logger.debug(
              `SET_VARIABLE: JsonLogic evaluation successful for "${trimmedVariableName}". Result: ${evalResultString}`
            );
          } catch (evalError) {
            evaluationThrewError = true; // <<< Set the flag here
            logger.error(
              `SET_VARIABLE: Error evaluating JsonLogic value for variable "${trimmedVariableName}". Storing 'undefined'. Original value: ${JSON.stringify(value)}`,
              {
                errorMessage:
                  evalError instanceof Error
                    ? evalError.message
                    : String(evalError),
              }
            );
            finalValue = undefined;
            evaluationOccurred = true;
          }
        }
      } else {
        logger.debug(
          `SET_VARIABLE: Value for "${trimmedVariableName}" is an empty object {}. Using it directly.`
        );
        finalValue = value;
      }
    } else {
      finalValue = value;
      logger.debug(
        `SET_VARIABLE: Value for "${trimmedVariableName}" is not a non-empty object. Using directly.`
      );
    }

    if (evaluationOccurred && finalValue === undefined) {
      const originalValueString = JSON.stringify(params.value);
      if (evaluationThrewError) {
        // <<< Use the new flag here
        logger.error(
          `SET_VARIABLE: JsonLogic evaluation for variable "${trimmedVariableName}" failed with an error (see previous log). Assignment skipped. Original value: ${originalValueString}`
        );
      } else {
        // This case means JsonLogic was attempted, no error was thrown by jsonLogic.apply,
        // but the result was 'undefined'. Or, dataForJsonLogicEvaluation was missing.
        // If dataForJsonLogicEvaluation was missing, an error was already logged.
        // If the initial error for missing dataForJsonLogicEvaluation should also trigger the "failed with an error" message,
        // then that specific logger.error call should also set evaluationThrewError = true.
        // For now, let's assume evaluationThrewError is only for jsonLogic.apply() errors.

        // If `!dataForJsonLogicEvaluation` path was taken, `finalValue` is `undefined` and `evaluationOccurred` is `true`.
        // `evaluationThrewError` would be `false`. So it would come here.
        // We need to distinguish:
        // 1. JsonLogic engine itself threw error (evaluationThrewError = true)
        // 2. JsonLogic engine returned undefined (evaluationThrewError = false)
        // 3. JsonLogic could not be attempted due to missing dataForJsonLogicEvaluation (evaluationThrewError = false, but an error was already logged)

        // Let's refine: if an error regarding evaluation was logged for *any reason* related to attempting JsonLogic.
        // The previous check for `!dataForJsonLogicEvaluation` logs an error.
        // The `evaluationThrewError` is specific to `jsonLogic.apply`.
        // The *intent* of the second error/warning is to summarize *why* assignment is skipped if `finalValue` is `undefined` post-evaluation.

        // Consider if an error has already been logged in this evaluation block
        let priorEvalRelatedErrorLogged = evaluationThrewError;
        if (
          !dataForJsonLogicEvaluation &&
          Object.keys(value).length > 0 &&
          typeof value === 'object' &&
          !Array.isArray(value)
        ) {
          // This condition means we logged "Cannot evaluate JsonLogic value..."
          priorEvalRelatedErrorLogged = true;
        }

        if (priorEvalRelatedErrorLogged) {
          logger.error(
            `SET_VARIABLE: JsonLogic evaluation attempt for variable "${trimmedVariableName}" failed or could not proceed (see previous log). Assignment skipped. Original value: ${originalValueString}`
          );
        } else {
          // This means evaluationOccurred, finalValue is undefined, but no error was logged during the evaluation attempt.
          // e.g. JsonLogic rule like {"var": "this.does.not.exist"} which might resolve to undefined without throwing.
          logger.warn(
            `SET_VARIABLE: JsonLogic evaluation resulted in 'undefined' for variable "${trimmedVariableName}". Assignment skipped. Original value: ${originalValueString}`
          );
        }
      }
      return;
    }
    // If `value` was initially undefined (checked at the start) or if JsonLogic evaluation resulted in undefined,
    // we would have returned already. If we reach here with `finalValue === undefined` it means the original
    // `value` (non-object or empty object) was literally `undefined`, which is already handled by the first check on `value`.

    // --- 4. Implement Core Logic (Assignment into variableStore) ---
    let finalValueStringForLog;
    try {
      finalValueStringForLog = JSON.stringify(finalValue);
    } catch (e) {
      finalValueStringForLog = String(finalValue);
      logger.warn(
        `SET_VARIABLE: Could not JSON.stringify final value for logging (variable: "${trimmedVariableName}"). Using String() fallback. This might happen with circular structures or BigInts.`,
        { valueType: typeof finalValue }
      );
    }

    logger.info(
      `SET_VARIABLE: Setting context variable "${trimmedVariableName}" in evaluationContext.context to value: ${finalValueStringForLog}`
    );

    try {
      // Assign the final determined value to the correct context (variableStore)
      variableStore[trimmedVariableName] = finalValue;
    } catch (assignmentError) {
      logger.error(
        `SET_VARIABLE: Unexpected error during assignment for variable "${trimmedVariableName}" into evaluationContext.context.`,
        {
          error:
            assignmentError instanceof Error
              ? assignmentError.message
              : String(assignmentError),
          variableName: trimmedVariableName,
          // Do not log finalValue again if it's complex and caused stringify issues above
        }
      );
      // Depending on desired behavior, you might want to re-throw or simply return here
    }
  }
}

export default SetVariableHandler;
