// src/services/perceptionLogFormatter.js
// --- FILE START ---

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/IPerceptionLogFormatter.js').IPerceptionLogFormatter} IPerceptionLogFormatter */

/**
 * @typedef {object} RawPerceptionLogEntry
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
 * @typedef {object} FormattedPerceptionEntry
 * @description Represents a perception log entry after formatting for prompt data.
 * @property {string} content - The main textual content of the log entry.
 * @property {string} [timestamp] - When the event occurred.
 * @property {string} [type] - The category of the perceived event.
 * @property {string} [eventId] - Unique ID for the event or log entry.
 * @property {string} [actorId] - ID of the entity that caused the event.
 * @property {string} [targetId] - Optional ID of the primary target.
 * // Add other passthrough properties if they might be used by custom placeholders
 */

/**
 * @class PerceptionLogFormatter
 * @description Transforms raw perception log entries into a format suitable for prompt data.
 * @implements {IPerceptionLogFormatter}
 */
export class PerceptionLogFormatter {
  /** @type {ILogger} */
  #logger;

  /**
   * @param {object} dependencies
   * @param {ILogger} dependencies.logger
   */
  constructor({ logger }) {
    if (!logger) {
      throw new Error('PerceptionLogFormatter: Logger dependency is required.');
    }
    this.#logger = logger;
    this.#logger.debug('PerceptionLogFormatter initialized.');
  }

  /**
   * Transforms an array of raw perception log entries.
   * @param {RawPerceptionLogEntry[]} rawLogEntries - The raw perception log entries from game state.
   * @returns {FormattedPerceptionEntry[]} The formatted perception log entries.
   */
  format(rawLogEntries) {
    if (!rawLogEntries || !Array.isArray(rawLogEntries)) {
      this.#logger.warn(
        'PerceptionLogFormatter.format: rawLogEntries is not a valid array or is null/undefined. Returning empty array.'
      );
      return [];
    }
    this.#logger.debug(
      `PerceptionLogFormatter.format attempting to process ${rawLogEntries.length} entries.`
    );

    return rawLogEntries
      .map((rawEntry) => {
        if (!rawEntry || typeof rawEntry !== 'object') {
          this.#logger.warn(
            `PerceptionLogFormatter.format: Invalid raw perception log entry skipped: ${JSON.stringify(rawEntry)}`
          );
          return null; // Mark for filtering
        }

        const mappedEntry = {
          content: rawEntry.descriptionText || '', // Map descriptionText to content
          timestamp: rawEntry.timestamp, // Pass through timestamp
          type: rawEntry.perceptionType, // Map perceptionType to type
          eventId: rawEntry.eventId,
          actorId: rawEntry.actorId,
          targetId: rawEntry.targetId,
          // Include other raw properties if they might be used by custom placeholders in perception_log_entry config
        };

        if (typeof mappedEntry.timestamp === 'undefined') {
          this.#logger.warn(
            `PerceptionLogFormatter.format: Perception log entry (event ID: ${rawEntry.eventId || 'N/A'}) missing 'timestamp'. Placeholder {timestamp} may not resolve correctly. Original entry: ${JSON.stringify(rawEntry)}`
          );
        }
        if (typeof mappedEntry.type === 'undefined') {
          this.#logger.warn(
            `PerceptionLogFormatter.format: Perception log entry (event ID: ${rawEntry.eventId || 'N/A'}) missing 'perceptionType' (for 'type'). Placeholder {type} may not resolve correctly. Original entry: ${JSON.stringify(rawEntry)}`
          );
        }
        // If 'content' is empty after mapping, PromptBuilder will handle it by outputting an empty string.
        if (mappedEntry.content === '') {
          this.#logger.debug(
            `PerceptionLogFormatter.format: Perception log entry (event ID: ${rawEntry.eventId || 'N/A'}) resulted in empty 'content' after mapping from 'descriptionText'. Original entry: ${JSON.stringify(rawEntry)}`
          );
        }

        return mappedEntry;
      })
      .filter((entry) => entry !== null); // Remove entries that were marked as null due to being invalid
  }
}

// --- FILE END ---
