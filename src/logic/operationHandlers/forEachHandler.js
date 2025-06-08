// src/logic/operationHandlers/forEachHandler.js
// -----------------------------------------------------------------------------
//  FOR_EACH Handler  —  Ticket “Loop support”
//  Executes a nested action list once per element in a collection.
// -----------------------------------------------------------------------------

/** @typedef {import('../../interfaces/coreServices.js').ILogger}                 ILogger */
/** @typedef {import('../defs.js').ExecutionContext}                             ExecutionContext */
/** @typedef {import('../operationInterpreter.js').default}                      OperationInterpreter */
/** @typedef {import('../defs.js').OperationParams}                              OperationParams */

import resolvePath from '../../utils/resolvePath.js';

/**
 * @typedef {object} ForEachParams
 * @property {string} collection       Dot-path to the array inside evaluationContext
 * @property {string} item_variable    Context variable name that holds each value
 * @property {import('../../data/schemas/operation.schema.json').Operation[]} actions
 */

class ForEachHandler {
  #logger;
  #opInterpreter;

  /**
   * @param {object} deps
   * @param {ILogger} deps.logger
   * @param {OperationInterpreter} deps.operationInterpreter
   */
  constructor({ logger, operationInterpreter }) {
    if (!logger?.debug) throw new Error('ForEachHandler needs ILogger');
    if (!operationInterpreter?.execute)
      throw new Error('ForEachHandler needs OperationInterpreter');
    this.#logger = logger;
    this.#opInterpreter = operationInterpreter;
  }

  /**
   * @param {OperationParams|ForEachParams|undefined|null} params
   * @param {ExecutionContext} executionContext
   */
  execute(params, executionContext) {
    // always log to the handler’s injected logger so tests on logger.warn() work
    const log = this.#logger;

    // ---------- 1. Validate input -------------------------------------------------
    if (!params || typeof params !== 'object') {
      log.warn('FOR_EACH: params missing or not an object', { params });
      return;
    }
    const { collection, item_variable, actions } = params;
    if (typeof collection !== 'string' || !collection.trim()) {
      log.warn('FOR_EACH: "collection" must be non-empty string');
      return;
    }
    if (typeof item_variable !== 'string' || !item_variable.trim()) {
      log.warn('FOR_EACH: "item_variable" must be non-empty string');
      return;
    }
    if (!Array.isArray(actions) || actions.length === 0) {
      log.warn('FOR_EACH: "actions" must be non-empty array');
      return;
    }

    // ---------- 2. Resolve collection path --------------------------------------
    const src = executionContext?.evaluationContext;
    const arr = resolvePath(src, collection.trim());
    if (!Array.isArray(arr)) {
      log.warn(
        `FOR_EACH: Path '${collection}' did not resolve to an array (got ${typeof arr}). Loop skipped.`
      );
      return;
    }

    // ---------- 3. Loop -----------------------------------------------------------
    const ctxStore = executionContext.evaluationContext.context;
    const varName = item_variable.trim();

    // track whether we need to restore or delete the variable afterward
    const hadPrior = Object.prototype.hasOwnProperty.call(ctxStore, varName);
    const savedPriorValue = hadPrior ? ctxStore[varName] : undefined;

    log.debug(
      `FOR_EACH: Iterating ${arr.length} element(s) over path '${collection}' → variable '${varName}'.`
    );

    try {
      for (let i = 0; i < arr.length; i += 1) {
        ctxStore[varName] = arr[i];
        try {
          for (const op of actions) {
            this.#opInterpreter.execute(op, executionContext);
          }
        } catch (nestedErr) {
          log.error(
            `FOR_EACH: nested action threw at loop index ${i}. Aborting loop.`,
            nestedErr
          );
          throw nestedErr; // propagate as specified
        }
      }
    } finally {
      // restore previous value (or clean up) so outer scope isn’t polluted
      if (hadPrior) {
        ctxStore[varName] = savedPriorValue;
      } else {
        delete ctxStore[varName];
      }
    }
  }
}

export default ForEachHandler;
