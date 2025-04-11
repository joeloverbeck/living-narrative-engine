// src/services/conditionEvaluationService.js

// Type Imports for JSDoc
/** @typedef {import('../../eventBus.js').default} EventBus */ // Keep for ActionMessage type, not for direct use
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

/**
 * Service responsible for evaluating condition objects against entities or connections.
 */
class ConditionEvaluationService {
    #entityManager;

    /**
     * @param {object} dependencies
     * @param {EntityManager} dependencies.entityManager - Required for component lookups.
     */
    constructor({entityManager}) {
        if (!entityManager) {
            throw new Error("ConditionEvaluationService requires an EntityManager dependency.");
        }
        this.#entityManager = entityManager;
        console.log("ConditionEvaluationService: Instance created.");
    }

    /**
     * Evaluates an array of conditions against a given object within a specific context.
     *
     * @param {Entity | Connection} objectToCheck - The entity or connection object the conditions are evaluated against.
     * @param {ConditionEvaluationContext} context - Contextual entities (user, potential targets).
     * @param {ConditionObjectData[] | undefined} conditions - The array of conditions to check.
     * @param {ConditionEvaluationOptions} options - Options including item name, check type, and fallback messages.
     * @returns {ConditionEvaluationResult} - Result indicating success/failure and relevant messages.
     */
    evaluateConditions(objectToCheck, context, conditions, options = {}) {
        /** @type {ActionMessage[]} */
        const messages = [];
        const {userEntity, targetEntityContext, targetConnectionContext} = context;
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
     * @param {Entity | Connection | null} obj
     * @returns {string}
     * @private
     */
    #getObjectName(obj) {
        if (!obj) return 'null object';

        // Check if it's an Entity (duck typing based on having getComponent)
        if (typeof obj.getComponent === 'function') {
            try {
                // Use the EntityManager to find the registered 'Name' component class
                const NameComponentClass = this.#entityManager.componentRegistry.get('Name');

                if (NameComponentClass) {
                    // Attempt to get the component instance using the retrieved class
                    const nameCompInstance = obj.getComponent(NameComponentClass);
                    // If the instance exists and has a 'value' property, use it
                    if (nameCompInstance && typeof nameCompInstance.value === 'string') {
                        return nameCompInstance.value;
                    }
                }
            } catch (error) {
                // Log potential errors during component lookup but don't crash
                console.warn(`ConditionEvaluationService: Error getting name component for entity ${obj.id}:`, error);
            }
            // Fallback to Entity ID if Name component/class isn't found or doesn't have a value
            return `Entity(${obj.id})`;

        } else if (obj.connectionId) { // Check if it's a Connection (duck typing)
            return obj.name || obj.direction || `Connection(${obj.connectionId})`;
        }

        return 'unknown object type'; // Fallback for other types
    }

    /**
     * Evaluates a single condition object against the target object (Entity or Connection), user entity, and context.
     * Handles property access carefully for different object types.
     * Uses EntityManager's component registry.
     *
     * @param {Entity | Connection} objectToCheck - The object the condition applies to.
     * @param {ConditionEvaluationContext} context - Contextual entities (user, potential targets).
     * @param {ConditionObjectData} condition - The condition data object.
     * @returns {boolean} - True if the condition is met, false otherwise.
     * @private
     */
    #evaluateSingleCondition(objectToCheck, context, condition) {
        const {userEntity} = context; // targetEntityContext, targetConnectionContext might be needed later
        const conditionType = condition.condition_type;

        // Parameter getter helpers (simplified)
        const getParam = (name, type) => {
            const value = condition[name];
            if (value === undefined || value === null) return null;
            if (type === 'number' && typeof value !== 'number') return null;
            if (type === 'string' && typeof value !== 'string') return null;
            if (type === 'boolean' && typeof value !== 'boolean') return null;
            // 'any' type doesn't need validation here
            return value;
        }
        const getNumberParam = (name, defaultValue = null) => getParam(name, 'number') ?? defaultValue;
        const getStringParam = (name, defaultValue = null) => getParam(name, 'string') ?? defaultValue;
        const getValueParam = (name) => getParam(name, 'any'); // Gets value without type check, used for expected_value


        // Helper for nested property access
        const getNestedProperty = (obj, propertyPath) => {
            if (!obj || !propertyPath) return undefined;
            const pathParts = propertyPath.split('.');
            let current = obj;
            for (const part of pathParts) {
                if (current === null || typeof current === 'undefined') return undefined;

                // If 'current' is an Entity, handle component access differently maybe?
                // For now, prioritize direct property access for simplicity, matching _evaluateCondition's original lean.
                // Component data access might require specific condition types (like 'component_property_check').
                if (typeof current.getComponent === 'function') {
                    // Allow direct access to entity ID
                    if (part === 'id') {
                        current = current.id;
                    }
                    // Simple component value access: Check if part matches a registered component name's property
                    else if (this.#entityManager.componentRegistry.has(part)) {
                        // This assumes the property path IS the component name, and we want the whole component object.
                        // To access a property *within* a component (e.g., Health.current), this needs extending.
                        // Let's refine this: If the path is 'ComponentName.propertyName'
                        const componentName = pathParts[0]; // Assume first part is Component name
                        const propertyName = pathParts[1]; // Assume second part is property name
                        if (pathParts.length === 2 && this.#entityManager.componentRegistry.has(componentName)) {
                            const ComponentClass = this.#entityManager.componentRegistry.get(componentName);
                            const componentInstance = current.getComponent(ComponentClass);
                            return componentInstance ? componentInstance[propertyName] : undefined;
                        } else {
                            console.warn(`ConditionEvaluationService: Complex component property path "${propertyPath}" not fully supported in 'target_has_property'. Trying direct access.`);
                            current = current[part]; // Fallback to direct access attempt
                        }

                    } else {
                        // Assume direct property access on the entity object itself (e.g., entity.someCustomProperty)
                        current = current[part];
                    }
                } else {
                    // If not an entity (e.g., Connection), assume direct property access
                    current = current[part];
                }
            }
            return current;
        };


        switch (conditionType) {
            // --- Conditions primarily about the USER ---
            case 'player_in_location': {
                const requiredLocationId = getStringParam('location_id');

                if (requiredLocationId === null) {
                    console.warn(`[ConditionEval] player_in_location condition missing required 'location_id' parameter.`);
                    return false; // Fail explicitly if parameter missing
                }

                const PositionComponentClass = this.#entityManager.componentRegistry.get('Position');

                if (!PositionComponentClass) {
                    console.warn("ConditionEvaluationService: Position component class not registered.");
                    return false;
                }

                if (!userEntity || typeof userEntity.getComponent !== 'function') {
                    console.error(`[ConditionEval] player_in_location: Invalid userEntity!`);
                    return false;
                }

                const userPosComp = userEntity.getComponent(PositionComponentClass);

                return userPosComp?.locationId === requiredLocationId;
            }
            case 'player_state': { // Kept for other player states if needed
                const requiredState = getStringParam('state');
                if (requiredState === null) return false;
                // TODO: Implement check against player state flags/components
                console.warn(`ConditionEvaluationService: Condition type 'player_state' ('${requiredState}') not implemented. Assuming false.`);
                return false;
            }

            // --- Conditions about the TARGET (objectToCheck) ---
            case 'target_has_component': { // Primarily for Entity targets
                const componentName = getStringParam('component_name'); // e.g., "Health"
                if (componentName === null) return false;

                // Ensure objectToCheck is an Entity
                if (typeof objectToCheck?.hasComponent !== 'function') {
                    // console.warn(`ConditionEvaluationService: Condition 'target_has_component' used on non-entity target. Condition fails.`);
                    return false; // Not an entity, cannot have component
                }

                const ComponentClass = this.#entityManager.componentRegistry.get(componentName);
                if (!ComponentClass) {
                    console.warn(`ConditionEvaluationService: No component class registered for name "${componentName}". Cannot check 'target_has_component'.`);
                    return false;
                }
                return objectToCheck.hasComponent(ComponentClass);
            }

            case 'target_has_property': { // Useful for both Entity and Connection
                const propertyPath = getStringParam('property_path'); // e.g., "state", "connectionId", "Health.current"
                const expectedValue = getValueParam('expected_value');
                if (propertyPath === null || typeof expectedValue === 'undefined') {
                    console.warn(`ConditionEvaluationService: Missing property_path or expected_value for target_has_property`);
                    return false;
                }

                // Use the refined nested property getter
                const actualValue = getNestedProperty(objectToCheck, propertyPath);

                // Comparison logic (strict equality)
                // console.log(`target_has_property Check: Path='${propertyPath}', Expected='${expectedValue}', Actual='${actualValue}'`); // Debug log
                return actualValue === expectedValue;
            }

            case 'target_distance': { // Primarily between Entities
                const maxDistance = getNumberParam('max_distance');
                const minDistance = getNumberParam('min_distance', 0);
                if (maxDistance === null || maxDistance < 0 || minDistance < 0 || maxDistance < minDistance) return false;

                // Ensure objectToCheck is an Entity
                if (typeof objectToCheck?.getComponent !== 'function') {
                    console.warn(`ConditionEvaluationService: Condition 'target_distance' used on non-entity target. Condition fails.`);
                    return false;
                }
                // Ensure user is an entity (should always be true based on context typing)
                if (typeof userEntity?.getComponent !== 'function') {
                    console.warn(`ConditionEvaluationService: User entity invalid for 'target_distance'. Condition fails.`);
                    return false;
                }

                if (objectToCheck.id === userEntity.id) return 0 >= minDistance && 0 <= maxDistance; // Distance to self is 0

                const PositionComponent = this.#entityManager.componentRegistry.get('Position');
                if (!PositionComponent) {
                    console.warn("ConditionEvaluationService: Position component class not registered.");
                    return false;
                }

                const userPosComp = userEntity.getComponent(PositionComponent);
                const targetPosComp = objectToCheck.getComponent(PositionComponent);

                // Cannot calculate distance if either is missing position or they are in different locations
                if (!userPosComp || !targetPosComp || !userPosComp.locationId || userPosComp.locationId !== targetPosComp.locationId) {
                    return false;
                }

                // Use 0 for undefined x/y coordinates within the same location
                const ux = userPosComp.x ?? 0;
                const uy = userPosComp.y ?? 0;
                const tx = targetPosComp.x ?? 0;
                const ty = targetPosComp.y ?? 0;

                const dx = ux - tx;
                const dy = uy - ty;
                const distanceSq = dx * dx + dy * dy;
                const minDistanceSq = minDistance * minDistance;
                const maxDistanceSq = maxDistance * maxDistance;

                return distanceSq >= minDistanceSq && distanceSq <= maxDistanceSq;
            }

            case 'health_below_max': { // Primarily for Entities
                if (typeof objectToCheck?.getComponent !== 'function') return false; // Not an entity
                const HealthComponent = this.#entityManager.componentRegistry.get('Health'); // Assuming 'Health'
                if (!HealthComponent) {
                    console.warn("ConditionEvaluationService: Health component class not registered.");
                    return false;
                }
                const healthComponent = objectToCheck.getComponent(HealthComponent);
                if (!healthComponent || typeof healthComponent.current !== 'number' || typeof healthComponent.max !== 'number') return false; // Missing component or invalid data
                return healthComponent.current < healthComponent.max;
            }

            case 'has_status_effect': { // Primarily for Entities
                if (typeof objectToCheck?.getComponent !== 'function') return false;
                const effectId = getStringParam('effect_id');
                if (effectId === null) return false;
                // TODO: Check StatusEffectsComponent on objectToCheck
                console.warn(`ConditionEvaluationService: Condition type 'has_status_effect' ('${effectId}') not implemented. Assuming false.`);
                return false;
            }

            case 'attribute_check': { // Primarily for Entities
                if (typeof objectToCheck?.getComponent !== 'function') return false;
                const attributeId = getStringParam('attribute_id');
                const comparison = getStringParam('comparison'); // e.g., '>=', '<', '=='
                const value = getValueParam('value');
                if (attributeId === null || comparison === null || typeof value === 'undefined') return false;
                // TODO: Get attribute value from AttributeComponent on objectToCheck and compare
                console.warn(`ConditionEvaluationService: Condition type 'attribute_check' ('${attributeId} ${comparison} ${value}') not implemented. Assuming false.`);
                return false;
            }

            // --- Conditions specifically about Connections ---
            // Example: Check if a connection (door/passage) is in a certain state
            case 'connection_state_is': {
                // This condition makes sense only if objectToCheck is a Connection
                if (!objectToCheck || typeof objectToCheck.getComponent === 'function' || !objectToCheck.connectionId) {
                    // console.warn(`ConditionEvaluationService: 'connection_state_is' used on non-connection object. Condition fails.`);
                    return false; // Not a connection object
                }
                const requiredState = getStringParam('state');
                if (requiredState === null) return false;
                return objectToCheck.state === requiredState;
            }


            default:
                console.warn(`ConditionEvaluationService: Encountered unknown condition_type '${conditionType}'. Assuming condition fails.`);
                return false;
        }
    }
}

export default ConditionEvaluationService;