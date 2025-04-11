// src/conditions/handlers/handleTargetHasComponentCondition.js

/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../components/connectionsComponent.js').Connection} Connection */
/** @typedef {import('../../../data/schemas/item.schema.json').definitions.ConditionObject} ConditionObjectData */
/** @typedef {import('../../services/conditionEvaluationService.js').ConditionEvaluationContext} ConditionEvaluationContext */
/** @typedef {import('../../services/conditionEvaluationService.js').ConditionHandlerFunction} ConditionHandlerFunction */

import {getStringParam} from '../../utils/conditionUtils.js';

/**
 * Condition handler for 'target_has_component'.
 * Checks if the objectToCheck (expected Entity) has the specified component.
 * @type {ConditionHandlerFunction}
 */
export const handleTargetHasComponentCondition = (objectToCheck, context, conditionData) => {
    const {entityManager} = context;
    const componentName = getStringParam(conditionData, 'component_name'); // e.g., "Health"

    if (componentName === null) {
        console.warn(`[ConditionHandler] target_has_component condition missing required 'component_name' parameter.`);
        return false;
    }

    // Ensure objectToCheck is an Entity capable of having components
    if (typeof objectToCheck?.hasComponent !== 'function') {
        // console.warn(`[ConditionHandler] 'target_has_component' used on non-entity target. Condition fails.`);
        return false; // Not an entity, cannot have component
    }

    const ComponentClass = entityManager.componentRegistry.get(componentName);
    if (!ComponentClass) {
        console.warn(`[ConditionHandler] No component class registered for name "${componentName}". Cannot check 'target_has_component'.`);
        return false;
    }

    return objectToCheck.hasComponent(ComponentClass);
};