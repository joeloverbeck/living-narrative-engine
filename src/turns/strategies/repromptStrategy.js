// src/turns/strategies/repromptStrategy.js
// ────────────────────────────────────────────────────────────────
//  RepromptStrategy
// ────────────────────────────────────────────────────────────────

/** @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../../entities/entity.js').default}      Entity */
/** @typedef {import('../constants/turnDirectives.js').default} TurnDirectiveEnum */
/** @typedef {import('../../types/commandResult.js').CommandResult}  CommandResult */

import { ITurnDirectiveStrategy } from '../interfaces/ITurnDirectiveStrategy.js';
import TurnDirective from '../constants/turnDirectives.js';
import { AwaitingActorDecisionState } from '../states/awaitingActorDecisionState.js';
import { DISPLAY_ERROR_ID } from '../../constants/eventIds.js';

/**
 * Handles TurnDirective.RE_PROMPT by requesting a transition to AwaitingActorDecisionState.
 * Relies solely on ITurnContext to obtain the actor and other necessary services.
 */
export default class RepromptStrategy extends ITurnDirectiveStrategy {
  /**
   * Executes the re-prompt strategy.
   * The actor is obtained from `turnContext.getActor()`.
   *
   * @override
   * @async
   * @param {ITurnContext} turnContext - The context for the current turn.
   * @param {TurnDirectiveEnum} directive - The directive that triggered this strategy.
   * @param {CommandResult} [cmdProcResult] - Optional result from command processing.
   * @returns {Promise<void>} Resolves when the strategy execution is complete.
   * @throws {Error} If the directive is not RE_PROMPT or if a critical error occurs.
   */
  async execute(
    /** @type {ITurnContext}  */ turnContext,
    /** @type {TurnDirectiveEnum}     */ directive,
    /** @type {CommandResult}    */ cmdProcResult // eslint-disable-line no-unused-vars
  ) {
    const className = this.constructor.name;
    const logger = turnContext.getLogger();
    const safeEventDispatcher = turnContext.getSafeEventDispatcher();

    if (directive !== TurnDirective.RE_PROMPT) {
      const errorMsg = `${className}: Received non-RE_PROMPT directive (${directive}). Aborting.`;
      safeEventDispatcher?.dispatch(DISPLAY_ERROR_ID, {
        message: errorMsg,
        details: { directive },
      });
      // Throwing an error allows the calling state (e.g., ProcessingCommandState)
      // to handle this appropriately, potentially by ending the turn with this error.
      throw new Error(errorMsg);
    }

    const contextActor = turnContext.getActor();

    if (!contextActor) {
      const errorMsg = `${className}: No actor found in ITurnContext. Cannot re-prompt.`;
      safeEventDispatcher?.dispatch(DISPLAY_ERROR_ID, {
        message: errorMsg,
        details: { directive },
      });
      // End the turn with an error because re-prompting requires an actor.
      // The turnContext.endTurn() method will signal the handler to transition
      // to an appropriate end state (e.g., TurnEndingState, then TurnIdleState).
      turnContext.endTurn(new Error(errorMsg));
      return;
    }

    // The previous check `if (!contextActor || contextActor.id !== actor.id)`
    // is no longer needed as the explicit `actor` parameter has been removed.
    // The primary concern now is the existence of `contextActor`.

    logger.debug(
      `${className}: Re-prompting actor ${contextActor.id}; requesting transition to AwaitingActorDecisionState.`
    );

    // Request transition to AwaitingActorDecisionState via ITurnContext
    // The AwaitingActorDecisionState constructor expects the handler instance,
    // which turnContext.requestTransition() will manage internally.
    try {
      await turnContext.requestTransition(AwaitingActorDecisionState);
      logger.debug(
        `${className}: Transition to AwaitingActorDecisionState requested successfully for actor ${contextActor.id}.`
      );
    } catch (transitionError) {
      const errorMsg = `${className}: Failed to request transition to AwaitingActorDecisionState for actor ${contextActor.id}. Error: ${transitionError.message}`;
      safeEventDispatcher?.dispatch(DISPLAY_ERROR_ID, {
        message: errorMsg,
        details: {
          actorId: contextActor.id,
          error: transitionError.message,
          stack: transitionError.stack,
        },
      });
      // If the transition fails, end the turn with an error.
      turnContext.endTurn(new Error(errorMsg));
    }
  }
}
