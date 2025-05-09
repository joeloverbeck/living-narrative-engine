// src/core/turnStates/TurnIdleState.js
// --- FILE START ---

/**
 * @typedef {import('../handlers/playerTurnHandler.js').default} PlayerTurnHandler
 * @typedef {import('../../entities/entity.js').default} Entity
 * @typedef {import('./ITurnState.js').ITurnState} ITurnState_Interface
 * @typedef {import('./abstractTurnState.js').AbstractTurnState} AbstractTurnState_Base
 */

import {AbstractTurnState} from './abstractTurnState.js';
// The AwaitingPlayerInputState is required for the transition in startTurn.
// Its actual implementation will be part of a different ticket (e.g., PTH-STATE-005).
import {AwaitingPlayerInputState} from './awaitingPlayerInputState.js';


/**
 * @class TurnIdleState
 * @extends AbstractTurnState_Base
 * @implements {ITurnState_Interface}
 * @description
 * Represents the state of the PlayerTurnHandler when no turn is currently active.
 * This is the initial state of the handler before `startTurn()` is called for the
 * first time, and the state to which the handler returns after a turn has fully
 * completed and been reset, or after the handler itself has been reset/destroyed.
 */
export class TurnIdleState extends AbstractTurnState {
    /**
     * Creates an instance of TurnIdleState.
     * @param {PlayerTurnHandler} context - The PlayerTurnHandler instance that manages this state.
     */
    constructor(context) {
        super(context);
    }

    /**
     * Returns the unique identifier for this state.
     * @override
     * @returns {string} The state name "TurnIdleState".
     */
    getStateName() {
        return "TurnIdleState";
    }

    /**
     * Called when the {@link PlayerTurnHandler} transitions into this state.
     * Logs entry and ensures the handler is in a clean, idle state by resetting
     * turn-specific resources and clearing the current actor.
     * @override
     * @async
     * @param {PlayerTurnHandler} context - The {@link PlayerTurnHandler} instance.
     * @param {ITurnState_Interface} [previousState] - The state from which the transition occurred.
     * @returns {Promise<void>}
     */
    async enterState(context, previousState) {
        const previousStateName = previousState?.getStateName() ?? 'None';
        context.logger.info(`${this.getStateName()}: Entered. Previous state: ${previousStateName}.`);

        context.logger.debug(`${this.getStateName()}: Ensuring clean state by calling context._resetTurnStateAndResources().`);
        // _resetTurnStateAndResources clears subscriptions, resets currentActor to null,
        // and other turn-specific flags like #isAwaitingTurnEndEvent, #isTerminatingNormally.
        context._resetTurnStateAndResources(`enterState-${this.getStateName()}`);

        // Explicitly setting currentActor to null as per ticket, though _resetTurnStateAndResources should also do this.
        // This ensures the requirement is met even if _resetTurnStateAndResources changes.
        if (context.getCurrentActor() !== null) {
            context.logger.debug(`${this.getStateName()}: Explicitly setting currentActor to null.`);
            context.setCurrentActor(null);
        }
        context.logger.debug(`${this.getStateName()}: Entry complete. Handler is now idle.`);
    }

    /**
     * Called when the {@link PlayerTurnHandler} transitions out of this state.
     * Logs exit from this state.
     * @override
     * @async
     * @param {PlayerTurnHandler} context - The {@link PlayerTurnHandler} instance.
     * @param {ITurnState_Interface} [nextState] - The state to which the handler is transitioning.
     * @returns {Promise<void>}
     */
    async exitState(context, nextState) {
        const nextStateName = nextState?.getStateName() ?? 'None';
        context.logger.info(`${this.getStateName()}: Exiting. Transitioning to ${nextStateName}.`);
        // No further specific exit logic for idle state beyond logging.
    }

    /**
     * Initiates a new turn for the specified actor.
     * This method validates the actor, sets them as the current actor in the context,
     * ensures the handler is ready for a new turn (by resetting relevant flags),
     * and transitions the handler to the {@link AwaitingPlayerInputState}.
     * @override
     * @async
     * @param {PlayerTurnHandler} context - The {@link PlayerTurnHandler} instance.
     * @param {Entity} actor - The player entity whose turn is to be started.
     * @returns {Promise<void>}
     * @throws {Error} If the actor is invalid or if the transition to the new state fails.
     */
    async startTurn(context, actor) {
        context.logger.info(`${this.getStateName()}: Received startTurn for actor ${actor?.id ?? 'UNKNOWN'}.`);

        if (!actor || typeof actor.id === 'undefined') {
            const errorMsg = `${this.getStateName()}: startTurn called with invalid actor. Actor is required.`;
            context.logger.error(errorMsg);
            throw new Error(errorMsg);
        }

        // Set the current actor in the context
        context.setCurrentActor(actor);
        context.logger.debug(`${this.getStateName()}: Set currentActor to ${actor.id}.`);

        // Note: Per ticket "Clears any residual turn end waiting mechanisms" & "Resets flags like context.#isDestroyed = false and context.#isTerminatingNormally = false."
        // - context._resetTurnStateAndResources() called in this.enterState() should have already handled
        //   clearing turn end waiting mechanisms and resetting #isTerminatingNormally to false.
        // - context.#isDestroyed is managed by PlayerTurnHandler.destroy() and checked by PlayerTurnHandler.startTurn() before delegation.
        //   If this method is running, #isDestroyed is implicitly false.

        context.logger.debug(`${this.getStateName()}: Preparing to transition to AwaitingPlayerInputState for actor ${actor.id}.`);
        try {
            // The PlayerTurnHandler needs to expose `_transitionToState` or similar
            // for states to call. This assumes `_transitionToState` is available on context.
            await context._transitionToState(new AwaitingPlayerInputState(context));
            context.logger.info(`${this.getStateName()}: Successfully transitioned to AwaitingPlayerInputState for actor ${actor.id}.`);
        } catch (error) {
            context.logger.error(`${this.getStateName()}: Failed to transition to AwaitingPlayerInputState for actor ${actor.id}. Error: ${error.message}`, error);
            // Rollback setCurrentActor if transition fails? Or rely on higher-level error handling.
            // For now, ensure state is reset if transition critically fails.
            context.setCurrentActor(null); // Clear actor if transition failed to prevent inconsistent state
            throw error; // Re-throw the error
        }
    }

    /**
     * Handles command submissions. This method should not be called when the handler is idle.
     * Inherits behavior from {@link AbstractTurnState} which logs a warning and throws an error.
     * @override
     * @async
     * @param {PlayerTurnHandler} context - The {@link PlayerTurnHandler} instance.
     * @param {string} commandString - The command string submitted.
     * @returns {Promise<void>}
     * @throws {Error} Indicating the operation is not valid in the current state.
     */
    async handleSubmittedCommand(context, commandString) {
        const message = `${this.getStateName()}: Command ('${commandString}') submitted but no turn is active. This should not happen.`;
        context.logger.warn(message);
        return super.handleSubmittedCommand(context, commandString); // Throws error
    }

    /**
     * Handles turn ended events. This method should not be called when the handler is idle.
     * Inherits behavior from {@link AbstractTurnState} which logs a warning.
     * @override
     * @async
     * @param {PlayerTurnHandler} context - The {@link PlayerTurnHandler} instance.
     * @param {object} payload - The event payload.
     * @returns {Promise<void>}
     */
    async handleTurnEndedEvent(context, payload) {
        const message = `${this.getStateName()}: handleTurnEndedEvent called but no turn is active. Actor in payload: ${payload?.entityId}. This should not happen.`;
        context.logger.warn(message);
        return super.handleTurnEndedEvent(context, payload); // Default does not throw, just warns.
    }

    /**
     * Handles processing of command results. Not applicable for idle state.
     * Inherits behavior from {@link AbstractTurnState} which logs an error and throws.
     * @override
     * @async
     * @param {PlayerTurnHandler} context - The {@link PlayerTurnHandler} instance.
     * @param {Entity} actor - The actor.
     * @param {object} cmdProcResult - The command processing result.
     * @param {string} commandString - The original command.
     * @returns {Promise<void>}
     * @throws {Error} Indicating the operation is not valid in the current state.
     */
    async processCommandResult(context, actor, cmdProcResult, commandString) {
        const message = `${this.getStateName()}: processCommandResult called but no turn is active/processing. Actor: ${actor?.id}. This should not happen.`;
        context.logger.warn(message);
        return super.processCommandResult(context, actor, cmdProcResult, commandString); // Throws error
    }

    /**
     * Handles turn directives. Not applicable for idle state.
     * Inherits behavior from {@link AbstractTurnState} which logs an error and throws.
     * @override
     * @async
     * @param {PlayerTurnHandler} context - The {@link PlayerTurnHandler} instance.
     * @param {Entity} actor - The actor.
     * @param {string} directive - The turn directive.
     * @param {object} [cmdProcResult] - The command processing result, if any.
     * @returns {Promise<void>}
     * @throws {Error} Indicating the operation is not valid in the current state.
     */
    async handleDirective(context, actor, directive, cmdProcResult) {
        const message = `${this.getStateName()}: handleDirective called but no turn is active/processing. Actor: ${actor?.id}, Directive: ${directive}. This should not happen.`;
        context.logger.warn(message);
        return super.handleDirective(context, actor, directive, cmdProcResult); // Throws error
    }

    /**
     * Handles the destruction of the {@link PlayerTurnHandler} context while in this state.
     * Logs the event and ensures resources are reset.
     * @override
     * @async
     * @param {PlayerTurnHandler} context - The {@link PlayerTurnHandler} instance being destroyed.
     * @returns {Promise<void>}
     */
    async destroy(context) {
        context.logger.info(`${this.getStateName()}: PlayerTurnHandler is being destroyed while in idle state.`);
        // Ensure resources are reset, although if it's idle, they should already be.
        // This is a good safeguard.
        context.logger.debug(`${this.getStateName()}: Calling _resetTurnStateAndResources during destroy to ensure clean state.`);
        context._resetTurnStateAndResources(`destroy-${this.getStateName()}`);
        // The PlayerTurnHandler's destroy() method is responsible for setting its own #isDestroyed flag.
        // This state method just handles any state-specific cleanup. For Idle, it's mostly ensuring reset.
        context.logger.debug(`${this.getStateName()}: Destroy handling complete.`);
    }
}

// --- FILE END ---