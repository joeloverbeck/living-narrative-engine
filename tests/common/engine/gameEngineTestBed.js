/**
 * @file Provides a minimal test bed for GameEngine unit tests.
 * @see tests/common/engine/gameEngineTestBed.js
 */

import { jest } from '@jest/globals';
import { createTestEnvironment } from './gameEngine.test-environment.js';
import BaseTestBed from '../baseTestBed.js';
import { suppressConsoleError } from '../jestHelpers.js';

/**
 * @description Utility class that instantiates {@link GameEngine} using a mocked
 * environment and exposes helpers for common test operations.
 * @class
 */
export class GameEngineTestBed extends BaseTestBed {
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

  /** @type {Map<any, any>} */
  #tokenOverrides = new Map();
  /** @type {Function} */
  #originalResolve;

  /**
   * @description Constructs a new test bed with optional DI overrides.
   * @param {{[token: string]: any}} [overrides]
   */
  constructor(overrides = {}) {
    const env = createTestEnvironment(overrides);
    const engine = env.createGameEngine();
    const mocks = {
      logger: env.logger,
      entityManager: env.entityManager,
      turnManager: env.turnManager,
      gamePersistenceService: env.gamePersistenceService,
      playtimeTracker: env.playtimeTracker,
      safeEventDispatcher: env.safeEventDispatcher,
      initializationService: env.initializationService,
    };
    super(mocks);
    this.env = env;
    this.engine = engine;

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
    await super.cleanup();
    await this.stop();
    this.env.mockContainer.resolve.mockImplementation(this.#originalResolve);
    this.#tokenOverrides.clear();
    this.env.cleanup();
  }
}

/**
 * Creates a new {@link GameEngineTestBed} instance.
 *
 * @param {{[token: string]: any}} [overrides] - Optional DI token overrides.
 * @returns {GameEngineTestBed} Test bed instance.
 */
export function createGameEngineTestBed(overrides = {}) {
  return new GameEngineTestBed(overrides);
}

/**
 * Defines a test suite with automatic {@link GameEngineTestBed} setup.
 *
 * @param {string} title - Suite title passed to `describe`.
 * @param {(getBed: () => GameEngineTestBed) => void} suiteFn - Callback
 *   containing the tests. Receives a getter for the active test bed.
 * @param {{[token: string]: any}} [overrides] - Optional DI overrides.
 * @returns {void}
 */
export function describeGameEngineSuite(title, suiteFn, overrides = {}) {
  describe(title, () => {
    let testBed;
    let consoleSpy;
    beforeEach(() => {
      consoleSpy = suppressConsoleError();
      testBed = new GameEngineTestBed(overrides);
    });
    afterEach(async () => {
      await testBed.cleanup();
      consoleSpy.mockRestore();
    });
    suiteFn(() => testBed);
  });
}

export default GameEngineTestBed;
