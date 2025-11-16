/**
 * @file Test goal factory for GOAP integration tests
 * Creates test GOAP goals (NOT actor component goals!)
 */

/**
 * Creates a basic test goal
 * @param {object} overrides - Goal property overrides
 * @returns {object} GOAP goal definition
 */
export function createTestGoal(overrides = {}) {
  return {
    id: 'test:goal',
    priority: 10,
    relevance: { '==': [true, true] }, // Always relevant
    goalState: { '==': [{ var: 'actor.test_satisfied' }, true] },
    ...overrides,
  };
}

/**
 * Creates a hunger-reduction goal
 * @returns {object} Hunger goal definition
 */
export function createHungerGoal() {
  return {
    id: 'test:reduce_hunger',
    priority: 10,
    relevance: {
      has_component: ['actor', 'test:hungry'],
    },
    goalState: {
      '!': [{ has_component: ['actor', 'test:hungry'] }],
    },
  };
}

/**
 * Creates a shelter-building goal
 * @returns {object} Shelter goal definition
 */
export function createShelterGoal() {
  return {
    id: 'test:build_shelter',
    priority: 10,
    relevance: {
      '!': [{ has_component: ['actor', 'test:has_shelter'] }],
    },
    goalState: {
      has_component: ['actor', 'test:has_shelter'],
    },
  };
}

/**
 * Creates an impossible goal (for failure testing)
 * @returns {object} Impossible goal definition
 */
export function createImpossibleGoal() {
  return {
    id: 'test:impossible_goal',
    priority: 10,
    relevance: { '==': [true, true] },
    goalState: {
      // Condition that can never be satisfied (no task can add this component)
      has_component: ['actor', 'test:impossible_state'],
    },
  };
}

/**
 * Creates a multi-step goal requiring complex planning
 * @returns {object} Complex goal definition
 */
export function createComplexGoal() {
  return {
    id: 'test:complex_task',
    priority: 10,
    relevance: { '==': [true, true] },
    goalState: {
      has_component: ['actor', 'test:task_complete'],
    },
  };
}
