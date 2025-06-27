import ScopeCycleError from '../../errors/scopeCycleError.js';

/**
 * Creates a cycle detector that tracks scope traversal and detects circular references.
 *
 * @returns {{enter: function(string): void, leave: function(): void}} Cycle detector with enter/leave methods
 */
export default function createCycleDetector() {
  const stack = [];
  return {
    enter(key) {
      if (stack.includes(key)) {
        throw new ScopeCycleError(`Cycle: ${[...stack, key].join(' -> ')}`, [...stack, key]);
      }
      stack.push(key);
    },
    leave() { stack.pop(); }
  };
}