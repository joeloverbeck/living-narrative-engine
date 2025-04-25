// src/conditions/operationHandlers/handleTargetHasPropertyCondition.js

/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../services/conditionEvaluationService.js').ConditionEvaluationContext} ConditionEvaluationContext */
/** @typedef {import('../../services/conditionEvaluationService.js').ConditionHandlerFunction} ConditionHandlerFunction */

import {getStringParam, getValueParam} from '../../utils/conditionParamUtils.js';
import {getContextValue} from '../../utils/conditionContextUtils.js';

/**
 * Condition handler for 'target_has_property'.
 * Checks if the objectToCheck has a specific property (potentially nested or component-based) equal to an expected value.
 * @type {ConditionHandlerFunction}
 */
export const handleTargetHasPropertyCondition = (objectToCheck, context, conditionData) => {
  const {dataAccess} = context;
  const propertyPath = getStringParam(conditionData, 'property_path');

  // Verify that the essential keys 'property_path' (resolved to non-null) AND 'expected_value' exist.
  const hasExpectedValueKey = conditionData && Object.prototype.hasOwnProperty.call(conditionData, 'expected_value');

  if (propertyPath === null || !hasExpectedValueKey) {
    // Use a warning message that aligns with the test expectation
    console.warn('[ConditionHandler] Missing property_path or expected_value in conditionData for target_has_property.');
    return false; // Return false because the condition definition is incomplete
  }
  // *** END ADDED CHECK ***

  // Now it's safe to get expectedValue, knowing the key exists (even if its value is null or undefined)
  const expectedValue = getValueParam(conditionData, 'expected_value');

  // Original logic follows...
  const actualValue = getContextValue(objectToCheck, propertyPath, dataAccess);

  console.log('Comparing actual:', actualValue, '(type:', typeof actualValue, ') with expected:', expectedValue, '(type:', typeof expectedValue, ')');

  return actualValue === expectedValue;
};