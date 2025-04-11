// src/services/conditionEvaluationService.js

// Type Imports for JSDoc
/** @typedef {import('../../eventBus.js').default} EventBus */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../components/connectionsComponent.js').Connection} Connection */
/** @typedef {import('../actions/actionTypes.js').ActionMessage} ActionMessage */
/** @typedef {import('../../data/schemas/item.schema.json').definitions.ConditionObject} ConditionObjectData */
/** @typedef {import('../components/healthComponent.js').HealthComponent} HealthComponent */ // Example component import
/** @typedef {import('../components/positionComponent.js').PositionComponent} PositionComponent */ // Example component import

/**
 * @typedef {object} ConditionEvaluationContext
 * @property {Entity} userEntity - The entity initiating the action.
 * @property {Entity | null} targetEntityContext - The target if it's an entity.
 * @property {Connection | null} targetConnectionContext - The target if it's a connection.
 * @property {EntityManager} entityManager - EntityManager instance for component lookups. // <-- Added
 */

/**
 * @callback ConditionHandlerFunction
 * @param {Entity | Connection} objectToCheck - The entity or connection the condition applies to.
 * @param {ConditionEvaluationContext} context - Contextual information including user and EntityManager.
 * @param {ConditionObjectData} conditionData - The full data object for the specific condition instance being evaluated.
 * @returns {boolean} - True if the condition is met, false otherwise.
 * @throws {Error} - Handlers can throw errors for critical issues (e.g., missing vital parameters).
 */


/**
 * @typedef {object} ConditionEvaluationOptions
 * @property {string} [itemName='(unknown item)'] - Name of the item/action context for messages.
 * @property {'Usability' | 'Target' | 'Generic'} [checkType='Generic'] - Type of check for messages.
 * @property {{ usability?: string, target?: string, default?: string }} [fallbackMessages={}] - Fallback failure messages.
 */

/**
 * @typedef {object} ConditionEvaluationResult
 * @property {boolean} success - True if all conditions passed, false otherwise.
 * @property {ActionMessage[]} messages - Array of internal/debugging messages generated during evaluation.
 * @property {string} [failureMessage] - The user-facing failure message if success is false.
 */

// ----- Import Handlers -----
// Import ALL handlers defined in the index file
import * as ConditionHandlers from '../conditions/handlers/index.js';

/**
 * Service responsible for evaluating condition objects against entities or connections.
 * Uses a handler pattern for modular condition logic.
 */
class ConditionEvaluationService {
    #entityManager;

    /** @type {Map<string, ConditionHandlerFunction>} */
    static #conditionHandlers = new Map();
    static #handlersRegistered = false; // Ensure registration happens only once

    /**
     * @param {object} dependencies
     * @param {EntityManager} dependencies.entityManager - Required for component lookups.
     */
    constructor({entityManager}) {
        if (!entityManager) {
            throw new Error("ConditionEvaluationService requires an EntityManager dependency.");
        }
        this.#entityManager = entityManager;

        // Register handlers if not already done (ensures it happens once per class load)
        if (!ConditionEvaluationService.#handlersRegistered) {
            ConditionEvaluationService.#registerHandlers();
            ConditionEvaluationService.#handlersRegistered = true;
        }
        console.log("ConditionEvaluationService: Instance created.");
    }

    /**
     * Registers all known condition handlers into the static map.
     * @private
     */
    static #registerHandlers() {
        ConditionEvaluationService.#conditionHandlers.set('player_in_location', ConditionHandlers.handlePlayerInLocationCondition);
        ConditionEvaluationService.#conditionHandlers.set('player_state', ConditionHandlers.handlePlayerStateCondition);
        ConditionEvaluationService.#conditionHandlers.set('target_has_component', ConditionHandlers.handleTargetHasComponentCondition);
        ConditionEvaluationService.#conditionHandlers.set('target_has_property', ConditionHandlers.handleTargetHasPropertyCondition);
        ConditionEvaluationService.#conditionHandlers.set('target_distance', ConditionHandlers.handleTargetDistanceCondition);
        ConditionEvaluationService.#conditionHandlers.set('health_below_max', ConditionHandlers.handleHealthBelowMaxCondition);
        ConditionEvaluationService.#conditionHandlers.set('has_status_effect', ConditionHandlers.handleHasStatusEffectCondition);
        ConditionEvaluationService.#conditionHandlers.set('attribute_check', ConditionHandlers.handleAttributeCheckCondition);
        ConditionEvaluationService.#conditionHandlers.set('connection_state_is', ConditionHandlers.handleConnectionStateIsCondition);
        // Add future handlers here...

        console.log(`ConditionEvaluationService: Registered ${ConditionEvaluationService.#conditionHandlers.size} condition handlers.`);
    }


    /**
     * Evaluates an array of conditions against a given object within a specific context.
     *
     * @param {Entity | Connection} objectToCheck - The entity or connection object the conditions are evaluated against.
     * @param {ConditionEvaluationContext} baseContext - Contextual entities (user, potential targets). MUST NOT include entityManager here.
     * @param {ConditionObjectData[] | undefined} conditions - The array of conditions to check.
     * @param {ConditionEvaluationOptions} options - Options including item name, check type, and fallback messages.
     * @returns {ConditionEvaluationResult} - Result indicating success/failure and relevant messages.
     */
    evaluateConditions(objectToCheck, baseContext, conditions, options = {}) {
        /** @type {ActionMessage[]} */
        const messages = [];
        // Create the full context including the entityManager instance
        const context = {...baseContext, entityManager: this.#entityManager};
        const {userEntity} = context; // Extract for convenience if needed below

        const {
            itemName = '(unknown item)',
            checkType = 'Generic',
            fallbackMessages = {}
        } = options;

        if (!conditions || conditions.length === 0) {
            return {
                success: true,
                messages: [{text: `No ${checkType} conditions to check for ${itemName}.`, type: "internal"}]
            };
        }

        // Determine name of the object being checked for logging
        const objectName = this.#getObjectName(objectToCheck);

        messages.push({
            text: `Checking ${checkType} conditions for ${itemName} against ${objectName}...`,
            type: 'internal'
        });

        for (const condition of conditions) {
            let conditionMet = false;
            let evaluationError = null;
            try {
                // Pass the FULL context (including entityManager) and the specific condition data
                conditionMet = this.#evaluateSingleCondition(objectToCheck, context, condition);
            } catch (error) {
                evaluationError = error;
                console.error(`ConditionEvaluationService: Error evaluating condition type '${condition.condition_type}' for ${itemName}:`, error);
                messages.push({
                    text: `ERROR evaluating condition ${condition.condition_type}: ${error.message}`,
                    type: 'error'
                });
                // Treat evaluation errors as condition failure for safety
                conditionMet = false;
            }

            const negate = condition.negate ?? false;
            const finalConditionMet = negate ? !conditionMet : conditionMet;

            if (!finalConditionMet) {
                // Determine appropriate failure message
                let failureMsg = condition.failure_message;
                if (!failureMsg) {
                    // Choose fallback based on checkType, then use a generic default
                    failureMsg = fallbackMessages[checkType.toLowerCase()]
                        ?? fallbackMessages.default
                        ?? `Condition failed for ${itemName}.`; // Last resort default
                }

                messages.push({
                    text: `${checkType} Condition Check Failed for ${itemName}: Type='${condition.condition_type}', Negated=${negate}, Reason='${failureMsg}'${evaluationError ? ' (Evaluation Error)' : ''}`,
                    type: 'internal'
                });
                // Return immediately on first failure
                return {success: false, messages, failureMessage: failureMsg};
            } else {
                messages.push({
                    text: `${checkType} Condition Check Passed for ${itemName}: Type='${condition.condition_type}', Negated=${negate}`,
                    type: 'internal'
                });
            }
        }

        // If loop completes, all conditions passed
        messages.push({text: `All ${checkType} conditions passed for ${itemName}.`, type: 'internal'});
        return {success: true, messages};
    }

    /**
     * Gets a display name for an entity or connection for logging.
     * (This method remains unchanged as it's used by evaluateConditions directly)
     * @param {Entity | Connection | null} obj
     * @returns {string}
     * @private
     */
    #getObjectName(obj) {
        if (!obj) return 'null object';

        if (typeof obj.getComponent === 'function') {
            try {
                const NameComponentClass = this.#entityManager.componentRegistry.get('Name');
                if (NameComponentClass) {
                    const nameCompInstance = obj.getComponent(NameComponentClass);
                    if (nameCompInstance && typeof nameCompInstance.value === 'string') {
                        return nameCompInstance.value;
                    }
                }
            } catch (error) {
                console.warn(`ConditionEvaluationService: Error getting name component for entity ${obj.id}:`, error);
            }
            return `Entity(${obj.id})`;

        } else if (obj.connectionId) {
            return obj.name || obj.direction || `Connection(${obj.connectionId})`;
        }

        return 'unknown object type';
    }

    /**
     * Evaluates a single condition by dispatching to the appropriate handler function.
     *
     * @param {Entity | Connection} objectToCheck - The object the condition applies to.
     * @param {ConditionEvaluationContext} context - Full context including user, targets, and EntityManager.
     * @param {ConditionObjectData} conditionData - The condition data object.
     * @returns {boolean} - True if the condition is met, false otherwise.
     * @throws {Error} - Can re-throw errors from handlers if not caught by the caller.
     * @private
     */
    #evaluateSingleCondition(objectToCheck, context, conditionData) {
        const conditionType = conditionData.condition_type;
        const handler = ConditionEvaluationService.#conditionHandlers.get(conditionType);

        if (handler) {
            // The try...catch block remains in evaluateConditions which calls this method.
            // We directly call the handler here.
            return handler(objectToCheck, context, conditionData);
        } else {
            console.warn(`ConditionEvaluationService: Encountered unknown condition_type '${conditionType}'. Assuming condition fails.`);
            return false;
        }
    }
}

export default ConditionEvaluationService;