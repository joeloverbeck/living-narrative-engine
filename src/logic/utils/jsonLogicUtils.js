// src/logic/utils/jsonLogicUtils.js

/**
 * Determine if a condition object is "empty".
 *
 * A condition is considered empty when it is a plain object (not an array)
 * with no own enumerable properties.
 *
 * @param {any} cond - Condition value to inspect.
 * @returns {boolean} `true` when the condition is an object with no keys.
 */
export function isEmptyCondition(cond) {
  return (
    cond !== null &&
    typeof cond === 'object' &&
    !Array.isArray(cond) &&
    Object.keys(cond).length === 0
  );
}

export default isEmptyCondition;
