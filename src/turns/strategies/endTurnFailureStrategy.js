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
import {
  assertDirective,
  requireContextActor,
  getLoggerAndClass,
  resolveTurnEndError,
} from './strategyHelpers.js';

export default class EndTurnFailureStrategy extends ITurnDirectiveStrategy {
  /** @override */
  async execute(
    /** @type {ITurnContext} */ turnContext,
    // actor parameter removed as per outcome of Ticket 2
    /** @type {TurnDirectiveEnum}     */ directive,
    /** @type {CommandResult}    */ cmdProcResult
  ) {
    const { logger, className } = getLoggerAndClass(this, turnContext);

    assertDirective({
      expected: TurnDirective.END_TURN_FAILURE,
      actual: directive,
      logger,
      className,
    });

    const missingActorMsg = `${className}: No actor found in ITurnContext for END_TURN_FAILURE. Critical issue.`;
    const contextActor = requireContextActor({
      turnContext,
      logger,
      className,
      errorMsg: missingActorMsg,
    });

    if (!contextActor) {
      logger.error(
        missingActorMsg +
          ' Ending turn with a generic error indicating missing actor.'
      );
      return;
    }

    // The original check `if (!contextActor || contextActor.id !== actor.id)` is simplified
    // as the explicit `actor` parameter is removed. The primary concern is now whether `contextActor` exists.

    const turnEndError = resolveTurnEndError(
      cmdProcResult,
      contextActor.id,
      directive
    );

    logger.info(
      `${className}: Executing END_TURN_FAILURE for actor ${contextActor.id}. Error: ${turnEndError.message}`
    );
    turnContext.endTurn(turnEndError); // End turn via ITurnContext with the determined error
  }
}
