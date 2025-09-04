// src/logic/operationHandlers/sequenceHandler.js

/**
 * @file SequenceHandler - Operation handler for SEQUENCE operations
 * @description Executes a sequence of actions sequentially using the ActionSequence service
 */

import { BaseService } from '../../utils/serviceBase.js';

/** @typedef {import('../../../data/schemas/operation.schema.json').Operation} Operation */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../actionSequenceService.js').default} ActionSequenceService */

/**
 * Handler for SEQUENCE operations.
 * Executes a sequence of actions in order using the ActionSequence service.
 */
class SequenceHandler extends BaseService {
  /** @type {ILogger} */ #logger;
  /** @type {ActionSequenceService} */ #actionSequence;

  /**
   * @param {object} dependencies
   * @param {ILogger} dependencies.logger - Logger instance
   * @param {ActionSequenceService} dependencies.actionSequence - Action sequence service
   */
  constructor({ logger, actionSequence }) {
    super();
    this.#logger = this._init('SequenceHandler', logger, {
      actionSequence: {
        value: actionSequence,
        requiredMethods: ['execute'],
      },
    });
    this.#actionSequence = actionSequence;

    this.#logger.debug('SequenceHandler initialized.');
  }

  /**
   * Executes a SEQUENCE operation by running all actions in the specified order.
   *
   * @param {Operation} operation - The SEQUENCE operation to execute
   * @param {ExecutionContext} context - Execution context
   * @returns {Promise<object>} Result object indicating successful execution
   */
  async execute(operation, context) {
    if (!operation?.parameters?.actions || !Array.isArray(operation.parameters.actions)) {
      throw new Error('SequenceHandler.execute: operation must have parameters.actions array');
    }

    if (!context || typeof context !== 'object') {
      throw new Error('SequenceHandler.execute: context is required');
    }

    const { actions } = operation.parameters;
    this.#logger.debug(`SequenceHandler: Executing sequence with ${actions.length} actions`);

    try {
      // Use ActionSequence service to execute the sequence
      await this.#actionSequence.execute({ actions }, context);
      
      this.#logger.debug('SequenceHandler: Sequence execution completed successfully');
      
      return {
        success: true,
        actionsExecuted: actions.length,
      };
    } catch (error) {
      this.#logger.error('SequenceHandler: Sequence execution failed', error);
      throw error;
    }
  }
}

export default SequenceHandler;