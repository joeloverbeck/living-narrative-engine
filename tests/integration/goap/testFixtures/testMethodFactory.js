/**
 * @file Test refinement method factory for GOAP integration tests
 * Creates test refinement methods for GOAP tasks
 */

/**
 * Creates a basic test refinement method
 *
 * @param {object} overrides - Method property overrides
 * @returns {object} Refinement method definition
 */
export function createTestMethod(overrides = {}) {
  return {
    id: 'test:method',
    precondition: { '==': [true, true] }, // Always applicable
    steps: [
      {
        stepType: 'primitive_action',
        actionId: 'test:action',
        targetBindings: {
          target: 'self',
        },
      },
    ],
    ...overrides,
  };
}

/**
 * Creates a consume food refinement method
 *
 * @returns {object} Consume method definition
 */
export function createConsumeMethod() {
  return {
    id: 'test:consume_method',
    precondition: { '==': [true, true] },
    steps: [
      {
        stepType: 'primitive_action',
        actionId: 'items:consume_item',
        targetBindings: {
          target: 'task.params.item',
        },
      },
    ],
  };
}

/**
 * Creates a multi-step method (move, pickup, consume)
 *
 * @returns {object} Multi-step method definition
 */
export function createMultiStepMethod() {
  return {
    id: 'test:multi_step_method',
    precondition: { '==': [true, true] },
    steps: [
      {
        stepType: 'primitive_action',
        actionId: 'world:move_to_location',
        targetBindings: {
          location: 'task.params.location',
        },
      },
      {
        stepType: 'primitive_action',
        actionId: 'items:pick_up_item',
        targetBindings: {
          target: 'task.params.item',
        },
      },
      {
        stepType: 'primitive_action',
        actionId: 'items:consume_item',
        targetBindings: {
          target: 'task.params.item',
        },
      },
    ],
  };
}

/**
 * Creates a method that will fail (for testing failure recovery)
 *
 * @returns {object} Failing method definition
 */
export function createFailingMethod() {
  return {
    id: 'test:failing_method',
    precondition: { '==': [false, true] }, // Never satisfied
    steps: [
      {
        stepType: 'primitive_action',
        actionId: 'test:impossible_action',
        targetBindings: {},
      },
    ],
  };
}

/**
 * Creates a conditional method with branching logic
 *
 * @returns {object} Conditional method definition
 */
export function createConditionalMethod() {
  return {
    id: 'test:conditional_method',
    precondition: { '==': [true, true] },
    steps: [
      {
        stepType: 'conditional',
        condition: {
          '==': [{ var: 'actor.components.core:inventory.has_item' }, true],
        },
        thenSteps: [
          {
            stepType: 'primitive_action',
            actionId: 'items:consume_item',
            targetBindings: { target: 'task.params.item' },
          },
        ],
        elseSteps: [
          {
            stepType: 'primitive_action',
            actionId: 'items:pick_up_item',
            targetBindings: { target: 'task.params.item' },
          },
          {
            stepType: 'primitive_action',
            actionId: 'items:consume_item',
            targetBindings: { target: 'task.params.item' },
          },
        ],
      },
    ],
  };
}
