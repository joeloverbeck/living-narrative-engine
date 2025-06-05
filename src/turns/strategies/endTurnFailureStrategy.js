// src/turns/strategies/endTurnFailureStrategy.js
// ────────────────────────────────────────────────────────────────
//  EndTurnFailureStrategy
// ────────────────────────────────────────────────────────────────

/** @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../../entities/entity.js').default}       Entity */
/** @typedef {import('../constants/turnDirectives.js').default}   TurnDirectiveEnum */
/** @typedef {import('../../commands/commandProcessor.js').CommandResult}   CommandResult */

import { ITurnDirectiveStrategy } from '../interfaces/ITurnDirectiveStrategy.js';
import TurnDirective from '../constants/turnDirectives.js';

export default class EndTurnFailureStrategy extends ITurnDirectiveStrategy {
  /** @override */
  async execute(
    /** @type {ITurnContext} */ turnContext,
    // actor parameter removed as per outcome of Ticket 2
    /** @type {TurnDirectiveEnum}     */ directive,
    /** @type {CommandResult}    */ cmdProcResult
  ) {
    const className = this.constructor.name;
    const logger = turnContext.getLogger();

    if (directive !== TurnDirective.END_TURN_FAILURE) {
      const errorMsg = `${className}: Wrong directive (${directive}). Expected END_TURN_FAILURE.`;
      logger.error(errorMsg);
      // As per PRD and other strategies, throwing an error here allows the calling state to handle it,
      // potentially by ending the turn with this error.
      throw new Error(errorMsg);
    }

    const contextActor = turnContext.getActor();

    if (!contextActor) {
      const msg = `${className}: No actor found in ITurnContext for END_TURN_FAILURE. Critical issue.`;
      logger.error(
        msg + ' Ending turn with a generic error indicating missing actor.'
      );
      // End the turn with an error reflecting the missing actor in the context.
      turnContext.endTurn(new Error(msg));
      return;
    }

    // The original check `if (!contextActor || contextActor.id !== actor.id)` is simplified
    // as the explicit `actor` parameter is removed. The primary concern is now whether `contextActor` exists.

    let turnEndError;
    if (cmdProcResult?.error instanceof Error) {
      turnEndError = cmdProcResult.error;
    } else if (
      cmdProcResult?.error !== undefined &&
      cmdProcResult?.error !== null
    ) {
      // If cmdProcResult.error is present but not an Error instance, wrap it in an Error.
      turnEndError = new Error(String(cmdProcResult.error));
    } else {
      // Default error message if cmdProcResult.error is missing or not an Error instance.
      turnEndError = new Error(
        `Turn for actor ${contextActor.id} ended by directive '${directive}' (failure).`
      );
    }

    logger.info(
      `${className}: Executing END_TURN_FAILURE for actor ${contextActor.id}. Error: ${turnEndError.message}`
    );
    turnContext.endTurn(turnEndError); // End turn via ITurnContext with the determined error
  }
}
