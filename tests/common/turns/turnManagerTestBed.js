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
import { StartHelpersMixin } from './startHelpersMixin.js';

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
  StartHelpersMixin(
    EntitySetupMixin(SpyTrackerMixin(TurnManagerFactoryMixin()))
  )
) {
  constructor(overrides = {}) {
    super(overrides);
    this.entityManager = this.mocks.entityManager;
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
