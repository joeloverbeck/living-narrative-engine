/**
 * @file goalTypeDetector.js
 * @description Utility for detecting goal constraint types (equality, inequality, complex)
 * and determining overshoot handling behavior for GOAP planning.
 */

/**
 * Detect the type of goal constraint from JSON Logic expression.
 *
 * @param {object} goalState - JSON Logic goal expression
 * @returns {'equality'|'inequality'|'complex'|'unknown'} Goal type
 * @example
 * // Equality goal
 * detectGoalType({ '==': [{ var: 'hunger' }, 10] }); // 'equality'
 * @example
 * // Inequality goal
 * detectGoalType({ '<=': [{ var: 'hunger' }, 10] }); // 'inequality'
 * @example
 * // Complex goal
 * detectGoalType({ and: [{ '<=': [{ var: 'hunger' }, 10] }] }); // 'complex'
 */
export function detectGoalType(goalState) {
  if (!goalState || typeof goalState !== 'object') {
    return 'unknown';
  }

  // Equality operators
  if (goalState['=='] || goalState['===']) {
    return 'equality';
  }

  // Inequality operators
  if (
    goalState['<'] ||
    goalState['<='] ||
    goalState['>'] ||
    goalState['>='] ||
    goalState['!='] ||
    goalState['!==']
  ) {
    return 'inequality';
  }

  // Complex operators (and, or, not)
  if (goalState.and || goalState.or || goalState.not) {
    return 'complex';
  }

  return 'unknown';
}

/**
 * Check if overshoot is allowed for this goal type.
 *
 * Inequality goals (≤, ≥, <, >) allow overshoot because any value
 * in the valid range satisfies the constraint.
 *
 * Equality goals (==, ===) do not allow overshoot because they
 * require an exact value match.
 *
 * Complex goals conservatively disallow overshoot to prevent
 * unintended side effects.
 *
 * @param {object} goalState - JSON Logic goal expression
 * @returns {boolean} True if overshoot allowed
 * @example
 * // Inequality allows overshoot
 * allowsOvershoot({ '<=': [{ var: 'hunger' }, 10] }); // true
 * @example
 * // Equality does not allow overshoot
 * allowsOvershoot({ '==': [{ var: 'hunger' }, 10] }); // false
 */
export function allowsOvershoot(goalState) {
  const type = detectGoalType(goalState);

  switch (type) {
    case 'inequality':
      return true; // ≤, ≥, <, > allow overshoot

    case 'equality':
      return false; // == requires exact value

    case 'complex':
      // Conservative: disallow overshoot for complex goals
      // Could be enhanced to analyze nested constraints
      return false;

    default:
      return true; // Default: allow (conservative for planning)
  }
}

/**
 * Extract target value from equality goal (if applicable).
 *
 * Only works for equality goals with numeric right-hand side values.
 * Returns null for non-equality goals or non-numeric targets.
 *
 * @param {object} goalState - JSON Logic goal expression
 * @returns {number|null} Target value or null if not equality goal
 * @example
 * // Extract from equality goal
 * extractEqualityTarget({ '==': [{ var: 'gold' }, 100] }); // 100
 * @example
 * // Returns null for inequality
 * extractEqualityTarget({ '<=': [{ var: 'hunger' }, 10] }); // null
 * @example
 * // Returns null for non-numeric
 * extractEqualityTarget({ '==': [{ var: 'status' }, 'alive'] }); // null
 */
export function extractEqualityTarget(goalState) {
  if (!goalState || typeof goalState !== 'object') {
    return null;
  }

  if (goalState['==']) {
    const [_left, right] = goalState['=='];
    // Assume right side is constant
    return typeof right === 'number' ? right : null;
  }

  if (goalState['===']) {
    const [_left, right] = goalState['==='];
    return typeof right === 'number' ? right : null;
  }

  return null;
}

export default {
  detectGoalType,
  allowsOvershoot,
  extractEqualityTarget,
};
