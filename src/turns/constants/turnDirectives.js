// src/turns/constants/turnDirectives.js
// --- FILE START ---
/**
 * @file Defines constants for turn directives used by CommandOutcomeInterpreter.
 */

import { freeze } from '../../../tests/utils/objectUtils';

/**
 * @enum {string}
 * @readonly
 * @description Directives indicating the result of interpreting a command outcome.
 * Used to guide the PlayerTurnHandler on whether to end the turn, re-prompt,
 * or wait for an external event.
 */
const TurnDirective = {
  /** Indicates the turn ended successfully after the command. */
  END_TURN_SUCCESS: 'END_TURN_SUCCESS',

  /** Indicates the turn ended due to a failure/error in the command. */
  END_TURN_FAILURE: 'END_TURN_FAILURE',

  /** Indicates the command completed, but the turn should continue (prompt again). */
  RE_PROMPT: 'RE_PROMPT',

  /** Indicates the handler must wait for a `core:turn_ended` event before ending the turn. */
  WAIT_FOR_EVENT: 'WAIT_FOR_EVENT',
};

// Freeze the object to prevent modification.
freeze(TurnDirective);

export default TurnDirective;
