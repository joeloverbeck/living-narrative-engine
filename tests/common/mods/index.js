/**
 * @file Main entry point for mod integration test utilities
 * @description Exports all mod testing utilities for easy importing
 */

// Base classes
import { ModActionTestBase } from './ModActionTestBase.js';
import { ModRuleTestBase } from './ModRuleTestBase.js';

// Test fixtures and factories
import {
  ModTestFixture,
  ModActionTestFixture,
  ModRuleTestFixture,
  ModCategoryTestFixture,
} from './ModTestFixture.js';
import { ModTestHandlerFactory } from './ModTestHandlerFactory.js';

// Entity building utilities
import { ModEntityBuilder, ModEntityScenarios } from './ModEntityBuilder.js';

// Assertion helpers
import { ModAssertionHelpers } from './ModAssertionHelpers.js';

export { ModActionTestBase, ModRuleTestBase };
export {
  ModTestFixture,
  ModActionTestFixture,
  ModRuleTestFixture,
  ModCategoryTestFixture,
};
export { ModTestHandlerFactory };
export { ModEntityBuilder, ModEntityScenarios };
export { ModAssertionHelpers };

/**
 * Convenience function to create a quick action test setup.
 *
 * @param {string} modId - The mod identifier
 * @param {string} actionId - The action identifier
 * @param {object} ruleFile - The rule definition
 * @param {object} conditionFile - The condition definition
 * @param {object} [options] - Additional options
 * @returns {ModActionTestFixture} Configured test fixture
 */
export function createActionTest(
  modId,
  actionId,
  ruleFile,
  conditionFile,
  options = {}
) {
  return ModTestFixture.forAction(
    modId,
    actionId,
    ruleFile,
    conditionFile,
    options
  );
}

/**
 * Convenience function to create a quick rule test setup.
 *
 * @param {string} modId - The mod identifier
 * @param {string} ruleId - The rule identifier
 * @param {object} ruleFile - The rule definition
 * @param {object} conditionFile - The condition definition
 * @param {object} [options] - Additional options
 * @returns {ModRuleTestFixture} Configured test fixture
 */
export function createRuleTest(
  modId,
  ruleId,
  ruleFile,
  conditionFile,
  options = {}
) {
  return ModTestFixture.forRule(
    modId,
    ruleId,
    ruleFile,
    conditionFile,
    options
  );
}

/**
 * Convenience function to create standard actor-target entities.
 *
 * @param {Array<string>} [names] - Names for the entities
 * @param {object} [options] - Additional options
 * @returns {object} Object with actor and target entities
 */
export function createStandardEntities(names = ['Alice', 'Bob'], options = {}) {
  return ModEntityScenarios.createActorTargetPair({ names, ...options });
}

/**
 * Convenience function to create close actors (common for intimacy tests).
 *
 * @param {Array<string>} [names] - Names for the entities
 * @param {object} [options] - Additional options
 * @returns {object} Object with close actor and target entities
 */
export function createCloseActors(names = ['Alice', 'Bob'], options = {}) {
  return ModEntityScenarios.createActorTargetPair({
    names,
    closeProximity: true,
    ...options,
  });
}

/**
 * Convenience function to create anatomy scenario.
 *
 * @param {Array<string>} [names] - Names for the entities
 * @param {Array<string>} [bodyParts] - Body part types
 * @param {object} [options] - Additional options
 * @returns {object} Object with entities and body parts
 */
export function createAnatomyScenario(
  names = ['Alice', 'Bob'],
  bodyParts = ['torso', 'breast', 'breast'],
  options = {}
) {
  return ModEntityScenarios.createAnatomyScenario({
    names,
    bodyParts,
    ...options,
  });
}

/**
 * Convenience function to create positioning scenario.
 *
 * @param {Array<string>} [names] - Names for the entities
 * @param {string} [positioning] - Initial positioning
 * @param {object} [options] - Additional options
 * @returns {object} Object with positioned entities
 */
export function createPositioningScenario(
  names = ['Alice', 'Bob'],
  positioning = 'standing',
  options = {}
) {
  return ModEntityScenarios.createPositioningScenario({
    names,
    positioning,
    ...options,
  });
}

/**
 * @description Convenience helper for creating configurable sitting arrangements.
 * @param {object} [options] - Scenario overrides forwarded to ModEntityScenarios.createSittingArrangement
 * @returns {object} Scenario details for seated, standing, and kneeling actors
 */
export function createSittingArrangement(options = {}) {
  return ModEntityScenarios.createSittingArrangement(options);
}

/**
 * @description Convenience helper for creating seated actor pairs.
 * @param {object} [options] - Scenario overrides forwarded to ModEntityScenarios.createSittingPair
 * @returns {object} Scenario details for the seated pair
 */
export function createSittingPair(options = {}) {
  return ModEntityScenarios.createSittingPair(options);
}

/**
 * @description Convenience helper for creating single actor sitting arrangements.
 * @param {object} [options] - Scenario overrides forwarded to ModEntityScenarios.createSoloSitting
 * @returns {object} Scenario details for the solo sitter
 */
export function createSoloSitting(options = {}) {
  return ModEntityScenarios.createSoloSitting(options);
}

/**
 * @description Convenience helper for sitting scenarios with nearby standing actors.
 * @param {object} [options] - Scenario overrides forwarded to ModEntityScenarios.createStandingNearSitting
 * @returns {object} Scenario details with seated and standing actors
 */
export function createStandingNearSitting(options = {}) {
  return ModEntityScenarios.createStandingNearSitting(options);
}

/**
 * @description Convenience helper for scenarios where actors use different furniture.
 * @param {object} [options] - Scenario overrides forwarded to ModEntityScenarios.createSeparateFurnitureArrangement
 * @returns {object} Scenario details with multiple furniture instances
 */
export function createSeparateFurnitureArrangement(options = {}) {
  return ModEntityScenarios.createSeparateFurnitureArrangement(options);
}

/**
 * @description Convenience helper for scenarios with kneeling actors positioned near seated actors.
 * @param {object} [options] - Scenario overrides forwarded to ModEntityScenarios.createKneelingBeforeSitting
 * @returns {object} Scenario details with seated and kneeling actors
 */
export function createKneelingBeforeSitting(options = {}) {
  return ModEntityScenarios.createKneelingBeforeSitting(options);
}

/**
 * Convenience helper for inventory loadout scenarios.
 *
 * @param {object} [options] - Scenario overrides forwarded to ModEntityScenarios.createInventoryLoadout
 * @returns {object} Scenario details including room, actor, and inventory items
 */
export function createInventoryLoadout(options = {}) {
  return ModEntityScenarios.createInventoryLoadout(options);
}

/**
 * Convenience helper for loose ground item scenarios.
 *
 * @param {object} [options] - Scenario overrides forwarded to ModEntityScenarios.createItemsOnGround
 * @returns {object} Scenario details including room, items, and optional actor context
 */
export function createItemsOnGround(options = {}) {
  return ModEntityScenarios.createItemsOnGround(options);
}

/**
 * Convenience helper for container scenarios with pre-populated contents.
 *
 * @param {object} [options] - Scenario overrides forwarded to ModEntityScenarios.createContainerWithContents
 * @returns {object} Scenario details including room, container, contents, and optional key item
 */
export function createContainerWithContents(options = {}) {
  return ModEntityScenarios.createContainerWithContents(options);
}

/**
 * Convenience helper for inventory transfer scenarios between two actors.
 *
 * @param {object} [options] - Scenario overrides forwarded to ModEntityScenarios.createInventoryTransfer
 * @returns {object} Scenario details including room, actors, and transfer item references
 */
export function createInventoryTransfer(options = {}) {
  return ModEntityScenarios.createInventoryTransfer(options);
}

/**
 * Convenience helper for drop item scenarios.
 *
 * @param {object} [options] - Scenario overrides forwarded to ModEntityScenarios.createDropItemScenario
 * @returns {object} Scenario details including room, actor, and item references
 */
export function createDropItemScenario(options = {}) {
  return ModEntityScenarios.createDropItemScenario(options);
}

/**
 * Convenience helper for pickup scenarios involving ground items.
 *
 * @param {object} [options] - Scenario overrides forwarded to ModEntityScenarios.createPickupScenario
 * @returns {object} Scenario details including room, actor, and ground item references
 */
export function createPickupScenario(options = {}) {
  return ModEntityScenarios.createPickupScenario(options);
}

/**
 * Convenience helper for open container scenarios.
 *
 * @param {object} [options] - Scenario overrides forwarded to ModEntityScenarios.createOpenContainerScenario
 * @returns {object} Scenario details including room, actor, container, and optional key references
 */
export function createOpenContainerScenario(options = {}) {
  return ModEntityScenarios.createOpenContainerScenario(options);
}

/**
 * Convenience helper for put-in-container scenarios.
 *
 * @param {object} [options] - Scenario overrides forwarded to ModEntityScenarios.createPutInContainerScenario
 * @returns {object} Scenario details including room, actor, container, and held item references
 */
export function createPutInContainerScenario(options = {}) {
  return ModEntityScenarios.createPutInContainerScenario(options);
}

/**
 * Helper to run standard assertions for successful actions.
 *
 * @param {Array} events - Events array from test environment
 * @param {string} expectedMessage - Expected success message
 * @param {object} [options] - Additional assertion options
 */
export function assertStandardSuccess(events, expectedMessage, options = {}) {
  ModAssertionHelpers.assertActionSuccess(events, expectedMessage, options);
}

/**
 * Helper to run standard perceptible event assertions.
 *
 * @param {Array} events - Events array from test environment
 * @param {object} expectedEvent - Expected event properties
 */
export function assertStandardPerceptibleEvent(events, expectedEvent) {
  ModAssertionHelpers.assertPerceptibleEvent(events, expectedEvent);
}

/**
 * Version information and metadata.
 */
export const VERSION = '1.0.0';
export const DESCRIPTION =
  'Mod Integration Test Utilities - Architectural improvements for scalable mod testing';

/**
 * Configuration constants used across mod tests.
 */
export const MOD_TEST_CONSTANTS = {
  DEFAULT_LOCATION: 'room1',
  DEFAULT_ROOM_NAME: 'Test Room',
  DEFAULT_ACTOR_NAMES: ['Alice', 'Bob'],
  STANDARD_EVENT_SEQUENCE: [
    'core:attempt_action',
    'core:perceptible_event',
    'core:display_successful_action_result',
    'core:turn_ended',
  ],
  COMMON_WRONG_ACTIONS: ['core:wait', 'core:look'],
};

/**
 * Utility functions for common test patterns.
 */
export const ModTestUtils = {
  /**
   * Extracts action name from full action ID.
   *
   * @param {string} actionId - Full action ID (e.g., 'intimacy:kiss_cheek')
   * @returns {string} Action name (e.g., 'kiss_cheek')
   */
  extractActionName(actionId) {
    return actionId.split(':')[1] || actionId;
  },

  /**
   * Formats action name for display.
   *
   * @param {string} actionName - Action name with underscores
   * @returns {string} Formatted name with spaces
   */
  formatActionName(actionName) {
    return actionName.replace(/_/g, ' ');
  },

  /**
   * Determines if an action likely requires closeness.
   *
   * @param {string} modId - Mod identifier
   * @param {string} actionName - Action name
   * @returns {boolean} True if action likely requires closeness
   */
  requiresCloseness(modId, actionName) {
    const closenessCategories = ['intimacy', 'sex', 'sex-breastplay'];
    const closenessActions = [
      'kiss_',
      'hug_',
      'fondle_',
      'massage_',
      'caress_',
      'touch_',
    ];

    if (closenessCategories.includes(modId)) {
      return true;
    }

    return closenessActions.some((action) => actionName.includes(action));
  },

  /**
   * Determines if an action requires anatomy components.
   *
   * @param {string} actionName - Action name
   * @returns {boolean} True if action requires anatomy
   */
  requiresAnatomy(actionName) {
    const anatomyActions = [
      'fondle_breasts',
      'fondle_penis',
      'suckle_testicle',
      'pump_penis',
      'rub_penis',
      'rub_vagina',
      'lick_testicles',
      'nuzzle_penis',
    ];
    return anatomyActions.includes(actionName);
  },

  /**
   * Gets category-specific handler factory.
   *
   * @param {string} modCategory - Mod category
   * @returns {Function} Handler factory function
   */
  getHandlerFactory(modCategory) {
    return ModTestHandlerFactory.getHandlerFactoryForCategory(modCategory);
  },

  /**
   * Creates a simple test entity with minimal components.
   *
   * @param {string} id - Entity ID
   * @param {string} name - Entity name
   * @param {string} [location] - Location ID
   * @returns {object} Simple entity object
   */
  createSimpleEntity(id, name, location = 'room1') {
    return new ModEntityBuilder(id).withName(name).atLocation(location).build();
  },
};

// Default export provides the main utilities
export default {
  ModActionTestBase,
  ModRuleTestBase,
  ModTestFixture,
  ModTestHandlerFactory,
  ModEntityBuilder,
  ModEntityScenarios,
  ModAssertionHelpers,

  // Convenience functions
  createActionTest,
  createRuleTest,
  createStandardEntities,
  createCloseActors,
  createAnatomyScenario,
  createPositioningScenario,
  assertStandardSuccess,
  assertStandardPerceptibleEvent,

  // Constants and utilities
  MOD_TEST_CONSTANTS,
  ModTestUtils,
  VERSION,
};
