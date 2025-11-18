/**
 * @file Shared helper builders for goal normalization/default scaffolding.
 */

/**
 * Returns a JSON-Logic rule that always resolves to true.
 * Useful as a permissive relevance/goalState placeholder during normalization.
 *
 * @returns {object}
 */
export function alwaysTrueCondition() {
  return { '==': [1, 1] };
}

/**
 * Builds a simple equality JSON-Logic matcher for a given variable path.
 *
 * @param {string} variablePath - JSON-Logic `var` identifier (e.g., 'actor.hp').
 * @param {any} expectedValue - Expected value to compare.
 * @returns {object}
 */
export function simpleStateMatcher(variablePath, expectedValue) {
  return {
    '==': [{ var: variablePath }, expectedValue],
  };
}

export default {
  alwaysTrueCondition,
  simpleStateMatcher,
};
