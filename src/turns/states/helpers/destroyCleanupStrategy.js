/**
 * @file Helper functions for cleanup when a turn handler is destroyed.
 */

/**
 * @typedef {import('../../interfaces/ITurnContext.js').ITurnContext} ITurnContext
 * @typedef {import('../../../entities/entity.js').default} Entity
 * @typedef {import('../../../interfaces/coreServices.js').ILogger | Console} ILogger
 */

/**
 * Collection of functions handling cleanup scenarios when a state is destroyed.
 *
 * @type {{
 *   noActor(logger: ILogger, stateName: string): void,
 *   handlerDestroying(logger: ILogger, actor: Entity, stateName: string): void,
 *   activeActor(turnContext: ITurnContext, logger: ILogger, actor: Entity, stateName: string): Promise<void>
 * }}
 */
export const destroyCleanupStrategy = {
  /**
   * @description Logs a warning when no actor exists in context during handler destruction.
   * @param {ILogger} logger - Logger instance used for output.
   * @param {string} stateName - Name of the calling state.
   * @returns {void}
   */
  noActor(logger, stateName) {
    logger.warn(
      `${stateName}: Handler destroyed. Actor ID from context: N/A_in_context. No specific turn to end via context if actor is missing.`
    );
  },

  /**
   * @description Logs a debug message when the handler is already destroying or destroyed.
   * @param {ILogger} logger - Logger instance used for output.
   * @param {Entity} actor - Actor retrieved from the context.
   * @param {string} stateName - Name of the calling state.
   * @returns {void}
   */
  handlerDestroying(logger, actor, stateName) {
    logger.debug(
      `${stateName}: Handler (actor ${actor.id}) is already being destroyed. Skipping turnContext.endTurn().`
    );
  },

  /**
   * @description Ends the turn via context when the handler is destroyed while an actor is active.
   * @param {ITurnContext} turnContext - Current turn context.
   * @param {ILogger} logger - Logger instance used for output.
   * @param {Entity} actor - Actor retrieved from the context.
   * @param {string} stateName - Name of the calling state.
   * @returns {Promise<void>} Resolves when turn ending completes.
   */
  async activeActor(turnContext, logger, actor, stateName) {
    logger.debug(
      `${stateName}: Handler destroyed while state was active for actor ${actor.id}. Ending turn via turnContext (may trigger AbortError if prompt was active).`
    );
    await turnContext.endTurn(
      new Error(
        `Turn handler destroyed while actor ${actor.id} was in ${stateName}.`
      )
    );
  },
};
