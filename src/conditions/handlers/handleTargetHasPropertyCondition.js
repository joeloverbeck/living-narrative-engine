// src/conditions/handlers/handleTargetHasPropertyCondition.js

/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../components/connectionsComponent.js').Connection} Connection */
/** @typedef {import('../../../data/schemas/item.schema.json').definitions.ConditionObject} ConditionObjectData */
/** @typedef {import('../../services/conditionEvaluationService.js').ConditionEvaluationContext} ConditionEvaluationContext */
/** @typedef {import('../../services/conditionEvaluationService.js').ConditionHandlerFunction} ConditionHandlerFunction */

import {getStringParam, getValueParam, getNestedProperty} from '../../utils/conditionUtils.js';

/**
 * Condition handler for 'target_has_property'.
 * Checks if the objectToCheck has a specific property (potentially nested or component-based) equal to an expected value.
 * @type {ConditionHandlerFunction}
 */
export const handleTargetHasPropertyCondition = (objectToCheck, context, conditionData) => {
    const {entityManager} = context;
    const propertyPath = getStringParam(conditionData, 'property_path'); // e.g., "state", "connectionId", "Health.current"
    const expectedValue = getValueParam(conditionData, 'expected_value'); // Use getValueParam as expectedValue can be any type

    // Note: Check specifically for `undefined` because `null` might be a valid expected value.
    if (propertyPath === null || typeof expectedValue === 'undefined') {
        console.warn(`[ConditionHandler] Missing property_path or expected_value for target_has_property`);
        return false;
    }

    // Use the refined nested property getter utility, passing entityManager
    const actualValue = getNestedProperty(objectToCheck, propertyPath, entityManager);

    // Comparison logic (strict equality)
    // console.log(`[ConditionHandler] target_has_property Check: Path='<span class="math-inline">\{propertyPath\}', Expected\='</span>{expectedValue}', Actual='${actualValue}'`); // Debug log
    return actualValue === expectedValue;
};