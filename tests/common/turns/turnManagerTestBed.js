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
import {
  createMockActor,
  createMockEntity,
} from '../mockFactories/entities.js';
import { TURN_ENDED_ID } from '../../../src/constants/eventIds.js';

/**
 * Mock scheduler that works with Jest fake timers.
 * Provides better integration with Jest's timer mocking.
 */
class MockScheduler {
  setTimeout(fn, ms) {
    // Ensure we're properly using Jest's mocked setTimeout if available
    if (jest.isMockFunction(setTimeout)) {
      return setTimeout(fn, ms);
    }
    return setTimeout(fn, ms);
  }

  clearTimeout(id) {
    // Ensure we're properly using Jest's mocked clearTimeout if available
    if (jest.isMockFunction(clearTimeout)) {
      return clearTimeout(id);
    }
    return clearTimeout(id);
  }
}

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
        getCurrentOrder: jest.fn().mockReturnValue([]),
      },
    turnHandlerResolver: () =>
      overrides.turnHandlerResolver ?? { resolveHandler: jest.fn() },
    dispatcher: () => {
      if (overrides.dispatcher) return overrides.dispatcher;

      // Create a simpler mock that exposes handlers through call history
      const handlers = new Map();
      const dispatcher = {
        dispatch: jest.fn().mockResolvedValue(true),
        subscribe: jest.fn((eventType, handler) => {
          if (!handlers.has(eventType)) {
            handlers.set(eventType, new Set());
          }
          handlers.get(eventType).add(handler);

          const unsubscribe = () => {
            handlers.get(eventType)?.delete(handler);
          };
          return unsubscribe;
        }),
        // Keep the internal handler storage for tests that need it
        _handlers: handlers,
        // Allow tests to trigger events manually
        _triggerEvent(eventType, payload) {
          const eventHandlers = handlers.get(eventType) || new Set();
          eventHandlers.forEach((handler) =>
            handler({ type: eventType, payload })
          );

          // Important: TurnEventSubscription schedules callbacks with setTimeout(callback, 0)
          // We need to advance timers to execute these scheduled callbacks
          if (jest.isMockFunction(setTimeout) && jest.getTimerCount() > 0) {
            jest.advanceTimersByTime(0);
          }
        },
      };
      return dispatcher;
    },
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
      scheduler: new MockScheduler(), // Use mock scheduler for Jest fake timers
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

  /**
   * Creates a mock actor entity and registers it with the entity manager.
   *
   * @param {string} id - The entity ID.
   * @param {object} [options] - Options for creating the actor.
   * @returns {object} The created actor entity.
   */
  createActorEntity(id, options = {}) {
    const actor = createMockActor(id, options);
    this.entityManager.activeEntities.set(id, actor);
    return actor;
  }

  /**
   * Creates a mock entity and registers it with the entity manager.
   *
   * @param {string} id - The entity ID.
   * @param {object} [options] - Options for creating the entity.
   * @returns {object} The created entity.
   */
  createEntity(id, options = {}) {
    const entity = createMockEntity(id, options);
    this.entityManager.activeEntities.set(id, entity);
    return entity;
  }

  /**
   * Simulates the end of a turn by dispatching a TURN_ENDED_ID event.
   *
   * @param {string} entityId - The ID of the entity whose turn is ending.
   * @param {boolean} [success] - Whether the turn ended successfully.
   * @param {Error|null} [error] - Optional error if the turn failed.
   * @returns {Promise<void>} Resolves when the event is dispatched.
   */
  async endTurn(entityId, success = true, error = null) {
    await this.mocks.dispatcher.dispatch(TURN_ENDED_ID, {
      entityId,
      success,
      error,
    });
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
    jest.useFakeTimers({ legacyFakeTimers: false });
    bed.initializeDefaultMocks();
  },
  async afterEachHook(bed) {
    try {
      // Clear any pending timers first to prevent hanging
      jest.clearAllTimers();

      // Force stop the turn manager if it exists
      if (bed.turnManager && bed.turnManager.stop) {
        // Create a timeout promise to prevent hanging on stop
        const stopPromise = bed.turnManager.stop();
        const timeoutPromise = new Promise((resolve) =>
          setTimeout(resolve, 100)
        );
        await Promise.race([stopPromise, timeoutPromise]);
      }
    } catch (e) {
      // Ignore errors during cleanup
    } finally {
      // Always restore real timers to prevent leakage
      jest.useRealTimers();
    }

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
      jest.useFakeTimers({ legacyFakeTimers: false });
      bed.initializeDefaultMocks();
      await bed.startRunning();
    },
    async afterEachHook(bed) {
      try {
        // Clear any pending timers first to prevent hanging
        jest.clearAllTimers();

        // Force stop the turn manager by setting private field
        if (bed.turnManager) {
          try {
            // Access private field through a workaround to ensure manager stops
            Object.defineProperty(bed.turnManager, '_TurnManager__isRunning', {
              value: false,
              writable: true,
              configurable: true,
            });
          } catch (e) {
            // Ignore errors accessing private fields
          }

          // Also try to stop it normally with a timeout
          if (bed.turnManager.stop) {
            const stopPromise = bed.turnManager.stop();
            const timeoutPromise = new Promise((resolve) =>
              setTimeout(resolve, 100)
            );
            await Promise.race([stopPromise, timeoutPromise]);
          }
        }
      } catch (e) {
        // Ignore errors during cleanup
      } finally {
        // Always restore real timers to prevent leakage
        jest.useRealTimers();
      }

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
