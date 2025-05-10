// src/core/turns/states/awaitingPlayerInputState.js
// --- FILE START ---

/**
 * @typedef {import('../handlers/baseTurnHandler.js').BaseTurnHandler} BaseTurnHandler
 * @typedef {import('../../../entities/entity.js').default} Entity
 * @typedef {import('./ITurnState.js').ITurnState} ITurnState_Interface
 * @typedef {import('./abstractTurnState.js').AbstractTurnState} AbstractTurnState_Base
 * @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext
 */

import {AbstractTurnState} from './abstractTurnState.js';
import {ProcessingCommandState} from './processingCommandState.js';
import {TurnIdleState} from './turnIdleState.js'; // For error recovery

/**
 * @class AwaitingPlayerInputState
 * @extends AbstractTurnState_Base
 * @implements {ITurnState_Interface}
 * @description
 * Active when the system is waiting for a human player to submit a command.
 * It subscribes to command input and prompts the player.
 * All interactions with actor, services, logger, etc., are through ITurnContext.
 */
export class AwaitingPlayerInputState extends AbstractTurnState {
    /** @private @type {function | null} */
    #unsubscribeFromCommandInputFn = null;

    /**
     * @param {BaseTurnHandler} handler - The BaseTurnHandler instance.
     */
    constructor(handler) {
        super(handler);
    }

    /** @override */
    getStateName() {
        return "AwaitingPlayerInputState";
    }

    /**
     * @override
     * @param {BaseTurnHandler} handler
     * @param {ITurnState_Interface} [previousState]
     */
    async enterState(handler, previousState) {
        // Get TurnContext first as it's needed for logging and all operations.
        const turnCtx = this._getTurnContext(); // Uses this._handler

        if (!turnCtx) {
            // Fallback logger if context (and its logger) is missing.
            const fallbackLogger = handler.getLogger();
            fallbackLogger.error(`${this.getStateName()}: Critical - ITurnContext not available on entry. Transitioning to Idle.`);
            handler._resetTurnStateAndResources(`critical-entry-no-context-${this.getStateName()}`);
            await handler._transitionToState(new TurnIdleState(handler));
            return;
        }

        const logger = turnCtx.getLogger(); // Now use logger from context

        // Call super.enterState AFTER context and logger are confirmed.
        // super.enterState internally calls this._getTurnContext() again, which is fine.
        await super.enterState(handler, previousState); // Handles initial logging

        const actor = turnCtx.getActor();
        if (!actor) {
            logger.error(`${this.getStateName()}: Critical - Actor not found in ITurnContext on entry. Ending turn.`);
            // No need to transition to Idle, endTurn will trigger TurnEndingState, then Idle.
            turnCtx.endTurn(new Error(`${this.getStateName()}: Actor not found in ITurnContext on entry.`));
            return;
        }
        const actorId = actor.id;

        try {
            const subMan = turnCtx.getSubscriptionManager(); // Get from ITurnContext
            // Ensure the callback correctly uses the 'actor' instance captured at enterState time.
            this.#unsubscribeFromCommandInputFn = subMan.subscribeToCommandInput(
                (cmdString) => this.handleSubmittedCommand(handler, cmdString, actor) // Pass handler & captured actor
            );
            logger.debug(`${this.getStateName()}: Subscribed to command input for actor ${actorId}.`);

            const prompter = turnCtx.getPlayerPromptService(); // Get from ITurnContext
            await prompter.prompt(actor, "Your command?"); // Prompt the actor from context
            logger.debug(`${this.getStateName()}: Player ${actorId} prompted for input.`);

        } catch (error) {
            const errorMessage = `${this.getStateName()}: Failed to subscribe or prompt player ${actorId}.`;
            logger.error(errorMessage, error);
            // End turn via ITurnContext if setup fails
            turnCtx.endTurn(new Error(`${errorMessage} Details: ${error.message}`));
        }
    }

    /**
     * @override
     * @param {BaseTurnHandler} handler
     * @param {ITurnState_Interface} [nextState]
     */
    async exitState(handler, nextState) {
        const turnCtx = this._getTurnContext(); // For logging
        const logger = turnCtx ? turnCtx.getLogger() : handler.getLogger(); // Fallback logger

        if (this.#unsubscribeFromCommandInputFn) {
            logger.debug(`${this.getStateName()}: Unsubscribing from command input.`);
            try {
                // Use SubscriptionLifecycleManager from ITurnContext if unsubscription needs it,
                // but typically the function itself is sufficient.
                this.#unsubscribeFromCommandInputFn();
            } catch (unsubError) {
                logger.error(`${this.getStateName()}: Error during command input unsubscription: ${unsubError.message}`, unsubError);
            }
            this.#unsubscribeFromCommandInputFn = null;
        } else {
            // Only warn if not going to a terminal-like state or if context is still expected.
            const nextStateName = nextState?.getStateName();
            const isTerminalTransition = nextStateName === 'TurnIdleState' || nextStateName === 'TurnEndingState';
            if (!isTerminalTransition && turnCtx && turnCtx.getActor()) {
                logger.warn(`${this.getStateName()}: No unsubscribe function stored or already cleared upon exit to ${nextStateName}.`);
            }
        }
        await super.exitState(handler, nextState); // Handles logging
    }

    /**
     * @override
     * @param {BaseTurnHandler} handler - The BaseTurnHandler instance.
     * @param {string} commandString - The command string submitted.
     * @param {Entity} actorEntityFromSubscription - The entity instance from the subscription callback.
     */
    async handleSubmittedCommand(handler, commandString, actorEntityFromSubscription) {
        const turnCtx = this._getTurnContext();

        if (!turnCtx) {
            const fallbackLogger = handler.getLogger();
            fallbackLogger.error(`${this.getStateName()}: handleSubmittedCommand called but no ITurnContext. Command: "${commandString}". Attempting to Idle.`);
            handler._resetTurnStateAndResources(`critical-command-no-context-${this.getStateName()}`);
            await handler._transitionToState(new TurnIdleState(handler));
            return;
        }

        const logger = turnCtx.getLogger();
        const contextActor = turnCtx.getActor();

        if (!contextActor) {
            logger.error(`${this.getStateName()}: Command received ("${commandString}") but no actor in current ITurnContext. Ending turn.`);
            turnCtx.endTurn(new Error(`${this.getStateName()}: No actor in ITurnContext during command submission.`));
            return;
        }

        if (contextActor.id !== actorEntityFromSubscription.id) {
            logger.error(`${this.getStateName()}: Command received for actor ${actorEntityFromSubscription.id}, but current context actor is ${contextActor.id}. This indicates a potential subscription mismatch or stale closure. Ending turn.`);
            turnCtx.endTurn(new Error(`Command actor mismatch: expected ${contextActor.id}, got ${actorEntityFromSubscription.id} from subscription.`));
            return;
        }
        const actorId = contextActor.id; // Use actor from context as the source of truth

        logger.info(`${this.getStateName()}: Received command "${commandString}" for actor ${actorId}.`);

        if (!commandString || commandString.trim() === "") {
            logger.debug(`${this.getStateName()}: Empty command received for ${actorId}. Re-prompting.`);
            try {
                const prompter = turnCtx.getPlayerPromptService(); // From ITurnContext
                await prompter.prompt(contextActor, "Your command? (Previous was empty)"); // Re-prompt current actor
            } catch (promptError) {
                const errorMsg = `${this.getStateName()}: Failed to re-prompt ${actorId} after empty command.`;
                logger.error(errorMsg, promptError);
                turnCtx.endTurn(new Error(`${errorMsg} Details: ${promptError.message}`));
            }
        } else {
            logger.debug(`${this.getStateName()}: Valid command "${commandString}" for ${actorId}. Transitioning to ProcessingCommandState.`);
            try {
                // ProcessingCommandState constructor takes handler and commandString.
                // ITurnContext is not passed directly to state constructors in this model;
                // states retrieve it from the handler.
                // Option 1 (Original): this._handler._transitionToState(...)
                // Option 2 (Preferred per ticket for ITurnContext use): turnCtx.requestTransition(...)
                await turnCtx.requestTransition(ProcessingCommandState, [commandString]);
                // The above is equivalent to:
                // await handler._transitionToState(new ProcessingCommandState(handler, commandString));
            } catch (transitionError) {
                const errorMsg = `${this.getStateName()}: Failed to transition to ProcessingCommandState for ${actorId}. Cmd: "${commandString}".`;
                logger.error(errorMsg, transitionError);
                turnCtx.endTurn(new Error(`${errorMsg} Details: ${transitionError.message}`));
            }
        }
    }

    /** @override */
    async handleTurnEndedEvent(handler, payload) {
        const turnCtx = this._getTurnContext();
        const logger = turnCtx ? turnCtx.getLogger() : handler.getLogger(); // Use context logger or fallback

        if (!turnCtx) {
            logger.warn(`${this.getStateName()}: handleTurnEndedEvent received but no ITurnContext active. Payload for: ${payload?.entityId}. This state (${this.getStateName()}) shouldn't typically process this unless its actor's turn ended externally.`);
            // Call super's default warning/behavior
            await super.handleTurnEndedEvent(handler, payload);
            return;
        }

        const currentActor = turnCtx.getActor();
        if (currentActor && payload && payload.entityId === currentActor.id) {
            logger.info(`${this.getStateName()}: core:turn_ended event received for current actor ${currentActor.id}. Ending turn via ITurnContext.`);
            const errorForTurnEnd = payload.error ? (payload.error instanceof Error ? payload.error : new Error(String(payload.error))) : null;
            turnCtx.endTurn(errorForTurnEnd); // End turn via ITurnContext
        } else {
            // Event is not for the current actor, or payload is malformed.
            // Log details and let super handle the default warning.
            logger.debug(`${this.getStateName()}: core:turn_ended event for entity ${payload?.entityId} (payload error: ${payload?.error}) ignored or not for current actor ${currentActor?.id}.`);
            await super.handleTurnEndedEvent(handler, payload);
        }
    }

    /** @override */
    async destroy(handler) {
        const turnCtx = this._getTurnContext(); // Get context before it's potentially cleared by super.destroy
        const logger = turnCtx ? turnCtx.getLogger() : handler.getLogger();
        const actorId = turnCtx?.getActor()?.id ?? 'N/A_at_destroy';

        logger.info(`${this.getStateName()}: Handler destroyed while awaiting input for ${actorId}.`);

        // Manually trigger cleanup normally done by exitState if still subscribed
        // This is important as super.destroy() might not call exitState in the same way.
        if (this.#unsubscribeFromCommandInputFn) {
            logger.debug(`${this.getStateName()} (destroy): Manually unsubscribing from command input for ${actorId}.`);
            try {
                this.#unsubscribeFromCommandInputFn();
            } catch (unsubError) {
                logger.error(`${this.getStateName()} (destroy): Error during manual unsubscription for ${actorId}: ${unsubError.message}`, unsubError);
            }
            this.#unsubscribeFromCommandInputFn = null;
        }

        if (turnCtx) { // If a turn was active (context exists)
            const destroyError = new Error(`Turn handler destroyed while actor ${actorId} was in ${this.getStateName()}.`);
            logger.debug(`${this.getStateName()}: Notifying turn end for ${actorId} due to destruction via ITurnContext.`);
            turnCtx.endTurn(destroyError); // This will set up transition to TurnEndingState etc.
        } else {
            logger.warn(`${this.getStateName()}: Handler destroyed, but no active ITurnContext for actor ${actorId}. No specific turn to end via context.`);
        }
        // BaseTurnHandler.destroy() handles further cleanup like calling _resetTurnStateAndResources
        // and ensuring transition to Idle. The call to turnCtx.endTurn() above should
        // normally lead to TurnEndingState, then Idle. If context was null, super.destroy() will force Idle.
        await super.destroy(handler); // Logs from AbstractTurnState, ensures Idle state.
        logger.debug(`${this.getStateName()}: Destroy handling for ${actorId} complete.`);
    }

    // These methods are not applicable for AwaitingPlayerInputState
    // and will rely on AbstractTurnState's default behavior (log error and throw).
    // async startTurn(handler, actorEntity) { return super.startTurn(handler, actorEntity); }
    // async processCommandResult(handler, actor, cmdProcResult, commandString) { return super.processCommandResult(handler, actor, cmdProcResult, commandString); }
    // async handleDirective(handler, actor, directive, cmdProcResult) { return super.handleDirective(handler, actor, directive, cmdProcResult); }
}

// --- FILE END ---