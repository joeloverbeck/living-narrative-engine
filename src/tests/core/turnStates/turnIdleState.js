// src/core/turnStates/turnIdleState.js
// --- FILE START ---

/**
 * @typedef {import('../handlers/playerTurnHandler.js').default} PlayerTurnHandler
 * @typedef {import('../../entities/entity.js').default} Entity
 * @typedef {import('./ITurnState.js').ITurnState} ITurnState_Interface
 */

import {AbstractTurnState} from './AbstractTurnState.js';

/**
 * @class TurnIdleState
 * @extends AbstractTurnState
 * @implements {ITurnState_Interface}
 * @description
 * Represents the state of the PlayerTurnHandler when no turn is currently active.
 * This is the initial state of the handler before startTurn() is called for the
 * first time, and the state to which the handler returns after a turn has fully
 * completed.
 */
export class TurnIdleState extends AbstractTurnState {
    /**
     * Creates an instance of TurnIdleState.
     * @param {PlayerTurnHandler} context - The PlayerTurnHandler instance that manages this state.
     */
    constructor(context) {
        super(context); // Pass context to AbstractTurnState constructor
    }

    /**
     * Called when the {@link PlayerTurnHandler} transitions into this state.
     * @override
     * @async
     * @param {PlayerTurnHandler} context - The {@link PlayerTurnHandler} instance.
     * @param {ITurnState_Interface} [previousState] - The state from which the transition occurred.
     * @returns {Promise<void>}
     */
    async enterState(context, previousState) {
        // context.logger.debug(`${this.getStateName()} entered. Previous: ${previousState?.getStateName() ?? 'None'}`);
        // No specific entry logic for idle state in this basic implementation.
    }

    /**
     * Called when the {@link PlayerTurnHandler} transitions out of this state.
     * @override
     * @async
     * @param {PlayerTurnHandler} context - The {@link PlayerTurnHandler} instance.
     * @param {ITurnState_Interface} [nextState] - The state to which the handler is transitioning.
     * @returns {Promise<void>}
     */
    async exitState(context, nextState) {
        // context.logger.debug(`${this.getStateName()} exited. Next: ${nextState?.getStateName() ?? 'None'}`);
        // No specific exit logic for idle state in this basic implementation.
    }

    /**
     * Handles the initiation of a player's turn.
     * In TurnIdleState, this will typically transition to a state like AwaitingPlayerInputState.
     * @override
     * @async
     * @param {PlayerTurnHandler} context - The {@link PlayerTurnHandler} instance.
     * @param {Entity} actor - The player entity whose turn is to be started.
     * @returns {Promise<void>}
     */
    async startTurn(context, actor) {
        // context.logger.info(`${this.getStateName()}: Received startTurn for actor ${actor.id}.`);
        // Actual transition and logic will be implemented in PTH-FLOW-001 and subsequent tickets.
        // For now, just log or placeholder.
        // Example: await context._transitionToState(new AwaitingPlayerInputState(context));
        // console.log(`TurnIdleState: startTurn called for actor ${actor.id}. Would transition state here.`);
        // For now, to fulfill the ticket's requirement for delegation demonstration,
        // we'll keep it simple and not implement the actual transition logic yet.
        // This method will be further refactored when startTurn in PlayerTurnHandler is updated.
    }

    // Other methods (handleSubmittedCommand, handleTurnEndedEvent, etc.)
    // will use the default implementations from AbstractTurnState (throwing errors or warnings)
    // as they are not expected to be called while in TurnIdleState, except for startTurn.
}

// --- FILE END ---