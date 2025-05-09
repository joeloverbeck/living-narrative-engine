// src/core/turns/strategies/waitForTurnEndEventStrategy.js

// ────────────────────────────────────────────────────────────────
//  WaitForTurnEndEventStrategy  – PTH-STRAT-005
// ────────────────────────────────────────────────────────────────

/** @typedef {import('../handlers/playerTurnHandler.js').default} PlayerTurnHandler */
/** @typedef {import('../../../entities/entity.js').default}       Entity */
/** @typedef {import('../constants/turnDirectives.js').default}   TurnDirective */
/** @typedef {import('../../commandProcessor.js').CommandResult}   CommandResult */

import {ITurnDirectiveStrategy} from './ITurnDirectiveStrategy.js';
import TurnDirective from '../constants/turnDirectives.js';
import {AwaitingExternalTurnEndState} from '../states/awaitingExternalTurnEndState.js';

/**
 * Strategy for {@link TurnDirective.WAIT_FOR_EVENT}.
 *
 * It simply flips the PlayerTurnHandler into {@link AwaitingExternalTurnEndState},
 * letting that state do the heavy lifting of subscribing to `core:turn_ended`.
 */
export default class WaitForTurnEndEventStrategy extends ITurnDirectiveStrategy {
    /** @override */
    async execute(
        /** @type {PlayerTurnHandler} */ context,
        /** @type {Entity}            */ actor,
        /** @type {TurnDirective}     */ directive,
        /** @type {CommandResult}    */ cmdProcResult = undefined // eslint-disable-line no-unused-vars
    ) {
        const className = this.constructor.name;

        // ───────────────────────────────────────────────────────────
        //  Basic guardrails
        // ───────────────────────────────────────────────────────────
        if (!context || !actor) {
            throw new Error(`${className}.execute – both context and actor are required.`);
        }

        if (directive !== TurnDirective.WAIT_FOR_EVENT) {
            context.logger.error(
                `${className}: Wrong directive (${directive}) – expected WAIT_FOR_EVENT.`
            );
            throw new Error(`${className} invoked with incorrect directive.`);
        }

        const currentActor = context.getCurrentActor();
        if (!currentActor || currentActor.id !== actor.id) {
            const msg = `${className}: WAIT_FOR_EVENT for actor ${actor.id}, `
                + `but current actor is ${currentActor?.id ?? 'NONE'}.`;
            context.logger.warn(msg);

            // End the stray turn instead of silently ignoring.
            await context._handleTurnEnd(
                actor.id,
                new Error('WAIT_FOR_EVENT issued for non-current actor.')
            );
            return;
        }

        // ───────────────────────────────────────────────────────────
        //  Core behaviour
        // ───────────────────────────────────────────────────────────
        context.logger.info(
            `${className}: Actor ${actor.id} must wait for external core:turn_ended. ` +
            `Transitioning to AwaitingExternalTurnEndState.`
        );

        await context._transitionToState(new AwaitingExternalTurnEndState(context));
    }
}