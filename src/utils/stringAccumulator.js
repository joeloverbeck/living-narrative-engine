// src/utils/stringAccumulator.js

/**
 * @module utils/stringAccumulator
 */

/**
 * @class StringAccumulator
 * @description
 * Efficiently accumulates many small pieces of text by storing them
 * in an array and joining only when needed, minimizing intermediate allocations.
 */
export class StringAccumulator {
  /**
   * @private
   * @type {string[]}
   * @description Internal array of string parts.
   */
  #parts = [];

  /**
   * Appends a value to the accumulator, coercing it to a string.
   *
   * @param {any} value - The value to append; will be converted via `String(value)`.
   * @returns {void}
   */
  append(value) {
    this.#parts.push(String(value));
  }

  /**
   * Returns the full concatenated string.
   *
   * @returns {string} The joined result of all appended parts.
   */
  toString() {
    return this.#parts.join('');
  }

  /**
   * Calculates the total length of the accumulated string
   * without creating the full string.
   *
   * @returns {number} Sum of `.length` of each part.
   */
  get length() {
    return this.#parts.reduce((sum, part) => sum + part.length, 0);
  }
}
