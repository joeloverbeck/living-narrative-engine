/**
 * @file Factory for creating specialized mod test environments
 * @description Provides high-level test environment creation for common mod testing scenarios with auto-loading capabilities
 */

import process from 'node:process';
import { createRequire } from 'node:module';

import { jest } from '@jest/globals';
import { createRuleTestEnvironment } from '../engine/systemLogicTestEnv.js';
import { expandMacros } from '../../../src/utils/macroUtils.js';
import logSuccessMacro from '../../../data/mods/core/macros/logSuccessAndEndTurn.macro.json';
import displaySuccessMacro from '../../../data/mods/core/macros/displaySuccessAndEndTurn.macro.json';
import { ATTEMPT_ACTION_ID } from '../../../src/constants/eventIds.js';
import { promises as fs } from 'fs';
import { resolve } from 'path';

import { ModTestHandlerFactory } from './ModTestHandlerFactory.js';
import { ModEntityBuilder, ModEntityScenarios } from './ModEntityBuilder.js';
import { ModAssertionHelpers } from './ModAssertionHelpers.js';
import {
  createActionValidationProxy,
  createRuleValidationProxy,
} from './actionValidationProxy.js';
import { DiscoveryDiagnostics } from './discoveryDiagnostics.js';
import {
  validateActionExecution,
  ActionValidationError,
} from './actionExecutionValidator.js';

const localRequire = createRequire(import.meta.url);

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
      const fixture = new ModActionTestFixture(
        modId,
        actionId,
        finalRuleFile,
        finalConditionFile,
        options
      );

      // Setup environment must be called after construction since it's async
      await fixture.initialize();

      return fixture;
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
      const fixture = new ModRuleTestFixture(
        modId,
        ruleId,
        finalRuleFile,
        finalConditionFile,
        options
      );

      // Setup environment must be called after construction since it's async
      await fixture.initialize();

      return fixture;
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
    const fixture = new ModActionTestFixture(
      modId,
      actionId,
      ruleFile,
      conditionFile,
      options
    );
    await fixture.initialize();
    return fixture;
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
    const fixture = new ModRuleTestFixture(
      modId,
      ruleId,
      ruleFile,
      conditionFile,
      options
    );
    await fixture.initialize();
    return fixture;
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
    this.diagnostics = null; // Will be created on demand
  }

  /**
   * Sets up the test environment.
   *
   * @param {object} ruleFile - Rule definition
   * @param {object} conditionFile - Condition definition
   * @param {string} conditionId - Condition identifier
   */
  async setupEnvironment(ruleFile, conditionFile, conditionId) {
    const macros = {
      'core:logSuccessAndEndTurn': logSuccessMacro,
      'core:displaySuccessAndEndTurn': displaySuccessMacro,
    };

    // Load action definitions for the mod to enable action discovery
    const actionDefinitions = await this.loadActionDefinitions();

    // Create conditions map for the test environment
    const conditions = {};
    if (conditionFile) {
      // Add both the conditionId and the actual condition file id
      conditions[conditionId] = conditionFile;
      if (conditionFile.id && conditionFile.id !== conditionId) {
        conditions[conditionFile.id] = conditionFile;
      }
    }

    const normalizedActionId = this.actionId.includes(':')
      ? this.actionId
      : `${this.modId}:${this.actionId}`;
    let targetActionDefinition = actionDefinitions.find(
      (definition) => definition.id === normalizedActionId
    );

    if (!targetActionDefinition) {
      const actionFilePath = this.actionId.includes(':')
        ? `data/mods/${this.modId}/actions/${this.actionId.split(':')[1]}.action.json`
        : `data/mods/${this.modId}/actions/${this.actionId}.action.json`;

      try {
        const resolvedPath = resolve(actionFilePath);
        const content = await fs.readFile(resolvedPath, 'utf8');
        targetActionDefinition = JSON.parse(content);
      } catch (error) {
        console.warn(
          `⚠️  Failed to load action definition for ${normalizedActionId} from ${actionFilePath}: ${error.message}`
        );
      }
    }

    if (targetActionDefinition?.prerequisites) {
      const collectConditionRefs = (node, accumulator) => {
        if (!node) {
          return;
        }

        if (Array.isArray(node)) {
          node.forEach((item) => collectConditionRefs(item, accumulator));
          return;
        }

        if (typeof node !== 'object') {
          return;
        }

        if (typeof node.condition_ref === 'string') {
          accumulator.add(node.condition_ref);
        }

        for (const value of Object.values(node)) {
          if (value && typeof value === 'object') {
            collectConditionRefs(value, accumulator);
          }
        }
      };

      const prerequisiteConditionIds = new Set();
      for (const prerequisite of targetActionDefinition.prerequisites) {
        collectConditionRefs(prerequisite, prerequisiteConditionIds);
      }

      for (const prerequisiteConditionId of prerequisiteConditionIds) {
        if (conditions[prerequisiteConditionId]) {
          continue;
        }

        try {
          const loadedCondition = await ModTestFixture.loadConditionFile(
            this.modId,
            prerequisiteConditionId
          );

          if (loadedCondition) {
            conditions[prerequisiteConditionId] = loadedCondition;

            if (
              loadedCondition.id &&
              loadedCondition.id !== prerequisiteConditionId
            ) {
              conditions[loadedCondition.id] = loadedCondition;
            }
          }
        } catch (error) {
          console.warn(
            `⚠️  Failed to auto-load prerequisite condition '${prerequisiteConditionId}' for action ${normalizedActionId}: ${error.message}`
          );
        }
      }
    }

    const handlerFactory = ModTestHandlerFactory.getHandlerFactoryForCategory(
      this.modId
    );

    // Don't pass dataRegistry - let createRuleTestEnvironment create one that uses the expanded rules
    this.testEnv = createRuleTestEnvironment({
      createHandlers: handlerFactory,
      entities: [],
      rules: [ruleFile],  // Pass unexpanded rule - createBaseRuleEnvironment will expand it
      actions: actionDefinitions,
      conditions,  // Pass conditions map instead of dataRegistry
      macros,  // Pass macros for expansion
    });
  }

  /**
   * Loads all action definitions from the mod's actions directory.
   *
   * @returns {Promise<Array<object>>} Array of action definitions
   */
  async loadActionDefinitions() {
    const actionsDir = resolve(`data/mods/${this.modId}/actions`);

    console.log('\n=== LOADING ACTION DEFINITIONS ===');
    console.log('Actions directory:', actionsDir);
    console.log('Mod ID:', this.modId);

    try {
      const files = await fs.readdir(actionsDir);
      console.log('All files in directory:', files);

      const actionFiles = files.filter(f => f.endsWith('.action.json'));
      console.log('Action files (filtered):', actionFiles);

      const actions = await Promise.all(
        actionFiles.map(async (file) => {
          try {
            const filePath = resolve(actionsDir, file);
            const content = await fs.readFile(filePath, 'utf8');
            const parsed = JSON.parse(content);

            // Validate action definition
            try {
              createActionValidationProxy(parsed, `${this.modId}:${file} action`);
            } catch (validationError) {
              console.log(
                `❌ Validation failed for ${file}: ${validationError.message}`
              );
              return null;
            }

            console.log(`✅ Successfully loaded ${file}: ${parsed.id}`);
            return parsed;
          } catch (error) {
            // Silently skip files that can't be loaded
            console.log(`❌ Failed to load ${file}: ${error.message}`);
            return null;
          }
        })
      );

      // Filter out nulls from failed loads
      const validActions = actions.filter(a => a !== null);
      console.log('Total actions loaded:', validActions.length);
      console.log('Action IDs:', validActions.map(a => a.id));
      console.log('=== END LOADING ACTION DEFINITIONS ===\n');

      return validActions;
    } catch (error) {
      // If the actions directory doesn't exist or can't be read, return empty array
      console.log(`❌ Failed to read directory: ${error.message}`);
      console.log('=== END LOADING ACTION DEFINITIONS ===\n');
      return [];
    }
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
   * Enable diagnostic mode for action discovery debugging
   *
   * @returns {DiscoveryDiagnostics} Diagnostics instance
   */
  enableDiagnostics() {
    if (!this.diagnostics) {
      this.diagnostics = new DiscoveryDiagnostics(this);
    }
    this.diagnostics.enableDiagnostics();
    return this.diagnostics;
  }

  /**
   * Disable diagnostic mode
   */
  disableDiagnostics() {
    if (this.diagnostics) {
      this.diagnostics.disableDiagnostics();
    }
  }

  /**
   * Discover actions with full diagnostic output
   * Useful for debugging why an action doesn't appear
   *
   * @param {string} actorId - Actor to discover for
   * @param {string} [expectedActionId] - Optional action to look for
   * @returns {Array} Discovered actions (synchronous)
   */
  discoverWithDiagnostics(actorId, expectedActionId = null) {
    const diag = this.enableDiagnostics();
    return diag.discoverWithDiagnostics(actorId, expectedActionId);
  }

  /**
   * Creates an entity using a configuration object.
   * Provides a convenient way to create entities without manually instantiating ModEntityBuilder.
   *
   * @param {object} config - Entity configuration
   * @param {string} config.id - Entity ID
   * @param {object} config.components - Components to add to the entity
   * @returns {object} Built entity object
   *
   * @example
   * const entity = testFixture.createEntity({
   *   id: 'actor1',
   *   components: {
   *     'core:name': { text: 'Alice' },
   *     'core:position': { locationId: 'room1' }
   *   }
   * });
   */
  createEntity(config) {
    const { id, components = {} } = config;

    if (!id) {
      throw new Error('ModTestFixture.createEntity: config.id is required');
    }

    if (typeof components !== 'object' || components === null) {
      throw new Error('ModTestFixture.createEntity: config.components must be an object');
    }

    // Create builder with the ID
    const builder = new ModEntityBuilder(id);

    // Add each component using withComponent
    for (const [componentId, componentData] of Object.entries(components)) {
      builder.withComponent(componentId, componentData);
    }

    return builder.build();
  }

  /**
   * Cleans up the test environment.
   */
  cleanup() {
    this.disableDiagnostics();
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

    // Store rule file without validation proxy
    // (Production rules follow rule.schema.json format and are validated by the schema system)
    this.ruleFile = ruleFile;
    this.conditionFile = conditionFile;

    // Validate action definition if provided in options
    if (options.actionDefinition) {
      try {
        createActionValidationProxy(
          options.actionDefinition,
          `${modId}:${actionId} action`
        );
      } catch (err) {
        console.error('\n⚠️  Action validation failed:');
        console.error(err.message);
        throw err;
      }
    }

    // Add actionFile property for compatibility with categoryPatternValidation.test.js
    // This contains the string representation of the action file content
    this.actionFile = ruleFile ? JSON.stringify(ruleFile) : null;

    // Store conditionId for deferred initialization
    this.conditionId = `${modId}:event-is-action-${actionId.replace(`${modId}:`, '').replace(/_/g, '-')}`;
  }

  /**
   * Initialize the test environment asynchronously.
   * Must be called after construction since setupEnvironment is now async.
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    await this.setupEnvironment(this.ruleFile, this.conditionFile, this.conditionId);
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
   * @description Creates a configurable sitting arrangement and loads it into the fixture.
   *
   * @param {object} [options] - Scenario overrides forwarded to ModEntityScenarios.createSittingArrangement
   * @returns {object} Scenario details including room, furniture, and actors
   */
  createSittingArrangement(options = {}) {
    const scenario = ModEntityScenarios.createSittingArrangement(options);
    this.reset([...scenario.entities]);
    return scenario;
  }

  /**
   * @description Creates a two-actor sitting pair scenario and loads it into the fixture.
   *
   * @param {object} [options] - Scenario overrides forwarded to ModEntityScenarios.createSittingPair
   * @returns {object} Scenario details including seated actors and furniture
   */
  createSittingPair(options = {}) {
    const scenario = ModEntityScenarios.createSittingPair(options);
    this.reset([...scenario.entities]);
    return scenario;
  }

  /**
   * @description Creates a solo sitting scenario and loads it into the fixture.
   *
   * @param {object} [options] - Scenario overrides forwarded to ModEntityScenarios.createSoloSitting
   * @returns {object} Scenario details including the seated actor and furniture
   */
  createSoloSitting(options = {}) {
    const scenario = ModEntityScenarios.createSoloSitting(options);
    this.reset([...scenario.entities]);
    return scenario;
  }

  /**
   * @description Creates an inventory loadout scenario and hydrates the fixture.
   *
   * @param {object} [options] - Scenario overrides forwarded to ModEntityScenarios.createInventoryLoadout
   * @returns {object} Scenario details including room, actor, and inventory items
   */
  createInventoryLoadout(options = {}) {
    const scenario = ModEntityScenarios.createInventoryLoadout(options);
    this.reset([...scenario.entities]);
    return scenario;
  }

  /**
   * @description Creates a scenario with items on the ground and optional actor context.
   *
   * @param {object} [options] - Scenario overrides forwarded to ModEntityScenarios.createItemsOnGround
   * @returns {object} Scenario details including room, items, and optional actor references
   */
  createItemsOnGround(options = {}) {
    const scenario = ModEntityScenarios.createItemsOnGround(options);
    this.reset([...scenario.entities]);
    return scenario;
  }

  /**
   * @description Creates a container with contents and loads it into the fixture.
   *
   * @param {object} [options] - Scenario overrides forwarded to ModEntityScenarios.createContainerWithContents
   * @returns {object} Scenario details including room, container, and contents
   */
  createContainerWithContents(options = {}) {
    const scenario = ModEntityScenarios.createContainerWithContents(options);
    this.reset([...scenario.entities]);
    return scenario;
  }

  /**
   * @description Creates a giver/receiver transfer scenario for inventory actions.
   *
   * @param {object} [options] - Scenario overrides forwarded to ModEntityScenarios.createInventoryTransfer
   * @returns {object} Scenario details including room, actors, and transfer item references
   */
  createInventoryTransfer(options = {}) {
    const scenario = ModEntityScenarios.createInventoryTransfer(options);
    this.reset([...scenario.entities]);
    return scenario;
  }

  /**
   * @description Creates an actor ready to drop an inventory item and loads it into the fixture.
   *
   * @param {object} [options] - Scenario overrides forwarded to ModEntityScenarios.createDropItemScenario
   * @returns {object} Scenario details including room, actor, and item references
   */
  createDropItemScenario(options = {}) {
    const scenario = ModEntityScenarios.createDropItemScenario(options);
    this.reset([...scenario.entities]);
    return scenario;
  }

  /**
   * @description Creates a pickup scenario with a ground item and hydrates the fixture.
   *
   * @param {object} [options] - Scenario overrides forwarded to ModEntityScenarios.createPickupScenario
   * @returns {object} Scenario details including room, actor, and ground item
   */
  createPickupScenario(options = {}) {
    const scenario = ModEntityScenarios.createPickupScenario(options);
    this.reset([...scenario.entities]);
    return scenario;
  }

  /**
   * @description Creates an actor and container pair for open container workflows and loads it into the fixture.
   *
   * @param {object} [options] - Scenario overrides forwarded to ModEntityScenarios.createOpenContainerScenario
   * @returns {object} Scenario details including room, actor, container, and optional key references
   */
  createOpenContainerScenario(options = {}) {
    const scenario = ModEntityScenarios.createOpenContainerScenario(options);
    this.reset([...scenario.entities]);
    return scenario;
  }

  /**
   * @description Creates a put-in-container scenario and hydrates the fixture.
   *
   * @param {object} [options] - Scenario overrides forwarded to ModEntityScenarios.createPutInContainerScenario
   * @returns {object} Scenario details including room, actor, container, and held item references
   */
  createPutInContainerScenario(options = {}) {
    const scenario = ModEntityScenarios.createPutInContainerScenario(options);
    this.reset([...scenario.entities]);
    return scenario;
  }

  /**
   * @description Creates a seated plus standing arrangement and loads it into the fixture.
   *
   * @param {object} [options] - Scenario overrides forwarded to ModEntityScenarios.createStandingNearSitting
   * @returns {object} Scenario details including seated and standing actors
   */
  createStandingNearSitting(options = {}) {
    const scenario = ModEntityScenarios.createStandingNearSitting(options);
    this.reset([...scenario.entities]);
    return scenario;
  }

  /**
   * @description Creates a scenario with actors on separate furniture entities and loads it into the fixture.
   *
   * @param {object} [options] - Scenario overrides forwarded to ModEntityScenarios.createSeparateFurnitureArrangement
   * @returns {object} Scenario details including multiple furniture entities
   */
  createSeparateFurnitureArrangement(options = {}) {
    const scenario = ModEntityScenarios.createSeparateFurnitureArrangement(options);
    this.reset([...scenario.entities]);
    return scenario;
  }

  /**
   * @description Creates a seated actor with kneeling companions and loads it into the fixture.
   *
   * @param {object} [options] - Scenario overrides forwarded to ModEntityScenarios.createKneelingBeforeSitting
   * @returns {object} Scenario details including seated and kneeling actors
   */
  createKneelingBeforeSitting(options = {}) {
    const scenario = ModEntityScenarios.createKneelingBeforeSitting(options);
    this.reset([...scenario.entities]);
    return scenario;
  }

  /**
   * Executes the action with standard parameters.
   *
   * Enhanced to include action discovery pipeline validation by default.
   * Set options.skipDiscovery = true to use legacy direct execution.
   *
   * @param {string} actorId - Actor entity ID
   * @param {string} targetId - Target entity ID
   * @param {object} [options] - Additional options
   * @param {boolean} [options.skipDiscovery] - If true, bypass action discovery (legacy behavior)
   * @param {string} [options.originalInput] - Original user input
   * @param {object} [options.additionalPayload] - Additional payload data
   * @returns {Promise} Promise that resolves when action is dispatched
   */
  async executeAction(actorId, targetId, options = {}) {
    const {
      skipDiscovery = false,
      skipValidation = false,
      originalInput,
      additionalPayload = {},
    } = options;

    // Ensure actionId is properly namespaced
    const fullActionId = this.actionId.includes(':')
      ? this.actionId
      : `${this.modId}:${this.actionId}`;

    // Legacy behavior: direct rule execution (bypasses discovery/validation)
    if (skipDiscovery) {
      const payload = {
        eventName: 'core:attempt_action',
        actorId,
        actionId: fullActionId,
        targetId,
        originalInput:
          originalInput ||
          `${this.actionId.split(':')[1] || this.actionId} ${targetId}`,
        ...additionalPayload,
      };

      const result = await this.eventBus.dispatch(ATTEMPT_ACTION_ID, payload);

      // IMPORTANT: Give the SystemLogicInterpreter time to process the event
      // The interpreter listens to events asynchronously, so we need a small delay
      // to ensure rules are processed before the test continues
      await new Promise((resolve) => setTimeout(resolve, 10));

      return result;
    }

    console.log(`[EXECUTE ACTION START] Called with actorId=${actorId}, targetId=${targetId}, skipDiscovery=${skipDiscovery}`);

    // Load action definition if not cached (needed for validation)
    if (!this._actionDefinition) {
      const { promises: fs } = await import('fs');
      const { resolve } = await import('path');

      const actionFilePath = this.actionId.includes(':')
        ? `data/mods/${this.modId}/actions/${this.actionId.split(':')[1]}.action.json`
        : `data/mods/${this.modId}/actions/${this.actionId}.action.json`;

      try {
        const resolvedPath = resolve(actionFilePath);
        const content = await fs.readFile(resolvedPath, 'utf8');
        this._actionDefinition = JSON.parse(content);
        console.log(`[ACTION DEF] Loaded action definition from ${actionFilePath}`);
      } catch (error) {
        this.logger.warn(
          `Failed to load action definition from ${actionFilePath}: ${error.message}`
        );
        this._actionDefinition = {};
      }
    }

    // Pre-flight validation (unless explicitly skipped)
    if (!skipValidation) {
      const validationErrors = validateActionExecution({
        actorId,
        targetId,
        secondaryTargetId: options.secondaryTargetId || null,
        tertiaryTargetId: options.tertiaryTargetId || null,
        actionDefinition: this._actionDefinition,
        entityManager: this.entityManager,
        actionId: fullActionId,
      });

      if (validationErrors.length > 0) {
        throw new ActionValidationError(validationErrors, {
          actorId,
          targetId,
          secondaryTargetId: options.secondaryTargetId,
          tertiaryTargetId: options.tertiaryTargetId,
          actionId: fullActionId,
          context: 'test execution',
        });
      }
    }

    const actorBefore = this.entityManager.getEntityInstance(actorId);

    // Defensive check: ensure entity exists before accessing components
    // Note: This should be caught by validation above, but kept for backward compatibility
    if (!actorBefore) {
      const errorMsg = `Entity ${actorId} does not exist. Ensure entities are created before calling executeAction (use createStandardActorTarget() or reset(entities)).`;
      console.error(`[EXECUTE ACTION ERROR] ${errorMsg}`);
      return {
        blocked: true,
        reason: errorMsg,
        attemptedAction: this.actionId.includes(':') ? this.actionId : `${this.modId}:${this.actionId}`,
        attemptedActor: actorId,
      };
    }

    if (!actorBefore.components) {
      const errorMsg = `Entity ${actorId} exists but has no components property. This indicates a malformed entity.`;
      console.error(`[EXECUTE ACTION ERROR] ${errorMsg}`);
      return {
        blocked: true,
        reason: errorMsg,
        attemptedAction: this.actionId.includes(':') ? this.actionId : `${this.modId}:${this.actionId}`,
        attemptedActor: actorId,
      };
    }

    console.log(`[EXECUTE ACTION START] Actor ${actorId} components BEFORE: ${JSON.stringify(Object.keys(actorBefore.components))}`);

    // Note: Action definition loading and component validation now handled by
    // validateActionExecution() above. The old validation code has been removed
    // to avoid duplication and ensure consistent validation behavior.

    // If validation passed, execute the action
    const payload = {
      eventName: 'core:attempt_action',
      actorId,
      actionId: fullActionId,
      targetId,
      originalInput:
        originalInput ||
        `${this.actionId.split(':')[1] || this.actionId} ${targetId}`,
      ...additionalPayload,
    };

    console.log(`[EXECUTE ACTION] About to dispatch action ${fullActionId}`);
    console.log(`[EXECUTE ACTION] Forbidden component check passed, executing action`);

    const result = await this.eventBus.dispatch(ATTEMPT_ACTION_ID, payload);

    console.log(`[EXECUTE ACTION] EventBus.dispatch returned: ${JSON.stringify(result)}`);

    // IMPORTANT: Give the SystemLogicInterpreter time to process the event
    // The interpreter listens to events asynchronously, so we need a small delay
    // to ensure rules are processed before the test continues
    await new Promise((resolve) => setTimeout(resolve, 10));

    console.log(`[EXECUTE ACTION] After 10ms delay, checking actor components`);
    const actorAfter = this.entityManager.getEntityInstance(actorId);
    console.log(`[EXECUTE ACTION] Actor ${actorId} components AFTER: ${JSON.stringify(Object.keys(actorAfter.components))}`);

    return result;
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
   * Discovers available actions for an actor using the action discovery pipeline.
   *
   * This method wraps the test environment's getAvailableActions functionality,
   * providing the same action discovery capabilities available in the test environment.
   *
   * In test environments, discovered actions are automatically wrapped with strict
   * property access validation to catch typos and incorrect property names early.
   *
   * @param {string} actorId - Actor entity ID
   * @returns {Array<object>} Array of available actions for the actor
   * @throws {Error} If test environment doesn't support action discovery
   */
  discoverActions(actorId) {
    if (!this.testEnv || !this.testEnv.getAvailableActions) {
      throw new Error(
        'Test environment does not support action discovery. Ensure the test environment was created with createRuleTestEnvironment.'
      );
    }

    try {
      const actions = this.testEnv.getAvailableActions(actorId);

      // In test environment, wrap actions with strict validation
      if (process.env.NODE_ENV === 'test') {
        // Lazy-load the helper to avoid circular dependencies
        const { wrapActionsWithStrictValidation } = localRequire(
          '../strictTestHelpers.js'
        );
        return wrapActionsWithStrictValidation(actions);
      }

      return actions;
    } catch (error) {
      this.logger.error(
        `Failed to discover actions for actor ${actorId}: ${error.message}`,
        error
      );
      throw error;
    }
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
