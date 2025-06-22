/**
 * @file A handler that returns the current timestamp.
 * @see src/logic/operationHandlers/getTimestampHandler.js
 */

import { tryWriteContextVariable } from '../../utils/contextVariableUtils.js';
import { assertParamsObject } from '../../utils/handlerUtils/indexUtils.js';

class GetTimestampHandler {
  #logger;

  constructor({ logger }) {
    if (!logger?.info) throw new Error('…');
    this.#logger = logger;
  }

  execute(params, executionContext) {
    const logger = executionContext?.logger ?? this.#logger;
    if (!assertParamsObject(params, logger, 'GET_TIMESTAMP')) return;

    const rv = params.result_variable.trim();
    const timestamp = new Date().toISOString();
    const result = tryWriteContextVariable(
      rv,
      timestamp,
      executionContext,
      undefined,
      this.#logger
    );
    if (result.success) {
      this.#logger.debug(`GET_TIMESTAMP → ${rv} = ${timestamp}`);
    }
  }
}

export default GetTimestampHandler;
