/**
 * @file TestModuleValidator - Validation system for test module configurations
 * @description Provides comprehensive validation for different test module types
 */

import { TestModuleValidationError } from '../errors/testModuleValidationError.js';

/**
 * @typedef {object} ValidationError
 * @property {string} code - Error code for programmatic handling
 * @property {string} field - The field that failed validation
 * @property {string} message - Human-readable error message
 */

/**
 * @typedef {object} ValidationWarning
 * @property {string} code - Warning code for programmatic handling
 * @property {string} field - The field that triggered the warning
 * @property {string} message - Human-readable warning message
 */

/**
 * @typedef {object} ValidationResult
 * @property {boolean} valid - Whether the configuration is valid
 * @property {ValidationError[]} errors - Array of validation errors
 * @property {ValidationWarning[]} warnings - Array of validation warnings
 */

/**
 * Validation system for test module configurations.
 * Provides module-specific validation rules and common validation utilities.
 */
export class TestModuleValidator {
  /**
   * Validates a configuration based on the module type
   *
   * @param {object} config - The configuration to validate
   * @param {string} moduleType - The type of module being validated
   * @returns {ValidationResult} The validation result
   * @throws {Error} If the module type is unknown
   */
  static validateConfiguration(config, moduleType) {
    const validators = {
      turnExecution: this.#validateTurnExecutionConfig,
      actionProcessing: this.#validateActionProcessingConfig,
      entityManagement: this.#validateEntityManagementConfig,
      llmTesting: this.#validateLLMTestingConfig,
    };

    const validator = validators[moduleType];
    if (!validator) {
      throw new Error(`Unknown module type: ${moduleType}`);
    }

    return validator.call(this, config);
  }

  /**
   * Validates turn execution module configuration
   *
   * @private
   * @param {object} config - The configuration to validate
   * @returns {ValidationResult}
   */
  static #validateTurnExecutionConfig(config) {
    const errors = [];
    const warnings = [];

    // Validate LLM configuration
    if (!config.llm) {
      errors.push({
        code: 'MISSING_LLM_CONFIG',
        field: 'llm',
        message: 'LLM configuration is required for turn execution',
      });
    } else {
      // Validate LLM strategy
      const validStrategies = ['tool-calling', 'json-schema'];
      if (!config.llm.strategy) {
        errors.push({
          code: 'MISSING_LLM_STRATEGY',
          field: 'llm.strategy',
          message: 'LLM strategy must be specified',
        });
      } else if (!validStrategies.includes(config.llm.strategy)) {
        errors.push({
          code: 'INVALID_LLM_STRATEGY',
          field: 'llm.strategy',
          message: `Invalid LLM strategy: ${config.llm.strategy}. Must be one of: ${validStrategies.join(', ')}`,
        });
      }

      // Validate temperature
      if (config.llm.temperature !== undefined) {
        if (typeof config.llm.temperature !== 'number') {
          errors.push({
            code: 'INVALID_TEMPERATURE_TYPE',
            field: 'llm.temperature',
            message: 'Temperature must be a number',
          });
        } else if (config.llm.temperature < 0 || config.llm.temperature > 2) {
          warnings.push({
            code: 'UNUSUAL_TEMPERATURE',
            field: 'llm.temperature',
            message: `Temperature ${config.llm.temperature} is outside typical range (0-2)`,
          });
        }
      }
    }

    // Validate actors
    if (!config.actors || config.actors.length === 0) {
      warnings.push({
        code: 'NO_ACTORS',
        field: 'actors',
        message: 'No actors configured - test environment will be empty',
      });
    } else {
      // Validate actor configurations
      config.actors.forEach((actor, index) => {
        if (!actor.id && typeof actor !== 'string') {
          errors.push({
            code: 'INVALID_ACTOR_CONFIG',
            field: `actors[${index}]`,
            message: 'Actor must be a string ID or object with id property',
          });
        }
      });
    }

    // Validate world configuration
    if (!config.world) {
      warnings.push({
        code: 'NO_WORLD_CONFIG',
        field: 'world',
        message: 'No world configuration provided - using defaults',
      });
    } else {
      if (!config.world.name) {
        warnings.push({
          code: 'NO_WORLD_NAME',
          field: 'world.name',
          message: 'World name not specified - using default',
        });
      }
    }

    // Validate performance tracking
    if (config.monitoring?.performance?.thresholds) {
      const thresholds = config.monitoring.performance.thresholds;

      // Check turn execution threshold
      if (thresholds.turnExecution && thresholds.turnExecution > 1000) {
        warnings.push({
          code: 'HIGH_PERFORMANCE_THRESHOLD',
          field: 'monitoring.performance.thresholds.turnExecution',
          message:
            'Turn execution threshold >1000ms may hide performance issues',
        });
      }

      // Check action discovery threshold
      if (thresholds.actionDiscovery && thresholds.actionDiscovery > 500) {
        warnings.push({
          code: 'HIGH_PERFORMANCE_THRESHOLD',
          field: 'monitoring.performance.thresholds.actionDiscovery',
          message:
            'Action discovery threshold >500ms may hide performance issues',
        });
      }
    }

    // Validate event capture
    if (config.monitoring?.events) {
      if (!Array.isArray(config.monitoring.events)) {
        errors.push({
          code: 'INVALID_EVENT_CONFIG',
          field: 'monitoring.events',
          message: 'Event capture configuration must be an array',
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validates action processing module configuration
   *
   * @private
   * @param {object} config - The configuration to validate
   * @returns {ValidationResult}
   */
  static #validateActionProcessingConfig(config) {
    const errors = [];
    const warnings = [];

    // Validate actor ID
    if (!config.actorId) {
      errors.push({
        code: 'MISSING_ACTOR_ID',
        field: 'actorId',
        message: 'Actor ID is required for action processing',
      });
    }

    // Validate action configuration
    if (config.actions) {
      if (!Array.isArray(config.actions)) {
        errors.push({
          code: 'INVALID_ACTIONS_CONFIG',
          field: 'actions',
          message: 'Actions must be an array',
        });
      } else {
        config.actions.forEach((action, index) => {
          if (!action.id) {
            errors.push({
              code: 'MISSING_ACTION_ID',
              field: `actions[${index}].id`,
              message: 'Each action must have an id',
            });
          }
        });
      }
    }

    // Validate mock configuration
    if (config.mockDiscovery && typeof config.mockDiscovery !== 'object') {
      errors.push({
        code: 'INVALID_MOCK_CONFIG',
        field: 'mockDiscovery',
        message: 'Mock discovery configuration must be an object',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validates entity management module configuration
   *
   * @private
   * @param {object} config - The configuration to validate
   * @returns {ValidationResult}
   */
  static #validateEntityManagementConfig(config) {
    const errors = [];
    const warnings = [];

    // Validate entity definitions
    if (!config.entities || config.entities.length === 0) {
      warnings.push({
        code: 'NO_ENTITIES',
        field: 'entities',
        message: 'No entities configured - consider adding test entities',
      });
    } else if (!Array.isArray(config.entities)) {
      errors.push({
        code: 'INVALID_ENTITIES_CONFIG',
        field: 'entities',
        message: 'Entities must be an array',
      });
    } else {
      config.entities.forEach((entity, index) => {
        if (!entity.type) {
          errors.push({
            code: 'MISSING_ENTITY_TYPE',
            field: `entities[${index}].type`,
            message: 'Each entity must have a type',
          });
        }
      });
    }

    // Validate relationships
    if (config.relationships) {
      if (!Array.isArray(config.relationships)) {
        errors.push({
          code: 'INVALID_RELATIONSHIPS_CONFIG',
          field: 'relationships',
          message: 'Relationships must be an array',
        });
      } else {
        config.relationships.forEach((rel, index) => {
          if (!rel.from || !rel.to || !rel.type) {
            errors.push({
              code: 'INCOMPLETE_RELATIONSHIP',
              field: `relationships[${index}]`,
              message: 'Relationships require from, to, and type fields',
            });
          }
        });
      }
    }

    // Validate world configuration
    if (config.world && config.world.createLocations === false) {
      warnings.push({
        code: 'NO_WORLD_LOCATIONS',
        field: 'world.createLocations',
        message:
          'World locations disabled - entities may not have valid locations',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validates LLM testing module configuration
   *
   * @private
   * @param {object} config - The configuration to validate
   * @returns {ValidationResult}
   */
  static #validateLLMTestingConfig(config) {
    const errors = [];
    const warnings = [];

    // Validate strategy
    if (!config.strategy) {
      errors.push({
        code: 'MISSING_STRATEGY',
        field: 'strategy',
        message: 'LLM strategy is required',
      });
    } else if (!['tool-calling', 'json-schema'].includes(config.strategy)) {
      errors.push({
        code: 'INVALID_STRATEGY',
        field: 'strategy',
        message: `Invalid strategy: ${config.strategy}. Must be one of: tool-calling, json-schema`,
      });
    }

    // Validate parameters
    if (config.parameters) {
      if (config.parameters.temperature !== undefined) {
        if (typeof config.parameters.temperature !== 'number') {
          errors.push({
            code: 'INVALID_TEMPERATURE_TYPE',
            field: 'parameters.temperature',
            message: 'Temperature must be a number',
          });
        } else if (
          config.parameters.temperature < 0 ||
          config.parameters.temperature > 2
        ) {
          warnings.push({
            code: 'INVALID_TEMPERATURE',
            field: 'parameters.temperature',
            message: 'Temperature should be between 0 and 2',
          });
        }
      }

      if (config.parameters.topP !== undefined) {
        if (typeof config.parameters.topP !== 'number') {
          errors.push({
            code: 'INVALID_TOP_P_TYPE',
            field: 'parameters.topP',
            message: 'Top-p must be a number',
          });
        } else if (config.parameters.topP < 0 || config.parameters.topP > 1) {
          warnings.push({
            code: 'INVALID_TOP_P',
            field: 'parameters.topP',
            message: 'Top-p should be between 0 and 1',
          });
        }
      }
    }

    // Validate token limits
    if (config.tokenLimits) {
      if (config.tokenLimits.input && config.tokenLimits.input > 8000) {
        warnings.push({
          code: 'HIGH_TOKEN_LIMIT',
          field: 'tokenLimits.input',
          message: 'Input token limit >8000 may exceed model capacity',
        });
      }

      if (config.tokenLimits.output && config.tokenLimits.output > 4000) {
        warnings.push({
          code: 'HIGH_OUTPUT_TOKEN_LIMIT',
          field: 'tokenLimits.output',
          message: 'Output token limit >4000 may exceed model capacity',
        });
      }
    }

    // Validate scenarios
    if (config.scenarios) {
      if (!Array.isArray(config.scenarios)) {
        errors.push({
          code: 'INVALID_SCENARIOS_CONFIG',
          field: 'scenarios',
          message: 'Scenarios must be an array',
        });
      } else {
        config.scenarios.forEach((scenario, index) => {
          if (!scenario.name) {
            errors.push({
              code: 'MISSING_SCENARIO_NAME',
              field: `scenarios[${index}].name`,
              message: 'Each scenario must have a name',
            });
          }
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Throws a validation error if the result contains errors
   *
   * @param {ValidationResult} result - The validation result
   * @param {string} message - The error message
   * @throws {TestModuleValidationError} If validation failed
   */
  static throwIfInvalid(result, message = 'Validation failed') {
    if (!result.valid) {
      throw new TestModuleValidationError(message, result.errors);
    }
  }

  /**
   * Checks if a value is a non-empty string
   *
   * @param {any} value - The value to check
   * @returns {boolean} True if the value is a non-empty string
   */
  static isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
  }

  /**
   * Checks if a value is a valid array
   *
   * @param {any} value - The value to check
   * @returns {boolean} True if the value is an array
   */
  static isValidArray(value) {
    return Array.isArray(value);
  }

  /**
   * Checks if a value is a valid object (not null, not array)
   *
   * @param {any} value - The value to check
   * @returns {boolean} True if the value is a valid object
   */
  static isValidObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
}
