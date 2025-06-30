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
import { handleIf } from './flowHandlers/ifHandler.js';
import { handleForEach } from './flowHandlers/forEachHandler.js';

const FLOW_HANDLERS = {
  IF: handleIf,
  FOR_EACH: handleForEach,
};

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
      const flowHandler = FLOW_HANDLERS[opType];
      if (flowHandler) {
        flowHandler(
          nodeToOperation(op),
          {
            ...baseCtx,
            scopeLabel: `${scopeLabel} ${opType}#${opIndex}`,
            jsonLogic,
          },
          logger,
          operationInterpreter
        );
        logger.debug(`${tag} Finished executing ${opType} operation.`);
      } else {
        operationInterpreter.execute(op, baseCtx);
        logger.debug(`${tag} Finished executing operation of type: ${opType}`);
      }
    } catch (err) {
      logger.error(
        `${tag} CRITICAL error during execution of Operation ${opType}`,
        err
      );
      throw err;
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
