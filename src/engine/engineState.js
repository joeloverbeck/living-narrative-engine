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
   * Marks the engine as initialized and running for the provided world.
   *
   * @param {string} worldName - Name of the active world.
   * @returns {void}
   */
  setStarted(worldName) {
    this.isInitialized = true;
    this.isGameLoopRunning = true;
    this.activeWorld = worldName;
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
