// src/services/conditionEvaluationService.js

// Type Imports for JSDoc
/** @typedef {import('../../eventBus.js').default} EventBus */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */ // Keep for constructor and internal use
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../components/connectionsComponent.js').Connection} Connection */
/** @typedef {import('../actions/actionTypes.js').ActionMessage} ActionMessage */
/** @typedef {import('../../data/schemas/item.schema.json').definitions.ConditionObject} ConditionObjectData */
/** @typedef {import('../components/healthComponent.js').HealthComponent} HealthComponent */
/** @typedef {import('../components/positionComponent.js').PositionComponent} PositionComponent */
/** @typedef {import('../components/baseComponent.js').default} BaseComponent */ // Generic component type

// ----- NEW: Condition Data Access Interface -----
/**
 * @typedef {object} ConditionDataAccess
 * @property {(componentKey: string) => Function | null} getComponentClassByKey - Retrieves a registered component class constructor by its JSON key.
 * @property {(entity: Entity, componentKeyOrClass: string | Function) => BaseComponent | null} getComponentForEntity - Retrieves a component instance from an entity, using either the key or class.
 * // Add more methods like findEntityById if handlers require them later
 */

/**
 * @typedef {object} ConditionEvaluationContext
 * @property {Entity} userEntity - The entity initiating the action.
 * @property {Entity | null} targetEntityContext - The target if it's an entity.
 * @property {Connection | null} targetConnectionContext - The target if it's a connection.
 * @property {ConditionDataAccess} dataAccess - Provides focused access to entity/component data. // <-- MODIFIED
 */

/**
 * @callback ConditionHandlerFunction
 * @param {Entity | Connection} objectToCheck - The entity or connection the condition applies to.
 * @param {ConditionEvaluationContext} context - Contextual information including user and the data accessor. // <-- MODIFIED (comment)
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
import * as ConditionHandlers from '../conditions/handlers/index.js';

// ----- Import Utilities -----
// Assume getNestedProperty exists and needs refactoring
import {getNestedProperty} from '../utils/conditionUtils.js'; // Adjust path if needed

/**
 * Service responsible for evaluating condition objects against entities or connections.
 * Uses a handler pattern for modular condition logic.
 */
class ConditionEvaluationService {
    #entityManager;
    /** @type {ConditionDataAccess} */
    #dataAccessor; // Store the accessor implementation

    /** @type {Map<string, ConditionHandlerFunction>} */
    static #conditionHandlers = new Map();
    static #handlersRegistered = false;

    /**
     * @param {object} dependencies
     * @param {EntityManager} dependencies.entityManager - Required for data lookups.
     */
    constructor({entityManager}) {
        if (!entityManager) {
            throw new Error("ConditionEvaluationService requires an EntityManager dependency.");
        }
        this.#entityManager = entityManager;

        this.#dataAccessor = this.#createDataAccessor(entityManager);

        if (!ConditionEvaluationService.#handlersRegistered) {
            ConditionEvaluationService.#registerHandlers();
            ConditionEvaluationService.#handlersRegistered = true;
        }
        console.log("ConditionEvaluationService: Instance created.");
    }

    /**
     * Creates the internal implementation of the ConditionDataAccess interface.
     * @param {EntityManager} entityManagerInstance
     * @returns {ConditionDataAccess}
     * @private
     */
    #createDataAccessor(entityManagerInstance) {
        return Object.freeze({
            getComponentClassByKey: (componentKey) => {
                return entityManagerInstance.componentRegistry.get(componentKey) || null;
            },
            getComponentForEntity: (entity, componentKeyOrClass) => {
                if (!entity || typeof entity.getComponent !== 'function') {
                    return null;
                }
                let ComponentClass = null;
                if (typeof componentKeyOrClass === 'string') {
                    ComponentClass = entityManagerInstance.componentRegistry.get(componentKeyOrClass);
                } else if (typeof componentKeyOrClass === 'function') {
                    ComponentClass = componentKeyOrClass;
                }

                if (!ComponentClass) {
                    // console.warn(`[DataAccessor] Component class not found for key/class: ${componentKeyOrClass}`);
                    return null;
                }
                try {
                    // Type assertion might be needed in TS, but okay in JS
                    return /** @type {BaseComponent | null} */ (entity.getComponent(ComponentClass));
                } catch (e) {
                    // Handles cases where getComponent might throw if class not registered, etc.
                    console.error(`[DataAccessor] Error getting component ${ComponentClass?.name || componentKeyOrClass} for entity ${entity.id}:`, e);
                    return null;
                }
            },
            // Add findEntityById if needed:
            // findEntityById: (entityId) => {
            //     return entityManagerInstance.getEntityInstance(entityId) || null;
            // }
        });
    }

    /**
     * Registers all known condition handlers into the static map.
     * @private
     */
    static #registerHandlers() {
        // Registration remains the same
        ConditionEvaluationService.#conditionHandlers.set('player_in_location', ConditionHandlers.handlePlayerInLocationCondition);
        ConditionEvaluationService.#conditionHandlers.set('player_state', ConditionHandlers.handlePlayerStateCondition);
        ConditionEvaluationService.#conditionHandlers.set('target_has_component', ConditionHandlers.handleTargetHasComponentCondition);
        ConditionEvaluationService.#conditionHandlers.set('target_has_property', ConditionHandlers.handleTargetHasPropertyCondition);
        ConditionEvaluationService.#conditionHandlers.set('target_distance', ConditionHandlers.handleTargetDistanceCondition);
        ConditionEvaluationService.#conditionHandlers.set('health_below_max', ConditionHandlers.handleHealthBelowMaxCondition);
        ConditionEvaluationService.#conditionHandlers.set('has_status_effect', ConditionHandlers.handleHasStatusEffectCondition);
        ConditionEvaluationService.#conditionHandlers.set('attribute_check', ConditionHandlers.handleAttributeCheckCondition);
        ConditionEvaluationService.#conditionHandlers.set('connection_state_is', ConditionHandlers.handleConnectionStateIsCondition);
        console.log(`ConditionEvaluationService: Registered ${ConditionEvaluationService.#conditionHandlers.size} condition handlers.`);
    }


    /**
     * Evaluates an array of conditions against a given object within a specific context.
     *
     * @param {Entity | Connection} objectToCheck - The entity or connection object the conditions are evaluated against.
     * @param {Omit<ConditionEvaluationContext, 'dataAccess'>} baseContext - Contextual entities (user, potential targets). MUST NOT include dataAccess here.
     * @param {ConditionObjectData[] | undefined} conditions - The array of conditions to check.
     * @param {ConditionEvaluationOptions} options - Options including item name, check type, and fallback messages.
     * @returns {ConditionEvaluationResult} - Result indicating success/failure and relevant messages.
     */
    evaluateConditions(objectToCheck, baseContext, conditions, options = {}) {
        /** @type {ActionMessage[]} */
        const messages = [];

        const context = {
            ...baseContext,
            dataAccess: this.#dataAccessor // Pass the pre-built accessor
        };
        const {userEntity} = context;

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

        const objectName = this.#getObjectName(objectToCheck, context.dataAccess);

        messages.push({
            text: `Checking ${checkType} conditions for ${itemName} against ${objectName}...`,
            type: 'internal'
        });

        for (const condition of conditions) {
            let conditionMet = false;
            let evaluationError = null;
            try {
                // Pass the FULL context (including dataAccess) and the specific condition data
                conditionMet = this.#evaluateSingleCondition(objectToCheck, context, condition);
            } catch (error) {
                // ... (error handling remains the same)
                evaluationError = error;
                console.error(`ConditionEvaluationService: Error evaluating condition type '${condition.condition_type}' for ${itemName}:`, error);
                messages.push({
                    text: `ERROR evaluating condition ${condition.condition_type}: ${error.message}`,
                    type: 'error'
                });
                conditionMet = false;
            }

            const negate = condition.negate ?? false;
            const finalConditionMet = negate ? !conditionMet : conditionMet;

            if (!finalConditionMet) {
                let failureMsg = condition.failure_message;
                if (!failureMsg) {
                    failureMsg = fallbackMessages[checkType.toLowerCase()]
                        ?? fallbackMessages.default
                        ?? `Condition failed for ${itemName}.`;
                }
                messages.push({
                    text: `${checkType} Condition Check Failed for ${itemName}: Type='${condition.condition_type}', Negated=${negate}, Reason='${failureMsg}'${evaluationError ? ' (Evaluation Error)' : ''}`,
                    type: 'internal'
                });
                return {success: false, messages, failureMessage: failureMsg};
            } else {
                messages.push({
                    text: `${checkType} Condition Check Passed for ${itemName}: Type='${condition.condition_type}', Negated=${negate}`,
                    type: 'internal'
                });
            }
        }

        messages.push({text: `All ${checkType} conditions passed for ${itemName}.`, type: 'internal'});
        return {success: true, messages};
    }

    /**
     * Gets a display name for an entity or connection for logging.
     * @param {Entity | Connection | null} obj
     * @param {ConditionDataAccess} dataAccess - Pass the accessor for component lookup. // <-- MODIFIED
     * @returns {string}
     * @private
     */
    #getObjectName(obj, dataAccess) { // <-- MODIFIED Signature
        if (!obj) return 'null object';

        // Check if it's an entity (duck typing)
        if (typeof obj.getComponent === 'function') {
            /** @type {Entity} */ // Type hint for clarity
            const entity = obj;
            try {
                // ----- MODIFIED: Use dataAccess to get Name component class -----
                const NameComponentClass = dataAccess.getComponentClassByKey('Name');
                if (NameComponentClass) {
                    // Use the direct getComponent method on the entity instance
                    const nameCompInstance = entity.getComponent(NameComponentClass);
                    if (nameCompInstance && typeof nameCompInstance.value === 'string') {
                        return nameCompInstance.value;
                    }
                }
            } catch (error) {
                console.warn(`ConditionEvaluationService: Error getting name component for entity ${entity.id}:`, error);
            }
            return `Entity(${entity.id})`;

        } else if (obj.connectionId) {
            /** @type {Connection} */ // Type hint
            const connection = obj;
            return connection.name || connection.direction || `Connection(${connection.connectionId})`;
        }

        return 'unknown object type';
    }

    /**
     * Evaluates a single condition by dispatching to the appropriate handler function.
     * (Signature and core logic remain the same, but the `context` it passes now contains `dataAccess`)
     * @param {Entity | Connection} objectToCheck
     * @param {ConditionEvaluationContext} context - Full context including user, targets, and dataAccess.
     * @param {ConditionObjectData} conditionData
     * @returns {boolean}
     * @throws {Error}
     * @private
     */
    #evaluateSingleCondition(objectToCheck, context, conditionData) {
        const conditionType = conditionData.condition_type;
        const handler = ConditionEvaluationService.#conditionHandlers.get(conditionType);

        if (handler) {
            // Call handler with the updated context (containing dataAccess)
            return handler(objectToCheck, context, conditionData);
        } else {
            console.warn(`ConditionEvaluationService: Encountered unknown condition_type '${conditionType}'. Assuming condition fails.`);
            return false;
        }
    }
}

export default ConditionEvaluationService;