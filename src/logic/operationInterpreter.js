// -----------------------------------------------------------------------------
//  OperationInterpreter
//  (v1.2.0 — defers placeholder resolution inside nested action-arrays)
// -----------------------------------------------------------------------------

import { resolvePlaceholders } from '../utils/contextUtils.js';
import { BaseService } from '../utils/serviceBase.js';
import { getNormalizedOperationType } from '../utils/operationTypeUtils.js';

/** @typedef {import('../../data/schemas/operation.schema.json').Operation} Operation */
/** @typedef {import('./defs.js').ExecutionContext}                               ExecutionContext */
/** @typedef {import('../interfaces/coreServices.js').ILogger}                    ILogger */
/** @typedef {import('./operationRegistry.js').default}                           OperationRegistry */

const ACTION_ARRAY_KEYS = new Set(['then_actions', 'else_actions', 'actions']);

class OperationInterpreter extends BaseService {
  /** @type {ILogger} */ #logger;
  /** @type {OperationRegistry} */ #registry;

  constructor({ logger, operationRegistry }) {
    super();
    this.#logger = this._init('OperationInterpreter', logger, {
      operationRegistry: {
        value: operationRegistry,
        requiredMethods: ['getHandler'],
      },
    });
    this.#registry = operationRegistry;

    this.#logger.debug(
      'OperationInterpreter Initialized (using OperationRegistry).'
    );
  }

  /**
   * Executes one operation.
   *
   * @param {Operation}      operation
   * @param {ExecutionContext} executionContext
   */
  async execute(operation, executionContext) {
    const opType = getNormalizedOperationType(
      operation?.type,
      this.#logger,
      'OperationInterpreter.execute'
    );

    if (!opType) {
      this.#logger.error(
        'OperationInterpreter received invalid operation object (missing type).',
        { operation }
      );
      return;
    }

    const handler = this.#registry.getHandler(opType);

    if (!handler) {
      this.#logger.error(
        `---> HANDLER NOT FOUND for operation type: "${opType}".`
      );
      return;
    }

    // -----------------------------------------------------------------------
    //  🔑  NEW LOGIC:  don't interpolate placeholders inside nested actions
    // -----------------------------------------------------------------------
    let paramsForHandler;
    try {
      if (operation.parameters && typeof operation.parameters === 'object') {
        paramsForHandler = resolvePlaceholders(
          operation.parameters,
          executionContext,
          this.#logger,
          '',
          ACTION_ARRAY_KEYS
        );
      } else {
        paramsForHandler = operation.parameters;
      }
    } catch (interpolationErr) {
      this.#logger.error(
        `Error resolving placeholders for operation "${opType}". Skipping handler.`,
        interpolationErr
      );
      return;
    }

    // -----------------------------------------------------------------------
    //  Execute the actual handler
    // -----------------------------------------------------------------------
    try {
      this.#logger.debug(`Executing handler for operation type "${opType}"…`);
      await handler(paramsForHandler, executionContext);
    } catch (handlerErr) {
      // Bubble up – SystemLogicInterpreter will handle halting the sequence
      this.#logger.debug(
        `Handler for operation "${opType}" threw – re-throwing to caller.`
      );
      throw handlerErr;
    }
  }
}

export default OperationInterpreter;
