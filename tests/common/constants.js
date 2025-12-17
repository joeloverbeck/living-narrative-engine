/**
 * Default world name used across test suites.
 *
 * @type {string}
 */
export const DEFAULT_TEST_WORLD = 'TestWorld';

//
// Recurring test messages
//
/**
 * Message displayed when the engine is ready.
 *
 * @type {string}
 */
export const ENGINE_READY_MESSAGE = 'Enter command...';

/**
 * Message dispatched when the engine stops.
 *
 * @type {string}
 */
export const ENGINE_STOPPED_MESSAGE = 'Game stopped. Engine is inactive.';

/**
 * Warning message used when an invalid note is encountered.
 *
 * @type {string}
 */
export const INVALID_NOTE_SKIPPED_MESSAGE =
  'NotesPersistenceHook: Invalid note skipped';

/**
 * Error message for an unknown initialization failure.
 *
 * @type {string}
 */
export const UNKNOWN_INIT_ERROR_MESSAGE =
  'Overall initialization failed. Error: Unknown error occurred';

/**
 * Error thrown when a logger lacks an "info" method.
 *
 * @type {string}
 */
export const LOGGER_INFO_METHOD_ERROR =
  "Invalid or missing method 'info' on dependency 'logger'.";
