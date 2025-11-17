/**
 * @file Registry for recipe validators with priority-based sorting
 * @see ../../../interfaces/IRecipeValidator.js - Validator interface
 * @see ../validators/BaseValidator.js - Base validator implementation
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';

/**
 * @typedef {import('../../../interfaces/IRecipeValidator.js').IRecipeValidator} IRecipeValidator
 */

/**
 * Registry for recipe validators with priority-based sorting.
 * Validators are stored by name and retrieved in priority order for pipeline execution.
 */
export class ValidatorRegistry {
  #validators = new Map();
  #logger;

  /**
   * Create a new ValidatorRegistry
   *
   * @param {object} dependencies - Dependencies for the registry
   * @param {object} dependencies.logger - Logger implementing ILogger interface
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    this.#logger = logger;
    this.#logger.info('ValidatorRegistry initialized');
  }

  /**
   * Register a validator instance
   *
   * @param {IRecipeValidator} validator - Validator implementing IRecipeValidator interface
   * @throws {Error} If validator doesn't implement required interface
   */
  register(validator) {
    // Validate that validator is an object
    if (!validator || typeof validator !== 'object') {
      throw new Error('Validator must be an object');
    }

    // Validate required method: validate()
    if (typeof validator.validate !== 'function') {
      throw new Error('Validator must implement validate() method');
    }

    // Validate required property: name
    if (typeof validator.name !== 'string' || validator.name.trim() === '') {
      throw new Error('Validator must have a non-blank name property');
    }

    // Validate required property: priority
    if (typeof validator.priority !== 'number' || isNaN(validator.priority)) {
      throw new Error('Validator must have a numeric priority property');
    }

    // Warn on duplicate registration
    if (this.#validators.has(validator.name)) {
      this.#logger.warn(
        `ValidatorRegistry: Overwriting existing validator '${validator.name}'`
      );
    }

    this.#validators.set(validator.name, validator);
    this.#logger.debug(
      `ValidatorRegistry: Registered validator '${validator.name}' (priority: ${validator.priority})`
    );
  }

  /**
   * Get a validator by name
   *
   * @param {string} name - Validator name
   * @returns {IRecipeValidator|undefined} Validator instance or undefined if not found
   */
  get(name) {
    return this.#validators.get(name);
  }

  /**
   * Get all validators sorted by priority (ascending order - lower priority runs first)
   *
   * @returns {IRecipeValidator[]} Array of validators sorted by priority
   */
  getAll() {
    return Array.from(this.#validators.values()).sort(
      (a, b) => a.priority - b.priority
    );
  }

  /**
   * Get the number of registered validators.
   *
   * @returns {number} Total validators registered
   */
  count() {
    return this.#validators.size;
  }

  /**
   * Assert that required validators are registered with the expected configuration.
   *
   * @param {Array<{name: string, priority?: number, failFast?: boolean}>} requiredValidators
   * Required validator descriptors.
   * @param {object} [options] - Assertion options.
   * @param {string} [options.environment] - Runtime environment label.
   * @param {Function} [options.onProductionFailure] - Callback when assertion downgrades to warning.
   * @returns {boolean} True when assertion passes, false when downgraded.
   */
  assertRegistered(requiredValidators = [], options = {}) {
    if (!Array.isArray(requiredValidators) || requiredValidators.length === 0) {
      return true;
    }

    const issues = [];

    for (const requirement of requiredValidators) {
      if (!requirement || typeof requirement.name !== 'string') {
        continue;
      }

      const validator = this.#validators.get(requirement.name);
      if (!validator) {
        issues.push({ type: 'missing', name: requirement.name });
        continue;
      }

      if (
        typeof requirement.priority === 'number' &&
        validator.priority !== requirement.priority
      ) {
        issues.push({
          type: 'priority',
          name: requirement.name,
          expected: requirement.priority,
          actual: validator.priority,
        });
      }

      if (
        typeof requirement.failFast === 'boolean' &&
        Boolean(validator.failFast) !== requirement.failFast
      ) {
        issues.push({
          type: 'failFast',
          name: requirement.name,
          expected: requirement.failFast,
          actual: Boolean(validator.failFast),
        });
      }
    }

    if (issues.length === 0) {
      return true;
    }

    const environment = options.environment || process?.env?.NODE_ENV || 'development';
    const summary = issues
      .map((issue) => `${issue.name}:${issue.type}`)
      .join(', ');

    if (environment === 'production') {
      this.#logger.warn(
        `ValidatorRegistry: Required validators misconfigured (${summary})`,
        { issues }
      );
      if (typeof options.onProductionFailure === 'function') {
        options.onProductionFailure(issues);
      }
      return false;
    }

    throw new Error(
      `ValidatorRegistry: Required validators misconfigured (${summary})`
    );
  }

  /**
   * Check if a validator is registered
   *
   * @param {string} name - Validator name
   * @returns {boolean} True if validator exists, false otherwise
   */
  has(name) {
    return this.#validators.has(name);
  }

  /**
   * Remove a validator by name
   *
   * @param {string} name - Validator name
   * @returns {boolean} True if validator was removed, false if it didn't exist
   */
  unregister(name) {
    const removed = this.#validators.delete(name);
    if (removed) {
      this.#logger.debug(`ValidatorRegistry: Unregistered validator '${name}'`);
    }
    return removed;
  }

  /**
   * Remove all validators from the registry
   */
  clear() {
    this.#validators.clear();
    this.#logger.debug('ValidatorRegistry: Cleared all validators');
  }
}

export default ValidatorRegistry;
