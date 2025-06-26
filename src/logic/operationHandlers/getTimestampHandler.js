/**
 * @file A handler that returns the current timestamp.
 * @see src/logic/operationHandlers/getTimestampHandler.js
 */

import BaseOperationHandler from './baseOperationHandler.js';
import { tryWriteContextVariable } from '../../utils/contextVariableUtils.js';
import { assertParamsObject } from '../../utils/handlerUtils/indexUtils.js';
import { validateStringParam } from '../../utils/handlerUtils/paramsUtils.js';
import { ensureEvaluationContext } from '../../utils/evaluationContextUtils.js';

/**
 * @implements {OperationHandler}
 */
class GetTimestampHandler extends BaseOperationHandler {
  /**
   * @param {BaseHandlerDeps} deps - Dependencies object
   */
  constructor({ logger }) {
    super('GetTimestampHandler', {
      logger: { value: logger },
    });
  }

  execute(params, executionContext) {
    const logger = this.getLogger(executionContext);
    if (!assertParamsObject(params, logger, 'GET_TIMESTAMP')) return;

    const resultVariable = validateStringParam(
      params.result_variable,
      'result_variable',
      logger,
      undefined
    );
    if (resultVariable === null) return;
    if (!ensureEvaluationContext(executionContext, undefined, logger)) {
      return;
    }
    const timestamp = new Date().toISOString();
    const result = tryWriteContextVariable(
      resultVariable,
      timestamp,
      executionContext,
      undefined,
      logger
    );
    if (result.success) {
      logger.debug(`GET_TIMESTAMP → ${resultVariable} = ${timestamp}`);
    }
  }
}

export default GetTimestampHandler;
