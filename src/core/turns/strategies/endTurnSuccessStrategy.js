// src/core/turns/strategies/endTurnSuccessStrategy.js
// ────────────────────────────────────────────────────────────────
//  EndTurnSuccessStrategy
// ────────────────────────────────────────────────────────────────

/** @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../../../entities/entity.js').default}       Entity */
/** @typedef {import('../constants/turnDirectives.js').default} TurnDirectiveEnum */
/** @typedef {import('../../commandProcessor.js').CommandResult}   CommandResult */

import {ITurnDirectiveStrategy} from './ITurnDirectiveStrategy.js';
import TurnDirective from '../constants/turnDirectives.js';

export default class EndTurnSuccessStrategy extends ITurnDirectiveStrategy {
    /** @override */
    async execute(
        /** @type {ITurnContext} */ turnContext,
        /** @type {Entity}            */ actor, // Should match turnContext.getActor()
        /** @type {TurnDirectiveEnum}     */ directive,
        /** @type {CommandResult}    */ cmdProcResult // eslint-disable-line no-unused-vars
    ) {
        const className = this.constructor.name;
        const logger = turnContext.getLogger();

        if (directive !== TurnDirective.END_TURN_SUCCESS) {
            const errorMsg = `${className}: Received wrong directive (${directive}). Expected END_TURN_SUCCESS.`;
            logger.error(errorMsg);
            throw new Error(errorMsg);
        }

        const contextActor = turnContext.getActor();
        if (!contextActor || contextActor.id !== actor.id) {
            const msg = `${className}: Actor mismatch for END_TURN_SUCCESS. Directive for ${actor.id}, context actor ${contextActor?.id ?? 'NONE'}.`;
            logger.warn(msg + " Ending turn for context actor with error.");
            turnContext.endTurn(new Error(msg)); // End context's turn with error
            return;
        }

        logger.info(`${className}: Executing END_TURN_SUCCESS for actor ${actor.id}.`);
        turnContext.endTurn(null); // End turn via ITurnContext, null for success
    }
}