// src/constants/textDefaults.js
// --- FILE START ---

/**
 * @file Defines common default and fallback strings used across the application,
 * particularly for AI prompt generation and data extraction.
 */

// --- Entity and Attribute Fallbacks (RAW, punctuation to be applied by context if needed) ---
export const DEFAULT_FALLBACK_CHARACTER_NAME = "Unnamed Character";
export const DEFAULT_FALLBACK_LOCATION_NAME = "Unnamed Location";
export const DEFAULT_FALLBACK_EXIT_DIRECTION = "Unmarked Exit"; // e.g. for exits in AIGameStateProvider

// Descriptions are generally raw, and ensureTerminalPunctuation utility should be used by the consumer.
export const DEFAULT_FALLBACK_DESCRIPTION_RAW = "No description available";
export const DEFAULT_FALLBACK_EVENT_DESCRIPTION_RAW = "Undescribed event";
export const DEFAULT_FALLBACK_ACTION_DESCRIPTION_RAW = "No specific description";

// --- Action Specific Fallbacks ---
export const DEFAULT_FALLBACK_ACTION_ID = "unknown:id";
export const DEFAULT_FALLBACK_ACTION_COMMAND = "unknown_command";
export const DEFAULT_FALLBACK_ACTION_NAME = "Unnamed Action";

// --- AIPromptFormatter: General Informational/Empty State Messages (typically fully punctuated) ---
export const PROMPT_FALLBACK_UNKNOWN_LOCATION = "Your current location is unknown.";
export const PROMPT_FALLBACK_NO_EXITS = "There are no obvious exits.";
export const PROMPT_FALLBACK_ALONE_IN_LOCATION = "You are alone here.";
export const PROMPT_FALLBACK_NO_ACTIONS_NARRATIVE = "You have no specific actions immediately apparent. Consider what your character would do in this situation; you might wait, observe, or reflect.";

// --- AIPromptFormatter: Character Segment Specific Messages (typically fully punctuated) ---
export const PROMPT_FALLBACK_UNKNOWN_CHARACTER_DETAILS = "Your character details are unknown.";
export const PROMPT_FALLBACK_ACTOR_PROMPT_DATA_UNAVAILABLE = "Your character's pre-processed details (actorPromptData) are unavailable. Using minimal info.";
export const PROMPT_FALLBACK_MINIMAL_CHARACTER_DETAILS = "Your character details are minimal or unknown.";

// --- AIPromptFormatter: Error Messages (typically fully punctuated) ---
export const ERROR_FALLBACK_CRITICAL_GAME_STATE_MISSING = "Error: Critical game state information is missing. Cannot generate LLM prompt.";

// --- AIGameStateProvider: Default for _getComponentText if no specific fallback applies ---
// This is more for internal robust data fetching before specific DTO fallbacks are applied.
export const DEFAULT_COMPONENT_VALUE_NA = "N/A";


// --- FILE END ---