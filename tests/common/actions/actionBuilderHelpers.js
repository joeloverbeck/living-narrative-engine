/**
 * @file Action builder helper functions for testing
 * @description Provides common test builders and validation helpers to reduce test boilerplate
 */

import { ActionDefinitionBuilder } from '../../../src/actions/builders/actionDefinitionBuilder.js';

/**
 * Creates a minimal valid action for testing
 *
 * @param {string} [id] - The action ID
 * @returns {object} Complete action definition
 * @example
 * const action = createTestAction('test:my-action');
 */
export function createTestAction(id = 'test:action') {
  return new ActionDefinitionBuilder(id)
    .withName('Test Action')
    .withDescription('A test action')
    .asBasicAction()
    .build();
}

/**
 * Creates a builder pre-configured for testing
 *
 * @param {string} [id] - The action ID
 * @returns {ActionDefinitionBuilder} Pre-configured builder
 * @example
 * const action = createTestBuilder('test:custom')
 *   .requiresComponent('test:component')
 *   .build();
 */
export function createTestBuilder(id = 'test:action') {
  return new ActionDefinitionBuilder(id)
    .withName('Test Action')
    .withDescription('A test action');
}

/**
 * Creates an invalid action definition for testing error scenarios
 *
 * @param {string} [id] - The action ID
 * @returns {ActionDefinitionBuilder} Incomplete builder for testing
 * @example
 * const invalidBuilder = createInvalidAction();
 * expect(() => invalidBuilder.build()).toThrow();
 */
export function createInvalidAction(id = 'test:invalid') {
  return new ActionDefinitionBuilder(id);
  // Deliberately incomplete for testing
}

/**
 * Validates that a definition matches expected structure
 *
 * @param {object} definition - The action definition to validate
 * @returns {boolean} True if structure is valid
 * @example
 * const action = createTestAction();
 * expect(validateActionStructure(action)).toBe(true);
 */
export function validateActionStructure(definition) {
  const requiredFields = ['id', 'name', 'description', 'scope', 'template', 'prerequisites', 'required_components'];
  
  for (const field of requiredFields) {
    if (!(field in definition)) {
      return false;
    }
  }
  
  // Check required_components structure
  if (!definition.required_components || !Array.isArray(definition.required_components.actor)) {
    return false;
  }
  
  // Check prerequisites is array
  if (!Array.isArray(definition.prerequisites)) {
    return false;
  }
  
  return true;
}

/**
 * Creates custom matchers for Jest
 */
export const actionMatchers = {
  /**
   * Custom Jest matcher to validate action definition structure
   *
   * @param {object} received - The received action definition
   * @returns {object} Jest matcher result
   */
  toBeValidActionDefinition: function(received) {
    const pass = validateActionStructure(received);
    
    if (pass) {
      return {
        message: () => `Expected ${JSON.stringify(received)} not to be a valid action definition`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected ${JSON.stringify(received)} to be a valid action definition`,
        pass: false,
      };
    }
  },

  /**
   * Custom Jest matcher to check if action has specific component requirement
   *
   * @param {object} received - The received action definition
   * @param {string} componentId - The component ID to check for
   * @returns {object} Jest matcher result
   */
  toRequireComponent: function(received, componentId) {
    const hasComponent = received.required_components?.actor?.includes(componentId);
    
    if (hasComponent) {
      return {
        message: () => `Expected action not to require component '${componentId}'`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected action to require component '${componentId}', but got: ${JSON.stringify(received.required_components?.actor || [])}`,
        pass: false,
      };
    }
  },

  /**
   * Custom Jest matcher to check if action has specific prerequisite
   *
   * @param {object} received - The received action definition
   * @param {string} conditionId - The condition ID to check for
   * @returns {object} Jest matcher result
   */
  toHavePrerequisite: function(received, conditionId) {
    const hasPrerequisite = received.prerequisites?.some(prereq => {
      if (typeof prereq === 'string') {
        return prereq === conditionId;
      }
      return prereq?.logic?.condition_ref === conditionId;
    });
    
    if (hasPrerequisite) {
      return {
        message: () => `Expected action not to have prerequisite '${conditionId}'`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected action to have prerequisite '${conditionId}', but got: ${JSON.stringify(received.prerequisites || [])}`,
        pass: false,
      };
    }
  }
};

/**
 * Creates a builder configured for movement actions
 *
 * @param {string} id - The action ID
 * @param {string} scopeId - The scope for targets
 * @returns {ActionDefinitionBuilder} Pre-configured movement builder
 */
export function createMovementActionBuilder(id, scopeId) {
  return new ActionDefinitionBuilder(id)
    .withName('Movement Action')
    .withDescription('A movement test action')
    .asTargetedAction(scopeId)
    .asMovementAction();
}

/**
 * Creates a builder configured for combat actions
 *
 * @param {string} id - The action ID
 * @param {string} scopeId - The scope for targets
 * @returns {ActionDefinitionBuilder} Pre-configured combat builder
 */
export function createCombatActionBuilder(id, scopeId) {
  return new ActionDefinitionBuilder(id)
    .withName('Combat Action')
    .withDescription('A combat test action')
    .asTargetedAction(scopeId)
    .asCombatAction();
}

/**
 * Creates a complex action with multiple components and prerequisites for testing
 *
 * @param {string} [id] - The action ID
 * @returns {object} Complex action definition
 */
export function createComplexTestAction(id = 'test:complex') {
  return new ActionDefinitionBuilder(id)
    .withName('Complex Test Action')
    .withDescription('A complex action for testing')
    .asTargetedAction('test:targets', 'perform on {target}')
    .requiresComponents(['test:comp1', 'test:comp2', 'test:comp3'])
    .withPrerequisites([
      'test:cond1',
      { condition: 'test:cond2', message: 'Custom failure message' },
      'test:cond3'
    ])
    .build();
}

export default {
  createTestAction,
  createTestBuilder,
  createInvalidAction,
  validateActionStructure,
  actionMatchers,
  createMovementActionBuilder,
  createCombatActionBuilder,
  createComplexTestAction
};