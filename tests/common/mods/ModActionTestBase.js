/**
 * @file Base class for mod action integration tests
 * @description Provides common functionality and patterns for testing mod actions
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from './ModTestFixture.js';

/**
 * Base class for mod action integration tests.
 *
 * Provides standardized setup, teardown, and common test patterns for mod action tests.
 * Eliminates boilerplate code and ensures consistent testing patterns across all mod actions.
 *
 * @example
 * class KissCheekActionTest extends ModActionTestBase {
 *   constructor() {
 *     super('intimacy', 'intimacy:kiss_cheek', kissCheekRule, eventIsActionKissCheek);
 *   }
 * }
 *
 * const testSuite = new KissCheekActionTest();
 * testSuite.runStandardTests();
 */
export class ModActionTestBase {
  /**
   * Creates a new mod action test base.
   *
   * @param {string} modId - The mod identifier (e.g., 'intimacy', 'positioning')
   * @param {string} actionId - The full action ID (e.g., 'intimacy:kiss_cheek')
   * @param {object} ruleFile - The rule definition JSON object
   * @param {object} conditionFile - The condition definition JSON object
   * @param {object} [options] - Additional configuration options
   * @param {boolean} [options.includeRoom] - Whether to include a room entity (default: true)
   * @param {string} [options.defaultLocation] - Default location ID (default: 'room1')
   * @param {Array<string>} [options.defaultNames] - Default actor names (default: ['Alice', 'Bob'])
   */
  constructor(modId, actionId, ruleFile, conditionFile, options = {}) {
    this.modId = modId;
    this.actionId = actionId;
    this.ruleFile = ruleFile;
    this.conditionFile = conditionFile;
    this.options = {
      includeRoom: true,
      defaultLocation: 'room1',
      defaultNames: ['Alice', 'Bob'],
      ...options,
    };

    this.testFixture = null;
    this.actionName = actionId.split(':')[1] || actionId;
  }

  /**
   * Sets up the test fixture before each test.
   *
   * @protected
   */
  setupTestFixture() {
    this.testFixture = ModTestFixture.forAction(
      this.modId,
      this.actionId,
      this.ruleFile,
      this.conditionFile,
      this.options
    );
  }

  /**
   * Cleans up the test fixture after each test.
   *
   * @protected
   */
  cleanupTestFixture() {
    if (this.testFixture) {
      this.testFixture.cleanup();
    }
  }

  /**
   * Creates the standard beforeEach and afterEach hooks.
   * Call this in your describe block to set up the standard lifecycle.
   *
   * @protected
   */
  setupStandardHooks() {
    beforeEach(() => {
      this.setupTestFixture();
    });

    afterEach(() => {
      this.cleanupTestFixture();
    });
  }

  /**
   * Creates a standard actor-target scenario for the test.
   *
   * @param {Array<string>} [names] - Names for actor and target
   * @param {object} [options] - Additional scenario options
   * @returns {object} Object with actor and target entities
   */
  createStandardScenario(names = this.options.defaultNames, options = {}) {
    if (this.requiresCloseness()) {
      return this.testFixture.createCloseActors(names, options);
    }
    return this.testFixture.createStandardActorTarget(names, options);
  }

  /**
   * Creates an anatomy scenario for body-related actions.
   *
   * @param {Array<string>} [names] - Names for actor and target
   * @param {Array<string>} [bodyParts] - Body part types to create
   * @param {object} [options] - Additional scenario options
   * @returns {object} Object with entities and body parts
   */
  createAnatomyScenario(
    names = this.options.defaultNames,
    bodyParts = ['torso', 'breast', 'breast'],
    options = {}
  ) {
    return this.testFixture.createAnatomyScenario(names, bodyParts, options);
  }

  /**
   * Executes the action with standard parameters.
   *
   * @param {string} actorId - Actor entity ID
   * @param {string} targetId - Target entity ID
   * @param {object} [options] - Additional execution options
   * @returns {Promise} Promise that resolves when action is executed
   */
  async executeAction(actorId, targetId, options = {}) {
    return this.testFixture.executeAction(actorId, targetId, options);
  }

  /**
   * Asserts that the action executed successfully.
   *
   * @param {string} expectedMessage - Expected success message
   * @param {object} [options] - Additional assertion options
   */
  assertActionSuccess(expectedMessage, options = {}) {
    this.testFixture.assertActionSuccess(expectedMessage, options);
  }

  /**
   * Asserts that the perceptible event was generated correctly.
   *
   * @param {object} expectedEvent - Expected event properties
   */
  assertPerceptibleEvent(expectedEvent) {
    this.testFixture.assertPerceptibleEvent(expectedEvent);
  }

  /**
   * Determines if this action requires closeness between actors.
   * Override this method in subclasses to specify closeness requirements.
   *
   * @returns {boolean} True if action requires closeness
   * @protected
   */
  requiresCloseness() {
    // Default behavior: intimacy and some positioning actions require closeness
    const closenessCategories = ['intimacy', 'sex', 'sex-breastplay'];
    const closenessActions = ['kiss_', 'hug_', 'fondle_', 'massage_'];

    if (closenessCategories.includes(this.modId)) {
      return true;
    }

    return closenessActions.some((action) => this.actionName.includes(action));
  }

  /**
   * Determines if this action requires anatomy components.
   * Override this method in subclasses to specify anatomy requirements.
   *
   * @returns {boolean} True if action requires anatomy components
   * @protected
   */
  requiresAnatomy() {
    const anatomyActions = [
      'fondle_breasts',
      'fondle_penis',
      'suckle_testicle',
    ];
    return anatomyActions.includes(this.actionName);
  }

  /**
   * Gets the expected success message format for this action.
   * Override this method in subclasses to provide action-specific messages.
   *
   * @param {string} actorName - Actor name
   * @param {string} targetName - Target name
   * @returns {string} Expected success message
   * @protected
   */
  getExpectedSuccessMessage(actorName, targetName) {
    // Default message format - override in subclasses for specific actions
    return `${actorName} performs ${this.actionName.replace('_', ' ')} on ${targetName}.`;
  }

  /**
   * Runs the standard success test for this action.
   *
   * @param {string} testName - Name for the test case
   * @param {function} [customSetup] - Custom setup function
   * @param {function} [customAssertions] - Custom assertion function
   */
  runSuccessTest(testName, customSetup = null, customAssertions = null) {
    it(
      testName || `successfully executes ${this.actionName} action`,
      async () => {
        let scenario;

        if (customSetup) {
          scenario = customSetup.call(this);
        } else if (this.requiresAnatomy()) {
          scenario = this.createAnatomyScenario();
        } else {
          scenario = this.createStandardScenario();
        }

        await this.executeAction(scenario.actor.id, scenario.target.id);

        const expectedMessage = this.getExpectedSuccessMessage(
          scenario.actor.components['core:name'].text,
          scenario.target.components['core:name'].text
        );

        this.assertActionSuccess(expectedMessage);

        if (customAssertions) {
          customAssertions.call(this, scenario);
        }
      }
    );
  }

  /**
   * Runs the standard perceptible event test for this action.
   *
   * @param {string} testName - Name for the test case
   * @param {function} [customSetup] - Custom setup function
   */
  runPerceptibleEventTest(testName, customSetup = null) {
    it(
      testName || `creates correct perceptible event for ${this.actionName}`,
      async () => {
        const scenario = customSetup
          ? customSetup.call(this)
          : this.createStandardScenario();

        await this.executeAction(scenario.actor.id, scenario.target.id);

        const expectedMessage = this.getExpectedSuccessMessage(
          scenario.actor.components['core:name'].text,
          scenario.target.components['core:name'].text
        );

        this.assertPerceptibleEvent({
          descriptionText: expectedMessage,
          locationId: this.options.defaultLocation,
          actorId: scenario.actor.id,
          targetId: scenario.target.id,
          perceptionType: 'action_target_general',
        });
      }
    );
  }

  /**
   * Runs the standard rule selectivity test (action only fires for correct action ID).
   *
   * @param {string} testName - Name for the test case
   */
  runRuleSelectivityTest(testName) {
    it(testName || `only fires for correct action ID`, async () => {
      const scenario = this.createStandardScenario();

      // Try with a different action
      const wrongActionId = 'core:wait';
      const payload = {
        eventName: 'core:attempt_action',
        actorId: scenario.actor.id,
        actionId: wrongActionId,
        originalInput: 'wait',
      };

      await this.testFixture.eventBus.dispatch('core:attempt_action', payload);

      // Should not have any perceptible events from our rule
      this.testFixture.assertOnlyExpectedEvents(['core:attempt_action']);
    });
  }

  /**
   * Runs the standard graceful failure test for missing entities.
   *
   * @param {string} testName - Name for the test case
   */
  runMissingEntityTest(testName) {
    it(testName || `handles missing target gracefully`, async () => {
      const scenario = this.createStandardScenario();

      await expect(async () => {
        await this.executeAction(scenario.actor.id, 'nonexistent');
      }).not.toThrow();

      // With missing target, rule should fail during execution
      this.testFixture.assertOnlyExpectedEvents(['core:attempt_action']);
    });
  }

  /**
   * Runs a test with multiple actors in the same location.
   *
   * @param {string} testName - Name for the test case
   */
  runMultiActorTest(testName) {
    it(testName || `works with multiple actors in location`, async () => {
      const scenario = this.testFixture.createMultiActorScenario([
        'Alice',
        'Bob',
        'Charlie',
      ]);

      await this.executeAction(scenario.actor.id, scenario.target.id);

      const expectedMessage = this.getExpectedSuccessMessage('Alice', 'Bob');
      this.assertActionSuccess(expectedMessage);

      this.assertPerceptibleEvent({
        descriptionText: expectedMessage,
        locationId: this.options.defaultLocation,
        actorId: scenario.actor.id,
        targetId: scenario.target.id,
      });
    });
  }

  /**
   * Runs all standard tests for this action.
   * Call this method in your describe block to run the complete test suite.
   *
   * @param {object} [options] - Options for test execution
   * @param {boolean} [options.includeSuccess] - Include success test (default: true)
   * @param {boolean} [options.includePerceptibleEvent] - Include perceptible event test (default: true)
   * @param {boolean} [options.includeRuleSelectivity] - Include rule selectivity test (default: true)
   * @param {boolean} [options.includeMissingEntity] - Include missing entity test (default: true)
   * @param {boolean} [options.includeMultiActor] - Include multi-actor test (default: true)
   * @param {Array<Function>} [options.customTests] - Additional custom test functions
   */
  runStandardTests(options = {}) {
    const {
      includeSuccess = true,
      includePerceptibleEvent = true,
      includeRuleSelectivity = true,
      includeMissingEntity = true,
      includeMultiActor = true,
      customTests = [],
    } = options;

    this.setupStandardHooks();

    if (includeSuccess) {
      this.runSuccessTest();
    }

    if (includePerceptibleEvent) {
      this.runPerceptibleEventTest();
    }

    if (includeRuleSelectivity) {
      this.runRuleSelectivityTest();
    }

    if (includeMissingEntity) {
      this.runMissingEntityTest();
    }

    if (includeMultiActor) {
      this.runMultiActorTest();
    }

    // Run custom tests
    customTests.forEach((testFn) => {
      if (typeof testFn === 'function') {
        testFn.call(this);
      }
    });
  }

  /**
   * Creates a describe block with all standard tests.
   *
   * @param {string} [description] - Description for the test suite
   * @param {object} [options] - Options passed to runStandardTests
   */
  createTestSuite(description, options = {}) {
    const testDescription =
      description || `${this.actionId} action integration`;

    describe(testDescription, () => {
      this.runStandardTests(options);
    });
  }
}

export default ModActionTestBase;
