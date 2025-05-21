// src/core/turns/strategies/endTurnSuccessStrategy.js
// ────────────────────────────────────────────────────────────────
//  EndTurnSuccessStrategy
// ────────────────────────────────────────────────────────────────

/** @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../../entities/entity.js').default}       Entity */
/** @typedef {import('../constants/turnDirectives.js').default} TurnDirectiveEnum */
/** @typedef {import('../../commands/commandProcessor.js').CommandResult}   CommandResult */

import {ITurnDirectiveStrategy} from './ITurnDirectiveStrategy.js';
import TurnDirective from '../constants/turnDirectives.js';

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

        if (directive !== TurnDirective.END_TURN_SUCCESS) {
            const errorMsg = `${className}: Received wrong directive (${directive}). Expected END_TURN_SUCCESS.`;
            logger.error(errorMsg);
            // It's generally better to let the calling state handle `turnContext.endTurn`
            // with an error when a strategy itself encounters a critical issue like a wrong directive.
            // Throwing an error allows the state to decide on the appropriate action.
            throw new Error(errorMsg);
        }

        const contextActor = turnContext.getActor();

        if (!contextActor) {
            const msg = `${className}: No actor found in ITurnContext for END_TURN_SUCCESS. Cannot end turn.`;
            logger.error(msg);
            // If there's no actor in the context, ending the turn for "null" might be problematic
            // or might be handled by endTurn itself. The PRD implies turnContext.endTurn(error) is preferred.
            // The responsibility of `turnContext.endTurn` is to signal the handler.
            // If the handler finds no actor, it should reset to Idle.
            // This situation indicates a severe problem upstream or in context setup.
            turnContext.endTurn(new Error(msg));
            return;
        }

        logger.info(`${className}: Executing END_TURN_SUCCESS for actor ${contextActor.id}.`);
        turnContext.endTurn(null); // End turn via ITurnContext, null for success
    }
}