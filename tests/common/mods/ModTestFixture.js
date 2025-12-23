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
import logFailureMacro from '../../../data/mods/core/macros/logFailureAndEndTurn.macro.json';
import logSuccessOutcomeMacro from '../../../data/mods/core/macros/logSuccessOutcomeAndEndTurn.macro.json';
import logFailureOutcomeMacro from '../../../data/mods/core/macros/logFailureOutcomeAndEndTurn.macro.json';
import endTurnOnlyMacro from '../../../data/mods/core/macros/endTurnOnly.macro.json';
// Weapons macros for melee combat
import handleMeleeCriticalMacro from '../../../data/mods/weapons/macros/handleMeleeCritical.macro.json';
import handleMeleeHitMacro from '../../../data/mods/weapons/macros/handleMeleeHit.macro.json';
import handleMeleeFumbleMacro from '../../../data/mods/weapons/macros/handleMeleeFumble.macro.json';
import handleMeleeMissMacro from '../../../data/mods/weapons/macros/handleMeleeMiss.macro.json';
// Ranged macros for throw action
import handleThrowCriticalMacro from '../../../data/mods/ranged/macros/handleThrowCritical.macro.json';
import handleThrowHitMacro from '../../../data/mods/ranged/macros/handleThrowHit.macro.json';
import handleThrowFumbleMacro from '../../../data/mods/ranged/macros/handleThrowFumble.macro.json';
import handleThrowMissMacro from '../../../data/mods/ranged/macros/handleThrowMiss.macro.json';
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
import { ScopeResolverHelpers } from './scopeResolverHelpers.js';
import { ParameterValidator } from '../../../src/scopeDsl/core/parameterValidator.js';
import { ParameterValidationError } from '../../../src/scopeDsl/errors/parameterValidationError.js';
import { ScopeResolutionError } from '../../../src/scopeDsl/errors/scopeResolutionError.js';
import ScopeConditionAnalyzer from '../engine/scopeConditionAnalyzer.js';
import { parseScopeDefinitions } from '../../../src/scopeDsl/scopeDefinitionParser.js';
import { ScopeEvaluationTracer } from './scopeEvaluationTracer.js';

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
 * Determines if the provided value matches the expected structure of a rule definition.
 *
 * @param {unknown} candidate - Parsed JSON candidate.
 * @returns {boolean} True when the candidate looks like a rule definition.
 */
function isRuleDefinition(candidate) {
  if (!candidate || typeof candidate !== 'object') {
    return false;
  }

  const rule = /** @type {{ rule_id?: unknown, actions?: unknown }} */ (
    candidate
  );
  return (
    typeof rule.rule_id === 'string' &&
    (Array.isArray(rule.actions) || rule.actions === undefined)
  );
}

/**
 * Determines if the provided value matches the expected structure of a condition definition.
 *
 * @param {unknown} candidate - Parsed JSON candidate.
 * @returns {boolean} True when the candidate looks like a condition definition.
 */
function isConditionDefinition(candidate) {
  if (!candidate || typeof candidate !== 'object') {
    return false;
  }

  const condition = /** @type {{ id?: unknown }} */ (candidate);
  return typeof condition.id === 'string';
}

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
 *
 * Schema validation (SCHVALTESINT-001): Now validates rule and condition files
 * against their JSON schemas before test setup. Use `skipValidation: true` in
 * options to bypass validation for debugging edge cases.
 */
export class ModTestFixture {
  /** @type {import('ajv').default|null} */
  static #schemaValidator = null;

  /** @type {boolean} */
  static #schemasLoaded = false;

  /**
   * Ensures the schema validator is initialized with AJV and required schemas.
   * Uses lazy loading to only initialize when first needed.
   *
   * @returns {Promise<import('ajv').default>} Initialized AJV instance
   * @private
   */
  static async #ensureSchemaValidator() {
    if (!this.#schemaValidator) {
      const Ajv = (await import('ajv')).default;
      const addFormats = (await import('ajv-formats')).default;

      const ajv = new Ajv({
        allErrors: true,
        strict: false,
        strictTypes: false,
        verbose: true,
      });
      addFormats(ajv);

      this.#schemaValidator = ajv;
    }

    if (!this.#schemasLoaded) {
      await this.#loadRequiredSchemas();
      this.#schemasLoaded = true;
    }

    return this.#schemaValidator;
  }

  /**
   * Loads required schemas for rule and condition validation.
   * Includes all schema dependencies to ensure proper $ref resolution.
   *
   * @private
   */
  static async #loadRequiredSchemas() {
    const fsPromises = (await import('fs')).promises;
    const { resolve: resolvePath } = await import('path');

    const schemasDir = resolvePath(process.cwd(), 'data/schemas');

    // Order matters: base schemas first, then schemas that reference them
    // nested-operation.schema.json is required by operations/if.schema.json
    // damage-capability-entry.schema.json is required by operations/applyDamage.schema.json
    const schemaFiles = [
      'common.schema.json',
      'json-logic.schema.json',
      'condition-container.schema.json',
      'condition.schema.json',
      'base-operation.schema.json',
      'nested-operation.schema.json',
      'damage-capability-entry.schema.json',
    ];

    // Load base schemas first
    for (const filename of schemaFiles) {
      const schemaPath = resolvePath(schemasDir, filename);
      try {
        const content = await fsPromises.readFile(schemaPath, 'utf8');
        const schema = JSON.parse(content);
        if (schema.$id && !this.#schemaValidator.getSchema(schema.$id)) {
          this.#schemaValidator.addSchema(schema, schema.$id);
        }
      } catch {
        // Schema load failure is non-fatal - validation will be skipped for that schema
      }
    }

    // Load operation schemas from operations subdirectory
    const operationsDir = resolvePath(schemasDir, 'operations');
    try {
      const operationFiles = await fsPromises.readdir(operationsDir);
      for (const file of operationFiles) {
        if (file.endsWith('.schema.json')) {
          const schemaPath = resolvePath(operationsDir, file);
          try {
            const content = await fsPromises.readFile(schemaPath, 'utf8');
            const schema = JSON.parse(content);
            if (schema.$id && !this.#schemaValidator.getSchema(schema.$id)) {
              this.#schemaValidator.addSchema(schema, schema.$id);
            }
          } catch {
            // Individual operation schema load failure is non-fatal
          }
        }
      }
    } catch {
      // Operations directory may not exist in all test environments
    }

    // Load operation.schema.json (depends on operation schemas)
    const operationSchemaPath = resolvePath(
      schemasDir,
      'operation.schema.json'
    );
    try {
      const content = await fsPromises.readFile(operationSchemaPath, 'utf8');
      const schema = JSON.parse(content);
      if (schema.$id && !this.#schemaValidator.getSchema(schema.$id)) {
        this.#schemaValidator.addSchema(schema, schema.$id);
      }
    } catch {
      // Non-fatal
    }

    // Load rule.schema.json (depends on operation.schema.json)
    const ruleSchemaPath = resolvePath(schemasDir, 'rule.schema.json');
    try {
      const content = await fsPromises.readFile(ruleSchemaPath, 'utf8');
      const schema = JSON.parse(content);
      if (schema.$id && !this.#schemaValidator.getSchema(schema.$id)) {
        this.#schemaValidator.addSchema(schema, schema.$id);
      }
    } catch {
      // Non-fatal
    }
  }

  /**
   * Validates mod files against their JSON schemas.
   *
   * @param {string} modId - The mod identifier
   * @param {string} actionId - The action identifier
   * @param {object} ruleFile - The rule file content
   * @param {object} conditionFile - The condition file content
   * @throws {Error} If validation fails with detailed error messages
   * @private
   */
  static async #validateModFiles(modId, actionId, ruleFile, conditionFile) {
    const validator = await this.#ensureSchemaValidator();

    // Validate rule file
    const ruleSchemaId = 'schema://living-narrative-engine/rule.schema.json';
    const ruleValidator = validator.getSchema(ruleSchemaId);
    if (ruleValidator) {
      const isRuleValid = ruleValidator(ruleFile);
      if (!isRuleValid) {
        const errors = ruleValidator.errors || [];
        const errorDetails = errors
          .map((e) => `    ${e.instancePath || '/'}: ${e.message}`)
          .join('\n');
        throw new Error(
          `Schema validation failed for rule file\n` +
            `  Action: ${modId}:${actionId}\n` +
            `  Schema: ${ruleSchemaId}\n` +
            `  Validation errors:\n${errorDetails}`
        );
      }
    }

    // Validate condition file
    const conditionSchemaId =
      'schema://living-narrative-engine/condition.schema.json';
    const conditionValidator = validator.getSchema(conditionSchemaId);
    if (conditionValidator) {
      const isConditionValid = conditionValidator(conditionFile);
      if (!isConditionValid) {
        const errors = conditionValidator.errors || [];
        const errorDetails = errors
          .map((e) => `    ${e.instancePath || '/'}: ${e.message}`)
          .join('\n');
        throw new Error(
          `Schema validation failed for condition file\n` +
            `  Action: ${modId}:${actionId}\n` +
            `  Schema: ${conditionSchemaId}\n` +
            `  Validation errors:\n${errorDetails}`
        );
      }
    }
  }

  /**
   * Resets the schema validator cache.
   * Useful for testing the validation system itself.
   *
   * @static
   */
  static resetSchemaValidator() {
    this.#schemaValidator = null;
    this.#schemasLoaded = false;
  }

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
   * @param {object} [options] - Configuration options
   * @param {boolean} [options.skipValidation] - Skip schema validation (for debugging)
   * @param {boolean} [options.autoRegisterScopes] - Auto-register dependency mod scopes
   * @param {string[]} [options.scopeCategories] - Which scope categories to register (positioning, inventory, items, anatomy)
   * @param {Array<string>} [options.supportingActions] - Additional action IDs whose rules
   *   and conditions should be loaded into the environment for multi-action workflows
   * @returns {Promise<ModActionTestFixture>} Configured test fixture for the action
   * @throws {Error} If auto-loading fails when files are not provided
   * @throws {Error} If schema validation fails (unless skipValidation is true)
   * @example
   * // Manual scope registration (backward compatible)
   * const fixture = await ModTestFixture.forAction('violence', 'violence:grab_neck');
   * ScopeResolverHelpers.registerPositioningScopes(fixture.testEnv);
   * @example
   * // Auto-register positioning scopes (auto-loading rule/condition files)
   * const fixture = await ModTestFixture.forAction(
   *   'violence',
   *   'violence:grab_neck',
   *   null,
   *   null,
   *   { autoRegisterScopes: true }
   * );
   * @example
   * // Auto-register multiple scope categories
   * const fixture = await ModTestFixture.forAction(
   *   'intimacy',
   *   'intimacy:caress_face',
   *   null,
   *   null,
   *   {
   *     autoRegisterScopes: true,
   *     scopeCategories: ['positioning', 'anatomy']
   *   }
   * );
   */
  static async forAction(
    modId,
    actionId,
    ruleFile = null,
    conditionFile = null,
    options = {}
  ) {
    try {
      // Validate options
      this._validateForActionOptions(options);

      const {
        skipValidation = false,
        autoRegisterScopes = false,
        scopeCategories = ['positioning'],
        ...otherOptions
      } = options;

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

      if (typeof finalRuleFile === 'string') {
        const resolvedPath = resolve(finalRuleFile);
        const content = await fs.readFile(resolvedPath, 'utf8');
        finalRuleFile = JSON.parse(content);
      }

      if (typeof finalConditionFile === 'string') {
        const resolvedPath = resolve(finalConditionFile);
        const content = await fs.readFile(resolvedPath, 'utf8');
        finalConditionFile = JSON.parse(content);
      }

      // Validate files against schemas (SCHVALTESINT-001)
      if (!skipValidation && finalRuleFile && finalConditionFile) {
        await this.#validateModFiles(
          modId,
          actionId,
          finalRuleFile,
          finalConditionFile
        );
      }

      // Use existing ModActionTestFixture constructor
      const fixture = new ModActionTestFixture(
        modId,
        actionId,
        finalRuleFile,
        finalConditionFile,
        otherOptions
      );

      // Setup environment must be called after construction since it's async
      await fixture.initialize();

      // Auto-register scopes if requested (NEW)
      if (autoRegisterScopes) {
        this._registerScopeCategories(fixture.testEnv, scopeCategories);
      }

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
   * Validates rule and condition files against their JSON schemas by default
   * (SCHVALTESINT-002).
   *
   * @param {string} modId - The mod identifier
   * @param {string} ruleId - The rule identifier
   * @param {object|null} [ruleFile] - The rule definition JSON (auto-loaded if null/undefined)
   * @param {object|null} [conditionFile] - The condition definition JSON (auto-loaded if null/undefined)
   * @param {object} [options] - Additional configuration options
   * @param {boolean} [options.skipValidation] - Skip schema validation (not recommended)
   * @returns {Promise<ModRuleTestFixture>} Configured test fixture for the rule
   * @throws {Error} If auto-loading fails when files are not provided
   * @throws {Error} If schema validation fails (unless skipValidation: true)
   */
  static async forRule(
    modId,
    ruleId,
    ruleFile = null,
    conditionFile = null,
    options = {}
  ) {
    try {
      const { skipValidation = false, ...otherOptions } = options;

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

      if (typeof finalRuleFile === 'string') {
        const resolvedPath = resolve(finalRuleFile);
        const content = await fs.readFile(resolvedPath, 'utf8');
        finalRuleFile = JSON.parse(content);
      }

      if (typeof finalConditionFile === 'string') {
        const resolvedPath = resolve(finalConditionFile);
        const content = await fs.readFile(resolvedPath, 'utf8');
        finalConditionFile = JSON.parse(content);
      }

      // Validate files against schemas (SCHVALTESINT-002)
      if (!skipValidation && finalRuleFile && finalConditionFile) {
        await this.#validateModFiles(
          modId,
          ruleId,
          finalRuleFile,
          finalConditionFile
        );
      }

      // Use existing ModRuleTestFixture constructor
      const fixture = new ModRuleTestFixture(
        modId,
        ruleId,
        finalRuleFile,
        finalConditionFile,
        otherOptions
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
    const effectiveModId = identifier.includes(':')
      ? identifier.split(':')[0]
      : modId;
    const errors = [];

    // Generate fullActionId - if identifier has no namespace, use modId_actionName pattern
    const fullActionId = identifier.includes(':')
      ? identifier.replace(':', '_')
      : `${effectiveModId}_${actionName}`;

    // Try to load rule file
    const rulePaths = MOD_FILE_CONVENTIONS.rules.map((pattern) =>
      pattern
        .replace('{modId}', effectiveModId)
        .replace('{actionName}', actionName)
        .replace('{fullActionId}', fullActionId)
    );

    for (const rulePath of rulePaths) {
      try {
        const resolvedPath = resolve(rulePath);
        const content = await fs.readFile(resolvedPath, 'utf8');
        const parsedRule = JSON.parse(content);

        if (!isRuleDefinition(parsedRule)) {
          errors.push(
            `Invalid rule definition at ${rulePath}: missing required rule fields.`
          );
          continue;
        }

        return parsedRule;
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
    const targetModId = identifier.includes(':')
      ? identifier.split(':')[0]
      : modId;
    const effectiveModId = targetModId || modId;
    const errors = [];

    // Generate fullActionId for conditions - use hyphens instead of underscores
    const fullActionIdForConditions = identifier.includes(':')
      ? identifier.replace(/[:_]/g, '-')
      : `${effectiveModId}-${actionName.replace(/_/g, '-')}`;

    // Try to load condition file
    const conditionPaths = MOD_FILE_CONVENTIONS.conditions.map((pattern) =>
      pattern
        .replace('{modId}', effectiveModId)
        .replace('{actionName}', actionName.replace(/_/g, '-'))
        .replace('{fullActionId}', fullActionIdForConditions)
    );

    for (const conditionPath of conditionPaths) {
      try {
        const resolvedPath = resolve(conditionPath);
        const content = await fs.readFile(resolvedPath, 'utf8');
        const parsedCondition = JSON.parse(content);

        if (!isConditionDefinition(parsedCondition)) {
          errors.push(
            `Invalid condition definition at ${conditionPath}: missing required condition fields.`
          );
          continue;
        }

        return parsedCondition;
      } catch (error) {
        errors.push(
          `Failed to load condition from ${conditionPath}: ${error.message}`
        );
      }
    }

    throw new Error(
      `Could not load condition file for ${effectiveModId}:${actionName}. Tried paths: ${conditionPaths.join(', ')}`
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
    const effectiveModId = identifier.includes(':')
      ? identifier.split(':')[0]
      : modId;
    const errors = [];
    let ruleFile = null;
    let conditionFile = null;

    // Generate fullActionId - if identifier has no namespace, use modId_actionName pattern
    const fullActionId = identifier.includes(':')
      ? identifier.replace(':', '_')
      : `${effectiveModId}_${actionName}`;

    // Try to load rule file
    const rulePaths = MOD_FILE_CONVENTIONS.rules.map((pattern) =>
      pattern
        .replace('{modId}', effectiveModId)
        .replace('{actionName}', actionName)
        .replace('{fullActionId}', fullActionId)
    );

    for (const rulePath of rulePaths) {
      try {
        const resolvedPath = resolve(rulePath);
        const content = await fs.readFile(resolvedPath, 'utf8');
        const parsedRule = JSON.parse(content);

        if (!isRuleDefinition(parsedRule)) {
          errors.push(
            `Invalid rule definition at ${rulePath}: missing required rule fields.`
          );
          continue;
        }

        ruleFile = parsedRule;
        break;
      } catch (error) {
        errors.push(`Failed to load rule from ${rulePath}: ${error.message}`);
      }
    }

    // Generate fullActionId for conditions - use hyphens instead of underscores
    const fullActionIdForConditions = identifier.includes(':')
      ? identifier.replace(/[:_]/g, '-')
      : `${effectiveModId}-${actionName.replace(/_/g, '-')}`;

    // Try to load condition file
    const conditionPaths = MOD_FILE_CONVENTIONS.conditions.map((pattern) =>
      pattern
        .replace('{modId}', effectiveModId)
        .replace('{actionName}', actionName.replace(/_/g, '-')) // Convert all underscores to hyphens for condition files
        .replace('{fullActionId}', fullActionIdForConditions)
    );

    for (const conditionPath of conditionPaths) {
      try {
        const resolvedPath = resolve(conditionPath);
        const content = await fs.readFile(resolvedPath, 'utf8');
        const parsedCondition = JSON.parse(content);

        if (!isConditionDefinition(parsedCondition)) {
          errors.push(
            `Invalid condition definition at ${conditionPath}: missing required condition fields.`
          );
          continue;
        }

        conditionFile = parsedCondition;
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
   * Validate forAction options
   *
   * @private
   * @param {object} options - Options to validate
   * @throws {Error} If options are invalid
   */
  static _validateForActionOptions(options) {
    if (typeof options !== 'object' || options === null) {
      throw new Error('Options must be an object');
    }

    const { skipValidation, autoRegisterScopes, scopeCategories } = options;

    if (skipValidation !== undefined && typeof skipValidation !== 'boolean') {
      throw new Error('skipValidation must be a boolean');
    }

    if (
      autoRegisterScopes !== undefined &&
      typeof autoRegisterScopes !== 'boolean'
    ) {
      throw new Error('autoRegisterScopes must be a boolean');
    }

    if (scopeCategories !== undefined) {
      if (!Array.isArray(scopeCategories)) {
        throw new Error('scopeCategories must be an array');
      }

      const validCategories = [
        'positioning',
        'inventory',
        'items',
        'anatomy',
        'clothing',
      ];
      const invalidCategories = scopeCategories.filter(
        (cat) => !validCategories.includes(cat)
      );

      if (invalidCategories.length > 0) {
        throw new Error(
          `Invalid scope categories: ${invalidCategories.join(', ')}. ` +
            `Valid categories: ${validCategories.join(', ')}`
        );
      }
    }
  }

  /**
   * Register scope categories based on configuration
   *
   * @private
   * @param {object} testEnv - Test environment
   * @param {string[]} categories - Scope categories to register
   */
  static _registerScopeCategories(testEnv, categories) {
    for (const category of categories) {
      switch (category) {
        case 'positioning':
          ScopeResolverHelpers.registerPositioningScopes(testEnv);
          break;

        case 'inventory':
        case 'items':
          ScopeResolverHelpers.registerInventoryScopes(testEnv);
          break;

        case 'anatomy':
          ScopeResolverHelpers.registerAnatomyScopes(testEnv);
          break;

        case 'clothing':
          ScopeResolverHelpers.registerClothingScopes(testEnv);
          break;

        default:
          console.warn(
            `Unknown scope category "${category}". Valid categories: positioning, inventory, anatomy, clothing`
          );
      }
    }
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
    const effectiveModId = identifier.includes(':')
      ? identifier.split(':')[0]
      : modId;

    // Generate fullActionId - if identifier has no namespace, use modId_actionName pattern
    const fullActionId = identifier.includes(':')
      ? identifier.replace(':', '_')
      : `${effectiveModId}_${actionName}`;

    const rulePaths = MOD_FILE_CONVENTIONS.rules.map((pattern) =>
      pattern
        .replace('{modId}', effectiveModId)
        .replace('{actionName}', actionName)
        .replace('{fullActionId}', fullActionId)
    );

    // Generate fullActionId for conditions - use hyphens instead of underscores
    const fullActionIdForConditions = identifier.includes(':')
      ? identifier.replace(/[:_]/g, '-')
      : `${effectiveModId}-${actionName.replace(/_/g, '-')}`;

    const conditionPaths = MOD_FILE_CONVENTIONS.conditions.map((pattern) =>
      pattern
        .replace('{modId}', effectiveModId)
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
    this.scopeTracer = new ScopeEvaluationTracer();
    this.defaultEntityOptions = {};
  }

  /**
   * Executes an operation directly using the operation interpreter.
   *
   * @param {string} type - Operation type
   * @param {object} context - Execution context (event, parameters, etc.)
   * @returns {Promise<object>} Operation result (usually the modified context)
   */
  async executeOperation(type, context) {
    if (!this.testEnv || !this.testEnv.operationInterpreter) {
      throw new Error('ModTestFixture: Test environment not initialized');
    }

    const operation = {
      type,
      parameters: context.parameters || {},
    };

    const executionContext = {
      evaluationContext: {
        event: context.event || {},
        context: {},
      },
      ...context,
    };

    // Ensure event payload exists
    if (
      executionContext.evaluationContext.event &&
      !executionContext.evaluationContext.event.payload
    ) {
      executionContext.evaluationContext.event.payload = {};
    }

    await this.testEnv.operationInterpreter.execute(
      operation,
      executionContext
    );

    return executionContext.evaluationContext.context;
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
      'core:logFailureAndEndTurn': logFailureMacro,
      'core:logSuccessOutcomeAndEndTurn': logSuccessOutcomeMacro,
      'core:logFailureOutcomeAndEndTurn': logFailureOutcomeMacro,
      'core:endTurnOnly': endTurnOnlyMacro,
      // Weapons macros for melee combat
      'weapons:handleMeleeCritical': handleMeleeCriticalMacro,
      'weapons:handleMeleeHit': handleMeleeHitMacro,
      'weapons:handleMeleeFumble': handleMeleeFumbleMacro,
      'weapons:handleMeleeMiss': handleMeleeMissMacro,
      // Ranged throw macros
      'ranged:handleThrowCritical': handleThrowCriticalMacro,
      'ranged:handleThrowHit': handleThrowHitMacro,
      'ranged:handleThrowFumble': handleThrowFumbleMacro,
      'ranged:handleThrowMiss': handleThrowMissMacro,
    };

    // Load action definitions for the mod to enable action discovery
    const actionDefinitions = await this.loadActionDefinitions();

    // Load lookup definitions for the mod to support QUERY_LOOKUP operations
    const lookups = await this.loadLookupDefinitions();

    // Load scope definitions for the mod to enable scope resolution
    const scopes = await this.loadScopeDefinitions();

    const supportingActions = Array.isArray(this.options.supportingActions)
      ? this.options.supportingActions
          .filter((actionId) => typeof actionId === 'string')
          .map((actionId) => actionId.trim())
          .filter((actionId) => actionId.length > 0)
      : [];

    const uniqueSupportingActions = Array.from(new Set(supportingActions));

    // Track prerequisite condition references across loaded actions
    const prerequisiteConditionIds = new Set();
    for (const actionDef of actionDefinitions) {
      const prerequisites = actionDef?.prerequisites;
      if (!Array.isArray(prerequisites) || prerequisites.length === 0) {
        continue;
      }

      for (const prereq of prerequisites) {
        if (!prereq) {
          continue;
        }

        if (typeof prereq === 'string') {
          prerequisiteConditionIds.add(prereq);
          continue;
        }

        if (
          typeof prereq.condition_ref === 'string' &&
          prereq.condition_ref.trim().length > 0
        ) {
          prerequisiteConditionIds.add(prereq.condition_ref.trim());
          continue;
        }

        if (
          typeof prereq.conditionId === 'string' &&
          prereq.conditionId.trim().length > 0
        ) {
          prerequisiteConditionIds.add(prereq.conditionId.trim());
          continue;
        }

        const logicConditionRef = prereq?.logic?.condition_ref;
        if (typeof logicConditionRef === 'string' && logicConditionRef.trim()) {
          prerequisiteConditionIds.add(logicConditionRef.trim());
        }
      }
    }

    // Create conditions map for the test environment
    const conditions = {};
    if (conditionFile) {
      // Add both the conditionId and the actual condition file id
      conditions[conditionId] = conditionFile;
      if (conditionFile.id && conditionFile.id !== conditionId) {
        conditions[conditionFile.id] = conditionFile;
      }
    }

    const supportingRuleFiles = [];
    for (const supportingAction of uniqueSupportingActions) {
      try {
        const { ruleFile: supportingRule, conditionFile: supportingCondition } =
          await ModTestFixture.tryAutoLoadFiles(this.modId, supportingAction);

        if (supportingRule) {
          supportingRuleFiles.push(supportingRule);
        }

        if (supportingCondition) {
          const normalizedActionName = extractActionName(supportingAction);
          const supportingModId = supportingAction.includes(':')
            ? supportingAction.split(':')[0]
            : this.modId;
          const derivedConditionId = `${supportingModId}:event-is-action-${normalizedActionName.replace(
            /_/g,
            '-'
          )}`;

          conditions[derivedConditionId] = supportingCondition;

          if (
            supportingCondition.id &&
            supportingCondition.id !== derivedConditionId
          ) {
            conditions[supportingCondition.id] = supportingCondition;
          }
        }
      } catch (error) {
        console.warn(
          `⚠️  Failed to load supporting action '${supportingAction}' for ${this.modId}:${this.actionId}: ${error.message}`
        );
      }
    }

    const normalizedActionId = this.actionId.includes(':')
      ? this.actionId
      : `${this.modId}:${this.actionId}`;
    let targetActionDefinition = actionDefinitions.find(
      (definition) => definition.id === normalizedActionId
    );

    if (!targetActionDefinition && actionDefinitions.length > 0) {
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

    // Store action definition for hint generation
    this._actionDefinition = targetActionDefinition;

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

    const rulesToLoad = [ruleFile, ...supportingRuleFiles].filter(Boolean);
    const seenRuleIds = new Set();
    const uniqueRules = [];
    for (const ruleDefinition of rulesToLoad) {
      const ruleId =
        typeof ruleDefinition?.rule_id === 'string'
          ? ruleDefinition.rule_id
          : null;
      if (!ruleId || seenRuleIds.has(ruleId)) {
        if (!ruleId) {
          uniqueRules.push(ruleDefinition);
        }
        continue;
      }
      seenRuleIds.add(ruleId);
      uniqueRules.push(ruleDefinition);
    }

    // Don't pass dataRegistry - let createRuleTestEnvironment create one that uses the expanded rules
    this.testEnv = createRuleTestEnvironment({
      createHandlers: handlerFactory,
      entities: [],
      rules: uniqueRules, // Pass unexpanded rules - createBaseRuleEnvironment will expand them
      actions: actionDefinitions,
      conditions, // Pass conditions map instead of dataRegistry
      macros, // Pass macros for expansion
      lookups, // Pass lookups for QUERY_LOOKUP operations
      scopes, // Pass scopes for scope resolution
      debugPrerequisites: this.options.debugPrerequisites || false,
    });
  }

  /**
   * Loads all action definitions from the mod's actions directory.
   *
   * @returns {Promise<Array<object>>} Array of action definitions
   */
  async loadActionDefinitions() {
    const actionsDir = resolve(`data/mods/${this.modId}/actions`);

    try {
      const files = await fs.readdir(actionsDir);

      const actionFiles = files.filter((f) => f.endsWith('.action.json'));

      const actions = await Promise.all(
        actionFiles.map(async (file) => {
          try {
            const filePath = resolve(actionsDir, file);
            const content = await fs.readFile(filePath, 'utf8');
            const parsed = JSON.parse(content);

            // Validate action definition
            try {
              createActionValidationProxy(
                parsed,
                `${this.modId}:${file} action`
              );
            } catch (validationError) {
              console.warn(
                `⚠️  Action validation failed for ${file}:`,
                validationError.message
              );
              return null;
            }
            return parsed;
          } catch (error) {
            // Silently skip files that can't be loaded
            return null;
          }
        })
      );

      // Filter out nulls from failed loads
      const validActions = actions.filter((a) => a !== null);

      console.log(
        `[ModTestFixture] Loaded ${validActions.length} action(s) for mod '${this.modId}':`,
        validActions.map((a) => a.id)
      );

      return validActions;
    } catch (error) {
      // If the actions directory doesn't exist or can't be read, return empty array
      return [];
    }
  }

  /**
   * Loads all lookup definitions from the mod's lookups directory.
   *
   * @returns {Promise<object>} Object mapping lookup IDs to lookup definitions
   */
  async loadLookupDefinitions() {
    const lookupsDir = resolve(`data/mods/${this.modId}/lookups`);

    try {
      const files = await fs.readdir(lookupsDir);

      const lookupFiles = files.filter((f) => f.endsWith('.lookup.json'));

      const lookups = await Promise.all(
        lookupFiles.map(async (file) => {
          try {
            const filePath = resolve(lookupsDir, file);
            const content = await fs.readFile(filePath, 'utf8');
            const parsed = JSON.parse(content);

            // Validate that the lookup has an id and entries
            if (!parsed.id || !parsed.entries) {
              return null;
            }

            return parsed;
          } catch (error) {
            // Silently skip files that can't be loaded
            return null;
          }
        })
      );

      // Filter out nulls from failed loads and convert to map
      const lookupMap = {};
      for (const lookup of lookups) {
        if (lookup !== null && lookup.id) {
          lookupMap[lookup.id] = lookup;
        }
      }

      return lookupMap;
    } catch (error) {
      // If the lookups directory doesn't exist or can't be read, return empty object
      return {};
    }
  }

  /**
   * Loads all scope definitions from the mod's scopes directory.
   *
   * @returns {Promise<object>} Object mapping scope names to scope definitions
   */
  async loadScopeDefinitions() {
    const scopesDir = resolve(`data/mods/${this.modId}/scopes`);

    try {
      const files = await fs.readdir(scopesDir);

      const scopeFiles = files.filter((f) => f.endsWith('.scope'));

      const allScopes = {};

      for (const file of scopeFiles) {
        try {
          const filePath = resolve(scopesDir, file);
          const content = await fs.readFile(filePath, 'utf8');

          // Parse scope definition using scopeDefinitionParser
          const parsedScopes = parseScopeDefinitions(content, filePath);

          // parseScopeDefinitions returns a Map<scopeName, { expr, ast }>
          // Convert to object format expected by dataRegistry
          for (const [scopeName, scopeData] of parsedScopes.entries()) {
            allScopes[scopeName] = {
              name: scopeName,
              expr: scopeData.expr,
              ast: scopeData.ast,
              source: 'file',
              filePath,
            };
          }
        } catch (error) {
          // Silently skip files that can't be loaded
          continue;
        }
      }

      return allScopes;
    } catch (error) {
      // If the scopes directory doesn't exist or can't be read, return empty object
      return {};
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
   * Enable detailed prerequisite debugging with enhanced error messages.
   * Note: This sets a flag that will be used when the test environment is created.
   * If the environment already exists, you may need to recreate the fixture.
   */
  enablePrerequisiteDebug() {
    this.options.debugPrerequisites = true;
  }

  /**
   * Disable prerequisite debugging.
   * Note: This sets a flag that will be used when the test environment is created.
   * If the environment already exists, you may need to recreate the fixture.
   */
  disablePrerequisiteDebug() {
    this.options.debugPrerequisites = false;
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
   * @param {string} [config.id] - Entity ID (auto-generated if not provided)
   * @param {string} [config.name] - Entity name
   * @param {object|Array} config.components - Components to add (object map or array of {componentId, data})
   * @returns {string} Entity ID
   * @example
   * // Object format
   * const entityId = fixture.createEntity({
   *   id: 'actor1',
   *   components: {
   *     'core:name': { text: 'Alice' },
   *     'core:position': { locationId: 'room1' }
   *   }
   * });
   * @example
   * // Array format with auto-generated ID
   * const entityId = fixture.createEntity({
   *   name: 'Alice',
   *   components: [
   *     { componentId: 'core:actor', data: {} },
   *     { componentId: 'core:position', data: { locationId: 'room1' } }
   *   ]
   * });
   */
  createEntity(config) {
    let { id, name, components = {} } = config;

    // Auto-generate ID if not provided
    if (!id) {
      // Generate a unique ID using timestamp and random number
      id = `entity-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }

    if (typeof components !== 'object' || components === null) {
      throw new Error(
        'ModTestFixture.createEntity: config.components must be an object or array'
      );
    }

    if (!this.testEnv || !this.testEnv.entityManager) {
      throw new Error('ModTestFixture: Test environment not initialized');
    }

    // Create entity in entity manager
    this.testEnv.entityManager.createEntity(id);

    // Add name component if provided
    if (name) {
      this.testEnv.entityManager.addComponent(id, 'core:name', { text: name });
    }

    // Handle array format: [{componentId, data}, ...]
    if (Array.isArray(components)) {
      for (const component of components) {
        if (!component.componentId) {
          throw new Error(
            'ModTestFixture.createEntity: Array components must have componentId property'
          );
        }
        this.testEnv.entityManager.addComponent(
          id,
          component.componentId,
          component.data || {}
        );
      }
    } else {
      // Handle object format: {componentId: data, ...}
      for (const [componentId, componentData] of Object.entries(components)) {
        this.testEnv.entityManager.addComponent(id, componentId, componentData);
      }
    }

    return id;
  }

  /**
   * Modifies a component on an existing entity.
   *
   * @param {string} entityId - Entity ID
   * @param {string} componentId - Component ID
   * @param {any} componentData - Component data
   * @returns {Promise<boolean>} Promise resolving to true on success
   * @example
   * await fixture.modifyComponent('actor1', 'core:position', { locationId: 'room2' });
   */
  async modifyComponent(entityId, componentId, componentData) {
    if (!this.testEnv || !this.testEnv.entityManager) {
      throw new Error('ModTestFixture: Test environment not initialized');
    }

    return await this.testEnv.entityManager.addComponent(
      entityId,
      componentId,
      componentData
    );
  }

  /**
   * Gets a component from an entity.
   *
   * @param {string} entityId - Entity ID
   * @param {string} componentId - Component ID
   * @returns {any} Component data or null
   * @example
   * const position = fixture.getComponent('actor1', 'core:position');
   */
  getComponent(entityId, componentId) {
    if (!this.testEnv || !this.testEnv.entityManager) {
      throw new Error('ModTestFixture: Test environment not initialized');
    }

    return this.testEnv.entityManager.getComponent(entityId, componentId);
  }

  /**
   * Gets the event bus from the test environment.
   *
   * @returns {object} Event bus instance
   */
  get eventBus() {
    if (!this.testEnv || !this.testEnv.eventBus) {
      throw new Error(
        'ModTestFixture: Test environment or event bus not initialized'
      );
    }

    return this.testEnv.eventBus;
  }

  /**
   * Cleans up the test environment.
   */
  cleanup() {
    this.disableDiagnostics();

    // Clear tracer to prevent memory leaks
    if (this.scopeTracer) {
      this.scopeTracer.clear();
      this.scopeTracer.disable();
    }

    if (this.testEnv) {
      this.testEnv.cleanup();
    }
  }

  /**
   * Enable scope evaluation tracing
   *
   * @returns {void}
   */
  enableScopeTracing() {
    this.scopeTracer.enable();
  }

  /**
   * Disable scope evaluation tracing
   *
   * @returns {void}
   */
  disableScopeTracing() {
    this.scopeTracer.disable();
  }

  /**
   * Get formatted scope trace output
   *
   * @returns {string} Human-readable trace
   */
  getScopeTrace() {
    return this.scopeTracer.format();
  }

  /**
   * Get raw scope trace data
   *
   * @returns {object} Trace data structure
   */
  getScopeTraceData() {
    return this.scopeTracer.getTrace();
  }

  /**
   * Get performance metrics from tracer
   *
   * @returns {object|null} Performance metrics
   */
  getScopePerformanceMetrics() {
    return this.scopeTracer.getPerformanceMetrics();
  }

  /**
   * Get formatted trace with performance focus
   *
   * @returns {string} Performance-focused trace
   */
  getScopeTraceWithPerformance() {
    return this.scopeTracer.format({ performanceFocus: true });
  }

  /**
   * Get filter breakdown for last evaluation with enhanced clause analysis.
   *
   * @param {string} entityId - Optional entity ID to filter by
   * @returns {object|Array|null} Filter breakdown with clause analysis
   */
  getFilterBreakdown(entityId = null) {
    const trace = this.scopeTracer.getTrace();
    const filterEvals = trace.steps.filter(
      (s) => s.type === 'FILTER_EVALUATION'
    );

    if (entityId) {
      const found = filterEvals.find((e) => e.entityId === entityId);
      return found
        ? {
            ...found,
            hasBreakdown: !!found.breakdown,
            clauses: found.breakdown
              ? this.#extractClauses(found.breakdown)
              : [],
          }
        : null;
    }

    return filterEvals.map((e) => ({
      entityId: e.entityId,
      result: e.result,
      logic: e.logic,
      hasBreakdown: !!e.breakdown,
      clauses: e.breakdown ? this.#extractClauses(e.breakdown) : [],
    }));
  }

  /**
   * Extract clauses from FilterClauseAnalyzer breakdown tree.
   * Recursively walks the tree and collects operator nodes.
   *
   * @private
   * @param {object} breakdown - FilterClauseAnalyzer breakdown node
   * @param {Array} clauses - Accumulator for clause objects
   * @returns {Array} Array of clause objects with operator, result, description
   */
  #extractClauses(breakdown, clauses = []) {
    if (!breakdown || typeof breakdown !== 'object') {
      return clauses;
    }

    if (breakdown.type === 'operator') {
      clauses.push({
        operator: breakdown.operator,
        result: breakdown.result,
        description: breakdown.description,
      });

      if (breakdown.children && Array.isArray(breakdown.children)) {
        for (const child of breakdown.children) {
          this.#extractClauses(child, clauses);
        }
      }
    }

    return clauses;
  }

  /**
   * Clear scope trace data
   *
   * @returns {void}
   */
  clearScopeTrace() {
    this.scopeTracer.clear();
  }

  /**
   * Enable tracing if condition is true
   *
   * @param {boolean} condition - Enable condition
   * @returns {void}
   */
  enableScopeTracingIf(condition) {
    if (condition) {
      this.scopeTracer.enable();
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

    /**
     * Map to track loaded dependency conditions for mock extension.
     *
     * @private
     */
    this._loadedConditions = new Map();

    /**
     * Registry of known scopes and their registration categories.
     * Used for providing helpful error hints when scopes are not registered.
     *
     * @private
     */
    this._knownScopes = {
      positioning: [
        'personal-space:furniture_actor_sitting_on',
        'positioning:actors_sitting_on_same_furniture',
        'personal-space:closest_leftmost_occupant',
        'personal-space:closest_rightmost_occupant',
        'positioning:furniture_allowing_sitting_at_location',
        'positioning:standing_actors_at_location',
        'positioning:sitting_actors',
        'positioning:kneeling_actors',
        'positioning:furniture_actor_behind',
        'positioning:actor_being_bitten_by_me',
        'personal-space:close_actors_facing_each_other_or_behind_target',
        'personal-space:close_actors_facing_each_other_or_behind_target_with_hands',
        'personal-space:close_actors',
        'personal-space:close_actors_facing_each_other',
        'sitting:actors_both_sitting_close',
        'sitting:actors_sitting_close',
        'personal-space:close_actors_or_entity_kneeling_before_actor',
        'straddling:actor_im_straddling',
        'deference-states:entity_actor_is_kneeling_before',
        'personal-space:actors_sitting_with_space_to_right',
        'sitting:available_furniture',
        'lying:available_lying_furniture',
        'lying:furniture_im_lying_on',
        'sitting:furniture_im_sitting_on',
        'bending:surface_im_bending_over',
        'facing-states:actors_im_facing_away_from',
      ],
      inventory: [
        'items:actor_inventory_items',
        'items:items_at_location',
        'items:portable_items_at_location',
        'items:actors_at_location',
        'containers-core:containers_at_location',
      ],
      anatomy: ['anatomy:actors_at_location', 'anatomy:target_body_parts'],
    };

    /**
     * Flag to suppress action discovery hints.
     *
     * @private
     */
    this._suppressHints = false;
  }

  /**
   * Initialize the test environment asynchronously.
   * Must be called after construction since setupEnvironment is now async.
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    await this.setupEnvironment(
      this.ruleFile,
      this.conditionFile,
      this.conditionId
    );
  }

  /**
   * Creates a standard actor-target setup for the action.
   *
   * @param {Array<string>} [names] - Names for actor and target
   * @param {object} [options] - Additional options
   * @returns {object} Object with actor and target entities
   */
  createStandardActorTarget(names = ['Alice', 'Bob'], options = {}) {
    const mergedOptions = { ...(this.defaultEntityOptions || {}), ...options };

    const scenario = ModEntityScenarios.createActorTargetPair({
      names,
      location: 'room1',
      closeProximity: true,
      ...mergedOptions,
    });

    const entities = [
      scenario.actor,
      scenario.target,
      ...(scenario.extraEntities || []),
    ];

    // Add room if needed
    if (mergedOptions.includeRoom !== false) {
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
   * @param {object} [options] - Scenario overrides forwarded to ModEntityScenarios.createSeparateFurnitureArrangement
   * @returns {object} Scenario details including multiple furniture entities
   */
  createSeparateFurnitureArrangement(options = {}) {
    const scenario =
      ModEntityScenarios.createSeparateFurnitureArrangement(options);
    this.reset([...scenario.entities]);
    return scenario;
  }

  /**
   * @description Creates a seated actor with kneeling companions and loads it into the fixture.
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
        attemptedAction: this.actionId.includes(':')
          ? this.actionId
          : `${this.modId}:${this.actionId}`,
        attemptedActor: actorId,
      };
    }

    if (!actorBefore.components) {
      const errorMsg = `Entity ${actorId} exists but has no components property. This indicates a malformed entity.`;
      console.error(`[EXECUTE ACTION ERROR] ${errorMsg}`);
      return {
        blocked: true,
        reason: errorMsg,
        attemptedAction: this.actionId.includes(':')
          ? this.actionId
          : `${this.modId}:${this.actionId}`,
        attemptedActor: actorId,
      };
    }

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

    if (targetId && payload.primaryId === undefined) {
      payload.primaryId = targetId;
    }

    const result = await this.eventBus.dispatch(ATTEMPT_ACTION_ID, payload);

    // IMPORTANT: Give the SystemLogicInterpreter time to process the event
    // The interpreter listens to events asynchronously, so we need a small delay
    // to ensure rules are processed before the test continues
    await new Promise((resolve) => setTimeout(resolve, 10));

    const actorAfter = this.entityManager.getEntityInstance(actorId);

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
    if (targetId && payload.primaryId === undefined) {
      payload.primaryId = targetId;
    }
    const initialEventCount = Array.isArray(this.events)
      ? this.events.length
      : 0;

    const result = await this.eventBus.dispatch(ATTEMPT_ACTION_ID, payload);

    const timeoutAt = Date.now() + 100;
    while (
      Array.isArray(this.events) &&
      this.events.length === initialEventCount &&
      Date.now() < timeoutAt
    ) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    return result;
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

      // Provide hint if no actions discovered
      this._provideActionDiscoveryHint(actorId, actions);

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

  /**
   * Suppress action discovery hints (for tests that expect empty results).
   */
  suppressHints() {
    this._suppressHints = true;
  }

  /**
   * Enable action discovery hints.
   */
  enableHints() {
    this._suppressHints = false;
  }

  /**
   * Detect which category a scope belongs to.
   *
   * @private
   * @param {string} scopeName - Scope to categorize
   * @returns {string|null} Category name or null if unknown
   */
  _detectScopeCategory(scopeName) {
    for (const [category, scopes] of Object.entries(this._knownScopes)) {
      if (scopes.includes(scopeName)) {
        return category;
      }
    }
    return null;
  }

  /**
   * Capitalize first letter of a string.
   *
   * @private
   * @param {string} str - String to capitalize
   * @returns {string} Capitalized string
   */
  _capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Provide helpful hint when action discovery fails due to missing scope registration.
   *
   * @private
   * @param {string} actorId - Actor ID
   * @param {string[]} availableActions - Discovered actions (empty when hint is needed)
   */
  _provideActionDiscoveryHint(actorId, availableActions) {
    // Skip if hints suppressed or actions were discovered
    if (this._suppressHints || availableActions.length > 0) {
      return;
    }

    // Check if we have a loaded action definition
    if (!this._actionDefinition) {
      return;
    }

    const actionId = this._actionDefinition.id;

    // Extract scope name from action definition (check primary, secondary, tertiary targets)
    let scopeName = null;
    const targets = this._actionDefinition.targets;
    if (targets) {
      // Handle new object format with primary/secondary/tertiary
      if (typeof targets === 'object' && !Array.isArray(targets)) {
        if (targets.primary?.scope) {
          scopeName = targets.primary.scope;
        } else if (targets.secondary?.scope) {
          scopeName = targets.secondary.scope;
        } else if (targets.tertiary?.scope) {
          scopeName = targets.tertiary.scope;
        }
      }
      // Handle old string format (e.g., "positioning:available_furniture")
      else if (typeof targets === 'string') {
        scopeName = targets;
      }
    }

    // Only provide hint if action uses a scope
    if (!scopeName) {
      return;
    }

    // Check if scope is known
    const category = this._detectScopeCategory(scopeName);

    if (category) {
      // Known scope - suggest auto-registration and manual registration
      const actionName = this.actionId.split(':')[1] || this.actionId;
      console.warn(
        `
⚠️  Action Discovery Hint

Action discovery returned 0 actions for actor '${actorId}'.

The action '${actionId}' uses scope '${scopeName}' which is not registered.

💡 Solution 1 (Recommended): Enable auto-registration

beforeEach(async () => {
  testFixture = await ModTestFixture.forAction(
    '${this.modId}',
    '${actionName}',
    null,
    null,
    { autoRegisterScopes: true }
  );
});

💡 Solution 2: Manual registration

import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';

beforeEach(async () => {
  testFixture = await ModTestFixture.forAction('${this.modId}', '${actionName}');
  ScopeResolverHelpers.register${this._capitalize(category)}Scopes(testFixture.testEnv);
});

📚 Documentation: See docs/testing/mod-testing-guide.md#testing-actions-with-custom-scopes
      `.trim()
      );
    } else {
      // Unknown scope - suggest custom resolver
      const actionName = this.actionId.split(':')[1] || this.actionId;
      console.warn(
        `
⚠️  Action Discovery Hint

Action discovery returned 0 actions for actor '${actorId}'.

The action '${actionId}' uses scope '${scopeName}' which is not in the standard library.

💡 Solution: Create custom scope resolver

import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';

beforeEach(async () => {
  testFixture = await ModTestFixture.forAction('${this.modId}', '${actionName}');

  // Register standard scopes first (if applicable)
  ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);

  // Create custom resolver for ${scopeName}
  const customResolver = ScopeResolverHelpers.createComponentLookupResolver(
    '${scopeName}',
    {
      componentType: 'mod:component',  // Update with actual component
      sourceField: 'field',             // Update with actual field
      contextSource: 'actor'
    }
  );

  ScopeResolverHelpers._registerResolvers(
    testFixture.testEnv,
    testFixture.testEnv.entityManager,
    { '${scopeName}': customResolver }
  );
});

📚 Documentation: See docs/testing/scope-resolver-registry.md#creating-custom-scope-resolvers
      `.trim()
      );
    }
  }

  /**
   * Loads condition definitions from dependency mods and makes them available
   * in the test environment's dataRegistry.
   *
   * @param {string[]} conditionIds - Array of condition IDs in format "modId:conditionId"
   * @throws {Error} If condition file cannot be loaded or ID format is invalid
   * @returns {Promise<void>}
   * @example
   * // Load single condition
   * await testFixture.loadDependencyConditions([
   *   'facing-states:actor-in-entity-facing-away'
   * ]);
   * @example
   * // Load multiple conditions (additive)
   * await testFixture.loadDependencyConditions([
   *   'facing-states:actor-in-entity-facing-away',
   *   'facing-states:entity-not-in-facing-away'
   * ]);
   */
  async loadDependencyConditions(conditionIds) {
    // Validate input
    if (!Array.isArray(conditionIds)) {
      throw new Error('conditionIds must be an array');
    }

    // Load each condition
    const loadPromises = conditionIds.map(async (id) => {
      // Validate ID format
      if (typeof id !== 'string' || !id.includes(':')) {
        throw new Error(
          `Invalid condition ID format: "${id}". Expected "modId:conditionId"`
        );
      }

      const parts = id.split(':');
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        throw new Error(
          `Invalid condition ID format: "${id}". Expected "modId:conditionId"`
        );
      }

      const [modId, conditionId] = parts;

      // Construct file path (relative from tests/common/mods/)
      const conditionPath = `../../../data/mods/${modId}/conditions/${conditionId}.condition.json`;

      try {
        // Load condition file
        const conditionModule = await import(conditionPath, {
          assert: { type: 'json' },
        });
        const conditionDef = conditionModule.default;

        // Store for later lookup
        this._loadedConditions.set(id, conditionDef);

        return { id, conditionDef };
      } catch (err) {
        throw new Error(
          `Failed to load condition "${id}" from ${conditionPath}: ${err.message}`
        );
      }
    });

    // Wait for all conditions to load
    await Promise.all(loadPromises);

    // Extend the dataRegistry mock
    const original = this.testEnv.dataRegistry.getConditionDefinition;
    this.testEnv.dataRegistry.getConditionDefinition = jest.fn((id) => {
      // Check if this is one of our loaded conditions
      if (this._loadedConditions.has(id)) {
        return this._loadedConditions.get(id);
      }
      // Chain to original (may be another extended version)
      return original(id);
    });
  }

  /**
   * Registers a custom scope from the specified mod and automatically loads
   * all dependency conditions referenced in the scope definition.
   *
   * This method:
   * 1. Loads and parses the scope definition file
   * 2. Extracts all condition_ref references from the scope AST
   * 3. Discovers transitive condition dependencies
   * 4. Validates all conditions exist
   * 5. Loads all conditions via loadDependencyConditions()
   * 6. Registers the scope resolver with the test environment
   *
   * @param {string} modId - The mod containing the scope (e.g., 'positioning', 'sex-anal-penetration')
   * @param {string} scopeName - The scope name without .scope extension (e.g., 'actors_with_exposed_asshole')
   * @param {object} [options] - Optional configuration
   * @param {boolean} [options.loadConditions] - Whether to auto-load conditions
   * @param {number} [options.maxDepth] - Max recursion depth for transitive dependencies
   * @returns {Promise<void>}
   * @throws {Error} If scope file not found, conditions missing, or parsing fails
   * @example
   * // Auto-loads facing-states:actor-in-entity-facing-away and other dependencies
   * await testFixture.registerCustomScope(
   *   'sex-anal-penetration',
   *   'actors_with_exposed_asshole_accessible_from_behind'
   * );
   * @example
   * // Disable auto-loading if needed
   * await testFixture.registerCustomScope(
   *   'my-mod',
   *   'my-scope',
   *   { loadConditions: false }
   * );
   */
  async registerCustomScope(modId, scopeName, options = {}) {
    const { loadConditions = true, maxDepth = 5 } = options;

    // Validate inputs
    if (!modId || typeof modId !== 'string') {
      throw new Error('modId must be a non-empty string');
    }
    if (!scopeName || typeof scopeName !== 'string') {
      throw new Error('scopeName must be a non-empty string');
    }

    // Construct scope file path (relative from tests/common/mods/)
    const scopePath = resolve(
      process.cwd(),
      `data/mods/${modId}/scopes/${scopeName}.scope`
    );

    // Read and parse scope definition
    let scopeContent;
    try {
      scopeContent = await fs.readFile(scopePath, 'utf-8');
    } catch (err) {
      throw new Error(
        `Failed to read scope file at ${scopePath}: ${err.message}`
      );
    }

    let parsedScopes;
    try {
      parsedScopes = parseScopeDefinitions(scopeContent, scopePath);
    } catch (err) {
      throw new Error(
        `Failed to parse scope file at ${scopePath}: ${err.message}`
      );
    }

    // parseScopeDefinitions returns a Map<scopeName, { expr, ast }>
    const fullScopeName = `${modId}:${scopeName}`;
    const scopeData = parsedScopes.get(fullScopeName);

    if (!scopeData) {
      const availableScopes = Array.from(parsedScopes.keys()).join(', ');
      throw new Error(
        `Scope "${fullScopeName}" not found in file ${scopePath}. ` +
          `Available scopes: ${availableScopes || '(none)'}`
      );
    }

    if (loadConditions) {
      // Extract condition references from the parsed AST
      const conditionRefs =
        ScopeConditionAnalyzer.extractConditionRefs(scopeData);

      if (conditionRefs.size > 0) {
        // Discover transitive dependencies
        const allConditions =
          await ScopeConditionAnalyzer.discoverTransitiveDependencies(
            Array.from(conditionRefs),
            ScopeConditionAnalyzer.loadConditionDefinition.bind(
              ScopeConditionAnalyzer
            ),
            maxDepth
          );

        // Validate conditions exist
        const validation = await ScopeConditionAnalyzer.validateConditions(
          allConditions,
          scopePath
        );

        if (validation.missing.length > 0) {
          throw new Error(
            `Scope "${fullScopeName}" references missing conditions:\n` +
              validation.missing.map((id) => `  - ${id}`).join('\n') +
              `\n\nReferenced in: ${scopePath}`
          );
        }

        // Load all discovered conditions
        await this.loadDependencyConditions(Array.from(allConditions));
      }
    }

    // Register the scope resolver
    // We need to create a resolver function that uses the scope engine
    const { default: ScopeEngine } = await import(
      '../../../src/scopeDsl/engine.js'
    );
    const scopeEngine = new ScopeEngine();

    // Capture testEnv reference for use in resolver closure
    const testEnv = this.testEnv;
    // Capture scopeTracer reference for use in resolver closure
    const scopeTracer = this.scopeTracer;

    const resolver = (context) => {
      // Build runtime context with getters for dynamic access
      // This ensures the resolver always uses the current entity manager,
      // even after reset() replaces it
      const runtimeCtx = {
        get entityManager() {
          return testEnv.entityManager;
        },
        get jsonLogicEval() {
          return testEnv.jsonLogic;
        },
        get logger() {
          return testEnv.logger;
        },
        get tracer() {
          return scopeTracer;
        },
      };

      try {
        // VALIDATE FIRST: Check the raw context parameter BEFORE extraction
        // This ensures we can detect action pipeline context objects ({actor, targets})
        // or scope resolution context objects ({runtimeCtx, dispatcher})
        ParameterValidator.validateActorEntity(
          context,
          `CustomScopeResolver[${fullScopeName}]`
        );

        // EXTRACT SECOND: After validation passes, extract actorEntity
        // ScopeEngine expects just actorEntity, not full context
        const actorEntity = context.actorEntity || context.actor || context;

        // Resolve using the AST
        const result = scopeEngine.resolve(
          scopeData.ast,
          actorEntity,
          runtimeCtx
        );

        return { success: true, value: result };
      } catch (err) {
        // Wrap with enhanced context
        if (err instanceof ParameterValidationError) {
          const wrappedError = new ScopeResolutionError(
            'Invalid parameter passed to scope resolver',
            {
              scopeName: fullScopeName,
              phase: 'parameter extraction',
              parameters: {
                contextType: typeof context,
                hasActorEntity: !!context.actorEntity,
                hasActor: !!context.actor,
                extractedType: typeof actorEntity,
              },
              expected: 'Entity instance with id property',
              received: 'Full context object with actor, targets properties',
              hint: 'Extract actorEntity from context before passing to ScopeEngine.resolve()',
              suggestion:
                'Use: const actorEntity = context.actorEntity || context.actor',
              example:
                'const actorEntity = context.actorEntity || context.actor;\n' +
                'const result = scopeEngine.resolve(scopeData.ast, actorEntity, runtimeCtx);',
              originalError: err,
            }
          );

          return {
            success: false,
            error: wrappedError.toString(),
            context: wrappedError.context,
          };
        }

        // Wrap other errors with scope context
        const wrappedError = new ScopeResolutionError(
          `Failed to resolve scope "${fullScopeName}"`,
          {
            scopeName: fullScopeName,
            phase: 'scope resolution',
            hint: 'Check scope definition and entity components',
            originalError: err,
          }
        );

        return {
          success: false,
          error: wrappedError.toString(),
          context: wrappedError.context,
        };
      }
    };

    // Register with ScopeResolverHelpers
    ScopeResolverHelpers._registerResolvers(
      this.testEnv,
      this.testEnv.entityManager,
      { [fullScopeName]: resolver }
    );
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
