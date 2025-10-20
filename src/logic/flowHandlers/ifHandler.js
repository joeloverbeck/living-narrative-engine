// src/logic/flowHandlers/ifHandler.js

/**
 * @module flowHandlers/ifHandler
 * @description Flow-control handler that executes THEN or ELSE action sequences
 * based on a JSON Logic condition.
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

import { evaluateConditionWithLogging } from '../jsonLogicEvaluationService.js';

/**
 * Execute IF logic.
 *
 * @param {Operation} node - Operation describing the IF logic.
 * @param {ActionExecutionContext} nestedCtx - Execution context for nested actions.
 * @param {ILogger} logger - Logger instance for diagnostics.
 * @param {OperationInterpreter} operationInterpreter - Interpreter used to execute nested operations.
 * @param executeActionSequence
 * @returns {void}
 */
export async function handleIf(
  node,
  nestedCtx,
  logger,
  operationInterpreter,
  executeActionSequence
) {
  const {
    condition,
    then_actions: thenActs = [],
    else_actions: elseActs = [],
  } = node.parameters || {};

  logger.debug(
    `[DEBUG] handleIf - Evaluating IF condition:`,
    JSON.stringify(condition, null, 2)
  );
  logger.debug(
    `[DEBUG] handleIf - Context available:`,
    Object.keys(nestedCtx.evaluationContext.context || {})
  );

  const { scopeLabel = 'IF', jsonLogic, ...baseCtx } = nestedCtx;
  const { result, errored } = evaluateConditionWithLogging(
    jsonLogic,
    condition,
    baseCtx.evaluationContext,
    logger,
    scopeLabel
  );

  logger.debug(
    `[DEBUG] handleIf - Condition result: ${result}, errored: ${errored}`
  );

  if (errored) {
    logger.debug(`[DEBUG] handleIf - Condition errored, exiting`);
    return;
  }

  if (result) {
    logger.debug(
      `[DEBUG] handleIf - Executing then_actions (${thenActs.length} actions)`
    );
    logger.debug(`[handleIf] then_actions length: ${thenActs.length}`);
    logger.debug(
      `[handleIf] then_actions: ${JSON.stringify(thenActs, null, 2)}`
    );
  } else {
    logger.debug(
      `[DEBUG] handleIf - Executing else_actions (${elseActs.length} actions)`
    );
    logger.debug(`[handleIf] else_actions length: ${elseActs.length}`);
    logger.debug(
      `[handleIf] else_actions: ${JSON.stringify(elseActs, null, 2)}`
    );
  }

  await executeActionSequence(
    result ? thenActs : elseActs,
    { ...baseCtx, scopeLabel, jsonLogic },
    logger,
    operationInterpreter
  );

  logger.debug(`[DEBUG] handleIf - Action sequence completed`);
}
