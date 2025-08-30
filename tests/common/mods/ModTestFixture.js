/**
 * @file Factory for creating specialized mod test environments
 * @description Provides high-level test environment creation for common mod testing scenarios
 */

import { jest } from '@jest/globals';
import { createRuleTestEnvironment } from '../engine/systemLogicTestEnv.js';
import { expandMacros } from '../../../src/utils/macroUtils.js';
import logSuccessMacro from '../../../data/mods/core/macros/logSuccessAndEndTurn.macro.json';
import { ATTEMPT_ACTION_ID } from '../../../src/constants/eventIds.js';

import { ModTestHandlerFactory } from './ModTestHandlerFactory.js';
import { ModEntityBuilder, ModEntityScenarios } from './ModEntityBuilder.js';
import { ModAssertionHelpers } from './ModAssertionHelpers.js';

/**
 * Factory class for creating specialized mod test environments.
 * 
 * Provides high-level abstractions for setting up common mod testing scenarios,
 * eliminating the boilerplate setup required in individual test files.
 */
export class ModTestFixture {
  /**
   * Creates a test fixture for a mod action.
   * 
   * @param {string} modId - The mod identifier (e.g., 'intimacy', 'positioning')
   * @param {string} actionId - The action identifier (e.g., 'kiss_cheek', 'kneel_before')
   * @param {object} ruleFile - The rule definition JSON
   * @param {object} conditionFile - The condition definition JSON
   * @param {object} options - Additional configuration options
   * @returns {ModActionTestFixture} Configured test fixture for the action
   */
  static forAction(modId, actionId, ruleFile, conditionFile, options = {}) {
    return new ModActionTestFixture(modId, actionId, ruleFile, conditionFile, options);
  }

  /**
   * Creates a test fixture for a mod rule.
   * 
   * @param {string} modId - The mod identifier
   * @param {string} ruleId - The rule identifier
   * @param {object} ruleFile - The rule definition JSON
   * @param {object} conditionFile - The condition definition JSON
   * @param {object} options - Additional configuration options
   * @returns {ModRuleTestFixture} Configured test fixture for the rule
   */
  static forRule(modId, ruleId, ruleFile, conditionFile, options = {}) {
    return new ModRuleTestFixture(modId, ruleId, ruleFile, conditionFile, options);
  }

  /**
   * Creates a test fixture for a specific mod category.
   * 
   * @param {string} categoryName - The mod category (e.g., 'positioning', 'intimacy')
   * @param {object} options - Configuration options
   * @returns {ModCategoryTestFixture} Configured test fixture for the category
   */
  static forCategory(categoryName, options = {}) {
    return new ModCategoryTestFixture(categoryName, options);
  }
}

/**
 * Base class for mod test fixtures.
 */
class BaseModTestFixture {
  constructor(modId, options = {}) {
    this.modId = modId;
    this.options = options;
    this.testEnv = null;
  }

  /**
   * Sets up the test environment.
   * 
   * @param {object} ruleFile - Rule definition
   * @param {object} conditionFile - Condition definition
   * @param {string} conditionId - Condition identifier
   */
  setupEnvironment(ruleFile, conditionFile, conditionId) {
    const macros = { 'core:logSuccessAndEndTurn': logSuccessMacro };
    const expanded = expandMacros(ruleFile.actions, {
      get: (type, id) => (type === 'macros' ? macros[id] : undefined),
    });

    const dataRegistry = {
      getAllSystemRules: jest
        .fn()
        .mockReturnValue([{ ...ruleFile, actions: expanded }]),
      getConditionDefinition: jest.fn((id) =>
        id === conditionId ? conditionFile : undefined
      ),
    };

    const handlerFactory = ModTestHandlerFactory.getHandlerFactoryForCategory(this.modId);

    this.testEnv = createRuleTestEnvironment({
      createHandlers: handlerFactory,
      entities: [],
      rules: [{ ...ruleFile, actions: expanded }],
      dataRegistry,
    });
  }

  /**
   * Resets the test environment with new entities.
   * 
   * @param {Array<object>} entities - Entities to load
   */
  reset(entities = []) {
    if (this.testEnv) {
      this.testEnv.reset(entities);
    }
  }

  /**
   * Cleans up the test environment.
   */
  cleanup() {
    if (this.testEnv) {
      this.testEnv.cleanup();
    }
  }

  /**
   * Gets the event bus from the test environment.
   * 
   * @returns {object} Event bus instance
   */
  get eventBus() {
    return this.testEnv?.eventBus;
  }

  /**
   * Gets the captured events from the test environment.
   * 
   * @returns {Array} Captured events array
   */
  get events() {
    return this.testEnv?.events || [];
  }

  /**
   * Gets the entity manager from the test environment.
   * 
   * @returns {object} Entity manager instance
   */
  get entityManager() {
    return this.testEnv?.entityManager;
  }

  /**
   * Gets the logger from the test environment.
   * 
   * @returns {object} Logger instance
   */
  get logger() {
    return this.testEnv?.logger;
  }
}

/**
 * Test fixture specialized for mod actions.
 */
export class ModActionTestFixture extends BaseModTestFixture {
  constructor(modId, actionId, ruleFile, conditionFile, options = {}) {
    super(modId, options);
    this.actionId = actionId;
    this.ruleFile = ruleFile;
    this.conditionFile = conditionFile;
    
    const conditionId = `${modId}:event-is-action-${actionId.replace(`${modId}:`, '')}`;
    this.setupEnvironment(ruleFile, conditionFile, conditionId);
  }

  /**
   * Creates a standard actor-target setup for the action.
   * 
   * @param {Array<string>} [names] - Names for actor and target
   * @param {object} [options] - Additional options
   * @returns {object} Object with actor and target entities
   */
  createStandardActorTarget(names = ['Alice', 'Bob'], options = {}) {
    const scenario = ModEntityScenarios.createActorTargetPair({
      names,
      location: 'room1',
      closeProximity: true,
      ...options,
    });

    const entities = [scenario.actor, scenario.target];
    
    // Add room if needed
    if (options.includeRoom !== false) {
      entities.unshift(ModEntityScenarios.createRoom('room1', 'Test Room'));
    }

    this.reset(entities);
    return scenario;
  }

  /**
   * Creates close actors scenario (common for intimacy and positioning tests).
   * 
   * @param {Array<string>} [names] - Actor names
   * @param {object} [options] - Additional options
   * @returns {object} Object with actor and target entities
   */
  createCloseActors(names = ['Alice', 'Bob'], options = {}) {
    return this.createStandardActorTarget(names, {
      closeProximity: true,
      ...options,
    });
  }

  /**
   * Creates anatomy scenario for body-related actions.
   * 
   * @param {Array<string>} [names] - Actor names
   * @param {Array<string>} [bodyParts] - Body part types
   * @param {object} [options] - Additional options
   * @returns {object} Object with entities and body parts
   */
  createAnatomyScenario(names = ['Alice', 'Bob'], bodyParts = ['torso', 'breast', 'breast'], options = {}) {
    const scenario = ModEntityScenarios.createAnatomyScenario({
      names,
      location: 'room1',
      bodyParts,
      ...options,
    });

    const entities = scenario.allEntities;
    
    // Add room if needed
    if (options.includeRoom !== false) {
      entities.unshift(ModEntityScenarios.createRoom('room1', 'Test Room'));
    }

    this.reset(entities);
    return scenario;
  }

  /**
   * Creates multi-actor scenario with observers.
   * 
   * @param {Array<string>} [names] - All actor names
   * @param {object} [options] - Additional options
   * @returns {object} Object with main entities and observers
   */
  createMultiActorScenario(names = ['Alice', 'Bob', 'Charlie'], options = {}) {
    const scenario = ModEntityScenarios.createMultiActorScenario({
      names,
      location: 'room1',
      closeToMain: 1,
      ...options,
    });

    const entities = scenario.allEntities;
    
    // Add room if needed
    if (options.includeRoom !== false) {
      entities.unshift(ModEntityScenarios.createRoom('room1', 'Test Room'));
    }

    this.reset(entities);
    return scenario;
  }

  /**
   * Executes the action with standard parameters.
   * 
   * @param {string} actorId - Actor entity ID
   * @param {string} targetId - Target entity ID
   * @param {object} [options] - Additional options
   * @returns {Promise} Promise that resolves when action is dispatched
   */
  async executeAction(actorId, targetId, options = {}) {
    const {
      originalInput,
      additionalPayload = {},
    } = options;

    const payload = {
      eventName: 'core:attempt_action',
      actorId,
      actionId: this.actionId,
      targetId,
      originalInput: originalInput || `${this.actionId.split(':')[1]} ${targetId}`,
      ...additionalPayload,
    };

    return this.eventBus.dispatch(ATTEMPT_ACTION_ID, payload);
  }

  /**
   * Asserts that the action executed successfully.
   * 
   * @param {string} expectedMessage - Expected success message
   * @param {object} [options] - Additional assertion options
   */
  assertActionSuccess(expectedMessage, options = {}) {
    ModAssertionHelpers.assertActionSuccess(this.events, expectedMessage, options);
  }

  /**
   * Asserts that the perceptible event was generated correctly.
   * 
   * @param {object} expectedEvent - Expected event properties
   */
  assertPerceptibleEvent(expectedEvent) {
    ModAssertionHelpers.assertPerceptibleEvent(this.events, expectedEvent);
  }

  /**
   * Asserts that a component was added to an entity.
   * 
   * @param {string} entityId - Entity ID to check
   * @param {string} componentId - Component ID that should exist
   * @param {object} [expectedData] - Expected component data
   */
  assertComponentAdded(entityId, componentId, expectedData = {}) {
    ModAssertionHelpers.assertComponentAdded(
      this.entityManager,
      entityId,
      componentId,
      expectedData
    );
  }

  /**
   * Asserts that the action failed (no success events).
   * 
   * @param {object} [options] - Failure assertion options
   */
  assertActionFailure(options = {}) {
    ModAssertionHelpers.assertActionFailure(this.events, options);
  }

  /**
   * Asserts that only expected events were generated.
   * 
   * @param {Array<string>} allowedEventTypes - Allowed event types
   */
  assertOnlyExpectedEvents(allowedEventTypes) {
    ModAssertionHelpers.assertOnlyExpectedEvents(this.events, allowedEventTypes);
  }

  /**
   * Clears the events array for the next test.
   */
  clearEvents() {
    if (this.events) {
      this.events.length = 0;
    }
  }
}

/**
 * Test fixture specialized for mod rules.
 */
export class ModRuleTestFixture extends ModActionTestFixture {
  constructor(modId, ruleId, ruleFile, conditionFile, options = {}) {
    super(modId, ruleId, ruleFile, conditionFile, options);
    this.ruleId = ruleId;
  }

  /**
   * Tests that the rule triggers for the correct action ID.
   * 
   * @param {string} actorId - Actor entity ID
   * @param {string} correctActionId - Action ID that should trigger the rule
   * @param {string} targetId - Target entity ID
   * @returns {Promise} Promise that resolves when action is dispatched
   */
  async testRuleTriggers(actorId, correctActionId, targetId) {
    return this.executeAction(actorId, targetId, {
      originalInput: `${correctActionId.split(':')[1]} ${targetId}`,
    });
  }

  /**
   * Tests that the rule does not trigger for incorrect action IDs.
   * 
   * @param {string} actorId - Actor entity ID
   * @param {string} wrongActionId - Action ID that should not trigger the rule
   * @param {string} [targetId] - Target entity ID
   * @returns {Promise} Promise that resolves when action is dispatched
   */
  async testRuleDoesNotTrigger(actorId, wrongActionId, targetId = null) {
    const initialEventCount = this.events.length;

    const payload = {
      eventName: 'core:attempt_action',
      actorId,
      actionId: wrongActionId,
    };

    if (targetId) {
      payload.targetId = targetId;
      payload.originalInput = `${wrongActionId.split(':')[1]} ${targetId}`;
    }

    await this.eventBus.dispatch(ATTEMPT_ACTION_ID, payload);

    ModAssertionHelpers.assertRuleDidNotTrigger(this.events, initialEventCount);
  }
}

/**
 * Test fixture for mod categories.
 */
export class ModCategoryTestFixture extends BaseModTestFixture {
  constructor(categoryName, options = {}) {
    super(categoryName, options);
    this.categoryName = categoryName;
  }

  /**
   * Creates category-specific entity scenarios.
   * 
   * @param {string} scenarioType - Type of scenario to create
   * @param {object} [options] - Scenario options
   * @returns {object} Created scenario
   */
  createCategoryScenario(scenarioType, options = {}) {
    switch (this.categoryName) {
      case 'positioning':
        return ModEntityScenarios.createPositioningScenario(options);
      case 'intimacy':
      case 'sex':
        return ModEntityScenarios.createActorTargetPair({
          closeProximity: true,
          ...options,
        });
      case 'violence':
      case 'exercise':
        return ModEntityScenarios.createActorTargetPair(options);
      default:
        return ModEntityScenarios.createActorTargetPair(options);
    }
  }

  /**
   * Gets category-specific default entities.
   * 
   * @returns {Array} Array of default entities for the category
   */
  getDefaultEntities() {
    const scenario = this.createCategoryScenario('default');
    const entities = [scenario.actor, scenario.target];
    entities.unshift(ModEntityScenarios.createRoom('room1', 'Test Room'));
    return entities;
  }
}

export default ModTestFixture;