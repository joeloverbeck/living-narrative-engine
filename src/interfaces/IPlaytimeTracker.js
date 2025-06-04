// src/interfaces/IPlaytimeTracker.js

/**
 * @interface IPlaytimeTracker
 * Defines the contract for services that track game playtime.
 */
class IPlaytimeTracker {
  /**
   * Resets the playtime tracker, clearing accumulated playtime and ending any active session.
   * @abstract
   * @returns {void}
   */
  reset() {
    throw new Error("Method 'reset()' must be implemented.");
  }

  /**
   * Starts a new play session.
   * Sets the session start time to the current time.
   * @abstract
   * @returns {void}
   */
  startSession() {
    throw new Error("Method 'startSession()' must be implemented.");
  }

  /**
   * Ends the current play session, calculates its duration, adds it to the
   * accumulated playtime, and resets the session timer.
   * @abstract
   * @returns {void}
   */
  endSessionAndAccumulate() {
    throw new Error("Method 'endSessionAndAccumulate()' must be implemented.");
  }

  /**
   * Gets the total accumulated playtime in seconds, including the current session's duration if active.
   * This method should not modify any internal state of the PlaytimeTracker.
   * @abstract
   * @returns {number} Total playtime in seconds.
   */
  getTotalPlaytime() {
    throw new Error("Method 'getTotalPlaytime()' must be implemented.");
  }

  /**
   * Sets the accumulated playtime, typically when loading a game.
   * This will also reset any currently active session timer before setting the new value.
   * @abstract
   * @param {number} seconds - The total accumulated playtime in seconds from a saved game.
   * @returns {void}
   * @throws {TypeError} If seconds is not a number.
   * @throws {RangeError} If seconds is negative.
   */
  setAccumulatedPlaytime(seconds) {
    throw new Error("Method 'setAccumulatedPlaytime()' must be implemented.");
  }
}

// Export the "interface" for JSDoc type checking.
// In JavaScript, interfaces are typically conceptual and enforced by documentation/convention
// or TypeScript. For JSDoc, defining a class like this works for type annotations.
export default IPlaytimeTracker;
