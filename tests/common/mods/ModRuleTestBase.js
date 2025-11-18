/**
 * @file Base class for mod rule integration tests
 * @description Provides specialized functionality for testing mod rules, extending ModActionTestBase
 */

import { describe, it, expect } from '@jest/globals';
import { ModActionTestBase } from './ModActionTestBase.js';
import { ModTestFixture } from './ModTestFixture.js';

/**
 * Base class for mod rule integration tests.
 *
 * Extends ModActionTestBase with rule-specific functionality and test patterns.
 * Focuses on testing rule behavior, event handling, and rule selectivity.
 *
 * @example
 * class KissCheekRuleTest extends ModRuleTestBase {
 *   constructor() {
 *     super('intimacy', 'intimacy_handle_kiss_cheek', kissCheekRule, eventIsActionKissCheek);
 *   }
 * }
 *
 * const testSuite = new KissCheekRuleTest();
 * testSuite.runStandardRuleTests();
 */
export class ModRuleTestBase extends ModActionTestBase {
  /**
   * Creates a new mod rule test base.
   *
   * @param {string} modId - The mod identifier (e.g., 'intimacy', 'positioning')
   * @param {string} ruleId - The rule identifier (e.g., 'intimacy_handle_kiss_cheek')
   * @param {object} ruleFile - The rule definition JSON object
   * @param {object} conditionFile - The condition definition JSON object
   * @param {object} [options] - Additional configuration options
   * @param {string} [options.associatedActionId] - The action ID this rule handles
   */
  constructor(modId, ruleId, ruleFile, conditionFile, options = {}) {
    // For rules, we derive the action ID from the rule or use provided one
    const actionId =
      options.associatedActionId ||
      ModRuleTestBase.deriveActionIdFromRule(ruleId);

    super(modId, actionId, ruleFile, conditionFile, options);

    this.ruleId = ruleId;
    this.associatedActionId = actionId;
  }

  /**
   * Derives the action ID from a rule ID.
   *
   * @param {string} ruleId - The rule identifier
   * @returns {string} Derived action ID
   * @static
   */
  static deriveActionIdFromRule(ruleId) {
    // Common patterns for rule to action mapping
    const patterns = [
      { pattern: /^(.+)_handle_(.+)$/, replacement: '$1:$2' },
      { pattern: /^handle_(.+)$/, replacement: '$1' },
      { pattern: /^(.+)_rule$/, replacement: '$1' },
      { pattern: /^(.+)Rule$/, replacement: '$1' },
    ];

    for (const { pattern, replacement } of patterns) {
      if (pattern.test(ruleId)) {
        return ruleId.replace(pattern, replacement);
      }
    }

    // If no pattern matches, return the rule ID as-is
    return ruleId;
  }

  /**
   * Sets up the test fixture for rule testing.
   *
   * @protected
   */
  setupTestFixture() {
    this.testFixture = ModTestFixture.forRule(
      this.modId,
      this.ruleId,
      this.ruleFile,
      this.conditionFile,
      this.options
    );
  }

  /**
   * Tests that the rule triggers for the correct action ID.
   *
   * @param {string} actorId - Actor entity ID
   * @param {string} targetId - Target entity ID
   * @param {string} [actionId] - Action ID to test (defaults to associated action)
   * @returns {Promise} Promise that resolves when action is dispatched
   */
  async testRuleTriggers(
    actorId,
    targetId,
    actionId = this.associatedActionId
  ) {
    return this.testFixture.testRuleTriggers(actorId, actionId, targetId);
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
    return this.testFixture.testRuleDoesNotTrigger(
      actorId,
      wrongActionId,
      targetId
    );
  }

  /**
   * Runs the standard rule execution test.
   *
   * @param {string} testName - Name for the test case
   * @param {function} [customSetup] - Custom setup function
   * @param {function} [customAssertions] - Custom assertion function
   */
  runRuleExecutionTest(testName, customSetup = null, customAssertions = null) {
    it(
      testName || `performs ${this.associatedActionId} action successfully`,
      async () => {
        let scenario;

        if (customSetup) {
          scenario = customSetup.call(this);
        } else if (this.requiresAnatomy()) {
          scenario = this.createAnatomyScenario();
        } else {
          scenario = this.createStandardScenario();
        }

        await this.testRuleTriggers(scenario.actor.id, scenario.target.id);

        // Assert standard event sequence
        const eventTypes = this.testFixture.events.map((e) => e.eventType);
        expect(eventTypes).toEqual(
          expect.arrayContaining([
            'core:perceptible_event',
            'core:display_successful_action_result',
            'core:turn_ended',
          ])
        );

        if (customAssertions) {
          customAssertions.call(this, scenario);
        }
      }
    );
  }

  /**
   * Runs the rule selectivity test (rule only fires for specific actions).
   *
   * @param {string} testName - Name for the test case
   * @param {Array<string>} [wrongActions] - Actions that should not trigger the rule
   */
  runRuleSelectivityTest(testName, wrongActions = ['core:wait']) {
    it(testName || 'does not fire rule for different action', async () => {
      const scenario = this.createStandardScenario();

      for (const wrongAction of wrongActions) {
        const initialEventCount = this.testFixture.events.length;

        await this.testRuleDoesNotTrigger(scenario.actor.id, wrongAction);

        // Rule should not trigger for different actions
        const newEventCount = this.testFixture.events.length;
        expect(newEventCount).toBe(initialEventCount + 1); // Only the dispatched event

        // Clear events for next iteration
        this.testFixture.clearEvents();
      }
    });
  }

  /**
   * Runs a test for rule error handling with missing entities.
   *
   * @param {string} testName - Name for the test case
   */
  runRuleErrorHandlingTest(testName) {
    it(testName || 'handles missing target gracefully', async () => {
      const scenario = this.createStandardScenario();

      // Test rule robustness with missing entities
      await expect(async () => {
        const payload = {
          eventName: 'core:attempt_action',
          actionId: this.associatedActionId,
          actorId: scenario.actor.id,
          targetId: 'nonexistent',
        };

        await this.testFixture.eventBus.dispatch(
          'core:attempt_action',
          payload
        );
      }).not.toThrow();

      // With missing target, rule should fail during execution
      const types = this.testFixture.events.map((e) => e.eventType);
      expect(types).toEqual(['core:attempt_action']);
    });
  }

  /**
   * Runs a test verifying the rule generates correct event messages.
   *
   * @param {string} testName - Name for the test case
   * @param {function} [messageGenerator] - Function to generate expected message
   */
  runRuleMessageTest(testName, messageGenerator = null) {
    it(testName || 'generates correct rule messages', async () => {
      const scenario = this.createStandardScenario();
      const actorName = scenario.actor.components['core:name'].text;
      const targetName = scenario.target.components['core:name'].text;

      await this.testRuleTriggers(scenario.actor.id, scenario.target.id);

      const expectedMessage = messageGenerator
        ? messageGenerator.call(this, actorName, targetName)
        : this.getExpectedSuccessMessage(actorName, targetName);

      const perceptibleEvent = this.testFixture.events.find(
        (e) => e.eventType === 'core:perceptible_event'
      );
      expect(perceptibleEvent).toBeDefined();
      expect(perceptibleEvent.payload.descriptionText).toBe(expectedMessage);

      const successEvent = this.testFixture.events.find(
        (e) => e.eventType === 'core:display_successful_action_result'
      );
      expect(successEvent).toBeDefined();
      expect(successEvent.payload.message).toBe(expectedMessage);
    });
  }

  /**
   * Runs a test for rule event sequence validation.
   *
   * @param {string} testName - Name for the test case
   * @param {Array<string>} [expectedSequence] - Expected event sequence
   */
  runRuleEventSequenceTest(testName, expectedSequence = null) {
    it(testName || 'follows correct event sequence', async () => {
      const scenario = this.createStandardScenario();

      await this.testRuleTriggers(scenario.actor.id, scenario.target.id);

      const defaultSequence = [
        'core:attempt_action',
        'core:perceptible_event',
        'core:display_successful_action_result',
        'core:turn_ended',
      ];

      const sequenceToCheck = expectedSequence || defaultSequence;
      const eventTypes = this.testFixture.events.map((e) => e.eventType);

      sequenceToCheck.forEach((expectedType) => {
        expect(eventTypes).toContain(expectedType);
      });

      // Verify order of key events
      const perceptibleIndex = eventTypes.indexOf('core:perceptible_event');
      const successIndex = eventTypes.indexOf(
        'core:display_successful_action_result'
      );
      const turnEndIndex = eventTypes.indexOf('core:turn_ended');

      if (perceptibleIndex !== -1 && successIndex !== -1) {
        expect(perceptibleIndex).toBeLessThan(successIndex);
      }

      if (successIndex !== -1 && turnEndIndex !== -1) {
        expect(successIndex).toBeLessThan(turnEndIndex);
      }
    });
  }

  /**
   * Runs a test for rule condition validation.
   *
   * @param {string} testName - Name for the test case
   * @param {function} setupInvalidConditions - Function to set up conditions that should prevent rule execution
   */
  runRuleConditionTest(testName, setupInvalidConditions) {
    it(testName || 'respects rule conditions', async () => {
      const scenario = setupInvalidConditions.call(this);

      await this.testRuleTriggers(scenario.actor.id, scenario.target.id);

      // Rule should not execute due to unmet conditions
      const successEvent = this.testFixture.events.find(
        (e) => e.eventType === 'core:display_successful_action_result'
      );
      expect(successEvent).toBeUndefined();
    });
  }

  /**
   * Runs all standard rule tests.
   *
   * @param {object} [options] - Options for test execution
   * @param {boolean} [options.includeExecution] - Include rule execution test (default: true)
   * @param {boolean} [options.includeSelectivity] - Include rule selectivity test (default: true)
   * @param {boolean} [options.includeErrorHandling] - Include error handling test (default: true)
   * @param {boolean} [options.includeMessages] - Include message validation test (default: true)
   * @param {boolean} [options.includeEventSequence] - Include event sequence test (default: true)
   * @param {Array<Function>} [options.customTests] - Additional custom test functions
   */
  runStandardRuleTests(options = {}) {
    const {
      includeExecution = true,
      includeSelectivity = true,
      includeErrorHandling = true,
      includeMessages = true,
      includeEventSequence = true,
      customTests = [],
    } = options;

    this.setupStandardHooks();

    if (includeExecution) {
      this.runRuleExecutionTest();
    }

    if (includeSelectivity) {
      this.runRuleSelectivityTest();
    }

    if (includeErrorHandling) {
      this.runRuleErrorHandlingTest();
    }

    if (includeMessages) {
      this.runRuleMessageTest();
    }

    if (includeEventSequence) {
      this.runRuleEventSequenceTest();
    }

    // Run custom tests
    customTests.forEach((testFn) => {
      if (typeof testFn === 'function') {
        testFn.call(this);
      }
    });
  }

  /**
   * Creates a describe block with all standard rule tests.
   *
   * @param {string} [description] - Description for the test suite
   * @param {object} [options] - Options passed to runStandardRuleTests
   */
  createRuleTestSuite(description, options = {}) {
    const testDescription = description || `${this.ruleId} rule integration`;

    describe(testDescription, () => {
      this.runStandardRuleTests(options);
    });
  }

  /**
   * Overrides the success test to use rule-specific execution.
   *
   * @param {string} testName - Name for the test case
   * @param {function} customSetup - Custom setup function
   * @param {function} customAssertions - Custom assertion function
   */
  runSuccessTest(testName, customSetup = null, customAssertions = null) {
    this.runRuleExecutionTest(testName, customSetup, customAssertions);
  }

  /**
   * Overrides the rule selectivity test to use rule-specific logic.
   *
   * @param {string} testName - Name for the test case
   */
  runRuleSelectivityTest(testName) {
    super.runRuleSelectivityTest(testName, ['core:wait', 'core:look']);
  }
}

export default ModRuleTestBase;
