// src/conditions/handlers/handleHealthBelowMaxCondition.js

// Keep necessary imports
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../services/conditionEvaluationService.js').ConditionEvaluationContext} ConditionEvaluationContext */
/** @typedef {import('../../services/conditionEvaluationService.js').ConditionHandlerFunction} ConditionHandlerFunction */
/** @typedef {import('../../components/healthComponent.js').HealthComponent} HealthComponent */
// No longer need direct EntityManager import

/**
 * Condition handler for 'health_below_max'.
 * Checks if the objectToCheck (expected Entity) has current health less than its maximum health.
 * @type {ConditionHandlerFunction}
 */
export const handleHealthBelowMaxCondition = (objectToCheck, context, conditionData) => {
    const {dataAccess} = context; // Use dataAccess

    // Ensure objectToCheck is an Entity
    if (typeof objectToCheck?.getComponent !== 'function') return false;

    // --- MODIFIED: Use dataAccess to get component class ---
    const HealthComponentClass = dataAccess.getComponentClassByKey('Health');
    if (!HealthComponentClass) {
        console.warn("[ConditionHandler] Health component class not found via dataAccess.");
        return false; // Or throw error depending on desired strictness
    }

    /** @type {HealthComponent | null} */
        // Use the retrieved class with the entity's getComponent method
    const healthComponent = objectToCheck.getComponent(HealthComponentClass);

    if (!healthComponent || typeof healthComponent.current !== 'number' || typeof healthComponent.max !== 'number') {
        return false;
    }

    return healthComponent.current < healthComponent.max;
};