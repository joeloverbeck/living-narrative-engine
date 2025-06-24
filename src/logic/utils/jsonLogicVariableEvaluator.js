// src/logic/utils/jsonLogicVariableEvaluator.js
import jsonLogic from 'json-logic-js';

/**
 * Determine if the provided value should be treated as JsonLogic.
 *
 * @param {*} value - The value to inspect.
 * @returns {boolean} True if value is a non-empty plain object.
 * @private
 */
function shouldEvaluateAsLogic(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length > 0
  );
}

/**
 * Perform JsonLogic evaluation of a value.
 *
 * @param {object} value - JsonLogic rule to evaluate.
 * @param {import('../defs.js').JsonLogicEvaluationContext} evaluationContext - Data for evaluation.
 * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger for messages.
 * @param {string} [varName] - Optional variable name for logging.
 * @returns {{ result: any, error: Error | null }} Evaluation result and potential error.
 * @private
 */
function performJsonLogicEvaluation(value, evaluationContext, logger, varName) {
  try {
    const result = jsonLogic.apply(value, evaluationContext);
    let evalResultString;
    try {
      evalResultString = JSON.stringify(result);
    } catch {
      evalResultString = String(result);
    }
    logger.debug(
      `SET_VARIABLE: JsonLogic evaluation successful${
        varName ? ` for "${varName}"` : ''
      }. Result: ${evalResultString}`
    );
    return { result, error: null };
  } catch (error) {
    return { result: undefined, error };
  }
}

/**
 * Centralized error/warning logging for JsonLogic evaluation failures.
 *
 * @param {*} originalValue - Original value prior to evaluation.
 * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger for messages.
 * @param {boolean} evaluationThrewError - Whether evaluation threw an exception.
 * @param {boolean} contextMissing - Whether evaluation context was missing.
 * @param {string} [varName] - Optional variable name for logging.
 * @private
 */
function handleEvaluationError(
  originalValue,
  logger,
  evaluationThrewError,
  contextMissing,
  varName
) {
  const originalValueString = JSON.stringify(originalValue);

  if (evaluationThrewError) {
    logger.error(
      `SET_VARIABLE: JsonLogic evaluation${varName ? ` for variable "${varName}"` : ''} failed with an error (see previous log). Assignment skipped. Original value: ${originalValueString}`
    );
  } else if (contextMissing) {
    logger.error(
      `SET_VARIABLE: JsonLogic evaluation attempt${varName ? ` for variable "${varName}"` : ''} failed or could not proceed (see previous log). Assignment skipped. Original value: ${originalValueString}`
    );
  } else {
    logger.warn(
      `SET_VARIABLE: JsonLogic evaluation resulted in 'undefined'${varName ? ` for variable "${varName}"` : ''}. Assignment skipped. Original value: ${originalValueString}`
    );
  }
}

/**
 * Evaluate the value using JsonLogic if applicable.
 *
 * @description If the value is a non-empty object, it is treated as a JsonLogic rule and
 * evaluated against the provided context. Logs relevant debug information and errors.
 * When evaluation fails or results in undefined, the function returns `{ success: false }`.
 * @param {*} value - The value to potentially evaluate.
 * @param {import('../defs.js').JsonLogicEvaluationContext} evaluationContext - JsonLogic data context.
 * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger for debug/error messages.
 * @param {string} [varName] - Optional variable name for logging.
 * @param {import('../defs.js').OperationParams} [params] - Original operation params for error logs.
 * @param {boolean} [hasExecutionContext] - Whether an executionContext was supplied.
 * @returns {{ success: boolean, value?: any }} Evaluation result; `success` is false if assignment should be skipped.
 */
export function evaluateValue(
  value,
  evaluationContext,
  logger,
  varName,
  params,
  hasExecutionContext
) {
  let finalValue = value;
  let evaluationOccurred = false;
  let evaluationThrewError = false;

  if (shouldEvaluateAsLogic(value)) {
    logger.debug(
      `SET_VARIABLE: Value${varName ? ` for "${varName}"` : ''} is a non-empty object. Attempting JsonLogic evaluation using executionContext.evaluationContext as data source.`
    );
    if (!evaluationContext) {
      logger.error(
        `SET_VARIABLE: Cannot evaluate JsonLogic value${varName ? ` for variable "${varName}"` : ''} because executionContext.evaluationContext is missing or invalid. Storing 'undefined'. Original value: ${JSON.stringify(value)}`,
        { hasExecutionContext }
      );
      finalValue = undefined;
      evaluationOccurred = true;
    } else {
      const { result, error } = performJsonLogicEvaluation(
        value,
        evaluationContext,
        logger,
        varName
      );
      evaluationOccurred = true;
      if (error) {
        evaluationThrewError = true;
        logger.error(
          `SET_VARIABLE: Error evaluating JsonLogic value${varName ? ` for variable "${varName}"` : ''}. Storing 'undefined'. Original value: ${JSON.stringify(value)}`,
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
      `SET_VARIABLE: Value${varName ? ` for "${varName}"` : ''} is an empty object {}. Using it directly.`
    );
  } else {
    logger.debug(
      `SET_VARIABLE: Value${varName ? ` for "${varName}"` : ''} is not a non-empty object. Using directly.`
    );
  }

  if (evaluationOccurred && finalValue === undefined) {
    handleEvaluationError(
      params?.value,
      logger,
      evaluationThrewError,
      !evaluationContext && shouldEvaluateAsLogic(value),
      varName
    );
    return { success: false };
  }

  return { success: true, value: finalValue };
}
