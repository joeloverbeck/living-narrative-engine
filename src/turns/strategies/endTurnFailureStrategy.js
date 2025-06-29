// src/turns/strategies/endTurnFailureStrategy.js
// ────────────────────────────────────────────────────────────────
//  EndTurnFailureStrategy
// ────────────────────────────────────────────────────────────────

/** @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../../entities/entity.js').default}       Entity */
/** @typedef {import('../constants/turnDirectives.js').default}   TurnDirectiveEnum */
/** @typedef {import('../../types/commandResult.js').CommandResult}   CommandResult */

import { ITurnDirectiveStrategy } from '../interfaces/ITurnDirectiveStrategy.js';
import TurnDirective from '../constants/turnDirectives.js';
import { assertDirective, requireContextActor } from './strategyHelpers.js';

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

    assertDirective({
      expected: TurnDirective.END_TURN_FAILURE,
      actual: directive,
      logger,
      className,
    });

    const contextActor = requireContextActor({
      turnContext,
      logger,
      className,
      errorMsg:
        'No actor found in ITurnContext for END_TURN_FAILURE. Critical issue.',
    });
    if (!contextActor) return;

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
