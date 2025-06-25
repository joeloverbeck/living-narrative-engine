/**
 * @file A handler that returns the current timestamp.
 * @see src/logic/operationHandlers/getTimestampHandler.js
 */

import BaseOperationHandler from './baseOperationHandler.js';
import { tryWriteContextVariable } from '../../utils/contextVariableUtils.js';
import { assertParamsObject } from '../../utils/handlerUtils/indexUtils.js';

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

    const resultVariable = params.result_variable.trim();
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
