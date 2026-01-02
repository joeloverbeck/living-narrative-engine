/**
 * @file TargetSelector.js
 * @description Manages target part selection for multi-hit simulations.
 * @see specs/multi-hit-simulator-robustness.md
 */

/**
 * Helper class for target selection across different modes
 */
class TargetSelector {
  /** @type {Array<{id: string, name: string, weight: number}>} */
  #parts;

  /** @type {string} */
  #mode;

  /** @type {string|null} */
  #focusPartId;

  /** @type {number} */
  #currentIndex;

  /**
   * @param {Array<{id: string, name: string, weight: number}>} parts - Available target parts
   * @param {string} mode - Targeting mode
   * @param {string|null} focusPartId - Focus target part ID
   */
  constructor(parts, mode, focusPartId) {
    this.#parts = parts;
    this.#mode = mode;
    this.#focusPartId = focusPartId;
    this.#currentIndex = 0;
  }

  /**
   * Get the next target part ID based on the targeting mode
   * @returns {string|null} Part ID or null for weighted random
   */
  getNextTarget() {
    if (this.#parts.length === 0) {
      return null;
    }

    switch (this.#mode) {
      case 'random':
        return this.#parts[Math.floor(Math.random() * this.#parts.length)].id;

      case 'round-robin': {
        const part = this.#parts[this.#currentIndex];
        this.#currentIndex = (this.#currentIndex + 1) % this.#parts.length;
        return part.id;
      }

      case 'focus':
        return this.#focusPartId;

      // Note: No default case needed - configure() validates target modes
      // and throws an error for unknown modes (line 258-259)
    }
  }

  /**
   * Reset the selector state (e.g., round-robin index)
   */
  reset() {
    this.#currentIndex = 0;
  }
}

export default TargetSelector;
