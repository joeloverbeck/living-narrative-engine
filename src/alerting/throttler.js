/**
 * @file Implements the Throttler class for suppressing and coalescing duplicate alerts.
 * @module Throttler
 */

/**
 * @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 */

/**
 * @typedef { 'warning' | 'error' } AlertSeverity
 */

/**
 * @typedef {object} ThrottleEntry
 * @property {number} firstTimestamp - The time the first event for this key arrived (ms since epoch).
 * @property {number} suppressedCount - The number of duplicates suppressed.
 * @property {NodeJS.Timeout} timerId - The ID of the setTimeout timer for the summary check.
 * @property {object} originalPayload - The payload of the first event, stored for the summary.
 */

/**
 * @class Throttler
 * @description
 * Manages the suppression and coalescing of frequent, identical events.
 * This class tracks incoming events by a unique key. It allows the first event to
 * pass through, suppresses duplicates for a 10-second window, and then dispatches
 * a summary event if any duplicates were suppressed during that window.
 */
export class Throttler {
  /**
   * @private
   * @type {Map<string, ThrottleEntry>}
   */
  #entries = new Map();

  /**
   * @private
   * @type {ISafeEventDispatcher}
   */
  #dispatcher;

  /**
   * @private
   * @type {AlertSeverity}
   */
  #severity;

  /**
   * The duration in milliseconds to wait before sending a summary.
   * @private
   * @readonly
   * @type {number}
   */
  #THROTTLE_WINDOW_MS = 10000;

  /**
   * Creates an instance of Throttler.
   * @param {ISafeEventDispatcher} dispatcher - The event dispatcher for emitting summaries.
   * @param {AlertSeverity} severity - The type of alerts this instance handles ('warning' or 'error').
   * @throws {Error} If the dispatcher is invalid.
   */
  constructor(dispatcher, severity) {
    if (!dispatcher || typeof dispatcher.dispatch !== 'function') {
      throw new Error(
        'Throttler: A valid ISafeEventDispatcher instance is required.'
      );
    }
    this.#dispatcher = dispatcher;
    this.#severity = severity;
  }

  /**
   * Determines if an event should be rendered immediately or suppressed.
   * If allowed, it initiates a 10-second tracking window for the event's key.
   * If suppressed, it increments a counter for that key.
   * @param {string} key - The unique key identifying the event.
   * @param {object} payload - The original event payload. Expected to have `message` and `details`.
   * @returns {boolean} `true` to allow the event, `false` to suppress it.
   */
  allow(key, payload) {
    const now = Date.now();
    const existingEntry = this.#entries.get(key);

    if (existingEntry) {
      // An event with this key is already being tracked.
      if (now - existingEntry.firstTimestamp < this.#THROTTLE_WINDOW_MS) {
        existingEntry.suppressedCount++;
        return false; // Suppress event.
      } else {
        // This is a fallback case. The timer should have already cleared the entry.
        // We clear the old timer and treat the incoming event as a new one.
        clearTimeout(existingEntry.timerId);
        this.#entries.delete(key);
      }
    }

    // This is a new event, or an old one whose window has expired.
    const timerId = setTimeout(() => {
      this.#emitSummaryIfNeeded(key);
    }, this.#THROTTLE_WINDOW_MS);

    this.#entries.set(key, {
      firstTimestamp: now,
      suppressedCount: 0,
      timerId: timerId,
      originalPayload: payload, // Store the first payload
    });

    return true; // Allow event.
  }

  /**
   * Checks if duplicates were suppressed for a given key and emits a summary message if so.
   * This method is called by the `setTimeout` scheduled in the `allow()` method.
   * After execution, it cleans up the state for the key.
   * @private
   * @param {string} key - The key of the event to summarize.
   */
  #emitSummaryIfNeeded(key) {
    const entry = this.#entries.get(key);

    if (entry && entry.suppressedCount > 0) {
      const { suppressedCount, originalPayload } = entry;

      const messagePrefix = this.#severity === 'warning' ? 'Warning' : 'Error';
      const originalMessage = originalPayload.message || 'An event';

      const summaryMessage = `${messagePrefix}: '${originalMessage}' occurred ${suppressedCount} more times in the last 10 seconds.`;

      const summaryPayload = {
        message: summaryMessage,
        details: originalPayload.details, // Carry over original details
      };

      const eventName =
        this.#severity === 'warning'
          ? 'ui:display_warning'
          : 'ui:display_error';

      this.#dispatcher.dispatch(eventName, summaryPayload);
    }

    // IMPORTANT: Always clean up the entry after the 10s have passed to prevent memory leaks.
    this.#entries.delete(key);
  }
}
