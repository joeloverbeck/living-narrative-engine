// src/core/turns/strategies/endTurnFailureStrategy.js

// ────────────────────────────────────────────────────────────────
//  EndTurnFailureStrategy  – PTH-STRAT-004
// ────────────────────────────────────────────────────────────────

/** @typedef {import('../handlers/playerTurnHandler.js').default} PlayerTurnHandler */
/** @typedef {import('../../../entities/entity.js').default}       Entity */
/** @typedef {import('../constants/turnDirectives.js').default}   TurnDirective */
/** @typedef {import('../../commandProcessor.js').CommandResult}   CommandResult */

import {ITurnDirectiveStrategy} from './ITurnDirectiveStrategy.js';
import TurnDirective from '../constants/turnDirectives.js';

/**
 * Handles {@link TurnDirective.END_TURN_FAILURE}.
 *
 * Its sole responsibility is to tell the {@link PlayerTurnHandler} that the
 * player’s turn has finished **because of an error**.  The strategy builds the
 * correct `Error` instance and delegates to `context._handleTurnEnd(...)`.
 */
export default class EndTurnFailureStrategy extends ITurnDirectiveStrategy {

    /* eslint-disable class-methods-use-this, no-unused-vars */
    /** @override */
    async execute(
        /** @type {PlayerTurnHandler} */ context,
        /** @type {Entity}            */ actor,
        /** @type {TurnDirective}     */ directive,
        /** @type {CommandResult}    */ cmdProcResult = undefined
    ) {
        const className = this.constructor.name;

        // ─── Guard-rails ───────────────────────────────────────────────
        if (!context || !actor) {
            throw new Error(`${className}.execute – both context and actor are required.`);
        }

        if (directive !== TurnDirective.END_TURN_FAILURE) {
            context.logger.error(
                `${className}: Wrong directive (${directive}). Expected END_TURN_FAILURE.`
            );
            throw new Error(`${className} invoked with incorrect directive.`);
        }

        const currentActor = context.getCurrentActor();
        if (!currentActor || currentActor.id !== actor.id) {
            const msg = `${className}: END_TURN_FAILURE for actor ${actor.id}, ` +
                `but current turn actor is ${currentActor?.id ?? 'NONE'}.`;
            context.logger.error(msg);
            throw new Error(msg);           // hard “assert” per acceptance criteria
        }

        // ─── Build / normalise the Error object ───────────────────────
        let turnEndError;

        if (cmdProcResult?.error instanceof Error) {
            turnEndError = cmdProcResult.error;
        } else if (cmdProcResult?.error !== undefined && cmdProcResult?.error !== null) {
            turnEndError = new Error(String(cmdProcResult.error));
        } else {
            turnEndError = new Error(
                `Turn ended by directive '${directive}' for actor ${actor.id}.`
            );
        }

        // ─── Delegate to the handler’s standard turn-end path ─────────
        context.logger.info(
            `${className}: Executing END_TURN_FAILURE for actor ${actor.id}.`
        );

        await context._handleTurnEnd(actor.id, turnEndError);
    }

    /* eslint-enable class-methods-use-this, no-unused-vars */
}