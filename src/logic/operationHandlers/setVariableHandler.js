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
import { assertParamsObject } from '../../utils/handlerUtils/paramsUtils.js';
import { tryWriteContextVariable } from '../../utils/contextVariableUtils.js';

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
   * @description Determine if the provided value should be treated as JsonLogic.
   * @param {*} value - The value to inspect.
   * @returns {boolean} True if value is a non-empty plain object.
   * @private
   */
  #shouldEvaluateAsLogic(value) {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      Object.keys(value).length > 0
    );
  }

  /**
   * @description Perform JsonLogic evaluation of a value.
   * @param {object} value - JsonLogic rule to evaluate.
   * @param {BaseJsonLogicEvaluationContext} evaluationContext - Data for evaluation.
   * @param {string} varName - Variable name for logging.
   * @returns {{ result: any, error: Error | null }} Evaluation result and potential error.
   * @private
   */
  #performJsonLogicEvaluation(value, evaluationContext, varName) {
    try {
      const result = jsonLogic.apply(value, evaluationContext);
      let evalResultString;
      try {
        evalResultString = JSON.stringify(result);
      } catch {
        evalResultString = String(result);
      }
      this.#logger.debug(
        `SET_VARIABLE: JsonLogic evaluation successful for "${varName}". Result: ${evalResultString}`
      );
      return { result, error: null };
    } catch (error) {
      return { result: undefined, error };
    }
  }

  /**
   * @description Centralized error/warning logging for JsonLogic evaluation failures.
   * @param {string} varName - Variable being assigned.
   * @param {*} originalValue - Original value prior to evaluation.
   * @param {boolean} evaluationThrewError - Whether evaluation threw an exception.
   * @param {boolean} contextMissing - Whether evaluation context was missing.
   * @private
   */
  #handleEvaluationError(
    varName,
    originalValue,
    evaluationThrewError,
    contextMissing
  ) {
    const logger = this.#logger;
    const originalValueString = JSON.stringify(originalValue);

    if (evaluationThrewError) {
      logger.error(
        `SET_VARIABLE: JsonLogic evaluation for variable "${varName}" failed with an error (see previous log). Assignment skipped. Original value: ${originalValueString}`
      );
    } else if (contextMissing) {
      logger.error(
        `SET_VARIABLE: JsonLogic evaluation attempt for variable "${varName}" failed or could not proceed (see previous log). Assignment skipped. Original value: ${originalValueString}`
      );
    } else {
      logger.warn(
        `SET_VARIABLE: JsonLogic evaluation resulted in 'undefined' for variable "${varName}". Assignment skipped. Original value: ${originalValueString}`
      );
    }
  }

  /**
   * @description Evaluate the value using JsonLogic if applicable.
   * @param {*} value - The value to potentially evaluate.
   * @param {string} varName - The variable name for logging.
   * @param {BaseJsonLogicEvaluationContext} evaluationContext - JsonLogic data context.
   * @param {OperationParams} params - Original operation params for error logs.
   * @param {boolean} hasExecutionContext - Whether an executionContext was supplied.
   * @returns {{ success: boolean, value?: any }} Evaluation result; `success` is false if assignment should be skipped.
   * @private
   */
  #evaluateValue(
    value,
    varName,
    evaluationContext,
    params,
    hasExecutionContext
  ) {
    const logger = this.#logger;
    let finalValue = value;
    let evaluationOccurred = false;
    let evaluationThrewError = false;

    if (this.#shouldEvaluateAsLogic(value)) {
      logger.debug(
        `SET_VARIABLE: Value for "${varName}" is a non-empty object. Attempting JsonLogic evaluation using executionContext.evaluationContext as data source.`
      );
      if (!evaluationContext) {
        logger.error(
          `SET_VARIABLE: Cannot evaluate JsonLogic value for variable "${varName}" because executionContext.evaluationContext is missing or invalid. Storing 'undefined'. Original value: ${JSON.stringify(value)}`,
          { hasExecutionContext }
        );
        finalValue = undefined;
        evaluationOccurred = true;
      } else {
        const { result, error } = this.#performJsonLogicEvaluation(
          value,
          evaluationContext,
          varName
        );
        evaluationOccurred = true;
        if (error) {
          evaluationThrewError = true;
          logger.error(
            `SET_VARIABLE: Error evaluating JsonLogic value for variable "${varName}". Storing 'undefined'. Original value: ${JSON.stringify(value)}`,
            {
              errorMessage:
                error instanceof Error ? error.message : String(error),
            }
          );
          finalValue = undefined;
        } else {
          finalValue = result;
        }
      }
    } else if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
    ) {
      logger.debug(
        `SET_VARIABLE: Value for "${varName}" is an empty object {}. Using it directly.`
      );
    } else {
      logger.debug(
        `SET_VARIABLE: Value for "${varName}" is not a non-empty object. Using directly.`
      );
    }

    if (evaluationOccurred && finalValue === undefined) {
      this.#handleEvaluationError(
        varName,
        params.value,
        evaluationThrewError,
        !evaluationContext && this.#shouldEvaluateAsLogic(value)
      );
      return { success: false };
    }

    return { success: true, value: finalValue };
  }

  /**
   * @description Store the variable in executionContext.evaluationContext.context.
   * @param {string} name - Variable name.
   * @param {*} value - Value to store.
   * @param {OperationExecutionContext} executionContext - Execution context providing the variable store.
   * @private
   */
  #storeVariable(name, value, executionContext) {
    const logger = this.#logger;
    let finalValueStringForLog;
    try {
      finalValueStringForLog = JSON.stringify(value);
    } catch (e) {
      finalValueStringForLog = String(value);
      logger.warn(
        `SET_VARIABLE: Could not JSON.stringify final value for logging (variable: "${name}"). Using String() fallback. This might happen with circular structures or BigInts.`,
        { valueType: typeof value }
      );
    }

    logger.debug(
      `SET_VARIABLE: Setting context variable "${name}" in evaluationContext.context to value: ${finalValueStringForLog}`
    );

    const result = tryWriteContextVariable(
      name,
      value,
      executionContext,
      undefined,
      logger
    );
    if (!result.success) {
      logger.error(
        `SET_VARIABLE: Unexpected error during assignment for variable "${name}" into evaluationContext.context.`,
        {
          variableName: name,
        }
      );
    }
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
    if (!assertParamsObject(params, logger, 'SET_VARIABLE')) {
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
    const evalResult = this.#evaluateValue(
      value,
      trimmedVariableName,
      evaluationCtx,
      params,
      !!executionContext
    );
    if (!evalResult.success) {
      return;
    }

    // --- 4. Store the variable ---
    this.#storeVariable(
      trimmedVariableName,
      evalResult.value,
      executionContext
    );
  }
}

export default SetVariableHandler;
