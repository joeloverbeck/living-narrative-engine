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
/** @typedef {import('../components/component.js').default} Component */ // Generic component type

// ----- NEW: Condition Data Access Interface -----
/**
 * @typedef {object} ConditionDataAccess
 * @property {(componentKey: string) => Function | null} getComponentClassByKey - Retrieves a registered component class constructor by its JSON key.
 * @property {(entity: Entity, componentKeyOrClass: string | Function) => Component | null} getComponentForEntity - Retrieves a component instance from an entity, using either the key or class.
 * // Add more methods like findEntityById if handlers require them later
 */

/**
 * @typedef {object} ConditionEvaluationContext
 * @property {Entity} userEntity - The entity initiating the action.
 * @property {Entity | null} targetEntityContext - The target if it's an entity.
 * @property {Connection | null} targetConnectionContext - The target if it's a connection.
 * @property {ConditionDataAccess} dataAccess - Provides focused access to entity/component data.
 */

/**
 * @callback ConditionHandlerFunction
 * @param {Entity | Connection} objectToCheck - The entity or connection the condition applies to.
 * @param {ConditionEvaluationContext} context - Contextual information including user and the data accessor.
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
        // Implementation remains the same as provided
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
                    return null;
                }
                try {
                    return /** @type {Component | null} */ (entity.getComponent(ComponentClass));
                } catch (e) {
                    console.error(`[DataAccessor] Error getting component ${ComponentClass?.name || componentKeyOrClass} for entity ${entity.id}:`, e);
                    return null;
                }
            },
        });
    }

    /**
     * Registers all known condition handlers into the static map.
     * @private
     */
    static #registerHandlers() {
        // Registration remains the same as provided
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
     * Orchestrates the evaluation loop, handles negation and errors, and determines the final result.
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

        // --- Context and Options Setup ---
        const context = {
            ...baseContext,
            dataAccess: this.#dataAccessor // Inject the data accessor
        };
        const {userEntity} = context;

        // Ensure options have defaults
        const populatedOptions = {
            itemName: '(unknown item)',
            checkType: 'Generic',
            fallbackMessages: {},
            ...options // User-provided options override defaults
        };
        const {itemName, checkType} = populatedOptions;


        // --- Handle Empty Conditions ---
        if (!conditions || conditions.length === 0) {
            return {
                success: true,
                messages: [{text: `No ${checkType} conditions to check for ${itemName}.`, type: "internal"}]
            };
        }

        // --- Start Logging ---
        const objectName = this.#getObjectName(objectToCheck, context.dataAccess);
        messages.push({
            text: `Checking ${checkType} conditions for ${itemName} against ${objectName}...`,
            type: 'internal'
        });

        // --- Condition Evaluation Loop ---
        for (const condition of conditions) {
            let conditionMet = false;
            let evaluationError = null;

            // 1. Evaluate Single Condition (with Error Handling)
            try {
                conditionMet = this.#evaluateSingleCondition(objectToCheck, context, condition);
            } catch (error) {
                evaluationError = error;
                console.error(`ConditionEvaluationService: Error evaluating condition type '${condition.condition_type}' for ${itemName}:`, error);
                messages.push({
                    text: `ERROR evaluating condition ${condition.condition_type}: ${error.message}`,
                    type: 'error'
                });
                // Treat errors as the condition not being met
                conditionMet = false;
            }

            // 2. Apply Negation
            const negate = condition.negate ?? false;
            const finalConditionMet = negate ? !conditionMet : conditionMet;

            // 3. Handle Failure
            if (!finalConditionMet) {
                // Determine the user-facing failure message using the helper
                const failureMsg = this.#determineFailureMessage(condition, populatedOptions);

                // Log internal failure details
                messages.push({
                    text: `${checkType} Condition Check Failed for ${itemName}: Type='${condition.condition_type}', Negated=${negate}, Reason='${failureMsg}'${evaluationError ? ' (Evaluation Error)' : ''}`,
                    type: 'internal'
                });

                // Return failure result immediately
                return {success: false, messages, failureMessage: failureMsg};
            }
            // 4. Handle Success (Log internal success for this condition)
            else {
                messages.push({
                    text: `${checkType} Condition Check Passed for ${itemName}: Type='${condition.condition_type}', Negated=${negate}`,
                    type: 'internal'
                });
            }
        }

        // --- All Conditions Passed ---
        messages.push({text: `All ${checkType} conditions passed for ${itemName}.`, type: 'internal'});
        return {success: true, messages};
    }

    /**
     * Determines the appropriate user-facing failure message for a failed condition.
     * Uses the specific message from the condition, fallback messages based on check type,
     * a default fallback, or a final generic message.
     *
     * @param {ConditionObjectData} condition - The condition object that failed.
     * @param {Required<ConditionEvaluationOptions>} options - The populated evaluation options.
     * @returns {string} The determined user-facing failure message.
     * @private
     */
    #determineFailureMessage(condition, options) {
        const {itemName, checkType, fallbackMessages} = options;

        // 1. Use specific failure message from the condition data if available
        if (condition.failure_message) {
            return condition.failure_message;
        }

        // 2. Use fallback message specific to the check type (lowercase key) if available
        const typeSpecificFallback = fallbackMessages[checkType.toLowerCase()];
        if (typeSpecificFallback) {
            return typeSpecificFallback;
        }

        // 3. Use the default fallback message if available
        if (fallbackMessages.default) {
            return fallbackMessages.default;
        }

        // 4. Use a final generic default message
        // Consider making this more generic if needed, but matching original logic for now.
        return `Condition failed for ${itemName}.`;
    }


    /**
     * Gets a display name for an entity or connection for logging.
     * (Implementation remains the same as provided)
     * @param {Entity | Connection | null} obj
     * @param {ConditionDataAccess} dataAccess - Pass the accessor for component lookup.
     * @returns {string}
     * @private
     */
    #getObjectName(obj, dataAccess) {
        if (!obj) return 'null object';

        if (typeof obj.getComponent === 'function') {
            const entity = /** @type {Entity} */ (obj);
            try {
                const NameComponentClass = dataAccess.getComponentClassByKey('Name');
                if (NameComponentClass) {
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
            const connection = /** @type {Connection} */ (obj);
            return connection.name || connection.direction || `Connection(${connection.connectionId})`;
        }

        return 'unknown object type';
    }

    /**
     * Evaluates a single condition by dispatching to the appropriate handler function.
     * (Implementation remains the same as provided)
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
            return handler(objectToCheck, context, conditionData);
        } else {
            console.warn(`ConditionEvaluationService: Encountered unknown condition_type '${conditionType}'. Assuming condition fails.`);
            // Throwing an error might be better for maintainability, but sticking to original logic for now.
            // throw new Error(`Unknown condition_type: ${conditionType}`);
            return false;
        }
    }
}

export default ConditionEvaluationService;