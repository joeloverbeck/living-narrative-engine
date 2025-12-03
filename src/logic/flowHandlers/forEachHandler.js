// src/logic/flowHandlers/forEachHandler.js

/**
 * @module flowHandlers/forEachHandler
 * @description Flow-control handler that iterates over a collection and
 * executes an action sequence for each item.
 */

/** @typedef {import('../../../data/schemas/operation.schema.json').Operation} Operation */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../operationInterpreter.js').default} OperationInterpreter */
/**
 * @typedef {ExecutionContext & {
 *   scopeLabel?: string,
 *   jsonLogic: import('../jsonLogicEvaluationService.js').default,
 * }} ActionExecutionContext
 */

import { resolvePath } from '../../utils/objectUtils.js';

/**
 * Execute FOR_EACH logic.
 *
 * @param {Operation} node - Operation describing the FOR_EACH loop.
 * @param {ActionExecutionContext} nestedCtx - Execution context for the loop.
 * @param {ILogger} logger - Logger instance for diagnostics.
 * @param {OperationInterpreter} operationInterpreter - Interpreter for executing the loop body.
 * @param executeActionSequence
 * @returns {void}
 */
export async function handleForEach(
  node,
  nestedCtx,
  logger,
  operationInterpreter,
  executeActionSequence
) {
  const {
    collection: path,
    item_variable: varName,
    actions,
  } = node.parameters || {};

  const { scopeLabel, jsonLogic, ...baseCtx } = nestedCtx;

  // Type check collection parameter
  if (typeof path !== 'string') {
    const received = JSON.stringify(path);
    const message =
      path && typeof path === 'object' && 'var' in path
        ? `FOR_EACH: 'collection' must be a string path, not a JSON Logic object. ` +
          `Received: ${received}. Use: "${path.var}" instead of ${received}`
        : `FOR_EACH: 'collection' must be a string path. Received: ${typeof path}`;
    throw new TypeError(message);
  }

  if (
    !path.trim() ||
    !varName?.trim() ||
    !Array.isArray(actions) ||
    actions.length === 0
  ) {
    logger.warn(`${scopeLabel}: invalid parameters.`);
    return;
  }
  const collection = resolvePath(baseCtx.evaluationContext, path.trim());
  if (!Array.isArray(collection)) {
    logger.warn(`${scopeLabel}: '${path}' did not resolve to an array.`);
    return;
  }

  const store = baseCtx.evaluationContext.context;
  const hadPrior = Object.prototype.hasOwnProperty.call(store, varName);
  const saved = store[varName];

  try {
    for (let i = 0; i < collection.length; i++) {
      store[varName] = collection[i];
      await executeActionSequence(
        actions,
        {
          ...baseCtx,
          scopeLabel: `${scopeLabel} > Item ${i + 1}/${collection.length}`,
          jsonLogic,
        },
        logger,
        operationInterpreter
      );
    }
  } finally {
    hadPrior ? (store[varName] = saved) : delete store[varName];
  }
}
