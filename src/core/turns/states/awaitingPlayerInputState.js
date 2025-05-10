// src/core/turns/states/awaitingPlayerInputState.js
// --- FILE START ---

/**
 * @typedef {import('../handlers/baseTurnHandler.js').default} BaseTurnHandler
 * @typedef {import('../../../entities/entity.js').default} Entity
 * @typedef {import('./ITurnState.js').ITurnState} ITurnState_Interface
 * @typedef {import('./abstractTurnState.js').AbstractTurnState} AbstractTurnState_Base
 * @typedef {import('./processingCommandState.js').ProcessingCommandState} ProcessingCommandState_Class
 * @typedef {import('./turnEndingState.js').TurnEndingState} TurnEndingState_Class
 * @typedef {import('./turnIdleState.js').TurnIdleState} TurnIdleState_Class
 * @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext
 */

import {AbstractTurnState} from './abstractTurnState.js';
import {ProcessingCommandState} from './processingCommandState.js';
import {TurnEndingState} from './turnEndingState.js';
import {TurnIdleState} from './turnIdleState.js';

/**
 * @class AwaitingPlayerInputState
 * @extends AbstractTurnState_Base
 * @implements {ITurnState_Interface}
 * @description
 * This state is active after `startTurn()` has successfully initialized the turn for an actor
 * and the system is waiting for the player to submit a command. The player has been prompted for action.
 * Its primary responsibilities are to subscribe to player command input, prompt the player,
 * and wait for a command to be submitted.
 * Note: The JSDoc `@param {PlayerTurnHandler}` in methods should be interpreted as `@param {BaseTurnHandler}`
 * as this state operates with the handler context provided by AbstractTurnState.
 */
export class AwaitingPlayerInputState extends AbstractTurnState {
    /**
     * Stores the function to unsubscribe from command input.
     * @private
     * @type {function | null}
     */
    #unsubscribeFromCommandInputFn = null;

    /**
     * Creates an instance of AwaitingPlayerInputState.
     * @param {BaseTurnHandler} handlerContext - The BaseTurnHandler instance that manages this state.
     */
    constructor(handlerContext) {
        super(handlerContext);
    }

    /**
     * Returns the unique identifier for this state.
     * @override
     * @returns {string} The state name "AwaitingPlayerInputState".
     */
    getStateName() {
        return "AwaitingPlayerInputState";
    }

    /**
     * Called when the {@link BaseTurnHandler} transitions into this state.
     * - Calls super.enterState for consistent logging.
     * - Ensures there's a current actor via TurnContext; if not, transitions to Idle.
     * - Subscribes to command input via SubscriptionManager from TurnContext; if fails, ends turn with error.
     * @override
     * @async
     * @param {BaseTurnHandler} handlerContext - The {@link BaseTurnHandler} instance.
     * @param {ITurnState_Interface} [previousState] - The state from which the transition occurred.
     * @returns {Promise<void>}
     */
    async enterState(handlerContext, previousState) {
        // AbstractTurnState.enterState uses this._getTurnContext() for actorId in log.
        // It's called first to ensure logging consistency.
        await super.enterState(handlerContext, previousState);

        const turnCtx = this._getTurnContext(); // Gets context from handler via this._handlerContext
        // Logger for state-specific messages, prefers turnCtx's logger.
        const logger = turnCtx ? turnCtx.getLogger() : handlerContext.getLogger();
        const actor = turnCtx?.getActor(); // Actor MUST come from TurnContext for this state
        const actorId = actor?.id ?? 'UNKNOWN_ACTOR_ON_ENTRY';

        if (!turnCtx || !actor) {
            logger.error(`${this.getStateName()}: TurnContext or Actor not found on entry. Actor ID: ${actorId}. Transitioning to Idle.`);
            if (typeof handlerContext._resetTurnStateAndResources === 'function') {
                handlerContext._resetTurnStateAndResources(`critical-entry-failure-${this.getStateName()}`);
            }
            await handlerContext._transitionToState(new TurnIdleState(handlerContext));
            return;
        }

        // Subscribe
        try {
            // Get SubscriptionManager from TurnContext
            const subMan = turnCtx.getSubscriptionManager();
            this.#unsubscribeFromCommandInputFn = subMan.subscribeToCommandInput(
                // Pass the handlerContext for the state method to operate on the correct handler instance
                (cmdString) => this.handleSubmittedCommand(handlerContext, cmdString)
            );
            logger.debug(`${this.getStateName()}: Successfully subscribed to command input for actor ${actorId}.`);

            // Optionally, prompt player for input here if not handled by an external mechanism
            // const playerPromptService = turnCtx.getPlayerPromptService();
            // await playerPromptService.prompt(actor, "Your command?");

        } catch (subError) {
            const errorMessage = `${this.getStateName()}: Failed to subscribe to command input or prompt player for actor ${actorId}.`;
            logger.error(errorMessage, subError);
            // Use turnCtx.endTurn() which calls the handler's _handleTurnEnd method.
            turnCtx.endTurn(new Error(`${errorMessage} Details: ${subError.message}`));
            return;
        }
    }

    /**
     * Called when the {@link BaseTurnHandler} transitions out of this state.
     * - Unsubscribes from command input.
     * - Calls super.exitState for consistent logging.
     * @override
     * @async
     * @param {BaseTurnHandler} handlerContext - The {@link BaseTurnHandler} instance.
     * @param {ITurnState_Interface} [nextState] - The state to which the handler is transitioning.
     * @returns {Promise<void>}
     */
    async exitState(handlerContext, nextState) {
        const turnCtx = this._getTurnContext();
        const logger = turnCtx ? turnCtx.getLogger() : handlerContext.getLogger();

        if (this.#unsubscribeFromCommandInputFn) {
            logger.debug(`${this.getStateName()}: Unsubscribing from command input.`);
            try {
                this.#unsubscribeFromCommandInputFn();
            } catch (unsubError) {
                logger.error(`${this.getStateName()}: Error during command input unsubscription: ${unsubError.message}`, unsubError);
            }
            this.#unsubscribeFromCommandInputFn = null;
        } else {
            // Only warn if we expected an unsubscribe function (e.g., not during initial error recovery before subscription)
            if (nextState && nextState.getStateName() !== 'TurnIdleState' && nextState.getStateName() !== 'TurnEndingState') {
                logger.warn(`${this.getStateName()}: No unsubscribe function was stored or it was already cleared upon exit.`);
            }
        }
        // Call super.exitState last for consistent logging from AbstractTurnState.
        await super.exitState(handlerContext, nextState);
    }

    /**
     * Handles a command string submitted by the player.
     * @override
     * @async
     * @param {BaseTurnHandler} handlerContext - The {@link BaseTurnHandler} instance.
     * @param {string} commandString - The command string submitted by the player.
     * @returns {Promise<void>}
     */
    async handleSubmittedCommand(handlerContext, commandString) {
        const turnCtx = this._getTurnContext();
        // If turnCtx is somehow lost, fallback, but this indicates a severe issue.
        const logger = turnCtx ? turnCtx.getLogger() : handlerContext.getLogger();
        const actor = turnCtx?.getActor();

        if (!turnCtx || !actor) {
            logger.error(`${this.getStateName()}: handleSubmittedCommand called but no TurnContext/actor. Command: "${commandString}". Attempting to transition to Idle.`);
            if (typeof handlerContext._resetTurnStateAndResources === 'function') {
                handlerContext._resetTurnStateAndResources(`critical-command-failure-${this.getStateName()}`);
            }
            await handlerContext._transitionToState(new TurnIdleState(handlerContext));
            return;
        }

        logger.info(`${this.getStateName()}: Received command "${commandString}" for actor ${actor.id}.`);

        if (!commandString || commandString.trim() === "") {
            logger.debug(`${this.getStateName()}: Empty command received for actor ${actor.id}. Re-prompting.`);
            try {
                const prompter = turnCtx.getPlayerPromptService();
                await prompter.prompt(actor); // Assuming prompt service is on TurnContext
            } catch (promptError) {
                const errorMessage = `${this.getStateName()}: Failed to re-prompt actor ${actor.id} after empty command.`;
                logger.error(errorMessage, promptError);
                turnCtx.endTurn(new Error(`${errorMessage} Details: ${promptError.message}`));
            }
        } else {
            logger.debug(`${this.getStateName()}: Valid command "${commandString}" for actor ${actor.id}. Transitioning to ProcessingCommandState.`);
            try {
                await handlerContext._transitionToState(new ProcessingCommandState(handlerContext, commandString));
            } catch (transitionError) {
                const errorMessage = `${this.getStateName()}: Failed to transition to ProcessingCommandState for actor ${actor.id}. Command: "${commandString}".`;
                logger.error(errorMessage, transitionError);
                turnCtx.endTurn(new Error(`${errorMessage} Details: ${transitionError.message}`));
            }
        }
    }

    /** @override */
    async startTurn(handlerContext, actor) {
        // This state should not typically handle startTurn again once entered.
        // Delegate to super which throws an error.
        return super.startTurn(handlerContext, actor);
    }

    /** @override */
    async handleTurnEndedEvent(handlerContext, payload) {
        const turnCtx = this._getTurnContext();
        const logger = turnCtx ? turnCtx.getLogger() : handlerContext.getLogger();
        const currentActor = turnCtx?.getActor();

        if (currentActor && payload && payload.entityId === currentActor.id) {
            logger.info(`${this.getStateName()}: core:turn_ended event received for current actor ${currentActor.id}. Ending turn.`);
            const errorForTurnEnd = payload.error ? (payload.error instanceof Error ? payload.error : new Error(String(payload.error))) : null;
            // Use turnCtx.endTurn() to ensure the standard end-of-turn callback is invoked.
            turnCtx.endTurn(errorForTurnEnd);
        } else {
            // Call super.handleTurnEndedEvent if the event is not for the current actor or for default logging.
            await super.handleTurnEndedEvent(handlerContext, payload);
        }
    }

    /** @override */
    async processCommandResult(handlerContext, actor, cmdProcResult, commandString) {
        // This state primarily awaits input, doesn't process results itself.
        return super.processCommandResult(handlerContext, actor, cmdProcResult, commandString);
    }

    /** @override */
    async handleDirective(handlerContext, actor, directive, cmdProcResult) {
        // This state primarily awaits input, doesn't handle directives itself.
        return super.handleDirective(handlerContext, actor, directive, cmdProcResult);
    }

    /** @override */
    async destroy(handlerContext) {
        const turnCtx = this._getTurnContext(); // Get context before it might be cleared by super or exitState
        const logger = turnCtx ? turnCtx.getLogger() : handlerContext.getLogger(); // Use turn's logger if available
        const actor = turnCtx?.getActor();
        const actorId = actor?.id ?? 'N/A_at_destroy';

        logger.info(`${this.getStateName()}: PlayerTurnHandler is being destroyed while awaiting input for actor ${actorId}.`);

        // Ensure cleanup like unsubscription. exitState is called by _transitionToState if handler moves to Idle.
        // If destroy is called directly without a state transition, manually call necessary parts of exitState.
        if (this.#unsubscribeFromCommandInputFn) {
            logger.debug(`${this.getStateName()} (destroy): Manually unsubscribing from command input.`);
            try {
                this.#unsubscribeFromCommandInputFn();
            } catch (unsubError) {
                logger.error(`${this.getStateName()} (destroy): Error during command input unsubscription: ${unsubError.message}`, unsubError);
            }
            this.#unsubscribeFromCommandInputFn = null;
        }

        if (actor && turnCtx) { // Check turnCtx as well, as endTurn is a method on it.
            const destroyError = new Error(`Turn handler destroyed while actor ${actorId} was in AwaitingPlayerInputState.`);
            logger.debug(`${this.getStateName()}: Notifying turn end for actor ${actorId} due to destruction.`);
            // Pass 'fromDestroy = true' to the handler's _handleTurnEnd if it accepts it
            // For now, just end the turn via context. The handler's destroy will manage overall flow.
            turnCtx.endTurn(destroyError);
        } else {
            logger.warn(`${this.getStateName()}: PlayerTurnHandler destroyed, but no current actor/TurnContext was active in this state. No specific turn to end via context.`);
        }
        // AbstractTurnState.destroy() logs a debug message.
        // The main cleanup is handled by BaseTurnHandler.destroy() which ensures transition to Idle and resource reset.
        await super.destroy(handlerContext);
        logger.debug(`${this.getStateName()}: Destroy handling complete for actor ${actorId}.`);
    }
}

// --- FILE END ---