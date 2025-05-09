// src/core/turns/strategies/repromptStrategy.js

// ────────────────────────────────────────────────────────────────
//  RepromptStrategy  – PTH-STRAT-002
// ────────────────────────────────────────────────────────────────

/** @typedef {import('../handlers/playerTurnHandler.js').default} PlayerTurnHandler */
/** @typedef {import('../../../entities/entity.js').default}      Entity */
/** @typedef {import('../constants/turnDirectives.js').default} TurnDirective */
/** @typedef {import('../../commandProcessor.js').CommandResult}  CommandResult */

import {ITurnDirectiveStrategy} from './ITurnDirectiveStrategy.js';
import TurnDirective from '../constants/turnDirectives.js';
import {AwaitingPlayerInputState} from '../states/awaitingPlayerInputState.js';

/**
 * Handles {@link TurnDirective.RE_PROMPT} by re-entering AwaitingPlayerInputState,
 * which in turn re-prompts the current player for input.
 */
export default class RepromptStrategy extends ITurnDirectiveStrategy {

    /** @override */
    async execute(
        /** @type {PlayerTurnHandler}  */ context,
        /** @type {Entity}            */ actor,
        /** @type {TurnDirective}     */ directive,
        /** @type {CommandResult}    */ cmdProcResult = undefined
    ) {
        const className = this.constructor.name;

        // Basic sanity checks ------------------------------------------------
        if (!context || !actor) {
            throw new Error(`${className}.execute – context and actor are required.`);
        }

        if (directive !== TurnDirective.RE_PROMPT) {
            context.logger.error(
                `${className}: Received non-RE_PROMPT directive (${directive}). Aborting.`
            );
            throw new Error(`${className} invoked with wrong directive.`);
        }

        const currentActor = context.getCurrentActor();
        if (!currentActor || currentActor.id !== actor.id) {
            const msg = `${className}: Attempted re-prompt for actor ${actor.id}, `
                + `but current turn actor is ${currentActor?.id ?? 'NONE'}.`;
            context.logger.warn(msg);

            // End the stray turn attempt – it’s safer than ignoring.
            await context._handleTurnEnd(
                actor.id,
                new Error('RE_PROMPT issued for non-current actor.')
            );
            return;
        }

        context.logger.info(
            `${className}: Re-prompting actor ${actor.id}; transitioning to AwaitingPlayerInputState.`
        );

        // AwaitingPlayerInputState.enterState() will perform the actual prompt.
        await context._transitionToState(new AwaitingPlayerInputState(context));
    }
}