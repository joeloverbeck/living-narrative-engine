// src/core/turns/strategies/repromptStrategy.js
// ────────────────────────────────────────────────────────────────
//  RepromptStrategy
// ────────────────────────────────────────────────────────────────

/** @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../../../entities/entity.js').default}      Entity */
/** @typedef {import('../constants/turnDirectives.js').default} TurnDirectiveEnum */
/** @typedef {import('../../commandProcessor.js').CommandResult}  CommandResult */

import {ITurnDirectiveStrategy} from './ITurnDirectiveStrategy.js';
import TurnDirective from '../constants/turnDirectives.js';
import {AwaitingPlayerInputState} from '../states/awaitingPlayerInputState.js'; // For transition

/**
 * Handles TurnDirective.RE_PROMPT by requesting a transition to AwaitingPlayerInputState.
 */
export default class RepromptStrategy extends ITurnDirectiveStrategy {

    /** @override */
    async execute(
        /** @type {ITurnContext}  */ turnContext,
        /** @type {Entity}            */ actor, // Should match turnContext.getActor()
        /** @type {TurnDirectiveEnum}     */ directive,
        /** @type {CommandResult}    */ cmdProcResult // eslint-disable-line no-unused-vars
    ) {
        const className = this.constructor.name;
        const logger = turnContext.getLogger();

        if (directive !== TurnDirective.RE_PROMPT) {
            const errorMsg = `${className}: Received non-RE_PROMPT directive (${directive}). Aborting.`;
            logger.error(errorMsg);
            throw new Error(errorMsg);
        }

        const contextActor = turnContext.getActor();
        if (!contextActor || contextActor.id !== actor.id) {
            const msg = `${className}: Actor mismatch. Directive for ${actor.id}, context actor is ${contextActor?.id ?? 'NONE'}.`;
            logger.error(msg);
            // End the turn for the context actor with an error.
            turnContext.endTurn(new Error(msg));
            return;
        }

        logger.info(
            `${className}: Re-prompting actor ${actor.id}; requesting transition to AwaitingPlayerInputState.`
        );

        // Request transition via ITurnContext
        await turnContext.requestTransition(AwaitingPlayerInputState);
    }
}