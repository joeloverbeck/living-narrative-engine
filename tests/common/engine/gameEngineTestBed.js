/**
 * @file Provides a minimal test bed for GameEngine unit tests.
 * @see tests/common/engine/gameEngineTestBed.js
 */
/* eslint-env jest */
/* global beforeEach, afterEach, describe */

import { createEnvironment } from './gameEngineEnvironment.js';
import ContainerTestBed from '../containerTestBed.js';
import { createStoppableMixin } from '../stoppableTestBedMixin.js';
import { suppressConsoleError } from '../jestHelpers.js';
import { createDescribeServiceSuite } from '../describeSuite.js';
import { createTestBedHelpers } from '../createTestBedHelpers.js';
import { DEFAULT_TEST_WORLD } from '../constants.js';

/**
 * @description Utility class that instantiates {@link GameEngine} using a mocked
 * environment and exposes helpers for common test operations. Public getter
 * methods expose commonly used service mocks while the underlying mock
 * collection remains internal.
 * @class
 */
const StoppableMixin = createStoppableMixin('engine');

export class GameEngineTestBed extends StoppableMixin(ContainerTestBed) {
  /** @type {ReturnType<typeof createEnvironment>} */
  env;
  /** @type {import('../../../src/engine/gameEngine.js').default} */
  engine;
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
    const env = createEnvironment(overrides);
    super(env.mockContainer, {
      logger: env.mocks.logger,
      entityManager: env.mocks.entityManager,
      turnManager: env.mocks.turnManager,
      gamePersistenceService: env.mocks.gamePersistenceService,
      playtimeTracker: env.mocks.playtimeTracker,
      safeEventDispatcher: env.mocks.safeEventDispatcher,
      initializationService: env.mocks.initializationService,
    });
    // Use the already created gameEngine instance if available to avoid double instantiation
    const engine = env.instance || env.createInstance();
    this.env = env;
    this.engine = engine;
  }

  /**
   * Returns the logger mock.
   *
   * @returns {ReturnType<import('../mockFactories').createMockLogger>} Logger mock.
   */
  getLogger() {
    return this.logger;
  }

  /**
   * Returns the entity manager mock.
   *
   * @returns {ReturnType<import('../mockFactories').createMockEntityManager>} Entity manager mock.
   */
  getEntityManager() {
    return this.entityManager;
  }

  /**
   * Returns the turn manager mock.
   *
   * @returns {ReturnType<import('../mockFactories').createMockTurnManager>} Turn manager mock.
   */
  getTurnManager() {
    return this.turnManager;
  }

  /**
   * Returns the game persistence service mock.
   *
   * @returns {ReturnType<import('../mockFactories').createMockGamePersistenceService>} Persistence service mock.
   */
  getGamePersistenceService() {
    return this.gamePersistenceService;
  }

  /**
   * Returns the playtime tracker mock.
   *
   * @returns {ReturnType<import('../mockFactories').createMockPlaytimeTracker>} Playtime tracker mock.
   */
  getPlaytimeTracker() {
    return this.playtimeTracker;
  }

  /**
   * Returns the validated event dispatcher mock.
   *
   * @returns {ReturnType<import('../mockFactories').createMockSafeEventDispatcher>} Dispatcher mock.
   */
  getSafeEventDispatcher() {
    return this.safeEventDispatcher;
  }

  /**
   * Returns the initialization service mock.
   *
   * @returns {ReturnType<import('../mockFactories').createMockInitializationService>} Initialization service mock.
   */
  getInitializationService() {
    return this.initializationService;
  }
  /**
   * Initializes the engine using a default successful initialization result.
   *
   * @param {string} [world] - World name to initialize.
   * @returns {Promise<void>} Promise resolving when the engine has started.
   */
  async init(world = DEFAULT_TEST_WORLD) {
    this.env.mocks.initializationService.runInitializationSequence.mockResolvedValue(
      {
        success: true,
      }
    );
    await this.engine.startNewGame(world);
  }

  /**
   * Initializes the engine then clears mock call history.
   *
   * @param {string} [world] - World name to initialize.
   * @returns {Promise<void>} Resolves once initialization completes.
   */
  async initAndReset(world = DEFAULT_TEST_WORLD) {
    await this.withReset(() => this.init(world));
  }

  /**
   * Presets initialization results and starts a new game.
   *
   * @param {string} worldName - Name of the world to initialize.
   * @param {import('../../src/interfaces/IInitializationService.js').InitializationResult} [initResult]
   * @returns {Promise<void>} Promise resolving when the engine has started.
   */
  async start(worldName, initResult = { success: true }) {
    this.env.mocks.initializationService.runInitializationSequence.mockResolvedValue(
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
    await this.withReset(() => this.start(world, result));
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
}

const engineSuiteHooks = (() => {
  let consoleSpy;
  return {
    /**
     * @param {GameEngineTestBed} bed
     */
    beforeEachHook(bed) {
      consoleSpy = suppressConsoleError();
      bed.resetMocks();
    },
    afterEachHook() {
      consoleSpy.mockRestore();
    },
  };
})();

export const {
  createBed: createGameEngineTestBed,
  describeSuite: describeGameEngineSuite,
} = createTestBedHelpers(GameEngineTestBed, engineSuiteHooks);

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
export const describeEngineSuite = createDescribeServiceSuite(
  GameEngineTestBed,
  'engine',
  engineSuiteHooks
);

/**
 * Defines an engine suite that automatically initializes the engine before
 * each test runs.
 *
 * @param {string} title - Suite title passed to `describe`.
 * @param {(context: { bed: GameEngineTestBed, engine: import('../../../src/engine/gameEngine.js').default }) => void} suiteFn -
 *   Callback containing the tests.
 * @param {string} [world] - Name of the world used for initialization.
 * @param {{[token: string]: any}} [overrides] - Optional DI overrides.
 * @returns {void}
 */
export function describeInitializedEngineSuite(
  title,
  suiteFn,
  world,
  overrides
) {
  if (typeof world === 'object' && world !== null) {
    overrides = world;
    world = DEFAULT_TEST_WORLD;
  }
  world = world || DEFAULT_TEST_WORLD;
  describeEngineSuite(
    title,
    (ctx) => {
      beforeEach(async () => {
        await ctx.bed.initAndReset(world);
      });
      suiteFn(ctx);
    },
    overrides
  );
}

export default GameEngineTestBed;
