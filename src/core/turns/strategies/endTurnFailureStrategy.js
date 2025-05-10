// src/core/turns/strategies/endTurnFailureStrategy.js
// ────────────────────────────────────────────────────────────────
//  EndTurnFailureStrategy
// ────────────────────────────────────────────────────────────────

/** @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../../../entities/entity.js').default}       Entity */
/** @typedef {import('../constants/turnDirectives.js').default}   TurnDirectiveEnum */
/** @typedef {import('../../commandProcessor.js').CommandResult}   CommandResult */

import {ITurnDirectiveStrategy} from './ITurnDirectiveStrategy.js';
import TurnDirective from '../constants/turnDirectives.js';

export default class EndTurnFailureStrategy extends ITurnDirectiveStrategy {
    /** @override */
    async execute(
        /** @type {ITurnContext} */ turnContext,
        /** @type {Entity}            */ actor, // Should match turnContext.getActor()
        /** @type {TurnDirectiveEnum}     */ directive,
        /** @type {CommandResult}    */ cmdProcResult
    ) {
        const className = this.constructor.name;
        const logger = turnContext.getLogger();

        if (directive !== TurnDirective.END_TURN_FAILURE) {
            const errorMsg = `${className}: Wrong directive (${directive}). Expected END_TURN_FAILURE.`;
            logger.error(errorMsg);
            throw new Error(errorMsg);
        }

        const contextActor = turnContext.getActor();
        if (!contextActor || contextActor.id !== actor.id) {
            const msg = `${className}: Actor mismatch for END_TURN_FAILURE. Directive for ${actor.id}, context actor ${contextActor?.id ?? 'NONE'}.`;
            logger.error(msg + " Ending turn for context actor with a generic error.");
            // End the current context's turn, but the error might not be from cmdProcResult if actors mismatch.
            turnContext.endTurn(new Error(msg));
            return;
        }

        let turnEndError;
        if (cmdProcResult?.error instanceof Error) {
            turnEndError = cmdProcResult.error;
        } else if (cmdProcResult?.error !== undefined && cmdProcResult?.error !== null) {
            turnEndError = new Error(String(cmdProcResult.error));
        } else {
            turnEndError = new Error(
                `Turn for actor ${actor.id} ended by directive '${directive}' (failure).`
            );
        }

        logger.info(`${className}: Executing END_TURN_FAILURE for actor ${actor.id}. Error: ${turnEndError.message}`);
        turnContext.endTurn(turnEndError); // End turn via ITurnContext with the error
    }
}