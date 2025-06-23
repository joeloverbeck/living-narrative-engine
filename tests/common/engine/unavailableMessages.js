/**
 * @file Contains shared error messages for service unavailability in engine tests.
 */

/**
 * Error message when GamePersistenceService is missing for showLoadGameUI.
 *
 * @type {string}
 */
export const GAME_PERSISTENCE_LOAD_UI_UNAVAILABLE =
  'GameEngine.showLoadGameUI: GamePersistenceService is unavailable. Cannot show Load Game UI.';

/**
 * Error message when GamePersistenceService is missing for showSaveGameUI.
 *
 * @type {string}
 */
export const GAME_PERSISTENCE_SAVE_UI_UNAVAILABLE =
  'GameEngine.showSaveGameUI: GamePersistenceService is unavailable. Cannot show Save Game UI.';

/**
 * Error message when GamePersistenceService is not available for loadGame.
 *
 * @type {string}
 */
export const GAME_PERSISTENCE_LOAD_GAME_UNAVAILABLE =
  'GameEngine.loadGame: GamePersistenceService is not available. Cannot load game.';

/**
 * Error message when GamePersistenceService is not available for triggerManualSave.
 *
 * @type {string}
 */
export const GAME_PERSISTENCE_TRIGGER_SAVE_UNAVAILABLE =
  'GameEngine.triggerManualSave: GamePersistenceService is not available. Cannot save game.';

/**
 * Failure message returned when GamePersistenceService is absent during manual save.
 *
 * @type {string}
 */
export const GAME_PERSISTENCE_SAVE_RESULT_UNAVAILABLE =
  'GamePersistenceService is not available. Cannot save game.';

/**
 * Warning message when PlaytimeTracker is not available during engine stop.
 *
 * @type {string}
 */
export const PLAYTIME_TRACKER_STOP_UNAVAILABLE =
  'GameEngine.stop: PlaytimeTracker service not available, cannot end session.';
