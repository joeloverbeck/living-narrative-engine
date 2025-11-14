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
