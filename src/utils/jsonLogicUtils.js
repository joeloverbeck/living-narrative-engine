// src/utils/jsonLogicUtils.js

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

/**
 * Recursively emit warnings for any `var` expressions using bracket
 * notation in a JSON Logic rule.
 *
 * @param {object | any} rule - Rule object or value to inspect.
 * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger for warnings.
 * @returns {void}
 */
export function warnOnBracketPaths(rule, logger) {
  if (Array.isArray(rule)) {
    rule.forEach((item) => warnOnBracketPaths(item, logger));
    return;
  }
  if (rule && typeof rule === 'object') {
    if (Object.prototype.hasOwnProperty.call(rule, 'var')) {
      const value = rule.var;
      const path =
        typeof value === 'string'
          ? value
          : Array.isArray(value) && typeof value[0] === 'string'
            ? value[0]
            : null;
      if (path && (path.includes('[') || path.includes(']'))) {
        logger.warn(
          `Invalid var path "${path}" contains unsupported brackets.`
        );
      }
    }
    Object.values(rule).forEach((v) => warnOnBracketPaths(v, logger));
  }
}

export default isEmptyCondition;
