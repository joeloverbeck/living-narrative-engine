// -----------------------------------------------------------------------------
//  OperationInterpreter
//  (v1.2.0 — defers placeholder resolution inside nested action-arrays)
// -----------------------------------------------------------------------------

import { resolvePlaceholders } from '../utils/contextUtils.js';
import { setupService } from '../utils/serviceInitializerUtils.js';

/** @typedef {import('../../data/schemas/operation.schema.json').Operation} Operation */
/** @typedef {import('./defs.js').ExecutionContext}                               ExecutionContext */
/** @typedef {import('../interfaces/coreServices.js').ILogger}                    ILogger */
/** @typedef {import('./operationRegistry.js').default}                           OperationRegistry */

const ACTION_ARRAY_KEYS = new Set(['then_actions', 'else_actions', 'actions']);

class OperationInterpreter {
  /** @type {ILogger} */ #logger;
  /** @type {OperationRegistry} */ #registry;

  constructor({ logger, operationRegistry }) {
    this.#logger = setupService('OperationInterpreter', logger, {
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
  execute(operation, executionContext) {
    if (!operation?.type || typeof operation.type !== 'string') {
      this.#logger.error(
        'OperationInterpreter received invalid operation object (missing type).',
        { operation }
      );
      return;
    }

    const opType = operation.type.trim();

    // FIX: Add a check for an empty string after trimming. This prevents
    // the registry from being called with an empty type.
    if (!opType) {
      this.#logger.error(
        'OperationInterpreter received an operation with a missing or empty type.',
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
    //  🔑  NEW LOGIC:  don’t interpolate placeholders inside nested actions
    // -----------------------------------------------------------------------
    let paramsForHandler;
    try {
      if (operation.parameters && typeof operation.parameters === 'object') {
        paramsForHandler = {};

        for (const [key, value] of Object.entries(operation.parameters)) {
          if (ACTION_ARRAY_KEYS.has(key) && Array.isArray(value)) {
            // Defer interpolation – pass through unchanged
            paramsForHandler[key] = value;
          } else {
            // Interpolate normally
            paramsForHandler[key] = resolvePlaceholders(
              value,
              executionContext,
              this.#logger
            );
          }
        }
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
      handler(paramsForHandler, executionContext);
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
