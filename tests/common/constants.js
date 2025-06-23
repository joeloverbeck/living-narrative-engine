/**
 * Default world name used across test suites.
 *
 * @type {string}
 */
export const DEFAULT_TEST_WORLD = 'TestWorld';

/**
 * Default active world used when validating save-related dispatches.
 *
 * @type {string}
 */
export const DEFAULT_ACTIVE_WORLD_FOR_SAVE = 'TestWorldForSaving';

/**
 * Default save name used across test suites for saving games.
 *
 * @type {string}
 */
export const DEFAULT_SAVE_NAME = 'MySaveFile';

/**
 * Default save identifier used across test suites for loading games.
 *
 * @type {string}
 */
export const DEFAULT_SAVE_ID = 'savegame-001.sav';
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

/**
 * Message when a save operation completes successfully.
 *
 * @type {string}
 */
export const SAVE_OPERATION_FINISHED_MESSAGE =
  'Save operation finished. Ready.';
