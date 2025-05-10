// src/core/turns/strategies/waitForTurnEndEventStrategy.js
// ────────────────────────────────────────────────────────────────
//  WaitForTurnEndEventStrategy
// ────────────────────────────────────────────────────────────────

/** @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../../../entities/entity.js').default}       Entity */
/** @typedef {import('../constants/turnDirectives.js').default}   TurnDirectiveEnum */
/** @typedef {import('../../commandProcessor.js').CommandResult}   CommandResult */

import {ITurnDirectiveStrategy} from './ITurnDirectiveStrategy.js';
import TurnDirective from '../constants/turnDirectives.js';
import {AwaitingExternalTurnEndState} from '../states/awaitingExternalTurnEndState.js';
import {TURN_ENDED_ID} from "../../constants/eventIds.js"; // For transition

export default class WaitForTurnEndEventStrategy extends ITurnDirectiveStrategy {
    /** @override */
    async execute(
        /** @type {ITurnContext} */ turnContext,
        /** @type {Entity}            */ actor, // Should match turnContext.getActor()
        /** @type {TurnDirectiveEnum}     */ directive,
        /** @type {CommandResult}    */ cmdProcResult // eslint-disable-line no-unused-vars
    ) {
        const className = this.constructor.name;
        const logger = turnContext.getLogger();

        if (directive !== TurnDirective.WAIT_FOR_EVENT) {
            const errorMsg = `${className}: Wrong directive (${directive}) – expected WAIT_FOR_EVENT.`;
            logger.error(errorMsg);
            throw new Error(errorMsg);
        }

        const contextActor = turnContext.getActor();
        if (!contextActor || contextActor.id !== actor.id) {
            const msg = `${className}: Actor mismatch for WAIT_FOR_EVENT. Directive for ${actor.id}, context actor ${contextActor?.id ?? 'NONE'}.`;
            logger.warn(msg + " Ending turn for context actor with error.");
            turnContext.endTurn(new Error(msg));
            return;
        }

        // The PlayerTurnHandler specific _markAwaitingTurnEnd(true, actorId) needs to be called.
        // This is not directly on ITurnContext.
        // This implies that either:
        // 1. The PlayerTurnHandler (or specific handler) sets this flag BEFORE ProcessingCommandState calls the strategy.
        //    This means the CommandOutcomeInterpreter or ProcessingCommandState would need to signal the handler.
        // 2. ITurnContext gets a method like `markAsAwaitingExternalEvent()`.
        // 3. The AwaitingExternalTurnEndState itself, upon entry, calls a method on the handler if available.

        // Given that `PlayerTurnHandler._markAwaitingTurnEnd` is specific, and `isAwaitingExternalEventProvider`
        // (passed to `TurnContext`) reads this flag, the handler that *owns* the flag should set it.
        // This strategy's job is to *transition* to the state that *waits*. The flag should be set by the handler
        // that knows it's entering this mode.
        // For now, this strategy will just transition. The `AwaitingExternalTurnEndState` already
        // relies on `turnCtx.isAwaitingExternalEvent()` which points to the handler's flag.
        // The responsibility of *setting* that flag needs to be carefully placed.
        // Let's assume for now that the handler, when it creates the context, or when a directive is about to be processed,
        // might set such a flag if the directive implies waiting.
        // OR, more simply, the `PlayerTurnHandler`'s implementation of `isAwaitingExternalEventProvider`
        // could return true if the *current state* IS `AwaitingExternalTurnEndState`.

        // For the ticket's scope, simply transitioning is the strategy's main job.
        // The PlayerTurnHandler's internal flag `_isAwaitingTurnEndEvent` is used by its
        // `_getIsAwaitingExternalTurnEndFlag` which is the `isAwaitingExternalEventProvider` for its `TurnContext`.
        // So, when AwaitingExternalTurnEndState calls `turnCtx.isAwaitingExternalEvent()`, it queries that flag.
        // The flag should be set by `PlayerTurnHandler` *before* or *as part of* deciding to use this strategy/state.
        // The original `PlayerTurnHandler._markAwaitingTurnEnd` was `_protected_`.
        // This strategy cannot call it if it only has `ITurnContext`.
        // The `AwaitingExternalTurnEndState` used to call it. Now it cannot.
        // This means the flag setting responsibility shifts.

        // Simplest: `PlayerTurnHandler` provides `isAwaitingExternalEventProvider`.
        // This provider can check `this.#isAwaitingTurnEndEvent`.
        // The flag `this.#isAwaitingTurnEndEvent` on `PlayerTurnHandler` needs to be set to `true`
        // when this strategy is about to be executed or when `AwaitingExternalTurnEndState` is entered.
        // Let `AwaitingExternalTurnEndState` be responsible for asking the handler to mark it, IF the handler supports it.

        // For this strategy, the primary job is transition.
        logger.info(
            `${className}: Actor ${actor.id} to wait for external ${TURN_ENDED_ID}. Requesting transition to AwaitingExternalTurnEndState.`
        );
        await turnContext.requestTransition(AwaitingExternalTurnEndState);
    }
}