// src/core/turnStates/AwaitingPlayerInputState.js
// --- FILE START ---

/**
 * @typedef {import('../handlers/playerTurnHandler.js').default} PlayerTurnHandler
 * @typedef {import('../../entities/entity.js').default} Entity
 * @typedef {import('./ITurnState.js').ITurnState} ITurnState_Interface
 * @typedef {import('./abstractTurnState.js').AbstractTurnState} AbstractTurnState_Base
 * @typedef {import('./processingCommandState.js').ProcessingCommandState} ProcessingCommandState_Class
 * @typedef {import('./turnEndingState.js').TurnEndingState} TurnEndingState_Class
 * @typedef {import('./turnIdleState.js').TurnIdleState} TurnIdleState_Class
 */

import {AbstractTurnState} from './abstractTurnState.js';
import {ProcessingCommandState} from './processingCommandState.js'; // Dependency: PTH-STATE-006
import {TurnEndingState} from './turnEndingState.js'; // Assumed for error transitions
import {TurnIdleState} from './turnIdleState.js';     // Assumed for error transitions

/**
 * @class AwaitingPlayerInputState
 * @extends AbstractTurnState_Base
 * @implements {ITurnState_Interface}
 * @description
 * This state is active after `startTurn()` has successfully initialized the turn for an actor
 * and the system is waiting for the player to submit a command. The player has been prompted for action.
 * Its primary responsibilities are to subscribe to player command input, prompt the player,
 * and wait for a command to be submitted.
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
     * @param {PlayerTurnHandler} context - The PlayerTurnHandler instance that manages this state.
     */
    constructor(context) {
        super(context);
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
     * Called when the {@link PlayerTurnHandler} transitions into this state.
     * - Logs entry.
     * - Ensures there's a current actor.
     * - Subscribes to command input.
     * - Prompts the player for action.
     * @override
     * @async
     * @param {PlayerTurnHandler} context - The {@link PlayerTurnHandler} instance.
     * @param {ITurnState_Interface} [previousState] - The state from which the transition occurred.
     * @returns {Promise<void>}
     */
    async enterState(context, previousState) {
        const actor = context.getCurrentActor();
        const actorId = actor?.id ?? 'UNKNOWN';
        context.logger.info(`${this.getStateName()}: Entered for actor ${actorId}. Previous state: ${previousState?.getStateName() ?? 'None'}.`);

        if (!actor) {
            const errorMsg = `${this.getStateName()}: Critical - No current actor found on entry. This is an invalid state. Transitioning to TurnIdleState.`;
            context.logger.error(errorMsg);
            // Transition to an idle/error state. TurnIdleState will reset resources.
            // No actor means _handleTurnEnd might not be appropriate here.
            try {
                await context._transitionToState(new TurnIdleState(context));
            } catch (transitionError) {
                context.logger.error(`${this.getStateName()}: Failed to transition to TurnIdleState after null actor error: ${transitionError.message}`, transitionError);
                // At this point, the handler might be in an unstable state.
            }
            return;
        }

        // Subscribe to command input
        try {
            context.logger.debug(`${this.getStateName()}: Subscribing to command input for actor ${actorId}.`);
            // Assuming subscribeToCommandInput takes the handler function and returns an unsubscribe function.
            this.#unsubscribeFromCommandInputFn = context.subscriptionManager.subscribeToCommandInput(
                this.handleSubmittedCommand.bind(this) // Pass bound method as callback
            );
            if (typeof this.#unsubscribeFromCommandInputFn !== 'function') {
                context.logger.warn(`${this.getStateName()}: subscriptionManager.subscribeToCommandInput did not return a function. Unsubscription might fail.`);
                // Fallback or alternative unsubscription might be needed if this path is hit.
            }
        } catch (subError) {
            const errorMsg = `${this.getStateName()}: Failed to subscribe to command input for actor ${actorId}. Error: ${subError.message}`;
            context.logger.error(errorMsg, subError);
            // As per ticket: transition to TurnEndingState with an error for the current actor.
            // This is typically handled by context._handleTurnEnd which initiates that transition.
            await context._handleTurnEnd(actor.id, new Error(errorMsg));
            // _handleTurnEnd will trigger a transition to TurnEndingState, then TurnIdleState.
            return; // Stop further execution in this state's enterState.
        }

        // Prompt player for action
        try {
            context.logger.debug(`${this.getStateName()}: Prompting player ${actorId} for action.`);
            // Using playerPromptService directly as _promptPlayerForAction is deprecated.
            await context.playerPromptService.prompt(actor);
            context.logger.debug(`${this.getStateName()}: Player ${actorId} prompted successfully.`);
        } catch (promptError) {
            const errorMsg = `${this.getStateName()}: playerPromptService.prompt failed for actor ${actorId}. Error: ${promptError.message}`;
            context.logger.error(errorMsg, promptError);
            // Per ticket: _promptPlayerForAction (now playerPromptService.prompt) is expected to handle ending the turn.
            // This means it might have already called _handleTurnEnd or similar, which would trigger state transitions.
            // This state should gracefully handle this (e.g., error might prevent further execution).
            // No explicit transition needed here if prompt service handles turn ending.
        }
    }

    /**
     * Called when the {@link PlayerTurnHandler} transitions out of this state.
     * - Logs exit.
     * - Unsubscribes from command input.
     * @override
     * @async
     * @param {PlayerTurnHandler} context - The {@link PlayerTurnHandler} instance.
     * @param {ITurnState_Interface} [nextState] - The state to which the handler is transitioning.
     * @returns {Promise<void>}
     */
    async exitState(context, nextState) {
        const actor = context.getCurrentActor();
        context.logger.info(`${this.getStateName()}: Exiting for actor ${actor?.id ?? 'N/A'}. Transitioning to ${nextState?.getStateName() ?? 'None'}.`);

        if (this.#unsubscribeFromCommandInputFn) {
            context.logger.debug(`${this.getStateName()}: Unsubscribing from command input.`);
            try {
                this.#unsubscribeFromCommandInputFn();
            } catch (unsubError) {
                context.logger.error(`${this.getStateName()}: Error during command input unsubscription: ${unsubError.message}`, unsubError);
            }
            this.#unsubscribeFromCommandInputFn = null;
        } else {
            // Fallback or if subscribeToCommandInput doesn't return a function,
            // use the specific method if it exists (as per original ticket phrasing).
            // context.logger.debug(`${this.getStateName()}: Attempting unsubscription via context.subscriptionManager.unsubscribeFromCommandInput().`);
            // context.subscriptionManager.unsubscribeFromCommandInput(); // This assumes manager knows what/how to unsub.
            // The current SubscriptionLifecycleManager (as per PlayerTurnHandler) has unsubscribeAll().
            // A more targeted unsubscription is preferred. Sticking to stored function.
            context.logger.warn(`${this.getStateName()}: No unsubscribe function was stored or it was already cleared.`);
        }
    }

    /**
     * Handles a command string submitted by the player. This method is the callback
     * for the command input subscription.
     * - Logs the command.
     * - Validates the current actor.
     * - Handles empty commands by re-prompting.
     * - Transitions to ProcessingCommandState for valid commands.
     * @override
     * @async
     * @param {PlayerTurnHandler} context - The {@link PlayerTurnHandler} instance.
     * @param {string} commandString - The command string submitted by the player.
     * @returns {Promise<void>}
     */
    async handleSubmittedCommand(context, commandString) {
        const actor = context.getCurrentActor();

        if (!actor) {
            context.logger.error(`${this.getStateName()}: handleSubmittedCommand called but no current actor. Command: "${commandString}". This should not happen.`);
            // This is an inconsistent state. May need to transition to an error/idle state.
            // For now, just log and return, as enterState should prevent this.
            return;
        }

        context.logger.info(`${this.getStateName()}: Received command "${commandString}" for actor ${actor.id}.`);

        // Validate current actor (context.#_assertTurnActiveFor(actor.id) equivalent)
        // This check is implicitly handled by ensuring 'actor' is the one we expect.
        // If PlayerTurnHandler's current actor changed unexpectedly, that's a deeper issue.
        // For robustness, one might re-verify `context.getCurrentActor().id === actor.id` if `actor` was passed differently.
        // Here, `actor` is from `context.getCurrentActor()`, so it's intrinsically validated.

        if (!commandString || commandString.trim() === "") {
            context.logger.debug(`${this.getStateName()}: Empty command received for actor ${actor.id}. Re-prompting.`);
            try {
                // Instead of context._handleEmptyCommand (old logic), directly re-prompt.
                await context.playerPromptService.prompt(actor);
                // State remains AwaitingPlayerInputState.
            } catch (promptError) {
                context.logger.error(`${this.getStateName()}: Failed to re-prompt actor ${actor.id} after empty command. Error: ${promptError.message}`, promptError);
                // playerPromptService.prompt is expected to handle turn ending if it fails critically.
            }
        } else {
            context.logger.debug(`${this.getStateName()}: Valid command "${commandString}" for actor ${actor.id}. Transitioning to ProcessingCommandState.`);
            try {
                // Pass context and commandString to ProcessingCommandState constructor
                await context._transitionToState(new ProcessingCommandState(context, commandString, actor));
            } catch (transitionError) {
                context.logger.error(`${this.getStateName()}: Failed to transition to ProcessingCommandState for actor ${actor.id}. Command: "${commandString}". Error: ${transitionError.message}`, transitionError);
                // If transition fails, the turn might need to be ended.
                // This could involve calling context._handleTurnEnd or transitioning to TurnEndingState.
                // For now, error is logged. A robust system might force end the turn here.
                await context._handleTurnEnd(actor.id, new Error(`Failed to transition to ProcessingCommandState: ${transitionError.message}`));
            }
        }
    }

    /**
     * Handles the initiation of a player's turn.
     * This state should not handle `startTurn` as a turn is already in progress.
     * Inherits behavior from {@link AbstractTurnState} which logs a warning and throws an error.
     * @override
     * @async
     */
    async startTurn(context, actor) {
        context.logger.warn(`${this.getStateName()}: startTurn called for actor ${actor?.id} but a turn is already in progress for ${context.getCurrentActor()?.id}. This indicates a logic error.`);
        return super.startTurn(context, actor); // AbstractTurnState will throw.
    }

    /**
     * Handles the `core:turn_ended` system event.
     * Not typically expected in this state unless an external event pre-empts player input.
     * Inherits behavior from {@link AbstractTurnState} which logs a warning.
     * @override
     * @async
     */
    async handleTurnEndedEvent(context, payload) {
        context.logger.warn(`${this.getStateName()}: handleTurnEndedEvent received for actor ${payload?.entityId} while awaiting player input for ${context.getCurrentActor()?.id}. This might be a pre-emptive turn end.`);
        // Depending on game rules, might transition to TurnEndingState.
        // For now, deferring to AbstractTurnState's default (log warning).
        // If payload.entityId === context.getCurrentActor().id, then a transition is warranted.
        const currentActor = context.getCurrentActor();
        if (currentActor && payload && payload.entityId === currentActor.id) {
            context.logger.info(`${this.getStateName()}: TurnEndedEvent matches current actor ${currentActor.id}. Ending turn.`);
            await context._handleTurnEnd(currentActor.id, payload.error ? new Error(payload.error) : null);
            // _handleTurnEnd will trigger transition to TurnEndingState -> TurnIdleState
        } else {
            return super.handleTurnEndedEvent(context, payload);
        }
    }

    /**
     * Not applicable for this state.
     * Inherits behavior from {@link AbstractTurnState} which logs an error and throws.
     * @override
     */
    async processCommandResult(context, actor, cmdProcResult, commandString) {
        return super.processCommandResult(context, actor, cmdProcResult, commandString);
    }

    /**
     * Not applicable for this state.
     * Inherits behavior from {@link AbstractTurnState} which logs an error and throws.
     * @override
     */
    async handleDirective(context, actor, directive, cmdProcResult) {
        return super.handleDirective(context, actor, directive, cmdProcResult);
    }

    /**
     * Handles cleanup if the {@link PlayerTurnHandler} is destroyed while this state is active.
     * - Calls `exitState()` to ensure unsubscription.
     * - Signals an abnormal turn end via `context._handleTurnEnd()`.
     * @override
     * @async
     * @param {PlayerTurnHandler} context - The {@link PlayerTurnHandler} instance being destroyed.
     * @returns {Promise<void>}
     */
    async destroy(context) {
        const actor = context.getCurrentActor();
        const actorId = actor?.id ?? 'N/A_at_destroy';
        context.logger.info(`${this.getStateName()}: PlayerTurnHandler is being destroyed while awaiting input for actor ${actorId}.`);

        // Ensure cleanup (e.g., unsubscribe)
        await this.exitState(context); // Pass context, nextState is implicitly "being destroyed"

        if (actor) {
            // Signal an abnormal turn end.
            // PlayerTurnHandler.destroy() also has logic for this, but state-specific error message is good.
            const destroyError = new Error(`Turn handler destroyed while actor ${actorId} was in AwaitingPlayerInputState.`);
            context.logger.debug(`${this.getStateName()}: Delegating to context._handleTurnEnd for actor ${actorId} due to destruction.`);
            // The context.destroy() method should manage isTerminatingNormally.
            // _handleTurnEnd will trigger transitions to TurnEndingState -> TurnIdleState.
            await context._handleTurnEnd(actor.id, destroyError);
        } else {
            context.logger.warn(`${this.getStateName()}: PlayerTurnHandler destroyed, but no current actor was set in this state. No specific turn to end.`);
        }
        context.logger.debug(`${this.getStateName()}: Destroy handling complete for actor ${actorId}.`);
    }
}

// --- FILE END ---