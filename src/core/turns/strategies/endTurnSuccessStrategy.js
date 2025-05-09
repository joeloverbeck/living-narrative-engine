// src/core/turns/strategies/endTurnSuccessStrategy.js

// ────────────────────────────────────────────────────────────────
//  EndTurnSuccessStrategy  – PTH-STRAT-003
// ────────────────────────────────────────────────────────────────

/** @typedef {import('../handlers/playerTurnHandler.js').default}  PlayerTurnHandler */
/** @typedef {import('../../../entities/entity.js').default}       Entity */
/** @typedef {import('../constants/turnDirectives.js').default} TurnDirective */
/** @typedef {import('../../commandProcessor.js').CommandResult}   CommandResult */

import {ITurnDirectiveStrategy} from './ITurnDirectiveStrategy.js';
import TurnDirective from '../constants/turnDirectives.js';

/**
 * Strategy for {@link TurnDirective.END_TURN_SUCCESS}.
 *
 * Its sole job is to tell the {@link PlayerTurnHandler} that the current
 * player turn finished successfully.
 */
export default class EndTurnSuccessStrategy extends ITurnDirectiveStrategy {

    /** @override */
    async execute(
        /** @type {PlayerTurnHandler} */ context,
        /** @type {Entity}            */ actor,
        /** @type {TurnDirective}     */ directive,
        /** @type {CommandResult}    */ cmdProcResult = undefined   // eslint-disable-line no-unused-vars
    ) {
        const className = this.constructor.name;

        // ------------------------------------------------------------------
        //  Basic validation
        // ------------------------------------------------------------------
        if (!context || !actor) {
            throw new Error(`${className}.execute – both context and actor are required.`);
        }

        if (directive !== TurnDirective.END_TURN_SUCCESS) {
            context.logger.error(
                `${className}: Received wrong directive (${directive}). Expected END_TURN_SUCCESS.`
            );
            throw new Error(`${className} invoked with incorrect directive.`);
        }

        // ------------------------------------------------------------------
        //  Ensure we're acting on the expected actor
        // ------------------------------------------------------------------
        const currentActor = context.getCurrentActor();
        if (!currentActor || currentActor.id !== actor.id) {
            context.logger.warn(
                `${className}: END_TURN_SUCCESS for actor ${actor.id}, ` +
                `but current actor is ${currentActor?.id ?? 'NONE'}. Continuing – _handleTurnEnd will decide.`
            );
        } else {
            context.logger.info(
                `${className}: Executing END_TURN_SUCCESS for actor ${actor.id}.`
            );
        }

        // ------------------------------------------------------------------
        //  Delegate to the handler’s normal turn-end path
        // ------------------------------------------------------------------
        await context._handleTurnEnd(actor.id, null);
    }
}