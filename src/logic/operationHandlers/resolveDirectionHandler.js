/**
 * @file A handler that resolves a direction into a target location's instance id.
 * @see src/logic/operationHandlers/resolveDirectionHandler.js
 */

class ResolveDirectionHandler {
  #worldContext;
  #logger;

  constructor({ worldContext, logger }) {
    if (typeof worldContext.getTargetLocationForDirection !== 'function')
      throw new Error('…');
    this.#worldContext = worldContext;
    this.#logger = logger;
  }

  execute(params, execCtx) {
    const { current_location_id, direction, result_variable } = params;
    const target = this.#worldContext.getTargetLocationForDirection({
      current_location_id,
      direction_taken: direction,
    });
    execCtx.evaluationContext.context[result_variable.trim()] = target;
    this.#logger.debug(`RESOLVE_DIRECTION → ${result_variable} = ${target}`);
  }
}

export default ResolveDirectionHandler;
