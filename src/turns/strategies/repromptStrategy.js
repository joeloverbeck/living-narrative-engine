// src/core/turns/strategies/repromptStrategy.js
// ────────────────────────────────────────────────────────────────
//  RepromptStrategy
// ────────────────────────────────────────────────────────────────

/** @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../../entities/entity.js').default}      Entity */
/** @typedef {import('../constants/turnDirectives.js').default} TurnDirectiveEnum */
/** @typedef {import('../../commands/commandProcessor.js').CommandResult}  CommandResult */

import {ITurnDirectiveStrategy} from './ITurnDirectiveStrategy.js';
import TurnDirective from '../constants/turnDirectives.js';
import {AwaitingPlayerInputState} from '../states/awaitingPlayerInputState.js';

/**
 * Handles TurnDirective.RE_PROMPT by requesting a transition to AwaitingPlayerInputState.
 * Relies solely on ITurnContext to obtain the actor and other necessary services.
 */
export default class RepromptStrategy extends ITurnDirectiveStrategy {

    /**
     * Executes the re-prompt strategy.
     * The actor is obtained from `turnContext.getActor()`.
     * @override
     * @async
     * @param {ITurnContext} turnContext - The context for the current turn.
     * @param {TurnDirectiveEnum} directive - The directive that triggered this strategy.
     * @param {CommandResult} [cmdProcResult] - Optional result from command processing.
     * @returns {Promise<void>} Resolves when the strategy execution is complete.
     * @throws {Error} If the directive is not RE_PROMPT or if a critical error occurs.
     */
    async execute(
        /** @type {ITurnContext}  */ turnContext,
        /** @type {TurnDirectiveEnum}     */ directive,
        /** @type {CommandResult}    */ cmdProcResult // eslint-disable-line no-unused-vars
    ) {
        const className = this.constructor.name;
        const logger = turnContext.getLogger();

        if (directive !== TurnDirective.RE_PROMPT) {
            const errorMsg = `${className}: Received non-RE_PROMPT directive (${directive}). Aborting.`;
            logger.error(errorMsg);
            // Throwing an error allows the calling state (e.g., ProcessingCommandState)
            // to handle this appropriately, potentially by ending the turn with this error.
            throw new Error(errorMsg);
        }

        const contextActor = turnContext.getActor();

        if (!contextActor) {
            const errorMsg = `${className}: No actor found in ITurnContext. Cannot re-prompt.`;
            logger.error(errorMsg);
            // End the turn with an error because re-prompting requires an actor.
            // The turnContext.endTurn() method will signal the handler to transition
            // to an appropriate end state (e.g., TurnEndingState, then TurnIdleState).
            turnContext.endTurn(new Error(errorMsg));
            return;
        }

        // The previous check `if (!contextActor || contextActor.id !== actor.id)`
        // is no longer needed as the explicit `actor` parameter has been removed.
        // The primary concern now is the existence of `contextActor`.

        logger.info(
            `${className}: Re-prompting actor ${contextActor.id}; requesting transition to AwaitingPlayerInputState.`
        );

        // Request transition to AwaitingPlayerInputState via ITurnContext
        // The AwaitingPlayerInputState constructor expects the handler instance,
        // which turnContext.requestTransition() will manage internally.
        try {
            await turnContext.requestTransition(AwaitingPlayerInputState);
            logger.debug(`${className}: Transition to AwaitingPlayerInputState requested successfully for actor ${contextActor.id}.`);
        } catch (transitionError) {
            const errorMsg = `${className}: Failed to request transition to AwaitingPlayerInputState for actor ${contextActor.id}. Error: ${transitionError.message}`;
            logger.error(errorMsg, transitionError);
            // If the transition fails, end the turn with an error.
            turnContext.endTurn(new Error(errorMsg));
        }
    }
}