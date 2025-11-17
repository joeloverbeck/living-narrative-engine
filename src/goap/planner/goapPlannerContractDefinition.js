/**
 * @file Shared GOAP planner contract definition.
 * Ensures validators, tests, and mocks rely on the same interface list.
 */

/**
 * Canonical GOAP planner contract definition.
 * Extend this when the planner surface grows.
 */
export const GOAP_PLANNER_CONTRACT = {
  dependencyName: 'IGoapPlanner',
  requiredMethods: ['plan', 'getLastFailure'],
  methodSignatures: {
    plan: 4, // actorId, goal, initialState, options
  },
};

/**
 * Return a copy of the required planner methods.
 * @returns {string[]}
 */
export function getRequiredPlannerMethods() {
  return [...GOAP_PLANNER_CONTRACT.requiredMethods];
}

/**
 * Collect all enumerable method names for a dependency instance, traversing prototypes.
 * @param {object} dependency - The planner instance or mock.
 * @returns {string[]} Sorted unique method names detected.
 */
export function collectMethodNames(dependency) {
  if (!dependency) return [];

  const methods = new Set();
  const visited = new Set();
  let current = dependency;

  while (current && current !== Object.prototype && !visited.has(current)) {
    visited.add(current);
    for (const name of Object.getOwnPropertyNames(current)) {
      if (name === 'constructor') continue;
      const descriptor = Object.getOwnPropertyDescriptor(current, name);
      if (descriptor && typeof descriptor.value === 'function') {
        methods.add(name);
      }
    }
    current = Object.getPrototypeOf(current);
  }

  return Array.from(methods).sort();
}

/**
 * Build a snapshot describing the planner dependency contract at runtime.
 * @param {object} dependency - Planner instance or mock.
 * @returns {object} Snapshot with required/provided metadata.
 */
export function createPlannerContractSnapshot(dependency) {
  const providedMethods = collectMethodNames(dependency);
  const requiredMethods = getRequiredPlannerMethods();
  const missingMethods = requiredMethods.filter(
    (method) => !providedMethods.includes(method)
  );

  return {
    dependency: GOAP_PLANNER_CONTRACT.dependencyName,
    requiredMethods,
    providedMethods,
    missingMethods,
  };
}

/**
 * Assert the planner plan signature matches expectations.
 * @param {Function} planFn - Planner plan function reference.
 * @returns {boolean} true when signature matches.
 */
export function hasValidPlanArity(planFn) {
  if (typeof planFn !== 'function') {
    return false;
  }
  const expected = GOAP_PLANNER_CONTRACT.methodSignatures.plan;
  return planFn.length === expected;
}
