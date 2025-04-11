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
        if (current === null || typeof current === 'undefined') {
            return undefined;
        }

        // Special handling for Entities to check for component access first
        // Duck-typing check for an Entity
        if (dataAccess && typeof current.getComponent === 'function') {
            /** @type {Entity} */
            const currentEntity = current;

            if (part === 'id' && pathParts.length === 1) {
                return currentEntity.id;
            }

            if (pathParts.length > 1 && i === 0) {
                const componentName = part;
                const propertyName = pathParts[1];

                const ComponentClass = dataAccess.getComponentClassByKey(componentName);

                if (ComponentClass) {
                    const componentInstance = currentEntity.getComponent(ComponentClass);

                    if (componentInstance) {
                        if (i === pathParts.length - 2) {
                            // Check if property exists before accessing
                            return propertyName in componentInstance ? componentInstance[propertyName] : undefined;
                        } else {
                            current = componentInstance;
                            i++; // Skip the property name part in the next iteration
                            continue;
                        }
                    } else {
                        return undefined;
                    }
                }
                // Fall through if not a component access pattern
            }

            // Fallback/Direct property access on the entity/component
            if (part in current) {
                current = current[part];
            } else {
                return undefined;
            }

        } else {
            // Direct property access for non-entities or when dataAccess is missing
            if (typeof current === 'object' && part in current) {
                current = current[part];
            } else {
                // Also handle non-object cases gracefully if path continues
                if (i < pathParts.length - 1) { // Check if it's not the last part
                    return undefined; // Cannot access property on non-object/primitive if path continues
                }
                // If it's the last part, the primitive itself might be the value (e.g., checking 'state' on a connection)
                // Let the loop finish and return current
                return undefined; // If property not found in object
            }
        }
    }
    return current;
};