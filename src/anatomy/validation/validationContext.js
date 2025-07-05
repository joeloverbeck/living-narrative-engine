/**
 * @file Context object that carries state through validation process
 */

import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';

/** @typedef {import('./validationRule.js').ValidationIssue} ValidationIssue */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Context object that carries state and collects results during validation
 */
export class ValidationContext {
  /** @type {string[]} */
  #entityIds;
  /** @type {object} */
  #recipe;
  /** @type {Set<string>} */
  #socketOccupancy;
  /** @type {IEntityManager} */
  #entityManager;
  /** @type {ILogger} */
  #logger;
  /** @type {ValidationIssue[]} */
  #issues;
  /** @type {Map<string, any>} */
  #metadata;

  /**
   * @param {object} params
   * @param {string[]} params.entityIds - All entity IDs in the graph
   * @param {object} params.recipe - The recipe used to assemble the graph
   * @param {Set<string>} params.socketOccupancy - Occupied sockets tracking
   * @param {IEntityManager} params.entityManager
   * @param {ILogger} params.logger
   */
  constructor({ entityIds, recipe, socketOccupancy, entityManager, logger }) {
    if (!entityIds) throw new InvalidArgumentError('entityIds is required');
    if (!recipe) throw new InvalidArgumentError('recipe is required');
    if (!socketOccupancy)
      throw new InvalidArgumentError('socketOccupancy is required');
    if (!entityManager)
      throw new InvalidArgumentError('entityManager is required');
    if (!logger) throw new InvalidArgumentError('logger is required');

    this.#entityIds = entityIds;
    this.#recipe = recipe;
    this.#socketOccupancy = socketOccupancy;
    this.#entityManager = entityManager;
    this.#logger = logger;
    this.#issues = [];
    this.#metadata = new Map();
  }

  /**
   * @returns {string[]} All entity IDs in the graph
   */
  get entityIds() {
    return this.#entityIds;
  }

  /**
   * @returns {object} The recipe used to assemble the graph
   */
  get recipe() {
    return this.#recipe;
  }

  /**
   * @returns {Set<string>} Occupied sockets tracking
   */
  get socketOccupancy() {
    return this.#socketOccupancy;
  }

  /**
   * @returns {IEntityManager}
   */
  get entityManager() {
    return this.#entityManager;
  }

  /**
   * @returns {ILogger}
   */
  get logger() {
    return this.#logger;
  }

  /**
   * Add validation issues to the context
   *
   * @param {ValidationIssue[]} issues - Issues to add
   */
  addIssues(issues) {
    this.#issues.push(...issues);
  }

  /**
   * Get all validation issues
   *
   * @returns {ValidationIssue[]}
   */
  getIssues() {
    return [...this.#issues];
  }

  /**
   * Get validation issues by severity
   *
   * @param {'error' | 'warning' | 'info'} severity
   * @returns {ValidationIssue[]}
   */
  getIssuesBySeverity(severity) {
    return this.#issues.filter((issue) => issue.severity === severity);
  }

  /**
   * Get all errors
   *
   * @returns {string[]} Error messages
   */
  getErrors() {
    return this.getIssuesBySeverity('error').map((issue) => issue.message);
  }

  /**
   * Get all warnings
   *
   * @returns {string[]} Warning messages
   */
  getWarnings() {
    return this.getIssuesBySeverity('warning').map((issue) => issue.message);
  }

  /**
   * Check if validation has errors
   *
   * @returns {boolean}
   */
  hasErrors() {
    return this.getIssuesBySeverity('error').length > 0;
  }

  /**
   * Store metadata that can be shared between rules
   *
   * @param {string} key - Metadata key
   * @param {any} value - Metadata value
   */
  setMetadata(key, value) {
    this.#metadata.set(key, value);
  }

  /**
   * Retrieve metadata stored by previous rules
   *
   * @param {string} key - Metadata key
   * @returns {any} Metadata value or undefined
   */
  getMetadata(key) {
    return this.#metadata.get(key);
  }

  /**
   * Get validation result summary
   *
   * @returns {object} Validation result
   */
  getResult() {
    const errors = this.getErrors();
    const warnings = this.getWarnings();

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
