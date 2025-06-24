// src/engine/engineState.js

/**
 * Represents the mutable runtime state of the game engine.
 * Tracks initialization status, loop status and the active world name.
 *
 * @class EngineState
 */
class EngineState {
  constructor() {
    /** @type {boolean} */
    this.isInitialized = false;
    /** @type {boolean} */
    this.isGameLoopRunning = false;
    /** @type {string | null} */
    this.activeWorld = null;
  }

  /**
   * Resets all state flags back to their defaults.
   *
   * @returns {void}
   */
  reset() {
    this.isInitialized = false;
    this.isGameLoopRunning = false;
    this.activeWorld = null;
  }
}

export default EngineState;
