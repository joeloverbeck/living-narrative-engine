/**
 * @file Provides a minimal test bed for TurnManager unit tests.
 * @see tests/common/turns/turnManagerTestBed.js
 */
/* eslint-env jest */

import { jest } from '@jest/globals';
import TurnManager from '../../../src/turns/turnManager.js';
import {
  createMockLogger,
  createMockValidatedEventBus,
  createMockTurnHandler,
} from '../mockFactories';
import { createMockEntityManager } from '../mockFactories/entities.js';
import { SpyTrackerMixin } from '../spyTrackerMixin.js';
import { createServiceFactoryMixin } from '../serviceFactoryTestBedMixin.js';
import { createDescribeTestBedSuite } from '../describeSuite.js';
import { createTestBedHelpers } from '../createTestBedHelpers.js';
import { flushPromisesAndTimers } from '../jestHelpers.js';
import { EventCaptureMixin } from './eventCaptureMixin.js';
import { EntitySetupMixin } from './entitySetupMixin.js';

/**
 * @description Utility class that instantiates {@link TurnManager} with mocked
 * dependencies and exposes helpers for common test operations.
 * @class
 */

const TurnManagerFactoryMixin = createServiceFactoryMixin(
  (overrides = {}) => ({
    logger: () => overrides.logger ?? createMockLogger(),
    entityManager: () => {
      const em =
        overrides.entityManager ??
        createMockEntityManager({ returnArray: true });
      em.getEntityInstance = jest.fn((id) => em.activeEntities.get(id));
      return em;
    },
    turnOrderService: () =>
      overrides.turnOrderService ?? {
        isEmpty: jest.fn(),
        getNextEntity: jest.fn(),
        startNewRound: jest.fn(),
        clearCurrentRound: jest.fn(),
      },
    turnHandlerResolver: () =>
      overrides.turnHandlerResolver ?? { resolveHandler: jest.fn() },
    dispatcher: () => overrides.dispatcher ?? createMockValidatedEventBus(),
  }),
  (mocks, overrides = {}) => {
    const TMClass = overrides.TurnManagerClass ?? TurnManager;
    const opts = overrides.turnManagerOptions ?? {};
    return new TMClass({
      turnOrderService: mocks.turnOrderService,
      entityManager: mocks.entityManager,
      logger: mocks.logger,
      dispatcher: mocks.dispatcher,
      turnHandlerResolver: mocks.turnHandlerResolver,
      ...opts,
    });
  },
  'turnManager'
);

export class TurnManagerTestBed extends EventCaptureMixin(
  EntitySetupMixin(SpyTrackerMixin(TurnManagerFactoryMixin()))
) {
  constructor(overrides = {}) {
    super(overrides);
    this.entityManager = this.mocks.entityManager;
  }

  /**
   * Runs a start callback inside {@link BaseTestBed#withReset}.
   *
   * @description Executes the provided start function within the standard
   *   reset wrapper so that mocks are cleared before each start.
   * @param {() => Promise<void>} startFn - Function containing start logic.
   * @returns {Promise<void>} Resolves once the start function completes.
   * @private
   */
  async #startInternal(startFn) {
    await this.withReset(startFn);
  }

  /**
   * Adds entities then starts the manager, clearing mock call history.
   *
   * @param {...{ id: string }} entities - Entities to register as active.
   * @returns {Promise<void>} Resolves once the manager has started.
   */
  async startWithEntities(...entities) {
    await this.#startInternal(async () => {
      this.setActiveEntities(...entities);
      await this.turnManager.start();
    });
  }

  /**
   * Starts the manager but suppresses the initial advanceTurn call.
   *
   * @returns {Promise<void>} Resolves once the manager is running.
   */
  async startRunning() {
    await this.#startInternal(async () => {
      const spy = jest
        .spyOn(this.turnManager, 'advanceTurn')
        .mockImplementationOnce(async () => {});
      await this.turnManager.start();
      spy.mockRestore();
    });
  }

  /**
   * Starts the manager then flushes timers/promises.
   *
   * @returns {Promise<void>} Resolves once timers are flushed.
   */
  async startAndFlush() {
    await this.#startInternal(async () => {
      await this.turnManager.start();
    });
    await flushPromisesAndTimers();
  }

  /**
   * Starts the manager with entities then flushes timers/promises.
   *
   * @param {...{ id: string }} entities - Entities to register as active.
   * @returns {Promise<void>} Resolves once timers are flushed.
   */
  async startWithEntitiesAndFlush(...entities) {
    await this.startWithEntities(...entities);
    await flushPromisesAndTimers();
  }

  /**
   * Spies on {@link TurnManager.stop} and tracks for cleanup.
   *
   * @returns {import('@jest/globals').Mock} The spy instance.
   */
  spyOnStop() {
    const spy = jest.spyOn(this.turnManager, 'stop');
    this.trackSpy(spy);
    return spy;
  }

  /**
   * Spies on {@link TurnManager.stop} and logs when invoked.
   *
   * Calls {@link TurnManagerTestBed#spyOnStop} and overrides the spy
   * implementation to emit a debug message. Useful for tests that need
   * confirmation that stop was triggered without affecting flow.
   *
   * @example
   * const stopSpy = bed.spyOnStopWithDebug();
   * await bed.turnManager.stop();
   * expect(stopSpy).toHaveBeenCalled();
   * @returns {import('@jest/globals').Mock} The spy instance.
   */
  spyOnStopWithDebug() {
    const spy = this.spyOnStop();
    spy.mockImplementation(() => {
      this.mocks.logger.debug('Mocked instance.stop() called.');
    });
    return spy;
  }

  /**
   * Spies on {@link TurnManager.advanceTurn} and tracks for cleanup.
   *
   * @returns {import('@jest/globals').Mock} The spy instance.
   */
  spyOnAdvanceTurn() {
    const spy = jest.spyOn(this.turnManager, 'advanceTurn');
    this.trackSpy(spy);
    return spy;
  }

  /**
   * Starts the manager with default actors and flushes pending tasks.
   *
   * @returns {Promise<{ ai1: object, ai2: object, player: object }>}
   *   Promise resolving to the created actors once start completes.
   */
  async startWithDefaultActorsAndFlush() {
    const actors = this.addDefaultActors();
    await this.startAndFlush();
    return actors;
  }

  /**
   * Creates a spy on {@link TurnManager.stop} that resolves without side
   * effects.
   *
   * @returns {import('@jest/globals').Mock} The spy instance.
   */
  spyOnStopNoOp() {
    const spy = this.spyOnStop();
    spy.mockResolvedValue();
    return spy;
  }

  /**
   * Sets up a mock turn handler for the provided actor.
   *
   * @param {object} actor - Actor entity for which to create the handler.
   * @param {object} [options] - Additional handler options.
   * @returns {ReturnType<typeof createMockTurnHandler>} The created handler.
   */
  setupHandlerForActor(actor, options = {}) {
    const handler = createMockTurnHandler({ actor, ...options });
    this.turnHandlerResolver.resolveHandler.mockResolvedValue(handler);
    return handler;
  }

  /**
   * Configures the resolver to return a fresh mock handler for any actor.
   *
   * @param {boolean} [includeSignal] - Whether handlers include signalNormalApparentTermination.
   * @returns {void}
   */
  setupMockHandlerResolver(includeSignal = true) {
    this.turnHandlerResolver.resolveHandler.mockImplementation(async (actor) =>
      createMockTurnHandler({
        actor,
        includeSignalTermination: includeSignal,
      })
    );
  }

  /**
   * Initializes common mock implementations used across many test suites. All
   *   turn order service methods resolve successfully, dispatcher.dispatch
   *   resolves to `true`, and a default handler resolver is configured.
   *
   * @returns {void}
   */
  initializeDefaultMocks() {
    this.mocks.turnOrderService.isEmpty.mockResolvedValue(true);
    this.mocks.turnOrderService.getNextEntity.mockResolvedValue(null);
    this.mocks.turnOrderService.startNewRound.mockResolvedValue();
    this.mocks.turnOrderService.clearCurrentRound.mockResolvedValue();
    this.mocks.dispatcher.dispatch.mockResolvedValue(true);
    this.setupMockHandlerResolver();
  }

  /**
   * Prepares the manager for {@link TurnManager.start} by mocking the handler
   * resolver and stubbing {@link TurnManager.advanceTurn}.
   *
   * @returns {import('@jest/globals').Mock} Spy on advanceTurn used during
   *   preparation.
   */
  prepareRunningManager() {
    this.setupMockHandlerResolver();
    const spy = this.spyOnAdvanceTurn();
    spy.mockResolvedValue(undefined);
    this.resetMocks();
    return spy;
  }

  /**
   * Calls advanceTurn then flushes timers/promises.
   *
   * @returns {Promise<void>} Resolves when all timers are flushed.
   */
  async advanceAndFlush() {
    await this.turnManager.advanceTurn();
    await flushPromisesAndTimers();
  }
}

/**
 * Creates a new {@link TurnManagerTestBed} instance.
 *
 * @param overrides
 * @returns {TurnManagerTestBed} Test bed instance.
 */
export const {
  createBed: createTurnManagerTestBed,
  describeSuite: describeTurnManagerSuite,
} = createTestBedHelpers(TurnManagerTestBed, {
  beforeEachHook(bed) {
    jest.useFakeTimers();
    bed.initializeDefaultMocks();
  },
  afterEachHook() {
    // Timers restored via BaseTestBed cleanup; spies restored by SpyTrackerMixin
  },
});

/**
 * Defines a suite where {@link TurnManager} is started before each test.
 *
 * @param {string} title - Suite title passed to `describe`.
 * @param {(getBed: () => TurnManagerTestBed) => void} suiteFn - Callback
 *   containing the tests. Receives a getter for the active test bed.
 * @param {Record<string, any>} [overrides] - Optional overrides for mock
 *   creation.
 * @returns {void}
 */
export const describeRunningTurnManagerSuite = createDescribeTestBedSuite(
  TurnManagerTestBed,
  {
    async beforeEachHook(bed) {
      jest.useFakeTimers();
      bed.initializeDefaultMocks();
      await bed.startRunning();
    },
    afterEachHook() {
      /* timers restored in cleanup */
    },
  }
);

export default TurnManagerTestBed;

/**
 * Re-exports {@link flushPromisesAndTimers} for convenience in test suites.
 */
export { flushPromisesAndTimers };

/*
Usage:
  describeRunningTurnManagerSuite('My Suite', (getBed) => {
    const bed = getBed();
    // bed.turnManager is already running
  });
*/
