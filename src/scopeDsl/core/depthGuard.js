import ScopeDepthError from '../../errors/scopeDepthError.js';

/**
 * Creates a depth guard that ensures expression depth does not exceed the specified maximum
 *
 * @param {number} maxDepth - The maximum allowed depth
 * @returns {{ensure: Function}} Object with ensure method for depth validation
 */
export default function createDepthGuard(maxDepth) {
  return {
    ensure(level) {
      if (level > maxDepth) {
        throw new ScopeDepthError(
          `Expression depth limit exceeded (max ${maxDepth})`,
          level,
          maxDepth
        );
      }
    },
  };
}
