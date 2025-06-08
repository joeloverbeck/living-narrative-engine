// src/turns/constants/eventIds.js

// Existing Event IDs
export const NEW_GAME_STARTED_ID = 'core:new_game_started';
export const LOADED_GAME_STARTED_ID = 'core:loaded_game_started';
export const GAME_STOPPED_ID = 'core:game_stopped';
export const GAME_LOADED_ID = 'core:game_loaded';
export const GAME_SAVED_ID = 'core:game_saved';
export const TURN_STARTED_ID = 'core:turn_started';
export const TURN_ENDED_ID = 'core:turn_ended';
export const SYSTEM_WARNING_OCCURRED_ID = 'core:system_warning_occurred';
export const SYSTEM_ERROR_OCCURRED_ID = 'core:system_error_occurred';
export const PLAYER_TURN_SUBMITTED_ID = 'core:player_turn_submitted';
export const DISPLAY_ERROR_ID = 'core:display_error';
export const DISPLAY_WARNING_ID = 'core:display_warning';
export const ENTITY_SPOKE_ID = 'core:entity_spoke';
export const DISPLAY_MESSAGE_ID = 'core:display_message';
export const DISPLAY_SPEECH_ID = 'core:display_speech';
export const AI_TURN_PROCESSING_STARTED = 'core:ai_turn_processing_started';
export const AI_TURN_PROCESSING_ENDED = 'core:ai_turn_processing_ended';

// New Event IDs for GameEngine to UI communication (GE-REFAC-006)

/**
 * Signals the engine is starting to initialize a world.
 * The UI can use this to display an initial loading message.
 *
 * @event ENGINE_INITIALIZING_UI
 * @type {string}
 * @constant
 * @example
 * // Payload structure:
 * // {
 * //   worldName: string // The name of the world being initialized.
 * // }
 */
export const ENGINE_INITIALIZING_UI = 'core:ui_initializing';

/**
 * Signals the engine has initialized (or loaded) and is ready for user input.
 * The UI can use this to update its state, set the game title, and enable input.
 *
 * @event ENGINE_READY_UI
 * @type {string}
 * @constant
 * @example
 * // Payload structure:
 * // {
 * //   activeWorld: string | null, // The name of the currently active world, or null if none.
 * //   message: string           // A message to display, e.g., to enable input prompt.
 * // }
 */
export const ENGINE_READY_UI = 'core:ui_ready';

/**
 * Signals a potentially blocking engine operation is underway.
 * The UI should indicate this status and typically disable user input.
 *
 * @event ENGINE_OPERATION_IN_PROGRESS_UI
 * @type {string}
 * @constant
 * @example
 * // Payload structure:
 * // {
 * //   titleMessage: string,         // Message to display as a title or primary status.
 * //   inputDisabledMessage: string  // Message to show when disabling input, explaining why.
 * // }
 */
export const ENGINE_OPERATION_IN_PROGRESS_UI = 'core:ui_operation_in_progress';

/**
 * Signals a significant engine operation has failed.
 * The UI should display the error and ensure input remains disabled or is re-disabled.
 *
 * @event ENGINE_OPERATION_FAILED_UI
 * @type {string}
 * @constant
 * @example
 * // Payload structure:
 * // {
 * //   errorMessage: string, // Detailed error message for the user.
 * //   errorTitle: string    // A concise title for the error dialog or message area.
 * // }
 */
export const ENGINE_OPERATION_FAILED_UI = 'core:ui_operation_failed';

/**
 * Signals the engine has been stopped.
 * The UI should update its status accordingly and disable input.
 *
 * @event ENGINE_STOPPED_UI
 * @type {string}
 * @constant
 * @example
 * // Payload structure:
 * // {
 * //   inputDisabledMessage: string // Message to show when disabling input.
 * // }
 */
export const ENGINE_STOPPED_UI = 'core:ui_stopped';

/**
 * Signals a request from the engine to display a general informational or error message to the user.
 * This is for messages not tied to a specific blocking operation's start/end/failure.
 *
 * @event ENGINE_MESSAGE_DISPLAY_REQUESTED
 * @type {string}
 * @constant
 * @example
 * // Payload structure:
 * // {
 * //   message: string,                            // The message content to display.
 * //   type: 'info' | 'error' | 'fatal' | 'warning' // The type of message, for appropriate UI styling.
 * // }
 */
export const ENGINE_MESSAGE_DISPLAY_REQUESTED =
  'core:ui_message_display_requested';

/**
 * Signals a request from the engine to show the save game interface.
 * The UI manager should handle the presentation of the save game UI.
 *
 * @event REQUEST_SHOW_SAVE_GAME_UI
 * @type {string}
 * @constant
 * @example
 * // Payload structure: {} (empty object)
 * // No specific data is sent with this event; its occurrence is the signal.
 */
export const REQUEST_SHOW_SAVE_GAME_UI = 'core:ui_request_show_save_game';

/**
 * Signals a request from the engine to show the load game interface.
 * The UI manager should handle the presentation of the load game UI.
 *
 * @event REQUEST_SHOW_LOAD_GAME_UI
 * @type {string}
 * @constant
 * @example
 * // Payload structure: {} (empty object)
 * // No specific data is sent with this event; its occurrence is the signal.
 */
export const REQUEST_SHOW_LOAD_GAME_UI = 'core:ui_request_show_load_game';

/**
 * Signals that saving the game is currently not allowed.
 * The UI should inform the user why saving is disabled (e.g., game not initialized, critical state).
 * The specific message can be static or determined by the UI manager based on this event.
 *
 * @event CANNOT_SAVE_GAME_INFO
 * @type {string}
 * @constant
 * @example
 * // Payload structure: {} (empty object)
 * // No specific data is sent with this event; its occurrence is the signal.
 * // The UI manager is expected to provide the appropriate user feedback.
 */
export const CANNOT_SAVE_GAME_INFO = 'core:ui_cannot_save_game_info';
