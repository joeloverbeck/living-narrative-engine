/**
 * @fileoverview Defines the possible states for the TurnStateMachine.
 */

/**
 * @enum {string}
 * @readonly
 * @description Represents the distinct operational states of the TurnStateMachine.
 * - IDLE: The machine is inactive, waiting for a turn to start.
 * - PROMPTING: The machine is actively trying to determine and send available actions to the actor.
 * - WAITING_FOR_COMMAND: The machine has successfully prompted and is waiting for a command input.
 * - PROCESSING_COMMAND: The machine has received a command and is processing it.
 * - ENDING: The turn is concluding, either successfully or due to failure/interruption.
 */
const TurnState = {
    IDLE: 'Idle',
    PROMPTING: 'Prompting',
    WAITING_FOR_COMMAND: 'WaitingForCommand',
    PROCESSING_COMMAND: 'ProcessingCommand',
    ENDING: 'Ending', // A terminal state reached before transitioning back to IDLE
};

// Ensure the object is immutable
Object.freeze(TurnState);

export default TurnState;