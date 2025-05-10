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
import {TurnEndingState} from './turnEndingState.js'; // Not directly used here, but good for context
import {TurnIdleState} from './turnIdleState.js';

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
        await super.enterState(handler, previousState); // Handles initial logging via this._getTurnContext()

        const turnCtx = this._getTurnContext(); // Must exist at this point
        const logger = turnCtx ? turnCtx.getLogger() : handler.getLogger(); // Prefer context's logger

        if (!turnCtx) { // Should have been caught by super.enterState if actor was needed for log
            logger.error(`${this.getStateName()}: Critical - ITurnContext not available on entry. Transitioning to Idle.`);
            handler._resetTurnStateAndResources(`critical-entry-failure-${this.getStateName()}`);
            await handler._transitionToState(new TurnIdleState(handler));
            return;
        }

        const actor = turnCtx.getActor();
        if (!actor) {
            logger.error(`${this.getStateName()}: Critical - Actor not found in ITurnContext on entry. Transitioning to Idle.`);
            handler._resetTurnStateAndResources(`critical-entry-no-actor-${this.getStateName()}`);
            await handler._transitionToState(new TurnIdleState(handler));
            return;
        }
        const actorId = actor.id;

        try {
            const subMan = turnCtx.getSubscriptionManager(); // Get from ITurnContext
            this.#unsubscribeFromCommandInputFn = subMan.subscribeToCommandInput(
                (cmdString) => this.handleSubmittedCommand(handler, cmdString, actor) // Pass handler and verified actor
            );
            logger.debug(`${this.getStateName()}: Subscribed to command input for actor ${actorId}.`);

            // Prompt player for input
            const prompter = turnCtx.getPlayerPromptService(); // Get from ITurnContext
            await prompter.prompt(actor, "Your command?"); // Or a more generic prompt message
            logger.debug(`${this.getStateName()}: Player ${actorId} prompted for input.`);

        } catch (error) {
            const errorMessage = `${this.getStateName()}: Failed to subscribe or prompt player ${actorId}.`;
            logger.error(errorMessage, error);
            turnCtx.endTurn(new Error(`${errorMessage} Details: ${error.message}`)); // End turn via ITurnContext
        }
    }

    /**
     * @override
     * @param {BaseTurnHandler} handler
     * @param {ITurnState_Interface} [nextState]
     */
    async exitState(handler, nextState) {
        const turnCtx = this._getTurnContext();
        const logger = turnCtx ? turnCtx.getLogger() : handler.getLogger();

        if (this.#unsubscribeFromCommandInputFn) {
            logger.debug(`${this.getStateName()}: Unsubscribing from command input.`);
            try {
                this.#unsubscribeFromCommandInputFn();
            } catch (unsubError) {
                logger.error(`${this.getStateName()}: Error during command input unsubscription: ${unsubError.message}`, unsubError);
            }
            this.#unsubscribeFromCommandInputFn = null;
        } else {
            // Avoid warning if exiting to Idle/Ending, as context might be clearing.
            const nextStateName = nextState?.getStateName();
            if (nextStateName && nextStateName !== 'TurnIdleState' && nextStateName !== 'TurnEndingState') {
                logger.warn(`${this.getStateName()}: No unsubscribe function stored or already cleared upon exit.`);
            }
        }
        await super.exitState(handler, nextState); // Handles logging via this._getTurnContext()
    }

    /**
     * @override
     * @param {BaseTurnHandler} handler
     * @param {string} commandString
     * @param {Entity} actorEntity - The entity that submitted the command (passed from subscription callback)
     */
    async handleSubmittedCommand(handler, commandString, actorEntity) {
        const turnCtx = this._getTurnContext();
        const logger = turnCtx ? turnCtx.getLogger() : handler.getLogger();

        if (!turnCtx) {
            logger.error(`${this.getStateName()}: handleSubmittedCommand called but no ITurnContext. Command: "${commandString}". Attempting to Idle.`);
            handler._resetTurnStateAndResources(`critical-command-no-context-${this.getStateName()}`);
            await handler._transitionToState(new TurnIdleState(handler));
            return;
        }

        const contextActor = turnCtx.getActor();
        if (!contextActor || contextActor.id !== actorEntity.id) {
            logger.error(`${this.getStateName()}: Command received for ${actorEntity.id}, but current context actor is ${contextActor?.id}. Ending turn with error.`);
            turnCtx.endTurn(new Error(`Command actor mismatch: expected ${contextActor?.id}, got ${actorEntity.id}`));
            return;
        }
        const actorId = contextActor.id;

        logger.info(`${this.getStateName()}: Received command "${commandString}" for actor ${actorId}.`);

        if (!commandString || commandString.trim() === "") {
            logger.debug(`${this.getStateName()}: Empty command received for ${actorId}. Re-prompting.`);
            try {
                const prompter = turnCtx.getPlayerPromptService(); // From ITurnContext
                await prompter.prompt(contextActor); // Re-prompt current actor
            } catch (promptError) {
                const errorMsg = `${this.getStateName()}: Failed to re-prompt ${actorId}.`;
                logger.error(errorMsg, promptError);
                turnCtx.endTurn(new Error(`${errorMsg} Details: ${promptError.message}`));
            }
        } else {
            logger.debug(`${this.getStateName()}: Valid command "${commandString}" for ${actorId}. Transitioning to ProcessingCommandState.`);
            try {
                // ProcessingCommandState constructor takes handler and commandString
                await handler._transitionToState(new ProcessingCommandState(handler, commandString));
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
        const logger = turnCtx ? turnCtx.getLogger() : handler.getLogger();

        if (!turnCtx) {
            logger.warn(`${this.getStateName()}: handleTurnEndedEvent received but no ITurnContext active. Payload for: ${payload?.entityId}`);
            await super.handleTurnEndedEvent(handler, payload); // Default warning
            return;
        }

        const currentActor = turnCtx.getActor();
        if (currentActor && payload && payload.entityId === currentActor.id) {
            logger.info(`${this.getStateName()}: core:turn_ended event received for current actor ${currentActor.id}. Ending turn via context.`);
            const errorForTurnEnd = payload.error ? (payload.error instanceof Error ? payload.error : new Error(String(payload.error))) : null;
            turnCtx.endTurn(errorForTurnEnd); // End turn via ITurnContext
        } else {
            // Event is not for the current actor, or payload is malformed.
            await super.handleTurnEndedEvent(handler, payload); // Default warning
        }
    }

    /** @override */
    async destroy(handler) {
        const turnCtx = this._getTurnContext(); // Get context before it's potentially cleared
        const logger = turnCtx ? turnCtx.getLogger() : handler.getLogger();
        const actorId = turnCtx?.getActor()?.id ?? 'N/A_at_destroy';

        logger.info(`${this.getStateName()}: BaseTurnHandler destroyed while awaiting input for ${actorId}.`);

        // Manually trigger cleanup normally done by exitState if still subscribed
        if (this.#unsubscribeFromCommandInputFn) {
            logger.debug(`${this.getStateName()} (destroy): Manually unsubscribing.`);
            try {
                this.#unsubscribeFromCommandInputFn();
            } catch (unsubError) { /* Already logging in exitState, avoid double log */
            }
            this.#unsubscribeFromCommandInputFn = null;
        }

        if (turnCtx) { // If a turn was active (context exists)
            const destroyError = new Error(`Turn handler destroyed while actor ${actorId} was in ${this.getStateName()}.`);
            logger.debug(`${this.getStateName()}: Notifying turn end for ${actorId} due to destruction via ITurnContext.`);
            turnCtx.endTurn(destroyError);
        } else {
            logger.warn(`${this.getStateName()}: Handler destroyed, but no active ITurnContext. No specific turn to end.`);
        }
        // BaseTurnHandler.destroy() handles further cleanup like transitioning to Idle.
        await super.destroy(handler); // Logs from AbstractTurnState
        logger.debug(`${this.getStateName()}: Destroy handling for ${actorId} complete.`);
    }

    // These methods are not applicable for AwaitingPlayerInputState
    // and will rely on AbstractTurnState's default behavior (log error and throw).
    // async startTurn(handler, actorEntity) { return super.startTurn(handler, actorEntity); }
    // async processCommandResult(handler, actor, cmdProcResult, commandString) { return super.processCommandResult(handler, actor, cmdProcResult, commandString); }
    // async handleDirective(handler, actor, directive, cmdProcResult) { return super.handleDirective(handler, actor, directive, cmdProcResult); }
}

// --- FILE END ---