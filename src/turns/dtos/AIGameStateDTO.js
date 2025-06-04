// src/turns/dtos/AIGameStateDTO.js
// --- FILE START ---

/**
 * @file Defines Data Transfer Objects (DTOs) used for representing game state
 * information for AI decision-making. These DTOs serve as a structured contract
 * between the game state gathering component and the prompt formatting component.
 */

/**
 * Purpose: Represents a single exit from a location.
 * @typedef {object} AILocationExitDTO
 * @property {string} direction - The direction of the exit (e.g., "north", "south-east").
 * @property {string} targetLocationId - The instance ID of the location this exit leads to.
 * @property {string} [targetLocationName] - Optional. The name of the target location. (Added to support prompt requirements)
 * @property {string} [description] - Optional. e.g., "a dark archway". (Future consideration)
 * @property {boolean} [isLocked] - Optional. If the exit is known to be locked. (Future consideration)
 */

/**
 * Purpose: Represents another character present in the same location as the AI actor.
 * @typedef {object} AICharacterInLocationDTO
 * @property {string} id - The unique ID of the character.
 * @property {string} name - The name of the character.
 * @property {string} description - A brief description of the character.
 * @property {string} [attitude] - Optional. e.g., "friendly", "hostile". (Future consideration)
 */

/**
 * Purpose: Summarizes the AI actor's current location.
 * @typedef {object} AILocationSummaryDTO
 * @property {string} name - The name of the location.
 * @property {string} description - A textual description of the location.
 * @property {AILocationExitDTO[]} exits - An array of available exits.
 * @property {AICharacterInLocationDTO[]} characters - An array of other characters in the location.
 * @property {string[]} [items] - Optional. Summary of notable items. (Future consideration)
 */

/**
 * Purpose: Represents a single entry from the AI actor's perception log.
 * @typedef {object} AIPerceptionLogEntryDTO
 * @property {string} description - The textual description of the perceived event.
 * @property {number} timestamp - The game timestamp of the perception (could be relative time later).
 * @property {string} type - The type of perception (e.g., "sight", "sound", "action_result").
 */

/**
 * Purpose: Represents an action available to the AI actor.
 * @typedef {object} AIAvailableActionDTO
 * @property {string} id - The definition ID of the action (e.g., "core:move", "skill:attack").
 * @property {string} command - The command string the AI would use (e.g., "move north", "attack goblin").
 * @property {string} name - A human-readable name for the action (e.g., "Move North", "Attack").
 * @property {string} description - A detailed description of the action's effect or purpose.
 * @property {string} [targetType] - Optional. e.g., "character", "item", "direction". (Future consideration)
 * @property {boolean} [requiresTarget] - Optional. If the action needs a target. (Future consideration)
 */

/**
 * Purpose: Represents the raw AI actor's state relevant for decision making,
 * mirroring the component data structure expected by the current AIPromptFormatter._formatCharacterSegment.
 * This will be refined or replaced by ActorPromptDataDTO in later refactoring stages.
 * @typedef {object} AIActorStateDTO
 * @property {string} id - The AI actor's unique ID.
 * // Other properties are dynamic, based on component IDs like NAME_COMPONENT_ID,
 * // PERSONALITY_COMPONENT_ID, etc. Their values are typically objects like { text: "value" }
 * // or { patterns: ["pattern1", "pattern2"] } for speech patterns.
 * @property {object} [core:name] - Component data for name.
 * @property {object} [core:description] - Component data for description.
 * @property {object} [core:personality] - Component data for personality.
 * @property {object} [core:profile] - Component data for profile.
 * @property {object} [core:likes] - Component data for likes.
 * @property {object} [core:dislikes] - Component data for dislikes.
 * @property {object} [core:secrets] - Component data for secrets.
 * @property {object} [core:fears] - Component data for fears.
 * @property {object} [core:speech_patterns] - Component data for speech patterns.
 */

/**
 * @typedef {import('./AIActorPromptDataDTO.js').ActorPromptDataDTO} ActorPromptDataDTO // Assuming path - Note: ActorPromptDataDTO is defined below in this file.
 */
/**
 * Purpose: The top-level DTO that aggregates all other AI-relevant state information.
 * This is the primary object passed to the prompt formatter.
 * @typedef {object} AIGameStateDTO
 * @property {AIActorStateDTO} actorState - The AI actor's own raw state (still needed for other systems potentially).
 * @property {ActorPromptDataDTO} actorPromptData - Pre-processed character data for prompt generation.
 * @property {AILocationSummaryDTO | null} currentLocation - Summary of the current location, or null if unknown.
 * @property {AIPerceptionLogEntryDTO[]} perceptionLog - Array of recent perceptions.
 * @property {AIAvailableActionDTO[]} availableActions - Array of actions the AI can currently take.
 * @property {object} [worldStateSummary] - Optional. e.g., time of day, weather. (Future consideration)
 * @property {string[]} [missionBriefing] - Optional. Current objectives for the AI. (Future consideration)
 */

/**
 * @typedef {object} ActorPromptDataDTO
 * @property {string} name - The character's name, defaulting if not set (e.g., "Unnamed Character").
 * @property {string} description - The character's description, punctuated and defaulted if not set (e.g., "No description available.").
 * @property {string} [personality] - Optional. The character's personality traits.
 * @property {string} [profile] - Optional. The character's profile information.
 * @property {string} [likes] - Optional. Things the character likes.
 * @property {string} [dislikes] - Optional. Things the character dislikes.
 * @property {string} [secrets] - Optional. Secrets the character might have.
 * @property {string} [fears] - Optional. Things the character fears.
 * @property {string[]} [speechPatterns] - Optional. An array of trimmed, valid speech patterns. An empty array or undefined if no valid patterns exist.
 */

// To make this file a module and allow JSDoc types to be potentially imported
// or recognized by some tooling that expects modules (e.g. for type checking or intellisense).
export {};

// --- FILE END ---
