/**
 * @file A handler that returns the current timestamp.
 * @see src/logic/operationHandlers/getTimestampHandler.js
 */

import BaseOperationHandler from './baseOperationHandler.js';
import { tryWriteContextVariable } from '../../utils/contextVariableUtils.js';
import { assertParamsObject } from '../../utils/handlerUtils/indexUtils.js';

class GetTimestampHandler extends BaseOperationHandler {
  constructor({ logger }) {
    super('GetTimestampHandler', {
      logger: { value: logger },
    });
  }

  execute(params, execCtx) {
    const logger = this.getLogger(execCtx);
    if (!assertParamsObject(params, logger, 'GET_TIMESTAMP')) return;

    const rv = params.result_variable.trim();
    const timestamp = new Date().toISOString();
    const result = tryWriteContextVariable(
      rv,
      timestamp,
      execCtx,
      undefined,
      logger
    );
    if (result.success) {
      logger.debug(`GET_TIMESTAMP → ${rv} = ${timestamp}`);
    }
  }
}

export default GetTimestampHandler;
