// src/logic/operationInterpreter.js (WITH ADDED LOGS)
import { resolvePlaceholders } from './contextUtils.js'; // Adjust path as needed
// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../data/schemas/operation.schema.json').Operation} Operation */
/** @typedef {import('./defs.js').ExecutionContext} ExecutionContext */ // Placeholder
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('./operationRegistry.js').default} OperationRegistry */

class OperationInterpreter {
  #logger;
  #registry;

  constructor({ logger, operationRegistry }) {
    if (!logger || typeof logger.error !== 'function') {
      throw new Error(
        'OperationInterpreter requires a valid ILogger instance.'
      );
    }
    if (
      !operationRegistry ||
      typeof operationRegistry.getHandler !== 'function'
    ) {
      throw new Error(
        'OperationInterpreter requires a valid OperationRegistry instance.'
      );
    }
    this.#logger = logger;
    this.#registry = operationRegistry;
    this.#logger.info(
      'OperationInterpreter Initialized (using OperationRegistry).'
    );
  }

  execute(operation, executionContext) {
    if (
      !operation ||
      typeof operation.type !== 'string' ||
      !operation.type.trim()
    ) {
      this.#logger.error(
        'OperationInterpreter received invalid operation object (missing or invalid type). Skipping execution.',
        { operation }
      );
      return;
    }

    const opType = operation.type.trim();
    const handler = this.#registry.getHandler(opType);

    if (handler) {
      let resolvedParameters;
      try {
        resolvedParameters = resolvePlaceholders(
          operation.parameters,
          executionContext,
          this.#logger
        );
      } catch (interpolationError) {
        this.#logger.error(
          `Error resolving placeholders for operation type "${opType}". Skipping handler invocation.`,
          interpolationError
        );
        return; // Stop if placeholders fail
      }

      try {
        this.#logger.debug(
          `Executing handler for operation type "${opType}"...`
        );
        handler(resolvedParameters, executionContext); // Call the actual handler
      } catch (handlerError) {
        this.#logger.debug(
          `Handler for operation type "${opType}" threw an error. Rethrowing...`
        );
        throw handlerError; // Rethrow
      }
    } else {
      this.#logger.error(
        `---> HANDLER NOT FOUND for operation type: "${opType}". Skipping execution.`
      );
    }
  }
}

export default OperationInterpreter;
