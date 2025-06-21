/**
 * @file Provides a minimal test bed for GameEngine unit tests.
 * @see tests/common/engine/gameEngineTestBed.js
 */
/* eslint-env jest */
/* global beforeEach, afterEach, describe */

import { createTestEnvironment } from './gameEngine.test-environment.js';
import FactoryTestBed from '../factoryTestBed.js';
import { TokenOverrideMixin } from '../tokenOverrideMixin.js';
import { createStoppableMixin } from '../stoppableTestBedMixin.js';
import { suppressConsoleError } from '../jestHelpers.js';
import {
  createDescribeTestBedSuite,
  describeSuiteWithHooks,
} from '../describeSuite.js';

/**
 * @description Utility class that instantiates {@link GameEngine} using a mocked
 * environment and exposes helpers for common test operations.
 * @class
 */
const StoppableMixin = createStoppableMixin('engine');

export class GameEngineTestBed extends StoppableMixin(
  TokenOverrideMixin(FactoryTestBed)
) {
  /** @type {ReturnType<typeof createTestEnvironment>} */
  env;
  /** @type {import('../../../src/engine/gameEngine.js').default} */
  engine;
  /** @type {{ resolve: import('jest').Mock }} */
  container;
  /**
   * @type {{
   *   logger: ReturnType<import('../mockFactories').createMockLogger>,
   *   entityManager: ReturnType<import('../mockFactories').createMockEntityManager>,
   *   turnManager: ReturnType<import('../mockFactories').createMockTurnManager>,
   *   gamePersistenceService: ReturnType<import('../mockFactories').createMockGamePersistenceService>,
   *   playtimeTracker: ReturnType<import('../mockFactories').createMockPlaytimeTracker>,
   *   safeEventDispatcher: ReturnType<import('../mockFactories').createMockSafeEventDispatcher>,
   *   initializationService: ReturnType<import('../mockFactories').createMockInitializationService>,
   * }}
   */

  /**
   * @description Constructs a new test bed with optional DI overrides.
   * @param {{[token: string]: any}} [overrides]
   */
  constructor(overrides = {}) {
    const env = createTestEnvironment(overrides);
    super({
      logger: () => env.logger,
      entityManager: () => env.entityManager,
      turnManager: () => env.turnManager,
      gamePersistenceService: () => env.gamePersistenceService,
      playtimeTracker: () => env.playtimeTracker,
      safeEventDispatcher: () => env.safeEventDispatcher,
      initializationService: () => env.initializationService,
    });
    this.container = env.mockContainer;
    this._initTokenOverrides(env.mockContainer);
    const engine = env.createGameEngine();
    this.env = env;
    this.engine = engine;
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
   * Initializes the engine then clears mock call history.
   *
   * @param {string} [world] - World name to initialize.
   * @returns {Promise<void>} Resolves once initialization completes.
   */
  async initAndReset(world = 'TestWorld') {
    await this.init(world);
    this.resetMocks();
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
   * Starts a new game and immediately clears mock call history.
   *
   * @param {string} world - Name of the world to initialize.
   * @param {import('../../src/interfaces/IInitializationService.js').InitializationResult} [result]
   *   Initialization result returned by the service.
   * @returns {Promise<void>} Resolves when the game has started.
   */
  async startAndReset(world, result = { success: true }) {
    await this.start(world, result);
    this.resetMocks();
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
   * Stops the engine and cleans up the mock environment after base cleanup.
   *
   * @protected
   * @returns {Promise<void>} Promise resolving when engine cleanup is complete.
   */
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
export const describeGameEngineSuite = createDescribeTestBedSuite(
  GameEngineTestBed,
  (() => {
    let consoleSpy;
    return {
      beforeEachHook() {
        consoleSpy = suppressConsoleError();
      },
      afterEachHook() {
        consoleSpy.mockRestore();
      },
    };
  })()
);

/**
 * Defines an engine-focused test suite providing `bed` and `engine` variables
 * automatically via `beforeEach`.
 *
 * @param {string} title - Suite title passed to `describe`.
 * @param {(context: { bed: GameEngineTestBed, engine: import('../../../src/engine/gameEngine.js').default }) => void} suiteFn -
 *   Callback containing the tests.
 * @param {{[token: string]: any}} [overrides] - Optional DI overrides.
 * @returns {void}
 */
export function describeEngineSuite(title, suiteFn, overrides = {}) {
  describeGameEngineSuite(
    title,
    (getBed) => {
      /** @type {GameEngineTestBed} */
      let bed;
      /** @type {import('../../../src/engine/gameEngine.js').default} */
      let engine;
      beforeEach(() => {
        bed = getBed();
        engine = bed.engine;
      });
      suiteFn({
        get bed() {
          return bed;
        },
        get engine() {
          return engine;
        },
      });
    },
    overrides
  );
}

export default GameEngineTestBed;
