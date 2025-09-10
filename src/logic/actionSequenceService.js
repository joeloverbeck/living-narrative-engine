// src/logic/actionSequenceService.js

/**
 * @file ActionSequenceService - Service wrapper around executeActionSequence function
 * @description Provides a DI-compatible service interface for executing action sequences
 * with built-in flow control and error handling.
 */

import { executeActionSequence } from './actionSequence.js';
import { BaseService } from '../utils/serviceBase.js';

/** @typedef {import('../../data/schemas/operation.schema.json').Operation} Operation */
/** @typedef {import('./defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('./operationInterpreter.js').default} OperationInterpreter */

/**
 * Service wrapper for action sequence execution.
 * Provides dependency injection compatibility for the executeActionSequence function.
 */
class ActionSequenceService extends BaseService {
  /** @type {ILogger} */ #logger;
  /** @type {OperationInterpreter} */ #operationInterpreter;

  /**
   * @param {object} dependencies
   * @param {ILogger} dependencies.logger - Logger instance
   * @param {OperationInterpreter} dependencies.operationInterpreter - Operation interpreter for executing individual operations
   */
  constructor({ logger, operationInterpreter }) {
    super();
    this.#logger = this._init('ActionSequenceService', logger, {
      operationInterpreter: {
        value: operationInterpreter,
        requiredMethods: ['execute'],
      },
    });
    this.#operationInterpreter = operationInterpreter;

    this.#logger.debug('ActionSequenceService initialized.');
  }

  /**
   * Executes a sequence of actions with the specified context.
   *
   * @param {object} sequence - Sequence object containing actions array
   * @param {object} sequence.actions - Array of operations to execute
   * @param {ExecutionContext} context - Execution context containing evaluation data, logger, etc.
   * @returns {Promise<void>}
   */
  async execute(sequence, context) {
    if (!sequence || !Array.isArray(sequence.actions)) {
      throw new Error(
        'ActionSequenceService.execute: sequence must have an actions array'
      );
    }

    if (!context || typeof context !== 'object') {
      throw new Error('ActionSequenceService.execute: context is required');
    }

    this.#logger.debug(
      `ActionSequenceService: Executing sequence with ${sequence.actions.length} actions`
    );

    // Create enhanced context with required services
    const enhancedContext = {
      ...context,
      scopeLabel: 'ActionSequenceService',
      jsonLogic: context.jsonLogic,
    };

    try {
      await executeActionSequence(
        sequence.actions,
        enhancedContext,
        this.#logger,
        this.#operationInterpreter
      );
      this.#logger.debug(
        'ActionSequenceService: Sequence execution completed successfully'
      );
    } catch (error) {
      this.#logger.error(
        'ActionSequenceService: Sequence execution failed',
        error
      );
      throw error;
    }
  }
}

export default ActionSequenceService;
