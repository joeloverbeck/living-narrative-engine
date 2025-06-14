// src/services/playtimeTracker.js

import IPlaytimeTracker from '../interfaces/IPlaytimeTracker.js';
import { DISPLAY_ERROR_ID } from '../constants/eventIds.js';
import { ISafeEventDispatcher } from '../interfaces/ISafeEventDispatcher.js';

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../interfaces/IPlaytimeTracker.js').default} IPlaytimeTracker
 */

/**
 * Manages and tracks player game time, including session start/end times
 * and accumulated playtime across sessions.
 *
 * @implements {IPlaytimeTracker}
 */
class PlaytimeTracker extends IPlaytimeTracker {
  /**
   * Stores the total playtime from previous sessions in seconds.
   *
   * @private
   * @type {number}
   */
  #accumulatedPlaytimeSeconds = 0;

  /**
   * Stores the timestamp (from Date.now()) when the current play session started.
   * A value of 0 indicates no active session.
   *
   * @private
   * @type {number}
   */
  #sessionStartTime = 0;

  /**
   * Instance of an ILogger compatible logger.
   *
   * @private
   * @type {ILogger}
   */
  #logger;

  /**
   * Safe event dispatcher used for reporting errors.
   *
   * @private
   * @type {ISafeEventDispatcher}
   */
  #safeEventDispatcher;

  /**
   * Creates a new PlaytimeTracker instance.
   *
   * @param {object} dependencies - The dependencies for the service.
   * @param {ILogger} dependencies.logger - An ILogger compatible logger instance.
   * @param {ISafeEventDispatcher} dependencies.safeEventDispatcher - Dispatcher used to emit error events.
   * @throws {Error} If required dependencies are not provided.
   */
  constructor({ logger, safeEventDispatcher }) {
    super();

    if (!logger || typeof logger.info !== 'function') {
      console.error(
        'PlaytimeTracker: Logger dependency is missing or invalid. Falling back to console.error.'
      );
      // Fallback logger for environments where a full logger isn't available or during initial setup
      this.#logger = {
        info: (message) =>
          console.info(`PlaytimeTracker (fallback): ${message}`),
        warn: (message) =>
          console.warn(`PlaytimeTracker (fallback): ${message}`),
        error: (message) =>
          console.error(`PlaytimeTracker (fallback): ${message}`),
        debug: (message) =>
          console.debug(`PlaytimeTracker (fallback): ${message}`),
      };
    } else {
      this.#logger = logger;
    }

    if (
      !safeEventDispatcher ||
      typeof safeEventDispatcher.dispatch !== 'function'
    ) {
      console.error(
        'PlaytimeTracker: safeEventDispatcher dependency is missing or invalid.'
      );
      throw new Error('PlaytimeTracker requires a valid SafeEventDispatcher.');
    }

    this.#safeEventDispatcher = safeEventDispatcher;

    this.#logger.debug('PlaytimeTracker: Instance created.');
  }

  /**
   * Starts a new play session.
   * Sets the session start time to the current time and logs the event.
   * If a session is already active (i.e., #sessionStartTime > 0), this method
   * will effectively restart the session timer from the current moment and log a warning.
   *
   * @returns {void}
   */
  startSession() {
    if (this.#sessionStartTime > 0) {
      this.#logger.warn(
        `PlaytimeTracker: startSession called while a session was already active (started at ${this.#sessionStartTime}). Restarting session timer.`
      );
    }
    this.#sessionStartTime = Date.now();
    this.#logger.debug(
      `PlaytimeTracker: Session started at ${this.#sessionStartTime}`
    );
  }

  /**
   * Ends the current play session, calculates its duration, adds it to the
   * accumulated playtime, and resets the session timer.
   * If no session is active, it logs this information and ensures the timer is reset.
   *
   * @returns {void}
   */
  endSessionAndAccumulate() {
    if (this.#sessionStartTime > 0) {
      const currentSessionDuration = Math.floor(
        (Date.now() - this.#sessionStartTime) / 1000
      );
      this.#accumulatedPlaytimeSeconds += currentSessionDuration;
      this.#logger.debug(
        `PlaytimeTracker: Session ended. Duration: ${currentSessionDuration}s. Accumulated playtime: ${this.#accumulatedPlaytimeSeconds}s.`
      );
    } else {
      this.#logger.debug(
        'PlaytimeTracker: endSessionAndAccumulate called but no active session was found.'
      );
    }
    this.#sessionStartTime = 0; // Reset session start time regardless of whether a session was active.
  }

  /**
   * Gets the total accumulated playtime in seconds, including the current session's duration if active.
   * This method does not modify any internal state of the PlaytimeTracker.
   *
   * @returns {number} Total playtime in seconds.
   */
  getTotalPlaytime() {
    let currentSessionDurationInSeconds = 0;
    if (this.#sessionStartTime > 0) {
      currentSessionDurationInSeconds = Math.floor(
        (Date.now() - this.#sessionStartTime) / 1000
      );
    }
    return this.#accumulatedPlaytimeSeconds + currentSessionDurationInSeconds;
  }

  /**
   * Sets the accumulated playtime, typically when loading a game.
   * This will also reset any currently active session timer before setting the new value.
   *
   * @param {number} seconds - The total accumulated playtime in seconds from a saved game.
   * @returns {void}
   * @throws {TypeError} If seconds is not a number.
   * @throws {RangeError} If seconds is negative.
   */
  setAccumulatedPlaytime(seconds) {
    if (typeof seconds !== 'number') {
      const errorMessage = `PlaytimeTracker: setAccumulatedPlaytime expects a number, but received ${typeof seconds}.`;
      this.#safeEventDispatcher.dispatch(DISPLAY_ERROR_ID, {
        message: errorMessage,
        details: { receivedType: typeof seconds },
      });
      throw new TypeError(errorMessage);
    }
    if (seconds < 0) {
      const errorMessage = `PlaytimeTracker: setAccumulatedPlaytime expects a non-negative number, but received ${seconds}.`;
      this.#safeEventDispatcher.dispatch(DISPLAY_ERROR_ID, {
        message: errorMessage,
        details: { seconds },
      });
      throw new RangeError(errorMessage);
    }

    this.#accumulatedPlaytimeSeconds = seconds;
    this.#sessionStartTime = 0; // Reset session start time
    this.#logger.debug(
      `PlaytimeTracker: Accumulated playtime set to ${seconds}s.`
    );
  }

  /**
   * Resets the playtime tracker, clearing accumulated playtime and ending any active session.
   * Useful for starting a new game from scratch or if initialization fails.
   *
   * @returns {void}
   */
  reset() {
    this.#accumulatedPlaytimeSeconds = 0;
    this.#sessionStartTime = 0;
    this.#logger.debug('PlaytimeTracker: Playtime reset.');
  }

  /**
   * FOR TESTING PURPOSES ONLY.
   * Gets the current accumulated playtime in seconds.
   *
   * @returns {number}
   * @private
   */
  _getAccumulatedPlaytimeSeconds() {
    return this.#accumulatedPlaytimeSeconds;
  }

  /**
   * FOR TESTING PURPOSES ONLY.
   * Gets the current session start time.
   *
   * @returns {number}
   * @private
   */
  _getSessionStartTime() {
    return this.#sessionStartTime;
  }

  /**
   * FOR TESTING PURPOSES ONLY.
   * Sets the session start time to a specific value.
   *
   * @param {number} startTime - The timestamp to set as the session start time.
   * @private
   */
  _setSessionStartTime(startTime) {
    this.#sessionStartTime = startTime;
  }

  /**
   * FOR TESTING PURPOSES ONLY.
   * Sets the accumulated playtime to a specific value.
   *
   * @param {number} seconds - The accumulated playtime in seconds.
   * @private
   */
  _setAccumulatedPlaytimeSeconds(seconds) {
    this.#accumulatedPlaytimeSeconds = seconds;
  }
}

export default PlaytimeTracker;
