/**
 * @file Custom Jest matchers for action discovery testing
 * @description Provides detailed error messages for common action discovery assertions
 */

import { expect } from '@jest/globals';

/**
 * Custom Jest matchers for action discovery
 */
export const actionDiscoveryMatchers = {
  /**
   * Matches if an action is discovered in the available actions array
   *
   * @param {Array<object>|object} received - Array of actions or object with actions property
   * @param {string} actionId - The action ID to find (e.g., 'affection:place_hands_on_shoulders')
   * @returns {object} Jest matcher result
   */
  toHaveAction(received, actionId) {
    const actions = Array.isArray(received) ? received : received.actions || [];

    const matchingAction = actions.find((a) => a.id === actionId);
    const pass = matchingAction !== undefined;

    if (pass) {
      return {
        pass: true,
        message: () =>
          `Expected NOT to discover action '${actionId}', but it was discovered`,
      };
    }

    // Generate detailed failure message
    const actionList =
      actions.length > 0
        ? actions.map((a, i) => `  ${i + 1}. ${a.id}`).join('\n')
        : '  (none)';

    return {
      pass: false,
      message: () =>
        `Expected to discover action '${actionId}'\n` +
        `\n` +
        `❌ Action '${actionId}' was NOT discovered\n` +
        `\n` +
        `Actions discovered: ${actions.length}\n` +
        `${actionList}\n` +
        `\n` +
        `Possible reasons:\n` +
        `  1. ComponentFilteringStage: Actor missing required components\n` +
        `  2. MultiTargetResolutionStage: Scope returned no targets\n` +
        `  3. TargetComponentValidationStage: Targets missing required components\n` +
        `  4. PrerequisiteEvaluationStage: Prerequisites not met\n` +
        `  5. Action not loaded in ActionIndex\n` +
        `\n` +
        `To debug:\n` +
        `  1. Check actor has required components: actor.components\n` +
        `  2. Verify action exists in action files\n` +
        `  3. Use builder.validate() to catch entity structure issues early\n` +
        `  4. Check scope criteria match test scenario\n`,
    };
  },

  /**
   * Matches if the number of discovered actions equals the expected count
   *
   * @param {Array<object>|object} received - Array of actions or object with actions property
   * @param {number} expectedCount - The expected number of actions
   * @returns {object} Jest matcher result
   */
  toDiscoverActionCount(received, expectedCount) {
    const actions = Array.isArray(received) ? received : received.actions || [];
    const actualCount = actions.length;

    const pass = actualCount === expectedCount;

    if (pass) {
      return {
        pass: true,
        message: () =>
          `Expected NOT to discover ${expectedCount} actions, but discovered exactly ${actualCount}`,
      };
    }

    const actionList =
      actions.length > 0
        ? actions.map((a, i) => `  ${i + 1}. ${a.id}`).join('\n')
        : '  (none)';

    return {
      pass: false,
      message: () =>
        `Expected to discover ${expectedCount} actions but discovered ${actualCount}\n` +
        `\n` +
        `Actions discovered:\n` +
        `${actionList}\n` +
        `\n` +
        (actualCount < expectedCount
          ? `Discovered FEWER actions than expected (${actualCount} < ${expectedCount})\n` +
            `\n` +
            `Possible reasons:\n` +
            `  • Some actions were filtered out by pipeline stages\n` +
            `  • Actor missing required components\n` +
            `  • Scope resolution returned no targets for some actions\n` +
            `  • Prerequisites not met\n` +
            `\n` +
            `To debug:\n` +
            `  • Check actor components and closeness relationships\n` +
            `  • Check which pipeline stage removed actions\n`
          : `Discovered MORE actions than expected (${actualCount} > ${expectedCount})\n` +
            `\n` +
            `Possible reasons:\n` +
            `  • More entities in closeness than expected\n` +
            `  • Scope resolving to unexpected targets\n` +
            `  • Multiple action definitions with similar criteria\n`),
    };
  },
};

/**
 * Extends Jest's expect with custom action discovery matchers
 */
export function extendExpectWithActionDiscoveryMatchers() {
  expect.extend(actionDiscoveryMatchers);
}

// Auto-extend when imported
extendExpectWithActionDiscoveryMatchers();

export default actionDiscoveryMatchers;
