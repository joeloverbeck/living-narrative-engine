// src/conditions/handlers/handleHealthBelowMaxCondition.js

/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../components/connectionsComponent.js').Connection} Connection */
/** @typedef {import('../../../data/schemas/item.schema.json').definitions.ConditionObject} ConditionObjectData */
/** @typedef {import('../../services/conditionEvaluationService.js').ConditionEvaluationContext} ConditionEvaluationContext */
/** @typedef {import('../../services/conditionEvaluationService.js').ConditionHandlerFunction} ConditionHandlerFunction */
/** @typedef {import('../../components/healthComponent.js').HealthComponent} HealthComponent */ // Example import

/**
 * Condition handler for 'health_below_max'.
 * Checks if the objectToCheck (expected Entity) has current health less than its maximum health.
 * @type {ConditionHandlerFunction}
 */
export const handleHealthBelowMaxCondition = (objectToCheck, context, conditionData) => {
    const {entityManager} = context;

    // Ensure objectToCheck is an Entity
    if (typeof objectToCheck?.getComponent !== 'function') return false;

    const HealthComponent = entityManager.componentRegistry.get('Health'); // Assuming 'Health'
    if (!HealthComponent) {
        console.warn("[ConditionHandler] Health component class not registered.");
        return false;
    }

    /** @type {HealthComponent | null} */
    const healthComponent = objectToCheck.getComponent(HealthComponent);

    // Check if component exists and has the required numeric properties
    if (!healthComponent || typeof healthComponent.current !== 'number' || typeof healthComponent.max !== 'number') {
        return false;
    }

    // Perform the check
    return healthComponent.current < healthComponent.max;
};