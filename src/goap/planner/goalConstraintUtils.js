/**
 * Helpers for analyzing goal state structures.
 *
 * Numeric distance heuristics should only fire when the goal state is a
 * single-root numeric comparator (<=, <, >=, >). Composite roots like `and`
 * or structural goal expressions must bypass `#taskReducesDistance` so they
 * evaluate as regular booleans.
 *
 * @see specs/goap-system-specs.md
 */

const NUMERIC_COMPARATORS = new Set(['<=', '<', '>=', '>']);

/**
 * Determine whether the provided goal definition should activate numeric
 * distance heuristics.
 *
 * @param {object} goal - Goal definition with a goalState object
 * @returns {boolean} True if the goal has a pure numeric root comparator
 */
export function goalHasPureNumericRoot(goal) {
  if (!goal || typeof goal.goalState !== 'object' || goal.goalState === null) {
    return false;
  }

  const topLevelKeys = Object.keys(goal.goalState);
  if (topLevelKeys.length !== 1) {
    return false; // Mixed roots (and/or) treated as boolean per specs
  }

  return NUMERIC_COMPARATORS.has(topLevelKeys[0]);
}

export default {
  goalHasPureNumericRoot,
};
