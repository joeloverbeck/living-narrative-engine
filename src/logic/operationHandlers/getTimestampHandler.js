/**
 * @file A handler that returns the current timestamp.
 * @see src/logic/operationHandlers/getTimestampHandler.js
 */

class GetTimestampHandler {
  #logger;

  constructor({ logger }) {
    if (!logger?.info) throw new Error('…');
    this.#logger = logger;
  }

  execute(params, execCtx) {
    const rv = params.result_variable.trim();
    execCtx.evaluationContext.context[rv] = new Date().toISOString();
    this.#logger.debug(
      `GET_TIMESTAMP → ${rv} = ${execCtx.evaluationContext.context[rv]}`
    );
  }
}

export default GetTimestampHandler;
