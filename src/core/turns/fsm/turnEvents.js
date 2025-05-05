/**
 * @fileoverview Defines the event types and their associated payloads used to
 * drive transitions within the TurnStateMachine.
 */

// --- Type Imports for JSDoc Payloads ---
// Adjust the relative path as necessary based on your project structure.
/** @typedef {import('../../constants/turnDirectives.js').default} TurnDirective */ // Assuming TurnDirective is the default export

// --- Event Type Definitions ---

/**
 * @typedef {object} TurnEventPayload_START
 * @property {string} actorId - The unique identifier of the entity whose turn is starting.
 */
/**
 * @typedef {object} TurnEvent_START
 * @property {'START'} type - The event type identifier.
 * @property {TurnEventPayload_START} payload - Data associated with the START event.
 * @description Event dispatched to initiate a new turn for a specific actor.
 */

/**
 * @typedef {object} TurnEvent_PROMPT_SUCCESS
 * @property {'PROMPT_SUCCESS'} type - The event type identifier.
 * @description Event dispatched when the actor has been successfully prompted with available actions.
 * Indicates the machine should now wait for input.
 */

/**
 * @typedef {object} TurnEventPayload_PROMPT_FAILURE
 * @property {Error} error - The error object encountered during the prompting process.
 */
/**
 * @typedef {object} TurnEvent_PROMPT_FAILURE
 * @property {'PROMPT_FAILURE'} type - The event type identifier.
 * @property {TurnEventPayload_PROMPT_FAILURE} payload - Data associated with the PROMPT_FAILURE event.
 * @description Event dispatched when prompting the actor failed (e.g., action discovery error).
 */

/**
 * @typedef {object} TurnEventPayload_COMMAND
 * @property {string} commandString - The raw command string submitted by the actor.
 */
/**
 * @typedef {object} TurnEvent_COMMAND
 * @property {'COMMAND'} type - The event type identifier.
 * @property {TurnEventPayload_COMMAND} payload - Data associated with the COMMAND event.
 * @description Event dispatched when a command input is received for the current actor.
 */

/**
 * @typedef {object} TurnEventPayload_PROCESS_RESULT
 * @property {TurnDirective[keyof TurnDirective]} directive - The turn directive determined by the CommandOutcomeInterpreter
 * (e.g., END_TURN_SUCCESS, RE_PROMPT).
 */
/**
 * @typedef {object} TurnEvent_PROCESS_RESULT
 * @property {'PROCESS_RESULT'} type - The event type identifier.
 * @property {TurnEventPayload_PROCESS_RESULT} payload - Data associated with the PROCESS_RESULT event.
 * @description Event dispatched after a command has been processed, carrying the outcome directive.
 */

/**
 * @typedef {object} [TurnEventPayload_FORCE_END]
 * @property {any} [reason] - Optional reason for forcing the turn to end (e.g., timeout, external interruption).
 */
/**
 * @typedef {object} TurnEvent_FORCE_END
 * @property {'FORCE_END'} type - The event type identifier.
 * @property {TurnEventPayload_FORCE_END} [payload] - Optional data associated with the FORCE_END event.
 * @description Event dispatched to prematurely end the current turn, outside the normal command processing flow.
 */

/**
 * @typedef {object} TurnEvent_DESTROY
 * @property {'DESTROY'} type - The event type identifier.
 * @description Event dispatched when the state machine instance is being destroyed or shut down.
 * Used for cleanup and potentially forcing an end state.
 */


// --- Union Event Type ---

/**
 * @typedef {
 * TurnEvent_START |
 * TurnEvent_PROMPT_SUCCESS |
 * TurnEvent_PROMPT_FAILURE |
 * TurnEvent_COMMAND |
 * TurnEvent_PROCESS_RESULT |
 * TurnEvent_FORCE_END |
 * TurnEvent_DESTROY
 * } TurnEvent
 * @description A union type representing any possible event that the TurnStateMachine can receive.
 */

// Note: No value is exported from this file, it only serves to define JSDoc types.
// If using TypeScript, you would export the types/interfaces.
// For JSDoc, ensure your jsconfig.json or tsconfig.json allows JS files and
// configure your IDE/linter to recognize these JSDoc types globally or via imports.