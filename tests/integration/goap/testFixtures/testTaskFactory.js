/**
 * @file Test task factory for GOAP integration tests
 * Creates test GOAP tasks (planning-time tasks)
 */

/**
 * Creates a basic test task
 * @param {object} overrides - Task property overrides
 * @returns {object} GOAP task definition
 */
export function createTestTask(overrides = {}) {
  return {
    id: 'test:task',
    structuralGates: null, // No filtering by default
    planningPreconditions: [],
    planningEffects: [
      {
        type: 'ADD_COMPONENT',
        parameters: {
          entityId: 'actor',
          componentId: 'test:goal_satisfied',
          componentData: {},
        },
      },
    ],
    refinementMethods: ['test:method'],
    fallbackBehavior: 'replan',
    ...overrides,
  };
}

/**
 * Creates a consume nourishing item task
 * @returns {object} Consume task definition
 */
export function createConsumeTask() {
  return {
    id: 'test:consume_nourishing_item',
    structuralGates: null,
    planningPreconditions: [
      {
        description: 'Actor must be hungry',
        condition: {
          has_component: ['actor', 'test:hungry'],
        },
      },
    ],
    planningEffects: [
      {
        type: 'REMOVE_COMPONENT',
        parameters: {
          entityId: 'actor',
          componentId: 'test:hungry',
        },
      },
    ],
    refinementMethods: ['test:consume_method'],
    fallbackBehavior: 'replan',
  };
}

/**
 * Creates a gather resources task
 * @returns {object} Gather task definition
 */
export function createGatherTask() {
  return {
    id: 'test:gather_resources',
    structuralGates: null,
    planningPreconditions: [],
    planningEffects: [
      {
        type: 'ADD_COMPONENT',
        parameters: {
          entityId: 'actor',
          componentId: 'test:has_resources',
          componentData: {},
        },
      },
    ],
    refinementMethods: ['test:gather_method'],
    fallbackBehavior: 'replan',
  };
}

/**
 * Creates a build shelter task
 * @returns {object} Build task definition
 */
export function createBuildShelterTask() {
  return {
    id: 'test:build_shelter',
    structuralGates: null,
    planningPreconditions: [
      {
        description: 'Actor must have resources',
        condition: {
          has_component: ['actor', 'test:has_resources'],
        },
      },
    ],
    planningEffects: [
      {
        type: 'ADD_COMPONENT',
        parameters: {
          entityId: 'actor',
          componentId: 'test:has_shelter',
          componentData: {},
        },
      },
    ],
    refinementMethods: ['test:build_method'],
    fallbackBehavior: 'replan',
  };
}

/**
 * Creates a task with replan fallback behavior
 * @returns {object} Task with replan fallback
 */
export function createReplanTask() {
  return {
    id: 'test:replan_task',
    structuralGates: null,
    planningPreconditions: [],
    planningEffects: [],
    refinementMethods: ['test:failing_method'],
    fallbackBehavior: 'replan',
  };
}

/**
 * Creates a task with fail fallback behavior
 * @returns {object} Task with fail fallback
 */
export function createFailTask() {
  return {
    id: 'test:fail_task',
    structuralGates: null,
    planningPreconditions: [],
    planningEffects: [],
    refinementMethods: ['test:failing_method'],
    fallbackBehavior: 'fail',
  };
}

/**
 * Creates a task with continue fallback behavior
 * @returns {object} Task with continue fallback
 */
export function createContinueTask() {
  return {
    id: 'test:continue_task',
    structuralGates: null,
    planningPreconditions: [],
    planningEffects: [],
    refinementMethods: ['test:failing_method'],
    fallbackBehavior: 'continue',
  };
}
