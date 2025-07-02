// src/engine/engineState.js

/**
 * Represents the mutable runtime state of the game engine.
 * Tracks initialization status, loop status and the active world name.
 *
 * @class EngineState
 */
class EngineState {
  /** @type {boolean} */
  #isInitialized;
  /** @type {boolean} */
  #isGameLoopRunning;
  /** @type {string | null} */
  #activeWorld;

  constructor() {
    this.#isInitialized = false;
    this.#isGameLoopRunning = false;
    this.#activeWorld = null;
  }

  /**
   * Indicates whether the engine has been initialized.
   *
   * @returns {boolean} Initialization status.
   */
  get isInitialized() {
    return this.#isInitialized;
  }

  /**
   * Indicates whether the game loop is currently running.
   *
   * @returns {boolean} Loop running status.
   */
  get isGameLoopRunning() {
    return this.#isGameLoopRunning;
  }

  /**
   * Returns the name of the currently active world, if any.
   *
   * @returns {string | null} Active world name or {@code null}.
   */
  get activeWorld() {
    return this.#activeWorld;
  }

  /**
   * Updates the active world name without changing initialization state.
   *
   * @param {string} worldName - Name of the world to set active.
   * @returns {void}
   */
  setActiveWorld(worldName) {
    this.#activeWorld = worldName;
  }

  /**
   * Marks the engine as initialized and running for the provided world.
   *
   * @param {string} worldName - Name of the active world.
   * @returns {void}
   */
  setStarted(worldName) {
    this.#isInitialized = true;
    this.#isGameLoopRunning = true;
    this.setActiveWorld(worldName);
  }

  /**
   * Resets all state flags back to their defaults.
   *
   * @returns {void}
   */
  reset() {
    this.#isInitialized = false;
    this.#isGameLoopRunning = false;
    this.#activeWorld = null;
  }
}

export default EngineState;
