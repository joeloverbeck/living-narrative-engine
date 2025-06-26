/**
 * @file Mixin providing init and start helpers for GameEngine tests.
 */

import { DEFAULT_TEST_WORLD } from '../constants.js';

/**
 * @description Extends a test bed with convenience methods for
 * initializing and starting the GameEngine.
 * @param {typeof import('../baseTestBed.js').default} Base - Base class to extend.
 * @returns {typeof import('../baseTestBed.js').default} Extended class.
 */
export function EngineStartHelpersMixin(Base) {
  return class EngineStartHelpers extends Base {
    /**
     * Initializes the engine using a default successful result.
     *
     * @param {string} [world] - World name to initialize.
     * @returns {Promise<void>} Promise resolving when started.
     */
    async init(world = DEFAULT_TEST_WORLD) {
      this.env.initializationService.runInitializationSequence.mockResolvedValue(
        {
          success: true,
        }
      );
      await this.engine.startNewGame(world);
    }

    /**
     * Initializes the engine and clears mock history.
     *
     * @param {string} [world] - World name to initialize.
     * @returns {Promise<void>} Resolves once initialization completes.
     */
    async initAndReset(world = DEFAULT_TEST_WORLD) {
      await this.withReset(() => this.init(world));
    }

    /**
     * Starts a new game with the provided initialization result.
     *
     * @param {string} worldName - Name of the world.
     * @param {import('../../../src/interfaces/IInitializationService.js').InitializationResult} [initResult]
     *   Initialization result returned by the service.
     * @returns {Promise<void>} Resolves when started.
     */
    async start(worldName, initResult = { success: true }) {
      this.env.initializationService.runInitializationSequence.mockResolvedValue(
        initResult
      );
      await this.engine.startNewGame(worldName);
    }

    /**
     * Starts a new game then clears mock history.
     *
     * @param {string} world - World name.
     * @param {import('../../../src/interfaces/IInitializationService.js').InitializationResult} [result]
     *   Initialization result.
     * @returns {Promise<void>} Resolves when started.
     */
    async startAndReset(world, result = { success: true }) {
      await this.withReset(() => this.start(world, result));
    }

    /**
     * Stops the engine if initialized.
     *
     * @returns {Promise<void>} Promise resolving once stopped.
     */
    async stop() {
      if (this.engine.getEngineStatus().isInitialized) {
        await this.engine.stop();
      }
    }
  };
}

export default EngineStartHelpersMixin;
