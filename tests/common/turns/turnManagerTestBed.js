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
import { createStoppableMixin } from '../stoppableTestBedMixin.js';
import { SpyTrackerMixin } from '../spyTrackerMixin.js';
import { createServiceFactoryMixin } from '../serviceFactoryTestBedMixin.js';
import BaseTestBed from '../baseTestBed.js';
import { createDescribeTestBedSuite } from '../describeSuite.js';
import { createTestBedHelpers } from '../createTestBedHelpers.js';
import { flushPromisesAndTimers } from '../jestHelpers.js';
import { createDefaultActors } from './testActors.js';

/**
 * @description Utility class that instantiates {@link TurnManager} with mocked
 * dependencies and exposes helpers for common test operations.
 * @class
 */
const StoppableMixin = createStoppableMixin('turnManager');

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

export class TurnManagerTestBed extends SpyTrackerMixin(
  StoppableMixin(TurnManagerFactoryMixin())
) {
  constructor(overrides = {}) {
    super(overrides);
    this.entityManager = this.mocks.entityManager;
  }

  /**
   * Ensures the TurnManager is stopped exactly once during cleanup.
   *
   * @protected
   * @override
   * @returns {Promise<void>} Resolves when cleanup finishes.
   */
  async _afterCleanup() {
    for (const spy of this._spies) {
      spy.mockRestore();
    }
    this._spies.length = 0;
    if (this.turnManager && typeof this.turnManager.stop === 'function') {
      await this.turnManager.stop();
    }
    await BaseTestBed.prototype._afterCleanup.call(this);
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
   * const stopSpy = bed.setupDebugStopSpy();
   * await bed.turnManager.stop();
   * expect(stopSpy).toHaveBeenCalled();
   * @returns {import('@jest/globals').Mock} The spy instance.
   */
  setupDebugStopSpy() {
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
   * Populates the mocked entity manager's activeEntities map.
   *
   * @param {...{ id: string }} entities - Entities to add.
   * @returns {void}
   */
  setActiveEntities(...entities) {
    const map = this.entityManager.activeEntities;
    map.clear();
    for (const e of entities) {
      map.set(e.id, e);
    }
  }

  /**
   * Adds a set of default actors to the mocked entity manager.
   *
   * @returns {{ ai1: object, ai2: object, player: object }}
   *   Object containing the created actors.
   */
  addDefaultActors() {
    const actors = createDefaultActors();
    this.setActiveEntities(actors.ai1, actors.ai2, actors.player);
    return actors;
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
   * Configures the turn order service to return the provided actor next.
   *
   * @param {object} actor - Actor entity to return.
   * @returns {void}
   */
  mockNextActor(actor) {
    this.mocks.turnOrderService.isEmpty.mockResolvedValue(false);
    this.mocks.turnOrderService.getNextEntity.mockResolvedValue(actor);
  }

  /**
   * Configures the turn order service to represent an empty queue.
   *
   * @returns {void}
   */
  mockEmptyQueue() {
    this.mocks.turnOrderService.isEmpty.mockResolvedValue(true);
    this.mocks.turnOrderService.getNextEntity.mockResolvedValue(null);
  }

  /**
   * Creates a spy on {@link TurnManager.stop} that resolves without side
   * effects.
   *
   * @returns {import('@jest/globals').Mock} The spy instance.
   */
  setupStopSpyNoOp() {
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
   * Retrieves the subscribed callback for the given event id.
   *
   * @param {string} eventId - Event identifier.
   * @returns {Function|undefined} Handler subscribed to the event.
   */
  captureHandler(eventId) {
    const call = this.dispatcher.subscribe.mock.calls.find(
      ([id]) => id === eventId
    );
    return call ? call[1] : undefined;
  }

  /**
   * Sets up the dispatcher to capture subscriptions for the specified event.
   *
   * @param {string} eventId - Event identifier to capture.
   * @returns {{ unsubscribe: jest.Mock, handler: (() => void)|null }} Captured
   *   unsubscribe mock and subscribed handler once registration occurs.
   */
  captureSubscription(eventId) {
    let captured = null;
    const unsubscribe = jest.fn();
    this.dispatcher.subscribe.mockImplementation((id, handler) => {
      if (id === eventId) {
        captured = handler;
      }
      return unsubscribe;
    });

    return {
      get handler() {
        return captured;
      },
      unsubscribe,
    };
  }

  /**
   * Triggers an event on the internal dispatcher.
   *
   * @param {string} eventType - Event name.
   * @param {object} payload - Event payload.
   * @returns {void}
   */
  trigger(eventType, payload) {
    this.dispatcher._triggerEvent(eventType, { type: eventType, payload });
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

  /**
   * Restores spies then stops the TurnManager via {@link StoppableMixin}.
   *
   * @protected
   * @returns {Promise<void>} Promise resolving when manager cleanup is complete.
   */
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
