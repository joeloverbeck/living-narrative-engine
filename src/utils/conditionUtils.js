// src/utils/conditionUtils.js

/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../components/connectionsComponent.js').Connection} Connection */
/** @typedef {import('../../data/schemas/item.schema.json').definitions.ConditionObject} ConditionObjectData */

/**
 * Extracts a parameter from the condition data object, ensuring it matches the expected type.
 * Returns null if the parameter is missing, null, or of the wrong type.
 *
 * @param {ConditionObjectData} conditionData - The condition data object.
 * @param {string} name - The name of the parameter key.
 * @param {'string' | 'number' | 'boolean' | 'any'} type - The expected JavaScript type (or 'any').
 * @returns {any | null} The parameter value or null if invalid/missing.
 */
const getParam = (conditionData, name, type) => {
    const value = conditionData[name];
    if (value === undefined || value === null) return null;
    if (type === 'number' && typeof value !== 'number') return null;
    if (type === 'string' && typeof value !== 'string') return null;
    if (type === 'boolean' && typeof value !== 'boolean') return null;
    // 'any' type doesn't need validation here
    return value;
};

/**
 * Gets a number parameter from condition data.
 * @param {ConditionObjectData} conditionData - The condition data.
 * @param {string} name - Parameter name.
 * @param {number | null} [defaultValue=null] - Default value if missing or invalid.
 * @returns {number | null}
 */
export const getNumberParam = (conditionData, name, defaultValue = null) => {
    const val = getParam(conditionData, name, 'number');
    return typeof val === 'number' ? val : defaultValue;
};

/**
 * Gets a string parameter from condition data.
 * @param {ConditionObjectData} conditionData - The condition data.
 * @param {string} name - Parameter name.
 * @param {string | null} [defaultValue=null] - Default value if missing or invalid.
 * @returns {string | null}
 */
export const getStringParam = (conditionData, name, defaultValue = null) => {
    const val = getParam(conditionData, name, 'string');
    return typeof val === 'string' ? val : defaultValue;
};

/**
 * Gets a boolean parameter from condition data.
 * @param {ConditionObjectData} conditionData - The condition data.
 * @param {string} name - Parameter name.
 * @param {boolean | null} [defaultValue=null] - Default value if missing or invalid.
 * @returns {boolean | null}
 */
export const getBooleanParam = (conditionData, name, defaultValue = null) => {
    const val = getParam(conditionData, name, 'boolean');
    return typeof val === 'boolean' ? val : defaultValue;
}

/**
 * Gets any parameter value from condition data without strict type checking.
 * @param {ConditionObjectData} conditionData - The condition data.
 * @param {string} name - Parameter name.
 * @returns {any | undefined} The value or undefined if missing.
 */
export const getValueParam = (conditionData, name) => {
    return getParam(conditionData, name, 'any'); // Returns undefined if not present
};


/**
 * Safely retrieves a potentially nested property from an object (Entity or Connection).
 * Handles component access for Entities specifically (e.g., "Health.current").
 *
 * @param {Entity | Connection | null} obj - The object to access (Entity, Connection, etc.).
 * @param {string | null | undefined} propertyPath - The dot-separated path (e.g., "state", "Health.current", "id").
 * @param {EntityManager} entityManager - The EntityManager instance, needed for component lookups.
 * @returns {any | undefined} The value found at the path, or undefined if not found or invalid path/object.
 */
export const getNestedProperty = (obj, propertyPath, entityManager) => {
    if (!obj || !propertyPath) return undefined;

    const pathParts = propertyPath.split('.');
    let current = obj;

    for (let i = 0; i < pathParts.length; i++) {
        const part = pathParts[i];
        if (current === null || typeof current === 'undefined') return undefined;

        // Check if 'current' is an Entity (duck typing)
        if (typeof current.getComponent === 'function') {
            // Allow direct access to entity ID
            if (part === 'id' && pathParts.length === 1) {
                return current.id; // Return ID directly
            }

            // Check for component access pattern: "ComponentName.propertyName"
            if (pathParts.length === 2 && i === 0) { // Only check this pattern at the first level
                const componentName = part;
                const propertyName = pathParts[1]; // The next part

                if (entityManager.componentRegistry.has(componentName)) {
                    const ComponentClass = entityManager.componentRegistry.get(componentName);
                    const componentInstance = current.getComponent(ComponentClass);
                    // Return the property from the component instance, or undefined if component/property doesn't exist
                    return componentInstance ? componentInstance[propertyName] : undefined;
                }
            }

            // Fallback: Try direct property access on the entity object itself
            // This covers cases like a single-part path that isn't 'id' or isn't a registered component,
            // or complex paths not matching the "Component.property" pattern.
            current = current[part];

        } else {
            // If not an entity (e.g., Connection), assume direct property access
            current = current[part];
        }
    }
    // Return the final value after traversing the path
    return current;
};