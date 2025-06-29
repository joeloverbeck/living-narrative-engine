// src/turns/strategies/endTurnSuccessStrategy.js
// ────────────────────────────────────────────────────────────────
//  EndTurnSuccessStrategy
// ────────────────────────────────────────────────────────────────

/** @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../../entities/entity.js').default}       Entity */
/** @typedef {import('../constants/turnDirectives.js').default} TurnDirectiveEnum */
/** @typedef {import('../../types/commandResult.js').CommandResult}   CommandResult */

import { ITurnDirectiveStrategy } from '../interfaces/ITurnDirectiveStrategy.js';
import TurnDirective from '../constants/turnDirectives.js';
import {
  assertDirective,
  requireContextActor,
} from '../../utils/strategyHelpers.js';

export default class EndTurnSuccessStrategy extends ITurnDirectiveStrategy {
  /** @override */
  async execute(
    /** @type {ITurnContext} */ turnContext,
    // actor parameter removed based on Ticket 2 outcome
    /** @type {TurnDirectiveEnum}     */ directive,
    /** @type {CommandResult}    */ cmdProcResult // eslint-disable-line no-unused-vars
  ) {
    const className = this.constructor.name;
    const logger = turnContext.getLogger();

    assertDirective({
      expected: TurnDirective.END_TURN_SUCCESS,
      actual: directive,
      logger,
      className,
    });

    const contextActor = requireContextActor({
      turnContext,
      logger,
      className,
      errorMsg: `${className}: No actor found in ITurnContext for END_TURN_SUCCESS. Cannot end turn.`,
    });

    if (!contextActor) {
      return;
    }

    logger.debug(
      `${className}: Executing END_TURN_SUCCESS for actor ${contextActor.id}.`
    );
    turnContext.endTurn(null); // End turn via ITurnContext, null for success
  }
}
