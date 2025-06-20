/**
 * @file Provides a minimal test bed for GameEngine unit tests.
 * @see tests/common/engine/gameEngineTestBed.js
 */

import { createTestEnvironment } from './gameEngine.test-environment.js';

/**
 * @description Utility class that instantiates {@link GameEngine} using a mocked
 * environment and exposes helpers for common test operations.
 * @class
 */
export class GameEngineTestBed {
  /** @type {ReturnType<typeof createTestEnvironment>} */
  env;
  /** @type {import('../../../src/engine/gameEngine.js').default} */
  engine;
  /**
   * @type {{
   *   logger: ReturnType<import('../mockFactories.js').createMockLogger>,
   *   entityManager: ReturnType<import('../mockFactories.js').createMockEntityManager>,
   *   turnManager: ReturnType<import('../mockFactories.js').createMockTurnManager>,
   *   gamePersistenceService: ReturnType<import('../mockFactories.js').createMockGamePersistenceService>,
   *   playtimeTracker: ReturnType<import('../mockFactories.js').createMockPlaytimeTracker>,
   *   safeEventDispatcher: ReturnType<import('../mockFactories.js').createMockSafeEventDispatcher>,
   *   initializationService: ReturnType<import('../mockFactories.js').createMockInitializationService>,
   * }}
   */
  mocks;

  /** @type {Map<any, any>} */
  #tokenOverrides = new Map();
  /** @type {Function} */
  #originalResolve;

  constructor() {
    this.env = createTestEnvironment();
    this.engine = this.env.createGameEngine();
    this.mocks = {
      logger: this.env.logger,
      entityManager: this.env.entityManager,
      turnManager: this.env.turnManager,
      gamePersistenceService: this.env.gamePersistenceService,
      playtimeTracker: this.env.playtimeTracker,
      safeEventDispatcher: this.env.safeEventDispatcher,
      initializationService: this.env.initializationService,
    };

    this.#originalResolve =
      this.env.mockContainer.resolve.getMockImplementation?.() ??
      this.env.mockContainer.resolve;
  }

  /**
   * Initializes the engine using a default successful initialization result.
   *
   * @param {string} [world] - World name to initialize.
   * @returns {Promise<void>} Promise resolving when the engine has started.
   */
  async init(world = 'TestWorld') {
    this.env.initializationService.runInitializationSequence.mockResolvedValue({
      success: true,
    });
    await this.engine.startNewGame(world);
  }

  /**
   * Presets initialization results and starts a new game.
   *
   * @param {string} worldName - Name of the world to initialize.
   * @param {import('../../src/interfaces/IInitializationService.js').InitializationResult} [initResult]
   * @returns {Promise<void>} Promise resolving when the engine has started.
   */
  async start(worldName, initResult = { success: true }) {
    this.env.initializationService.runInitializationSequence.mockResolvedValue(
      initResult
    );
    await this.engine.startNewGame(worldName);
  }

  /**
   * Stops the engine if it is initialized.
   *
   * @returns {Promise<void>} Promise resolving once stopped.
   */
  async stop() {
    if (this.engine.getEngineStatus().isInitialized) {
      await this.engine.stop();
    }
  }

  /**
   * Temporarily overrides container token resolution.
   *
   * @param {any} token - Token to override.
   * @param {any | (() => any)} value - Replacement value or function.
   */
  withTokenOverride(token, value) {
    this.#tokenOverrides.set(token, value);
    this.env.mockContainer.resolve.mockImplementation((tok) => {
      if (this.#tokenOverrides.has(tok)) {
        const override = this.#tokenOverrides.get(tok);
        return typeof override === 'function' ? override() : override;
      }
      return this.#originalResolve(tok);
    });
  }

  /**
   * Stops the engine and cleans up the environment.
   *
   * @returns {Promise<void>} Promise resolving when cleanup is complete.
   */
  async cleanup() {
    await this.stop();
    this.env.mockContainer.resolve.mockImplementation(this.#originalResolve);
    this.#tokenOverrides.clear();
    this.env.cleanup();
  }
}

/**
 * Creates a new {@link GameEngineTestBed} instance.
 *
 * @returns {GameEngineTestBed} Test bed instance.
 */
export function createGameEngineTestBed() {
  return new GameEngineTestBed();
}

export default GameEngineTestBed;
