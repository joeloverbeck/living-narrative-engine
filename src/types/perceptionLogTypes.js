// src/types/perceptionLogTypes.js

/**
 * @typedef {Object} RawPerceptionLogEntry
 * @description Represents a single entry as it might come from the game state or entity component.
 * @property {string} [descriptionText] - The main textual content of the log entry.
 * @property {string} [perceptionType] - The category of the perceived event.
 * @property {string} [timestamp] - When the event occurred.
 * @property {string} [eventId] - Unique ID for the event or log entry.
 * @property {string} [actorId] - ID of the entity that caused the event.
 * @property {string} [targetId] - Optional ID of the primary target.
 * // ... any other properties from the original log entry schema
 */

/**
 * @typedef {Object} FormattedPerceptionEntry
 * @description Represents a perception log entry after formatting for prompt data.
 * @property {string} content - The main textual content of the log entry.
 * @property {string} [timestamp] - When the event occurred.
 * @property {string} [type] - The category of the perceived event.
 * @property {string} [eventId] - Unique ID for the event or log entry.
 * @property {string} [actorId] - ID of the entity that caused the event.
 * @property {string} [targetId] - Optional ID of the primary target.
 * // Add other passthrough properties if they might be used by custom placeholders
 */
