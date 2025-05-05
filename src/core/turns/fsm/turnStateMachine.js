// src/core/turns/fsm/turnStateMachine.js

/**
 * @fileoverview Implements the TurnStateMachine class responsible for managing
 * the state transitions of an actor's turn based on events.
 */

import TurnState from './turnState.js';
// Import TurnEvent types for JSDoc annotations
// Note: These are type imports, not actual value imports in JS
/** @typedef {import('./turnEvents.js').TurnEvent} TurnEvent */
/** @typedef {import('./turnEvents.js').TurnEvent_START} TurnEvent_START */
/** @typedef {import('./turnEvents.js').TurnEvent_PROCESS_RESULT} TurnEvent_PROCESS_RESULT */

// Import TurnDirective for checking payload in PROCESS_RESULT event
import TurnDirective from '../../constants/turnDirectives.js';


/**
 * @class TurnStateMachine
 * @description Manages the state transitions for a single actor's turn lifecycle.
 * It tracks the current state and the actor involved, ensuring valid transitions
 * based on received events.
 */
class TurnStateMachine {
    /**
     * The current state of the machine.
     * @private
     * @type {TurnState[keyof TurnState]}
     */
    #currentState;

    /**
     * The unique identifier of the actor whose turn is currently being managed.
     * Null if the machine is in the Idle state.
     * @private
     * @type {string | null}
     */
    #currentActorId;

    /**
     * Creates an instance of TurnStateMachine.
     */
    constructor() {
        this.#currentState = TurnState.IDLE;
        this.#currentActorId = null;
        // Optional: Add logger dependency if needed for debugging transitions later
        // this.#logger = logger;
    }

    // --- Public API Methods ---

    /**
     * Returns the current state of the state machine.
     * @public
     * @returns {TurnState[keyof TurnState]} The current state value (e.g., TurnState.IDLE).
     */
    current() {
        return this.#currentState;
    }

    /**
     * Sends an event to the state machine, potentially causing a state transition.
     * @public
     * @param {TurnEvent} event - The event object to process.
     * @returns {boolean} Returns true if the event caused a state transition, false otherwise (event ignored).
     */
    send(event) {
        // Input validation (basic)
        if (!event || typeof event.type !== 'string') {
            // Optional: Log error for invalid event structure
            // console.error('TurnStateMachine.send: Received invalid event object:', event);
            return false;
        }
        // Delegate the core logic to the private transition method
        return this.#transition(event);
    }

    /**
     * Asserts that the state machine is currently handling a turn for the specified actor ID.
     * Throws an error if the machine is in an active turn state (Prompting, WaitingForCommand,
     * ProcessingCommand) but the provided actorId does not match the internally stored one.
     * Does nothing if the machine is Idle or Ending, or if the actor IDs match during an active turn.
     *
     * @public
     * @param {string} actorId - The actor ID expected to be currently active.
     * @throws {Error} If the assertion fails (active turn for a different actor).
     * @returns {void}
     */
    assertActor(actorId) {
        const activeTurnStates = [
            TurnState.PROMPTING,
            TurnState.WAITING_FOR_COMMAND,
            TurnState.PROCESSING_COMMAND,
        ];

        // Only perform the check if the machine is in an active turn state
        if (activeTurnStates.includes(this.#currentState)) {
            // Check for mismatch
            if (this.#currentActorId !== actorId) {
                const errorMessage = `TurnStateMachineError: Actor assertion failed. Expected '${this.#currentActorId}' but received '${actorId}' in state '${this.#currentState}'.`;
                // Optional: Log the error before throwing
                // console.error(errorMessage);
                throw new Error(errorMessage);
            }
            // If IDs match in an active state, do nothing (assertion passes)
        }
        // If state is Idle or Ending, do nothing (assertion passes implicitly)
    }


    // --- Private Core Logic ---

    /**
     * Processes an incoming event and attempts to transition the state machine.
     * This is the core logic determining the next state based on the current
     * state and the event received. It handles storing/clearing actorId and
     * triggers the automatic transition from Ending to Idle.
     *
     * @private
     * @param {TurnEvent} event - The event object to process.
     * @returns {boolean} Returns true if a state transition occurred, false otherwise.
     */
    #transition(event) {
        const previousState = this.#currentState;
        let nextState = this.#currentState; // Assume no change by default

        // Handle DESTROY event globally, as it resets the machine regardless of current state
        if (event.type === 'DESTROY') {
            nextState = TurnState.IDLE;
            this.#currentActorId = null; // Clear actor ID on destroy
            this.#currentState = nextState;
            // Ensure state change happens before returning
            const didChangeOnDestroy = previousState !== nextState;
            return didChangeOnDestroy;
        }

        // State-specific transition logic
        switch (this.#currentState) {
            case TurnState.IDLE:
                if (event.type === 'START') {
                    // Cast event to the specific type to safely access payload
                    const startEvent = /** @type {TurnEvent_START} */ (event);
                    if (startEvent.payload?.actorId) {
                        nextState = TurnState.PROMPTING;
                        this.#currentActorId = startEvent.payload.actorId; // Store actor ID
                    } else {
                        // Optional: Log error about missing actorId in START event payload
                        // console.error('TurnStateMachine: START event missing actorId payload.');
                    }
                }
                break;

            case TurnState.PROMPTING:
                if (event.type === 'PROMPT_SUCCESS') {
                    nextState = TurnState.WAITING_FOR_COMMAND;
                } else if (event.type === 'PROMPT_FAILURE') {
                    nextState = TurnState.ENDING;
                    // *** ADDED FIX HERE ***
                } else if (event.type === 'FORCE_END') {
                    nextState = TurnState.ENDING;
                    // *** END FIX ***
                }
                break;

            case TurnState.WAITING_FOR_COMMAND:
                if (event.type === 'COMMAND') {
                    // Ensure payload exists (though type implies it should)
                    // Correctly check for the existence of commandString property
                    if (event.payload && event.payload.commandString !== undefined) {
                        nextState = TurnState.PROCESSING_COMMAND;
                    } else {
                        // Optional: Log error about missing commandString
                        // console.error('TurnStateMachine: COMMAND event missing commandString payload.');
                    }
                } else if (event.type === 'FORCE_END') {
                    nextState = TurnState.ENDING;
                }
                break;

            case TurnState.PROCESSING_COMMAND:
                if (event.type === 'PROCESS_RESULT') {
                    // Cast event to the specific type to safely access payload
                    const processResultEvent = /** @type {TurnEvent_PROCESS_RESULT} */ (event);
                    // Correctly check for the existence of directive property
                    if (processResultEvent.payload?.directive) {
                        if (processResultEvent.payload.directive === TurnDirective.RE_PROMPT) {
                            nextState = TurnState.PROMPTING;
                        } else {
                            // Any other directive (END_TURN_SUCCESS, END_TURN_FAILURE) leads to Ending
                            nextState = TurnState.ENDING;
                        }
                    } else {
                        // Optional: Log error about missing directive
                        // console.error('TurnStateMachine: PROCESS_RESULT event missing directive payload.');
                        // Decide how to handle malformed event - maybe transition to Ending? For now, ignore.
                    }
                } else if (event.type === 'FORCE_END') {
                    nextState = TurnState.ENDING;
                }
                break;

            case TurnState.ENDING:
                // No transitions *out* of Ending except the automatic one to Idle,
                // which is handled after the state update below.
                // We also ignore DESTROY here because it's handled globally above.
                break;

            // Default case: If none of the above match, state remains unchanged (nextState === this.#currentState)
        }

        // --- Update State & Handle Automatic Ending Transition ---
        const didChange = previousState !== nextState;
        if (didChange) {
            this.#currentState = nextState;
            // Optional: Log the transition
            // console.debug(`TurnStateMachine: Transitioned [${previousState}] -> [${this.#currentState}] on event [${event.type}] for actor [${this.#currentActorId}]`);

            // If we entered the Ending state, immediately trigger the cleanup and transition to Idle
            if (this.#currentState === TurnState.ENDING) {
                this.#_enterEndingState();
            }
        } else {
            // Optional: Log ignored event
            // console.debug(`TurnStateMachine: Ignored event [${event.type}] in state [${this.#currentState}] for actor [${this.#currentActorId}]`);
        }

        return didChange;
    }

    /**
     * Handles the automatic cleanup and transition required upon entering the Ending state.
     * This ensures the machine always settles in Idle after a turn concludes.
     * @private
     */
    #_enterEndingState() {
        // Optional: Log this specific automatic transition
        // console.debug(`TurnStateMachine: Auto-transitioning [${TurnState.ENDING}] -> [${TurnState.IDLE}] and clearing actor [${this.#currentActorId}]`);
        this.#currentActorId = null; // Clear the actor ID
        this.#currentState = TurnState.IDLE; // Transition to Idle
    }
}

export default TurnStateMachine;