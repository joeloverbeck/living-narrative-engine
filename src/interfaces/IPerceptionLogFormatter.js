// src/interfaces/IPerceptionLogFormatter.js
// --- FILE START ---

/**
 * @typedef {import('../types/perceptionLogTypes.js').RawPerceptionLogEntry} RawPerceptionLogEntry
 * @typedef {import('../types/perceptionLogTypes.js').FormattedPerceptionEntry} FormattedPerceptionEntry
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
