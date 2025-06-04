// src/utils/conditionParamUtils.js

// =========================================================================
// Parameter Getter Functions (Moved from conditionUtils.js)
// =========================================================================

/**
 * Extracts a parameter from the condition data object, ensuring it matches the expected type.
 * Reads directly from the condition object, not a nested 'params' object.
 * Returns undefined if the parameter is missing or of the wrong type.
 * Returns null if the parameter is explicitly null and type is 'any'.
 * Internal helper function.
 * @param {ConditionObjectData | null | undefined} conditionData - The condition data object.
 * @param {string} name - The name of the parameter key.
 * @param {'string' | 'number' | 'boolean' | 'any'} type - The expected JavaScript type (or 'any').
 * @returns {any | undefined | null} The parameter value or undefined/null if invalid/missing/explicitly null.
 */
const getParam = (conditionData, name, type) => {
  // Check if conditionData is actually an object before accessing properties
  if (!conditionData || typeof conditionData !== 'object') {
    return undefined;
  }

  const value = conditionData[name];

  // Check for undefined or null first
  if (value === undefined || value === null) {
    // Allow 'any' type to return null if the value is explicitly null
    // Return undefined if missing, null if explicitly null & type is 'any'
    return type === 'any' && value === null ? null : undefined;
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
 * @param {number | null} [defaultValue] - Default value if missing or invalid type.
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
 * @param {string | null} [defaultValue] - Default value if missing or invalid type.
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
 * @param {boolean | null} [defaultValue] - Default value if missing or invalid type.
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
 * @returns {any | undefined | null} The value, undefined if missing, or null if explicitly null.
 */
export const getValueParam = (conditionData, name) => {
  // Use 'any' type which handles explicit null correctly via getParam
  return getParam(conditionData, name, 'any');
};
