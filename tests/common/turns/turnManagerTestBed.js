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
import FactoryTestBed from '../factoryTestBed.js';
import { createStoppableMixin } from '../stoppableTestBedMixin.js';
import {
  describeSuiteWithHooks,
  createDescribeTestBedSuite,
} from '../describeSuite.js';
import { flushPromisesAndTimers } from '../jestHelpers.js';
import { runWithReset } from '../testBedHelpers.js';

/**
 * @description Utility class that instantiates {@link TurnManager} with mocked
 * dependencies and exposes helpers for common test operations.
 * @class
 */
const StoppableMixin = createStoppableMixin('turnManager');

export class TurnManagerTestBed extends StoppableMixin(FactoryTestBed) {
  /** @type {TurnManager} */
  turnManager;
  /** @type {Array<import('@jest/globals').Mock>} */
  #spies = [];

  constructor(overrides = {}) {
    super({
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
        overrides.turnHandlerResolver ?? {
          resolveHandler: jest.fn(),
        },
      dispatcher: () => overrides.dispatcher ?? createMockValidatedEventBus(),
    });

    const TurnManagerClass = overrides.TurnManagerClass ?? TurnManager;
    const tmOptions = overrides.turnManagerOptions ?? {};

    this.turnManager = new TurnManagerClass({
      turnOrderService: this.turnOrderService,
      entityManager: this.entityManager,
      logger: this.logger,
      dispatcher: this.dispatcher,
      turnHandlerResolver: this.turnHandlerResolver,
      ...tmOptions,
    });

    // Ensure entityManager is always the same reference
    this.entityManager = this.mocks.entityManager;
  }

  /**
   * Adds entities then starts the manager, clearing mock call history.
   *
   * @param {...{ id: string }} entities - Entities to register as active.
   * @returns {Promise<void>} Resolves once the manager has started.
   */
  async startWithEntities(...entities) {
    await runWithReset(this, async () => {
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
    await runWithReset(this, async () => {
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
    await this.turnManager.start();
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
    this.#spies.push(spy);
    return spy;
  }

  /**
   * Spies on {@link TurnManager.advanceTurn} and tracks for cleanup.
   *
   * @returns {import('@jest/globals').Mock} The spy instance.
   */
  spyOnAdvanceTurn() {
    const spy = jest.spyOn(this.turnManager, 'advanceTurn');
    this.#spies.push(spy);
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
   * @description Initializes common mock implementations used across many
   *   test suites. All turn order service methods resolve successfully,
   *   dispatcher.dispatch resolves to `true`, and a default handler resolver is
   *   configured.
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
  async _afterCleanup() {
    for (const spy of this.#spies) {
      spy.mockRestore();
    }
    this.#spies.length = 0;
    await super._afterCleanup();
  }
}

/**
 * Creates a new {@link TurnManagerTestBed} instance.
 *
 * @param overrides
 * @returns {TurnManagerTestBed} Test bed instance.
 */
export function createTurnManagerTestBed(overrides = {}) {
  return new TurnManagerTestBed(overrides);
}

/**
 * Defines a test suite with automatic {@link TurnManagerTestBed} setup.
 *
 * @param {string} title - Suite title passed to `describe`.
 * @param {(getBed: () => TurnManagerTestBed) => void} suiteFn - Callback
 *   containing the tests. Receives a getter for the active test bed.
 * @param {Record<string, any>} [overrides] - Optional overrides for mock
 *   creation.
 * @returns {void}
 */
export const describeTurnManagerSuite = createDescribeTestBedSuite(
  TurnManagerTestBed,
  {
    beforeEachHook(bed) {
      jest.useFakeTimers();
      bed.initializeDefaultMocks();
    },
    afterEachHook() {
      // Timers restored via BaseTestBed cleanup; spies handled by _afterCleanup
    },
  }
);

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
 * Convenience export for {@link TurnManagerTestBed#startWithEntitiesAndFlush}.
 *
 * @param {TurnManagerTestBed} bed - Test bed instance.
 * @param {...{ id: string }} entities - Entities to register as active.
 * @returns {Promise<void>} Resolves once timers are flushed.
 */
export async function startWithEntitiesAndFlush(bed, ...entities) {
  await bed.startWithEntitiesAndFlush(...entities);
}

export { flushPromisesAndTimers };

/*
Usage:
  describeRunningTurnManagerSuite('My Suite', (getBed) => {
    const bed = getBed();
    // bed.turnManager is already running
  });
*/
