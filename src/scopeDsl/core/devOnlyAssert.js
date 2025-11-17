/**
 * Throws an error when a developer-only invariant fails outside production builds.
 *
 * The helper intentionally no-ops during production deployments so we do not
 * crash live games when optional adapters lag behind the engine contract.
 *
 * @param {boolean} condition - Condition that must be truthy in non-production builds.
 * @param {string} message - Error message used when the assertion fails.
 */
export function devOnlyAssert(condition, message) {
  const nodeEnv = typeof process !== 'undefined' ? process.env?.NODE_ENV : 'production';

  if (nodeEnv === 'production') {
    return;
  }

  if (!condition) {
    const error = new Error(message);
    error.name = 'ScopeDslDevAssertionError';
    throw error;
  }
}

export default devOnlyAssert;
