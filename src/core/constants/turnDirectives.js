// src/core/constants/turnDirectives.js
// --- FILE START ---

/**
 * @fileoverview Defines constants for turn directives used by CommandOutcomeInterpreter.
 */

/**
 * @enum {string}
 * @readonly
 * @description Directives indicating the result of interpreting a command outcome.
 * Used to guide the PlayerTurnHandler on whether to end the turn or re-prompt.
 */
const TurnDirective = {
    /** Indicates the turn ended successfully after the command. */
    END_TURN_SUCCESS: 'END_TURN_SUCCESS',

    /** Indicates the turn ended due to a failure/error in the command. */
    END_TURN_FAILURE: 'END_TURN_FAILURE',

    /** Indicates the command completed, but the turn should continue (prompt again). */
    RE_PROMPT: 'RE_PROMPT'
};

// Ensure the object is immutable
Object.freeze(TurnDirective);

export default TurnDirective;
// --- FILE END ---