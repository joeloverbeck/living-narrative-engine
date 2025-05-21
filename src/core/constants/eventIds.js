// src/core/constants/eventIds.js

// export const GAME_STARTED_ID = 'core:game_started'; // Removed
export const NEW_GAME_STARTED_ID = 'core:new_game_started'; // Added
export const LOADED_GAME_STARTED_ID = 'core:loaded_game_started'; // Added
export const GAME_STOPPED_ID = 'core:game_stopped';
export const GAME_LOADED_ID = 'core:game_loaded'; // Note: This event seems to signify the completion of data loading. LOADED_GAME_STARTED_ID signifies the game logic has started post-load. Ensure their distinction is clear in your system.
export const GAME_SAVED_ID = 'core:game_saved';
export const TURN_STARTED_ID = 'core:turn_started';
export const TURN_ENDED_ID = 'core:turn_ended';
export const SYSTEM_ERROR_OCCURRED_ID = 'core:system_error_occurred';
export const PLAYER_TURN_SUBMITTED_ID = 'core:player_turn_submitted';
export const ENTITY_SPOKE_ID = 'core:entity_spoke';