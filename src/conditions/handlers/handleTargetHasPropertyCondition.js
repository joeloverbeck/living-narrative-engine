// src/conditions/handlers/handleTargetHasPropertyCondition.js

// Keep necessary imports
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../../data/schemas/item.schema.json').definitions.ConditionObject} ConditionObjectData */
/** @typedef {import('../../services/conditionEvaluationService.js').ConditionEvaluationContext} ConditionEvaluationContext */
/** @typedef {import('../../services/conditionEvaluationService.js').ConditionHandlerFunction} ConditionHandlerFunction */

// --- MODIFIED: Import getNestedProperty (ensure path is correct) ---
import {getStringParam, getValueParam, getNestedProperty} from '../../utils/conditionUtils.js';

/**
 * Condition handler for 'target_has_property'.
 * Checks if the objectToCheck has a specific property (potentially nested or component-based) equal to an expected value.
 * @type {ConditionHandlerFunction}
 */
export const handleTargetHasPropertyCondition = (objectToCheck, context, conditionData) => {
    const {dataAccess} = context; // Use dataAccess
    const propertyPath = getStringParam(conditionData, 'property_path');
    const expectedValue = getValueParam(conditionData, 'expected_value');

    if (propertyPath === null || typeof expectedValue === 'undefined') {
        console.warn(`[ConditionHandler] Missing property_path or expected_value for target_has_property`);
        return false;
    }

    const actualValue = getNestedProperty(objectToCheck, propertyPath, dataAccess);

    return actualValue === expectedValue;
};