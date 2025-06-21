// src/turns/strategies/waitForTurnEndEventStrategy.js
// ────────────────────────────────────────────────────────────────
//  WaitForTurnEndEventStrategy
// ────────────────────────────────────────────────────────────────

/** @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../../entities/entity.js').default}       Entity */
/** @typedef {import('../constants/turnDirectives.js').default}   TurnDirectiveEnum */
/** @typedef {import('../../types/commandResult.js').CommandResult}   CommandResult */

import { ITurnDirectiveStrategy } from '../interfaces/iTurnDirectiveStrategy.js';
import TurnDirective from '../constants/turnDirectives.js';
import { TURN_ENDED_ID } from '../../constants/eventIds.js';

export default class WaitForTurnEndEventStrategy extends ITurnDirectiveStrategy {
  /**
   * Executes the WaitForTurnEndEventStrategy.
   * This strategy transitions the turn to AwaitingExternalTurnEndState, relying solely on
   * ITurnContext to obtain the actor and manage turn progression.
   * The explicit 'actor' parameter has been removed from the signature as per Ticket 2.
   *
   * @override
   * @async
   * @param {ITurnContext} turnContext - The context for the current turn.
   * @param {TurnDirectiveEnum} directive - The directive that triggered this strategy.
   * @param {CommandResult} [cmdProcResult] - Optional result from command processing.
   * @returns {Promise<void>} Resolves when the strategy execution is complete.
   * @throws {Error} If the directive is not WAIT_FOR_EVENT or if a critical error occurs.
   */
  async execute(
    /** @type {ITurnContext} */ turnContext,
    // actor parameter removed as per outcome of Ticket 2
    /** @type {TurnDirectiveEnum}     */ directive,
    /** @type {CommandResult}    */ cmdProcResult // eslint-disable-line no-unused-vars
  ) {
    const className = this.constructor.name;
    const logger = turnContext.getLogger();

    if (directive !== TurnDirective.WAIT_FOR_EVENT) {
      const errorMsg = `${className}: Received wrong directive (${directive}). Expected WAIT_FOR_EVENT.`;
      logger.error(errorMsg);
      // As per standard practice in other strategies, throw an error to let the calling state handle it.
      // This might involve ending the turn with this error.
      throw new Error(errorMsg);
    }

    const contextActor = turnContext.getActor();

    if (!contextActor) {
      const criticalErrorMsg = `${className}: No actor found in ITurnContext. Cannot transition to AwaitingExternalTurnEndState without an actor.`;
      logger.error(criticalErrorMsg);
      // As per ticket: log this critical error and end the turn via turnContext.endTurn(new Error(...))
      await turnContext.endTurn(new Error(criticalErrorMsg));
      return;
    }

    // The previous check `if (!contextActor || contextActor.id !== actor.id)` is no longer applicable
    // as the explicit `actor` parameter has been removed. The primary concern is now the existence of `contextActor`.

    // Logging and State Transition Logic
    logger.debug(
      `${className}: Actor ${contextActor.id} to wait for external event (e.g., ${TURN_ENDED_ID}). Requesting transition to AwaitingExternalTurnEndState.`
    );

    // Core logic: request transition to AwaitingExternalTurnEndState
    // The responsibility for setting any underlying handler flags (like ActorTurnHandler.#isAwaitingTurnEndEvent)
    // is managed by AwaitingExternalTurnEndState itself through turnContext.setAwaitingExternalEvent(true, actorId).
    try {
      // MODIFIED: Call the new, abstract method on the turn context.
      await turnContext.requestAwaitingExternalTurnEndStateTransition();
      logger.debug(
        `${className}: Transition to AwaitingExternalTurnEndState requested successfully for actor ${contextActor.id}.`
      );
    } catch (transitionError) {
      const errorMsg = `${className}: Failed to request transition to AwaitingExternalTurnEndState for actor ${contextActor.id}. Error: ${transitionError.message}`;
      logger.error(errorMsg, transitionError);
      // If the transition fails, end the turn with an error.
      await turnContext.endTurn(new Error(errorMsg));
    }
  }
}
