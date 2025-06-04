// src/interfaces/IPerceptionLogFormatter.js
// --- FILE START ---

/**
 * @typedef {import('../services/PerceptionLogFormatter.js').RawPerceptionLogEntry} RawPerceptionLogEntry
 * @description Represents a single entry as it might come from the game state or entity component.
 * This typedef is expected to be defined in PerceptionLogFormatter.js or a central types file.
 * @property {string} [descriptionText] - The main textual content of the log entry.
 * @property {string} [perceptionType] - The category of the perceived event.
 * @property {string} [timestamp] - When the event occurred.
 * @property {string} [eventId] - Unique ID for the event or log entry.
 * @property {string} [actorId] - ID of the entity that caused the event.
 * @property {string} [targetId] - Optional ID of the primary target.
 * // ... any other properties from the original log entry schema
 */

/**
 * @typedef {import('../services/PerceptionLogFormatter.js').FormattedPerceptionEntry} FormattedPerceptionEntry
 * @description Represents a perception log entry after formatting for prompt data.
 * This typedef is expected to be defined in PerceptionLogFormatter.js or a central types file.
 * @property {string} content - The main textual content of the log entry.
 * @property {string} [timestamp] - When the event occurred.
 * @property {string} [type] - The category of the perceived event.
 * @property {string} [eventId] - Unique ID for the event or log entry.
 * @property {string} [actorId] - ID of the entity that caused the event.
 * @property {string} [targetId] - Optional ID of the primary target.
 * // Add other passthrough properties if they might be used by custom placeholders
 */

/**
 * @interface IPerceptionLogFormatter
 * @description Defines the contract for a service that transforms raw perception log entries.
 */
export class IPerceptionLogFormatter {
  /**
   * Transforms an array of raw perception log entries.
   *
   * @param {RawPerceptionLogEntry[]} rawLogEntries - The raw perception log entries from game state.
   * @returns {FormattedPerceptionEntry[]} The formatted perception log entries.
   * @throws {Error} If the method is not implemented.
   */
  format(rawLogEntries) {
    throw new Error("Method 'format()' must be implemented.");
  }
}

// --- FILE END ---
