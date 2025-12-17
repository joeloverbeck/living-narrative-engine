/**
 * @file Base class for JSON Logic operators.
 * Provides common functionality for error handling, logging, and entity resolution.
 * Matches pattern established by BaseBodyPartOperator, BaseFurnitureOperator, etc.
 *
 * @see BaseBodyPartOperator.js
 * @see BaseFurnitureOperator.js
 * @see BaseEquipmentOperator.js
 */

/**
 * @abstract
 * Base class for JSON Logic operators.
 * Provides common functionality for error handling, logging, and entity resolution.
 * Matches pattern established by BaseBodyPartOperator, BaseFurnitureOperator, etc.
 */
export class BaseOperator {
  /** @protected @type {import('../../../interfaces/coreServices.js').IEntityManager} */
  entityManager;
  /** @protected @type {import('../../../interfaces/coreServices.js').ILogger} */
  logger;
  /** @protected @type {string} */
  operatorName;

  /**
   * @param {Object} dependencies
   * @param {import('../../../interfaces/coreServices.js').IEntityManager} dependencies.entityManager
   * @param {import('../../../interfaces/coreServices.js').ILogger} dependencies.logger
   * @param {string} operatorName - Name used in error messages
   */
  constructor({ entityManager, logger }, operatorName) {
    if (new.target === BaseOperator) {
      throw new Error(
        'BaseOperator is abstract and cannot be instantiated directly'
      );
    }
    if (!entityManager || !logger) {
      throw new Error('BaseOperator: Missing required dependencies');
    }
    this.entityManager = entityManager;
    this.logger = logger;
    this.operatorName = operatorName;
  }

  /**
   * Main evaluation entry point with error handling.
   * Subclasses override evaluateInternal() for their logic.
   *
   * @param {*} params - Operator parameters
   * @param {Object} context - Evaluation context
   * @returns {*} Result of evaluation
   */
  evaluate(params, context) {
    try {
      return this.evaluateInternal(params, context);
    } catch (error) {
      this.logger.error(`${this.operatorName}: Evaluation error`, error);
      return this.getDefaultOnError();
    }
  }

  /**
   * @abstract
   * Internal evaluation logic. Must be implemented by subclasses.
   *
   * @param {*} params - Operator parameters
   * @param {Object} context - Evaluation context
   * @returns {*} Result of evaluation
   */
  evaluateInternal(params, context) {
    throw new Error('evaluateInternal must be implemented by subclass');
  }

  /**
   * Default return value when an error occurs.
   * Override in subclass if different default is needed (e.g., return 0 for numeric operators).
   *
   * @returns {boolean} Default value on error
   */
  getDefaultOnError() {
    return false;
  }
}

export default BaseOperator;
