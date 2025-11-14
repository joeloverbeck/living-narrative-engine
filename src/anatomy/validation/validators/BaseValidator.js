/**
 * @file Base validator for recipe pre-flight validation
 * @see ../../../interfaces/IRecipeValidator.js - Interface definition
 * @see ../core/ValidationResultBuilder.js - Result builder
 */

import { IRecipeValidator } from '../../../interfaces/IRecipeValidator.js';
import ValidationResultBuilder from '../core/ValidationResultBuilder.js';
import {
  assertNonBlankString,
  validateDependency,
} from '../../../utils/dependencyUtils.js';

/**
 * Abstract base class for recipe validators using template method pattern.
 *
 * Provides common validation infrastructure:
 * - Exception handling with try-catch wrapper
 * - Result building with ValidationResultBuilder
 * - Logging integration with consistent error formatting
 * - Template method for validation execution
 *
 * Subclasses must implement performValidation() to provide specific validation logic.
 *
 * @abstract
 * @augments IRecipeValidator
 * @example
 * class ComponentExistenceValidator extends BaseValidator {
 *   constructor({ dataRegistry, logger }) {
 *     super({
 *       name: 'component-existence',
 *       priority: 10,
 *       failFast: true,
 *       logger
 *     });
 *     this.#dataRegistry = dataRegistry;
 *   }
 *
 *   async performValidation(recipe, options, builder) {
 *     // Validation logic here
 *     if (componentExists) {
 *       builder.addPassed('Component exists');
 *     } else {
 *       builder.addError('COMPONENT_NOT_FOUND', 'Component missing');
 *     }
 *   }
 * }
 */
export class BaseValidator extends IRecipeValidator {
  #name;
  #priority;
  #failFast;
  #logger;

  /**
   * Creates a new base validator.
   *
   * @param {object} params - Constructor parameters
   * @param {string} params.name - Unique validator name (non-blank string)
   * @param {number} params.priority - Execution priority (lower = runs earlier)
   * @param {boolean} [params.failFast] - Stop validation pipeline on error (default: false)
   * @param {object} params.logger - Logger instance implementing ILogger
   * @throws {Error} If name is not a non-blank string
   * @throws {Error} If priority is not a valid number
   * @throws {Error} If failFast is not a boolean
   * @throws {Error} If logger does not implement required methods
   */
  constructor({ name, priority, failFast = false, logger }) {
    super();

    // Validate name parameter
    assertNonBlankString(
      name,
      'Validator name',
      'BaseValidator constructor',
      logger
    );

    // Validate priority parameter
    if (typeof priority !== 'number' || isNaN(priority)) {
      throw new Error('Validator priority must be a valid number');
    }

    // Validate failFast parameter
    if (typeof failFast !== 'boolean') {
      throw new Error('Validator failFast must be a boolean');
    }

    // Validate logger dependency
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    // Store configuration
    this.#name = name;
    this.#priority = priority;
    this.#failFast = failFast;
    this.#logger = logger;
  }

  /**
   * Gets the validator name.
   *
   * @returns {string} Unique validator identifier
   */
  get name() {
    return this.#name;
  }

  /**
   * Gets the validator priority.
   *
   * @returns {number} Execution priority (lower values execute first)
   */
  get priority() {
    return this.#priority;
  }

  /**
   * Gets whether validator should stop pipeline on failure.
   *
   * @returns {boolean} True if pipeline should stop on validation error
   */
  get failFast() {
    return this.#failFast;
  }

  /**
   * Template method for validation execution.
   *
   * Orchestrates the validation flow:
   * 1. Creates ValidationResultBuilder instance
   * 2. Calls performValidation() implemented by subclass
   * 3. Handles exceptions by wrapping them in validation errors
   * 4. Returns frozen result object
   *
   * This method is final and should not be overridden by subclasses.
   * Subclasses should implement performValidation() instead.
   *
   * @param {object} recipe - Recipe object to validate
   * @param {object} [options] - Validation options (default: {})
   * @param {string} [options.recipePath] - Optional path to recipe file
   * @returns {Promise<object>} Frozen validation result with structure:
   *   {
   *     recipeId: string,
   *     recipePath: string|null,
   *     errors: Array<object>,
   *     warnings: Array<object>,
   *     suggestions: Array<object>,
   *     passed: Array<object>,
   *     isValid: boolean,
   *     metadata: object
   *   }
   */
  async validate(recipe, options = {}) {
    // Create builder for collecting validation results
    const builder = new ValidationResultBuilder(
      recipe.recipeId,
      options.recipePath
    );

    try {
      // Call abstract method implemented by subclass
      await this.performValidation(recipe, options, builder);
    } catch (error) {
      // Log error with full context for debugging
      this.#logger.error(
        `Validator '${this.#name}' threw exception during validation of recipe '${recipe.recipeId}'`,
        error
      );

      // Wrap exception in validation error to prevent pipeline crash
      builder.addError(
        'VALIDATOR_EXCEPTION',
        `Validation failed with exception: ${error.message}`,
        {
          validatorName: this.#name,
          recipeId: recipe.recipeId,
          errorType: error.constructor.name,
          errorMessage: error.message,
          errorStack: error.stack,
        }
      );
    }

    // Build and return frozen result object
    return builder.build();
  }

  /**
   * Abstract method for validation logic - must be implemented by subclasses.
   *
   * Subclasses MUST override this method to provide specific validation logic.
   * Use the builder parameter to record validation results:
   * - builder.addError() for validation errors
   * - builder.addWarning() for validation warnings
   * - builder.addSuggestion() for improvement suggestions
   * - builder.addPassed() for successful validation checks
   * - builder.setMetadata() for additional validation metadata
   *
   * Do NOT catch exceptions in this method - let them propagate to the
   * template method which will handle them consistently.
   *
   * @abstract
   * @param {object} _recipe - Recipe object to validate
   * @param {object} _options - Validation options passed from validate()
   * @param {ValidationResultBuilder} _builder - Result builder for recording outcomes
   * @returns {Promise<void>}
   * @throws {Error} Always throws if not implemented by subclass
   * @example
   * async performValidation(recipe, options, builder) {
   *   const components = this.#extractComponents(recipe);
   *
   *   for (const componentId of components) {
   *     if (!this.#componentExists(componentId)) {
   *       builder.addError(
   *         'COMPONENT_NOT_FOUND',
   *         `Component '${componentId}' does not exist`,
   *         { componentId }
   *       );
   *     }
   *   }
   *
   *   if (components.length > 0 && builder.build().isValid) {
   *     builder.addPassed(`Validated ${components.length} components`);
   *   }
   * }
   */
  async performValidation(_recipe, _options, _builder) {
    throw new Error(
      `performValidation() not implemented in ${this.constructor.name}. ` +
        `Subclasses must override this abstract method to provide validation logic.`
    );
  }
}
