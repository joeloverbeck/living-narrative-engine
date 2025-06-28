// src/logic/actionSequence.js

/**
 * @module actionSequence
 * @description Helper for executing a list of operations with built-in
 * condition checks and error handling. Extracted from
 * SystemLogicInterpreter._executeActions.
 */

/** @typedef {import('../../data/schemas/operation.schema.json').Operation} Operation */
/** @typedef {import('./defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('./operationInterpreter.js').default} OperationInterpreter */
/**
 * @typedef {ExecutionContext & {
 *   scopeLabel?: string,
 *   jsonLogic: import('./jsonLogicEvaluationService.js').default,
 * }} ActionExecutionContext
 */

import { evaluateConditionWithLogging } from './jsonLogicEvaluationService.js';
import { resolvePath } from '../utils/objectUtils.js';

/**
 * Handles IF flow-control nodes.
 *
 * @param {Operation} node - Operation describing the IF logic.
 * @param {ActionExecutionContext} nestedCtx - Execution context for nested actions.
 * @param {ILogger} logger - Logger instance for diagnostics.
 * @param {OperationInterpreter} operationInterpreter - Interpreter used to execute nested operations.
 */
function handleIf(node, nestedCtx, logger, operationInterpreter) {
  const {
    condition,
    then_actions: thenActs = [],
    else_actions: elseActs = [],
  } = node.parameters || {};

  const { scopeLabel = 'IF', jsonLogic, ...baseCtx } = nestedCtx;
  const { result, errored } = evaluateConditionWithLogging(
    jsonLogic,
    condition,
    baseCtx.evaluationContext,
    logger,
    scopeLabel
  );

  if (errored) {
    return;
  }

  if (result) {
    logger.debug(`[handleIf] then_actions length: ${thenActs.length}`);
    logger.debug(
      `[handleIf] then_actions: ${JSON.stringify(thenActs, null, 2)}`
    );
  } else {
    logger.debug(`[handleIf] else_actions length: ${elseActs.length}`);
    logger.debug(
      `[handleIf] else_actions: ${JSON.stringify(elseActs, null, 2)}`
    );
  }

  executeActionSequence(
    result ? thenActs : elseActs,
    { ...baseCtx, scopeLabel, jsonLogic },
    logger,
    operationInterpreter
  );
}

/**
 * Handles FOR_EACH flow-control nodes.
 *
 * @param {Operation} node - Operation describing the FOR_EACH loop.
 * @param {ActionExecutionContext} nestedCtx - Execution context for the loop.
 * @param {ILogger} logger - Logger instance for diagnostics.
 * @param {OperationInterpreter} operationInterpreter - Interpreter for executing the loop body.
 */
function handleForEach(node, nestedCtx, logger, operationInterpreter) {
  const {
    collection: path,
    item_variable: varName,
    actions,
  } = node.parameters || {};

  const { scopeLabel, jsonLogic, ...baseCtx } = nestedCtx;

  if (
    !path?.trim() ||
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
      executeActionSequence(
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

/**
 * Executes a sequence of operations.
 *
 * @param {Operation[]} actions - Operations to execute.
 * @param {ActionExecutionContext} nestedCtx - Nested execution context containing
 *   evaluation data, logger, jsonLogic instance, and optional scope label.
 * @param {ILogger} logger - Logger for diagnostics.
 * @param {OperationInterpreter} operationInterpreter - Interpreter used to
 *   execute individual operations.
 */
export function executeActionSequence(
  actions,
  nestedCtx,
  logger,
  operationInterpreter
) {
  const { scopeLabel = 'ActionSequence', jsonLogic, ...baseCtx } = nestedCtx;
  const total = actions.length;

  for (let i = 0; i < total; i++) {
    const op = actions[i];
    const opIndex = i + 1;
    const opType = op?.type ?? 'MISSING_TYPE';
    const tag = `[${scopeLabel} - Action ${opIndex}/${total}]`;

    if (!op || typeof op !== 'object' || !op.type) {
      logger.error(`${tag} Invalid operation object. Halting sequence.`, op);
      break;
    }

    if (op.condition) {
      const { result, errored, error } = evaluateConditionWithLogging(
        jsonLogic,
        op.condition,
        baseCtx.evaluationContext,
        logger,
        tag
      );
      if (errored) {
        logger.error(`${tag} Condition evaluation failed – op skipped.`, error);
        continue;
      }
      if (!result) {
        logger.debug(`${tag} Condition=false – op skipped.`);
        continue;
      }
    }

    try {
      logger.debug(`${tag} About to execute operation of type: ${opType}`);
      if (opType === 'IF') {
        handleIf(
          nodeToOperation(op),
          { ...baseCtx, scopeLabel: `${scopeLabel} IF#${opIndex}`, jsonLogic },
          logger,
          operationInterpreter
        );
        logger.debug(`${tag} Finished executing IF operation.`);
      } else if (opType === 'FOR_EACH') {
        handleForEach(
          nodeToOperation(op),
          {
            ...baseCtx,
            scopeLabel: `${scopeLabel} FOR_EACH#${opIndex}`,
            jsonLogic,
          },
          logger,
          operationInterpreter
        );
        logger.debug(`${tag} Finished executing FOR_EACH operation.`);
      } else {
        operationInterpreter.execute(op, baseCtx);
        logger.debug(`${tag} Finished executing operation of type: ${opType}`);
      }
    } catch (err) {
      logger.error(
        `${tag} CRITICAL error during execution of Operation ${opType}`,
        err
      );
      break;
    }
  }
}

/**
 * Identity helper for type clarity.
 *
 * @param {Operation} node - Operation node to cast.
 * @returns {Operation} The same operation node.
 */
function nodeToOperation(node) {
  return node;
}

export default executeActionSequence;
