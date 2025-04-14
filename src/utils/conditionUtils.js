// src/utils/conditionUtils.js

/** @typedef {import('../services/conditionEvaluationService.js').ConditionDataAccess} ConditionDataAccess */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../components/connectionsComponent.js').Connection} Connection */
/** @typedef {import('../../data/schemas/item.schema.json').definitions.ConditionObject} ConditionObjectData */
/** @typedef {import('../components/baseComponent.js').default} BaseComponent */ // For type hints

// =========================================================================
// Parameter Getter Functions (Refactored getParam)
// =========================================================================

/**
 * Extracts a parameter from the condition data object, ensuring it matches the expected type.
 * Reads directly from the condition object, not a nested 'params' object.
 * Returns undefined if the parameter is missing or of the wrong type.
 * Returns null if the parameter is explicitly null and type is 'any'.
 *
 * @param {ConditionObjectData | null | undefined} conditionData - The condition data object.
 * @param {string} name - The name of the parameter key.
 * @param {'string' | 'number' | 'boolean' | 'any'} type - The expected JavaScript type (or 'any').
 * @returns {any | undefined | null} The parameter value or undefined/null if invalid/missing/explicitly null.
 */
const getParam = (conditionData, name, type) => {
    const value = conditionData?.[name];

    // Check for undefined or null first
    if (value === undefined || value === null) {
        // Allow 'any' type to return null if the value is explicitly null
        // Return undefined if missing, null if explicitly null & type is 'any'
        return (type === 'any' && value === null) ? null : undefined;
    }

    // Type checking based on the expected type
    if (type === 'number' && typeof value !== 'number') return undefined;
    if (type === 'string' && typeof value !== 'string') return undefined;
    if (type === 'boolean' && typeof value !== 'boolean') return undefined;
    // 'any' type accepts any value that passed the null/undefined check above

    return value;
};


/**
 * Gets a number parameter from condition data object.
 * @param {ConditionObjectData | null | undefined} conditionData - The condition data.
 * @param {string} name - Parameter name.
 * @param {number | null} [defaultValue=null] - Default value if missing or invalid type.
 * @returns {number | null}
 */
export const getNumberParam = (conditionData, name, defaultValue = null) => {
    const val = getParam(conditionData, name, 'number');
    return typeof val === 'number' ? val : defaultValue;
};

/**
 * Gets a string parameter from condition data object.
 * @param {ConditionObjectData | null | undefined} conditionData - The condition data.
 * @param {string} name - Parameter name.
 * @param {string | null} [defaultValue=null] - Default value if missing or invalid type.
 * @returns {string | null}
 */
export const getStringParam = (conditionData, name, defaultValue = null) => {
    const val = getParam(conditionData, name, 'string');
    return typeof val === 'string' ? val : defaultValue;
};

/**
 * Gets a boolean parameter from condition data object.
 * @param {ConditionObjectData | null | undefined} conditionData - The condition data.
 * @param {string} name - Parameter name.
 * @param {boolean | null} [defaultValue=null] - Default value if missing or invalid type.
 * @returns {boolean | null}
 */
export const getBooleanParam = (conditionData, name, defaultValue = null) => {
    const val = getParam(conditionData, name, 'boolean');
    return typeof val === 'boolean' ? val : defaultValue;
};

/**
 * Gets any parameter value from condition data object without strict type checking (but checks presence).
 * @param {ConditionObjectData | null | undefined} conditionData - The condition data.
 * @param {string} name - Parameter name.
 * @returns {any | undefined} The value or undefined if missing. Note: Explicit `null` in JSON is returned as `null`.
 */
export const getValueParam = (conditionData, name) => {
    return getParam(conditionData, name, 'any');
};


// =========================================================================
// Nested Property Getter (No changes needed here based on this issue)
// =========================================================================
/**
 * Safely retrieves a potentially nested property from an object (Entity or Connection).
 * Handles component access for Entities specifically (e.g., "Health.current") using the provided data accessor.
 *
 * @param {Entity | Connection | BaseComponent | any | null} obj - The object to access (Entity, Connection, Component, potentially plain object).
 * @param {string | null | undefined} propertyPath - The dot-separated path (e.g., "state", "Health.current", "id").
 * @param {ConditionDataAccess | null} [dataAccess=null] - The data accessor instance, needed for component lookups on Entities.
 * @returns {any | undefined} The value found at the path, or undefined if not found or invalid path/object.
 */
export const getNestedProperty = (obj, propertyPath, dataAccess = null) => {
    if (!obj || typeof propertyPath !== 'string' || propertyPath === '') {
        return undefined;
    }

    const pathParts = propertyPath.split('.');
    let current = obj;

    for (let i = 0; i < pathParts.length; i++) {
        const part = pathParts[i];
        // Check for null/undefined current object before trying to access properties
        if (current === null || typeof current === 'undefined') {
            return undefined;
        }

        // Special handling for Entities to check for component access first
        // Duck-typing check for an Entity
        if (dataAccess && typeof current.getComponent === 'function') {
            /** @type {Entity} */
            const currentEntity = current;

            // Direct 'id' property access on entity
            if (part === 'id' && pathParts.length === 1) {
                return currentEntity.id;
            }

            // Check if the first part looks like a component access pattern
            if (pathParts.length > 1 && i === 0) {
                const componentName = part;

                const ComponentClass = dataAccess.getComponentClassByKey(componentName);
                if (ComponentClass) {
                    const componentInstance = currentEntity.getComponent(ComponentClass);
                    if (componentInstance) {
                        // Check if the *next* part is the final property we need from the component
                        if (i === pathParts.length - 2) {
                            const propertyName = pathParts[i + 1]; // Get the next part name
                            // Return the property value or undefined if it doesn't exist
                            return propertyName in componentInstance ? componentInstance[propertyName] : undefined;
                        } else {
                            // Path is longer (e.g., Component.Prop.NestedProp)
                            // Set current to the component instance, and let the next loop iteration handle the property access on it.
                            current = componentInstance;
                            // *** REMOVED i++ FROM HERE ***
                            continue; // Skip the rest of this iteration, proceed to the next part (e.g., 'status')
                        }
                    } else {
                        return undefined; // Component instance not found on entity
                    }
                }
                // If ComponentClass wasn't found by key, fall through to direct property access on the entity,
                // which will likely fail and return undefined if 'part' isn't a direct entity property.
            }

            // Fallback/Direct property access on the entity or (in later iterations) component instance
            // This handles entity.directProp or componentInstance.someProp
            if (part in current) {
                current = current[part];
            } else {
                return undefined; // Property not found directly on entity/component instance
            }

        } else {
            // Direct property access for non-entities (like connections) or when dataAccess is missing
            if (typeof current === 'object' && part in current) {
                current = current[part];
            } else {
                // Cannot access property 'part' on the current value (might be primitive or property missing)
                // If this isn't the last part of the path, we definitely can't go further.
                // If it is the last part, the property simply wasn't found.
                return undefined;
            }
        }
    }
    // If the loop completes, 'current' holds the final value
    return current;
};