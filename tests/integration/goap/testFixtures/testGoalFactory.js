/**
 * @file Test goal factory for GOAP integration tests
 * Creates test GOAP goals (NOT actor component goals!)
 */

import { validateGoalPaths } from '../../../../src/goap/planner/goalPathValidator.js';

const SHOULD_WARN_LITERAL_ACTOR_IDS = process.env.NODE_ENV === 'test';

/**
 *
 * @param goalDefinition
 */
function warnOnLiteralActorIds(goalDefinition) {
  if (!SHOULD_WARN_LITERAL_ACTOR_IDS || !goalDefinition?.goalState) {
    return;
  }

  const validation = validateGoalPaths(goalDefinition.goalState, {
    goalId: goalDefinition.id,
  });

  const literalActorViolations = validation.violations.filter(
    (violation) => violation.reason === 'literal-actor-id'
  );

  if (literalActorViolations.length === 0) {
    return;
  }

  const offenders = literalActorViolations
    .map((violation) => violation.path)
    .join(', ');
  // eslint-disable-next-line no-console -- intentional test-only guardrail warning
  console.warn(
    `[createTestGoal] Goal ${goalDefinition.id} references literal actor ID(s) (${offenders}) inside has_component. Replace them with the 'actor' alias before running multi-actor suites.`
  );
}

/**
 * Creates a basic test goal
 *
 * @param {object} overrides - Goal property overrides
 * @returns {object} GOAP goal definition
 */
export function createTestGoal(overrides = {}) {
  const goal = {
    id: 'test:goal',
    priority: 10,
    relevance: { '==': [true, true] }, // Always relevant
    goalState: { '==': [{ var: 'actor.test_satisfied' }, true] },
    ...overrides,
  };

  warnOnLiteralActorIds(goal);
  return goal;
}

/**
 * Creates a hunger-reduction goal
 *
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
 *
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
 *
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
 *
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
