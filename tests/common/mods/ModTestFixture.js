/**
 * @file Factory for creating specialized mod test environments
 * @description Provides high-level test environment creation for common mod testing scenarios with auto-loading capabilities
 */

import { jest } from '@jest/globals';
import { createRuleTestEnvironment } from '../engine/systemLogicTestEnv.js';
import { expandMacros } from '../../../src/utils/macroUtils.js';
import logSuccessMacro from '../../../data/mods/core/macros/logSuccessAndEndTurn.macro.json';
import { ATTEMPT_ACTION_ID } from '../../../src/constants/eventIds.js';
import { promises as fs } from 'fs';
import { resolve } from 'path';

import { ModTestHandlerFactory } from './ModTestHandlerFactory.js';
import { ModEntityScenarios } from './ModEntityBuilder.js';
import { ModAssertionHelpers } from './ModAssertionHelpers.js';

/**
 * File naming conventions for auto-loading mod files
 */
const MOD_FILE_CONVENTIONS = {
  // Rule file patterns (using underscore naming)
  rules: [
    'data/mods/{modId}/rules/{actionName}.rule.json', // e.g., kiss_cheek.rule.json
    'data/mods/{modId}/rules/handle_{actionName}.rule.json', // e.g., handle_kiss_cheek.rule.json
    'data/mods/{modId}/rules/{fullActionId}.rule.json', // e.g., intimacy_kiss_cheek.rule.json
  ],

  // Condition file patterns (using hyphen naming)
  conditions: [
    'data/mods/{modId}/conditions/event-is-action-{actionName}.condition.json', // e.g., event-is-action-kiss-cheek.condition.json
    'data/mods/{modId}/conditions/{actionName}.condition.json', // e.g., kiss-cheek.condition.json
    'data/mods/{modId}/conditions/event-is-action-{fullActionId}.condition.json', // e.g., event-is-action-intimacy-kiss-cheek.condition.json
  ],
};

/**
 * Extracts action name from full action ID
 *
 * @param {string} actionId - Action ID (e.g., 'intimacy:kiss_cheek')
 * @returns {string} Action name (e.g., 'kiss_cheek')
 */
function extractActionName(actionId) {
  return actionId.includes(':') ? actionId.split(':')[1] : actionId;
}

/**
 * Factory class for creating specialized mod test environments.
 *
 * Provides high-level abstractions for setting up common mod testing scenarios,
 * eliminating the boilerplate setup required in individual test files.
 *
 * Enhanced with auto-loading capabilities to reduce manual file imports while
 * maintaining full backward compatibility.
 */
export class ModTestFixture {
  /**
   * Creates a test fixture for a mod action.
   *
   * Enhanced version that supports auto-loading of rule and condition files
   * when they are not provided, while maintaining full backward compatibility.
   *
   * @param {string} modId - The mod identifier (e.g., 'intimacy', 'positioning')
   * @param {string} actionId - The action identifier (e.g., 'kiss_cheek', 'kneel_before')
   * @param {object|null} [ruleFile] - The rule definition JSON (auto-loaded if null/undefined)
   * @param {object|null} [conditionFile] - The condition definition JSON (auto-loaded if null/undefined)
   * @param {object} [options] - Additional configuration options
   * @returns {Promise<ModActionTestFixture>} Configured test fixture for the action
   * @throws {Error} If auto-loading fails when files are not provided
   */
  static async forAction(
    modId,
    actionId,
    ruleFile = null,
    conditionFile = null,
    options = {}
  ) {
    try {
      let finalRuleFile = ruleFile;
      let finalConditionFile = conditionFile;

      // Auto-load files if not provided
      if (!finalRuleFile || !finalConditionFile) {
        // Load only the missing files
        if (!finalRuleFile && !finalConditionFile) {
          // Both files missing - load both
          const loaded = await this.loadModFiles(modId, actionId);
          finalRuleFile = loaded.ruleFile;
          finalConditionFile = loaded.conditionFile;
        } else {
          // Partial loading - load individual files as needed
          if (!finalRuleFile) {
            try {
              finalRuleFile = await this.loadRuleFile(modId, actionId);
            } catch {
              throw new Error(
                `Could not auto-load rule file for ${modId}:${actionId}`
              );
            }
          }

          if (!finalConditionFile) {
            try {
              finalConditionFile = await this.loadConditionFile(
                modId,
                actionId
              );
            } catch {
              throw new Error(
                `Could not auto-load condition file for ${modId}:${actionId}`
              );
            }
          }
        }
      }

      // Use existing ModActionTestFixture constructor
      return new ModActionTestFixture(
        modId,
        actionId,
        finalRuleFile,
        finalConditionFile,
        options
      );
    } catch (error) {
      throw new Error(
        `ModTestFixture.forAction failed for ${modId}:${actionId}: ${error.message}`
      );
    }
  }

  /**
   * Creates a test fixture for a mod rule.
   *
   * Enhanced version that supports auto-loading of rule and condition files
   * when they are not provided, while maintaining full backward compatibility.
   *
   * @param {string} modId - The mod identifier
   * @param {string} ruleId - The rule identifier
   * @param {object|null} [ruleFile] - The rule definition JSON (auto-loaded if null/undefined)
   * @param {object|null} [conditionFile] - The condition definition JSON (auto-loaded if null/undefined)
   * @param {object} [options] - Additional configuration options
   * @returns {Promise<ModRuleTestFixture>} Configured test fixture for the rule
   * @throws {Error} If auto-loading fails when files are not provided
   */
  static async forRule(
    modId,
    ruleId,
    ruleFile = null,
    conditionFile = null,
    options = {}
  ) {
    try {
      let finalRuleFile = ruleFile;
      let finalConditionFile = conditionFile;

      // Auto-load files if not provided
      if (!finalRuleFile || !finalConditionFile) {
        // Load only the missing files
        if (!finalRuleFile && !finalConditionFile) {
          // Both files missing - load both
          const loaded = await this.loadModFiles(modId, ruleId);
          finalRuleFile = loaded.ruleFile;
          finalConditionFile = loaded.conditionFile;
        } else {
          // Partial loading - load individual files as needed
          if (!finalRuleFile) {
            try {
              finalRuleFile = await this.loadRuleFile(modId, ruleId);
            } catch {
              throw new Error(
                `Could not auto-load rule file for ${modId}:${ruleId}`
              );
            }
          }

          if (!finalConditionFile) {
            try {
              finalConditionFile = await this.loadConditionFile(modId, ruleId);
            } catch {
              throw new Error(
                `Could not auto-load condition file for ${modId}:${ruleId}`
              );
            }
          }
        }
      }

      // Use existing ModRuleTestFixture constructor
      return new ModRuleTestFixture(
        modId,
        ruleId,
        finalRuleFile,
        finalConditionFile,
        options
      );
    } catch (error) {
      throw new Error(
        `ModTestFixture.forRule failed for ${modId}:${ruleId}: ${error.message}`
      );
    }
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

  /**
   * Creates a test fixture for a mod action with explicit auto-loading.
   *
   * This method always attempts to auto-load files and throws clear errors
   * when files cannot be found, making it ideal for new tests.
   *
   * @param {string} modId - The mod identifier (e.g., 'intimacy', 'positioning')
   * @param {string} actionId - The action identifier (e.g., 'kiss_cheek', 'kneel_before')
   * @param {object} [options] - Additional configuration options
   * @returns {Promise<ModActionTestFixture>} Configured test fixture for the action
   * @throws {Error} If files cannot be auto-loaded
   */
  static async forActionAutoLoad(modId, actionId, options = {}) {
    const { ruleFile, conditionFile } = await this.loadModFiles(
      modId,
      actionId
    );
    return new ModActionTestFixture(
      modId,
      actionId,
      ruleFile,
      conditionFile,
      options
    );
  }

  /**
   * Creates a test fixture for a mod rule with explicit auto-loading.
   *
   * This method always attempts to auto-load files and throws clear errors
   * when files cannot be found, making it ideal for new tests.
   *
   * @param {string} modId - The mod identifier
   * @param {string} ruleId - The rule identifier
   * @param {object} [options] - Additional configuration options
   * @returns {Promise<ModRuleTestFixture>} Configured test fixture for the rule
   * @throws {Error} If files cannot be auto-loaded
   */
  static async forRuleAutoLoad(modId, ruleId, options = {}) {
    const { ruleFile, conditionFile } = await this.loadModFiles(modId, ruleId);
    return new ModRuleTestFixture(
      modId,
      ruleId,
      ruleFile,
      conditionFile,
      options
    );
  }

  /**
   * Attempts to auto-load rule and condition files without throwing errors.
   *
   * This method is used internally for backward compatibility, returning null
   * values when files cannot be found instead of throwing errors.
   *
   * @param {string} modId - The mod identifier
   * @param {string} identifier - The action or rule identifier
   * @returns {Promise<{ruleFile: object|null, conditionFile: object|null}>} Loaded files or null values
   */
  static async tryAutoLoadFiles(modId, identifier) {
    try {
      return await this.loadModFiles(modId, identifier);
    } catch {
      // Return null to indicate auto-loading failed (for backward compatibility)
      return { ruleFile: null, conditionFile: null };
    }
  }

  /**
   * Loads a single rule file based on naming conventions.
   *
   * @param {string} modId - The mod identifier
   * @param {string} identifier - The action or rule identifier
   * @returns {Promise<object>} Loaded rule file
   * @throws {Error} If file cannot be found
   */
  static async loadRuleFile(modId, identifier) {
    const actionName = extractActionName(identifier);
    const errors = [];

    // Generate fullActionId - if identifier has no namespace, use modId_actionName pattern
    const fullActionId = identifier.includes(':')
      ? identifier.replace(':', '_')
      : `${modId}_${actionName}`;

    // Try to load rule file
    const rulePaths = MOD_FILE_CONVENTIONS.rules.map((pattern) =>
      pattern
        .replace('{modId}', modId)
        .replace('{actionName}', actionName)
        .replace('{fullActionId}', fullActionId)
    );

    for (const rulePath of rulePaths) {
      try {
        const resolvedPath = resolve(rulePath);
        const content = await fs.readFile(resolvedPath, 'utf8');
        return JSON.parse(content);
      } catch (error) {
        errors.push(`Failed to load rule from ${rulePath}: ${error.message}`);
      }
    }

    throw new Error(
      `Could not load rule file for ${modId}:${identifier}. Tried paths: ${rulePaths.join(', ')}`
    );
  }

  /**
   * Loads a single condition file based on naming conventions.
   *
   * @param {string} modId - The mod identifier
   * @param {string} identifier - The action or rule identifier
   * @returns {Promise<object>} Loaded condition file
   * @throws {Error} If file cannot be found
   */
  static async loadConditionFile(modId, identifier) {
    const actionName = extractActionName(identifier);
    const errors = [];

    // Generate fullActionId for conditions - use hyphens instead of underscores
    const fullActionIdForConditions = identifier.includes(':')
      ? identifier.replace(/[:_]/g, '-')
      : `${modId}-${actionName.replace(/_/g, '-')}`;

    // Try to load condition file
    const conditionPaths = MOD_FILE_CONVENTIONS.conditions.map((pattern) =>
      pattern
        .replace('{modId}', modId)
        .replace('{actionName}', actionName.replace(/_/g, '-'))
        .replace('{fullActionId}', fullActionIdForConditions)
    );

    for (const conditionPath of conditionPaths) {
      try {
        const resolvedPath = resolve(conditionPath);
        const content = await fs.readFile(resolvedPath, 'utf8');
        return JSON.parse(content);
      } catch (error) {
        errors.push(
          `Failed to load condition from ${conditionPath}: ${error.message}`
        );
      }
    }

    throw new Error(
      `Could not load condition file for ${modId}:${identifier}. Tried paths: ${conditionPaths.join(', ')}`
    );
  }

  /**
   * Loads mod rule and condition files based on naming conventions.
   *
   * Attempts to find files using established naming patterns from the codebase.
   * Throws descriptive errors with attempted paths when files cannot be found.
   *
   * @param {string} modId - The mod identifier
   * @param {string} identifier - The action or rule identifier
   * @returns {Promise<{ruleFile: object, conditionFile: object}>} Loaded rule and condition files
   * @throws {Error} If files cannot be found with detailed error messages
   */
  static async loadModFiles(modId, identifier) {
    const actionName = extractActionName(identifier);
    const errors = [];
    let ruleFile = null;
    let conditionFile = null;

    // Generate fullActionId - if identifier has no namespace, use modId_actionName pattern
    const fullActionId = identifier.includes(':')
      ? identifier.replace(':', '_')
      : `${modId}_${actionName}`;

    // Try to load rule file
    const rulePaths = MOD_FILE_CONVENTIONS.rules.map((pattern) =>
      pattern
        .replace('{modId}', modId)
        .replace('{actionName}', actionName)
        .replace('{fullActionId}', fullActionId)
    );

    for (const rulePath of rulePaths) {
      try {
        const resolvedPath = resolve(rulePath);
        const content = await fs.readFile(resolvedPath, 'utf8');
        ruleFile = JSON.parse(content);
        break;
      } catch (error) {
        errors.push(`Failed to load rule from ${rulePath}: ${error.message}`);
      }
    }

    // Generate fullActionId for conditions - use hyphens instead of underscores
    const fullActionIdForConditions = identifier.includes(':')
      ? identifier.replace(/[:_]/g, '-')
      : `${modId}-${actionName.replace(/_/g, '-')}`;

    // Try to load condition file
    const conditionPaths = MOD_FILE_CONVENTIONS.conditions.map((pattern) =>
      pattern
        .replace('{modId}', modId)
        .replace('{actionName}', actionName.replace(/_/g, '-')) // Convert all underscores to hyphens for condition files
        .replace('{fullActionId}', fullActionIdForConditions)
    );

    for (const conditionPath of conditionPaths) {
      try {
        const resolvedPath = resolve(conditionPath);
        const content = await fs.readFile(resolvedPath, 'utf8');
        conditionFile = JSON.parse(content);
        break;
      } catch (error) {
        errors.push(
          `Failed to load condition from ${conditionPath}: ${error.message}`
        );
      }
    }

    if (!ruleFile) {
      throw new Error(
        `Could not load rule file for ${modId}:${identifier}. Tried paths: ${rulePaths.join(', ')}`
      );
    }
    if (!conditionFile) {
      throw new Error(
        `Could not load condition file for ${modId}:${identifier}. Tried paths: ${conditionPaths.join(', ')}`
      );
    }

    return { ruleFile, conditionFile };
  }

  /**
   * Returns conventional file paths for a given mod and identifier.
   *
   * This utility method helps with debugging and understanding which
   * paths will be tried during auto-loading.
   *
   * @param {string} modId - The mod identifier
   * @param {string} identifier - The action or rule identifier
   * @returns {{rulePaths: string[], conditionPaths: string[]}} Arrays of conventional paths
   */
  static getConventionalPaths(modId, identifier) {
    const actionName = extractActionName(identifier);

    // Generate fullActionId - if identifier has no namespace, use modId_actionName pattern
    const fullActionId = identifier.includes(':')
      ? identifier.replace(':', '_')
      : `${modId}_${actionName}`;

    const rulePaths = MOD_FILE_CONVENTIONS.rules.map((pattern) =>
      pattern
        .replace('{modId}', modId)
        .replace('{actionName}', actionName)
        .replace('{fullActionId}', fullActionId)
    );

    // Generate fullActionId for conditions - use hyphens instead of underscores
    const fullActionIdForConditions = identifier.includes(':')
      ? identifier.replace(/[:_]/g, '-')
      : `${modId}-${actionName.replace(/_/g, '-')}`;

    const conditionPaths = MOD_FILE_CONVENTIONS.conditions.map((pattern) =>
      pattern
        .replace('{modId}', modId)
        .replace('{actionName}', actionName.replace(/_/g, '-'))
        .replace('{fullActionId}', fullActionIdForConditions)
    );

    return { rulePaths, conditionPaths };
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
      getConditionDefinition: jest.fn((id) => {
        // Return condition file if the id matches either the generated conditionId or the actual condition file id
        if (id === conditionId || (conditionFile && id === conditionFile.id)) {
          return conditionFile;
        }
        return undefined;
      }),
    };

    const handlerFactory = ModTestHandlerFactory.getHandlerFactoryForCategory(
      this.modId
    );

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

    // Add actionFile property for compatibility with categoryPatternValidation.test.js
    // This contains the string representation of the action file content
    this.actionFile = ruleFile ? JSON.stringify(ruleFile) : null;

    const conditionId = `${modId}:event-is-action-${actionId.replace(`${modId}:`, '').replace(/_/g, '-')}`;
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
  createAnatomyScenario(
    names = ['Alice', 'Bob'],
    bodyParts = ['torso', 'breast', 'breast'],
    options = {}
  ) {
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

    // Create a copy of entities to avoid modifying the original scenario
    const entities = [...scenario.allEntities];

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
    const { originalInput, additionalPayload = {} } = options;

    // Ensure actionId is properly namespaced
    const fullActionId = this.actionId.includes(':')
      ? this.actionId
      : `${this.modId}:${this.actionId}`;

    const payload = {
      eventName: 'core:attempt_action',
      actorId,
      actionId: fullActionId,
      targetId,
      originalInput:
        originalInput || `${this.actionId.split(':')[1] || this.actionId} ${targetId}`,
      ...additionalPayload,
    };

    return this.eventBus.dispatch(ATTEMPT_ACTION_ID, payload);
  }

  /**
   * Executes an action manually with a custom action ID.
   *
   * @param {string} actorId - Actor entity ID
   * @param {string} actionId - Custom action ID to execute
   * @param {string} targetId - Target entity ID
   * @param {object} [options] - Additional options
   * @returns {Promise} Promise that resolves when action is dispatched
   */
  async executeActionManual(actorId, actionId, targetId, options = {}) {
    const { originalInput, additionalPayload = {} } = options;
    const payload = {
      eventName: 'core:attempt_action',
      actorId,
      actionId,
      targetId,
      originalInput: originalInput || `${actionId.split(':')[1]} ${targetId}`,
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
    ModAssertionHelpers.assertActionSuccess(
      this.events,
      expectedMessage,
      options
    );
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
    ModAssertionHelpers.assertOnlyExpectedEvents(
      this.events,
      allowedEventTypes
    );
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
