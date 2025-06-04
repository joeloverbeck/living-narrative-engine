// src/interfaces/IInitializationService.js

/**
 * @file Defines the interface for the game initialization service.
 * This interface decouples game engine logic from concrete initialization implementations.
 */

// --- Interface Specific Types ---

/**
 * Represents the outcome of the game initialization sequence.
 * This type is used by the IInitializationService.runInitializationSequence method.
 * @typedef {object} InitializationResult
 * @property {boolean} success - Indicates whether the initialization sequence completed successfully.
 * @property {Error} [error] - An error object containing details if initialization failed (success is false).
 * @property {Object<string, any>} [details] - Optional. Any additional details or data resulting from the initialization.
 * For example, loaded configuration, statistics, etc.
 * Using [key: string]: any for flexibility as specified.
 */

/**
 * @interface IInitializationService
 * @classdesc Specifies the contract for services responsible for orchestrating the
 * full game initialization process. This includes loading world data, setting up
 * core systems, instantiating initial entities, configuring input, and preparing
 * the game for play.
 *
 * Implementations of this interface are expected to handle the entire setup sequence
 * for a given game world.
 */
class IInitializationService {
  /**
   * Runs the complete asynchronous sequence required to initialize the game for a specific world.
   *
   * The method is expected to:
   * 1. Load necessary world data (e.g., maps, entity definitions, game rules) for the given `worldName`.
   * 2. Initialize core game systems and services.
   * 3. Instantiate initial game entities and set up the game state.
   * 4. Configure input handlers and UI components as needed.
   * 5. Perform any other setup required before the game loop can begin.
   *
   * If the initialization process encounters a critical failure at any step,
   * the promise should resolve with `success: false` and an `Error` object.
   * The return object can include additional key-value pairs for more detailed reporting.
   * @async
   * @param {string} worldName - The identifier of the world to initialize. Must be a non-empty string.
   * @returns {Promise<{success: boolean, error?: Error, [key: string]: any}>}
   * A promise that resolves with an object indicating the outcome of the initialization.
   * - `success`: `true` if initialization was successful, `false` otherwise.
   * - `error`: An `Error` object if `success` is `false`, detailing the failure.
   * - `[key: string]: any`: Allows for additional, arbitrary properties on the result object.
   * @throws {Error} This abstract method declaration will throw an error if called directly.
   * Implementations should validate `worldName` and may throw errors for invalid input
   * or during critical failures not caught and returned in the InitializationResult.
   * @abstract
   */
  async runInitializationSequence(worldName) {
    // eslint-disable-next-line no-unused-vars
    const _worldName = worldName; // To satisfy linter if no-unused-vars is enabled
    throw new Error(
      'IInitializationService.runInitializationSequence: Method not implemented.'
    );
  }
}

// Export the "interface" class for JSDoc type checking and @implements.
export { IInitializationService };
// InitializationResult is a @typedef, it will be available for import in JSDoc using its path.
