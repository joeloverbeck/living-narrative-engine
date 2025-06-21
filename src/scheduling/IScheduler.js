/**
 * @file Defines the IScheduler interface used for scheduling callbacks.
 */

/**
 * @interface IScheduler
 * @classdesc Abstraction over setTimeout/clearTimeout to allow deterministic scheduling.
 */
export class IScheduler {
  /**
   * Schedules a callback to run after the specified delay.
   *
   * @param {() => void} fn - The callback to execute.
   * @param {number} ms - Delay in milliseconds.
   * @returns {any} Identifier for the scheduled timeout.
   */
  // eslint-disable-next-line no-unused-vars
  setTimeout(fn, ms) {
    throw new Error('not implemented');
  }

  /**
   * Clears a previously scheduled timeout.
   *
   * @param {any} id - Identifier returned from setTimeout.
   * @returns {void}
   */
  // eslint-disable-next-line no-unused-vars
  clearTimeout(id) {
    throw new Error('not implemented');
  }
}
