/**
 * @file A handler that returns the current timestamp.
 * @see src/logic/operationHandlers/getTimestampHandler.js
 */

import { setContextValue } from '../../utils/contextVariableUtils.js';
import { assertParamsObject } from '../../utils/handlerUtils';

class GetTimestampHandler {
  #logger;

  constructor({ logger }) {
    if (!logger?.info) throw new Error('…');
    this.#logger = logger;
  }

  execute(params, execCtx) {
    const logger = execCtx?.logger ?? this.#logger;
    if (!assertParamsObject(params, logger, 'GET_TIMESTAMP')) return;

    const rv = params.result_variable.trim();
    const timestamp = new Date().toISOString();
    const stored = setContextValue(
      rv,
      timestamp,
      execCtx,
      undefined,
      this.#logger
    );
    if (stored) {
      this.#logger.debug(`GET_TIMESTAMP → ${rv} = ${timestamp}`);
    }
  }
}

export default GetTimestampHandler;
