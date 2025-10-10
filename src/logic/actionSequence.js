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
export async function executeActionSequence(
  actions,
  nestedCtx,
  logger,
  operationInterpreter
) {
  const { scopeLabel = 'ActionSequence', jsonLogic, ...baseCtx } = nestedCtx;
  const total = actions.length;
  const sequenceStartTime = Date.now();

  logger.debug(
    `🎬 [ActionSequence] Starting sequence: ${scopeLabel} (${total} actions)`
  );

  for (let i = 0; i < total; i++) {
    const op = actions[i];
    const opIndex = i + 1;
    const opType = op?.type ?? 'MISSING_TYPE';
    const tag = `[${scopeLabel} - Action ${opIndex}/${total}]`;
    const actionStartTime = Date.now();

    logger.debug(`🎯 [ActionSequence] ${tag} Starting action: ${opType}`);

    if (!op || typeof op !== 'object' || !op.type) {
      logger.error(`❌ ${tag} Invalid operation object. Halting sequence.`, op);
      break;
    }

    if (op.condition) {
      logger.debug(`🔍 ${tag} Evaluating condition for ${opType}`);
      const { result, errored, error } = evaluateConditionWithLogging(
        jsonLogic,
        op.condition,
        baseCtx.evaluationContext,
        logger,
        tag
      );
      if (errored) {
        logger.error(
          `❌ ${tag} Condition evaluation failed – op skipped.`,
          error
        );
        continue;
      }
      if (!result) {
        logger.debug(`⏭️ ${tag} Condition=false – op skipped.`);
        continue;
      }
      logger.debug(`✅ ${tag} Condition passed for ${opType}`);
    }

    try {
      logger.debug(`⚡ ${tag} About to execute operation of type: ${opType}`);
      const flowHandler = FLOW_HANDLERS[opType];
      if (flowHandler) {
        logger.debug(`🔄 ${tag} Using flow handler for ${opType}`);
        await flowHandler(
          nodeToOperation(op),
          {
            ...baseCtx,
            scopeLabel: `${scopeLabel} ${opType}#${opIndex}`,
            jsonLogic,
          },
          logger,
          operationInterpreter,
          executeActionSequence
        );
        const actionEndTime = Date.now();
        const actionDuration = actionEndTime - actionStartTime;
        logger.debug(
          `✅ ${tag} Finished executing ${opType} operation (${actionDuration}ms)`
        );
      } else {
        logger.debug(`🔧 ${tag} Using operation interpreter for ${opType}`);

        // Capture operation start if trace available
        if (baseCtx.trace?.captureOperationStart) {
          baseCtx.trace.captureOperationStart(op, opIndex);
        }

        const operationResult = await operationInterpreter.execute(op, baseCtx);

        // Capture operation result if trace available
        if (baseCtx.trace?.captureOperationResult) {
          baseCtx.trace.captureOperationResult(operationResult);
        }

        const actionEndTime = Date.now();
        const actionDuration = actionEndTime - actionStartTime;

        // Track operation result and warn on failures
        const resultSuccess = operationResult?.success;
        if (resultSuccess === true) {
          logger.debug(
            `✅ ${tag} Operation ${opType} completed successfully (${actionDuration}ms)`
          );
        } else if (resultSuccess === false) {
          logger.warn(
            `⚠️ ${tag} Operation ${opType} reported failure but rule continues (${actionDuration}ms)`,
            {
              operationType: opType,
              operationIndex: opIndex,
              error: operationResult.error,
              operationParameters: op.parameters,
            }
          );
        } else {
          logger.debug(
            `✅ ${tag} Finished executing operation of type: ${opType} (${actionDuration}ms)`
          );
        }
      }
    } catch (err) {
      logger.error(
        `❌ ${tag} CRITICAL error during execution of Operation ${opType}`,
        err
      );
      throw err;
    }
  }

  const sequenceEndTime = Date.now();
  const sequenceDuration = sequenceEndTime - sequenceStartTime;
  logger.debug(
    `🏁 [ActionSequence] Completed sequence: ${scopeLabel} (${sequenceDuration}ms total)`
  );
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
