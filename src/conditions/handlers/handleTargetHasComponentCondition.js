// src/conditions/operationHandlers/handleTargetHasComponentCondition.js

// Keep necessary imports
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../services/conditionEvaluationService.js').ConditionEvaluationContext} ConditionEvaluationContext */
/** @typedef {import('../../services/conditionEvaluationService.js').ConditionHandlerFunction} ConditionHandlerFunction */
// No longer need direct EntityManager import

import {getStringParam} from '../../utils/conditionParamUtils.js'

/**
 * Condition handler for 'target_has_component'.
 * Checks if the objectToCheck (expected Entity) has the specified component.
 * @type {ConditionHandlerFunction}
 */
export const handleTargetHasComponentCondition = (objectToCheck, context, conditionData) => {
    const {dataAccess} = context; // Use dataAccess
    const componentName = getStringParam(conditionData, 'component_name');

    if (componentName === null) {
        console.warn(`[ConditionHandler] target_has_component condition missing required 'component_name' parameter.`);
        return false;
    }

    // Ensure objectToCheck is an Entity capable of having components
    // Use hasComponent for check, but getComponent for type check is fine too
    if (typeof objectToCheck?.hasComponent !== 'function') {
        return false;
    }

    const ComponentClass = dataAccess.getComponentClassByKey(componentName);
    if (!ComponentClass) {
        console.warn(`[ConditionHandler] No component class found via dataAccess for name "${componentName}". Cannot check 'target_has_component'.`);
        return false;
    }

    // Use the retrieved class with the entity's hasComponent method
    return objectToCheck.hasComponent(ComponentClass);
};
