/**
 * @file Provides a minimal test bed for TurnManager unit tests.
 * @see tests/common/turns/turnManagerTestBed.js
 */
/* eslint-env jest */
/* global describe, beforeEach, afterEach */

import { jest } from '@jest/globals';
import TurnManager from '../../../src/turns/turnManager.js';
import {
  createMockLogger,
  createMockEntityManager,
  createMockValidatedEventBus,
} from '../mockFactories.js';
import BaseTestBed from '../baseTestBed.js';

/**
 * @description Utility class that instantiates {@link TurnManager} with mocked
 * dependencies and exposes helpers for common test operations.
 * @class
 */
export class TurnManagerTestBed extends BaseTestBed {
  /** @type {TurnManager} */
  turnManager;

  constructor(overrides = {}) {
    const { mocks } = BaseTestBed.fromFactories({
      logger: () => overrides.logger ?? createMockLogger(),
      entityManager: () => {
        const em = overrides.entityManager ?? createMockEntityManager();
        em.activeEntities = new Map();
        em.getEntityInstance = jest.fn((id) => em.activeEntities.get(id));
        em.getActiveEntities.mockImplementation(() =>
          Array.from(em.activeEntities.values())
        );
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
    super(mocks);

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
  }

  /**
   * Adds entities then starts the manager, clearing mock call history.
   *
   * @param {...{ id: string }} entities - Entities to register as active.
   * @returns {Promise<void>} Resolves once the manager has started.
   */
  async startWithEntities(...entities) {
    this.setActiveEntities(...entities);
    await this.turnManager.start();
    this.resetMocks();
  }

  /**
   * Starts the manager but suppresses the initial advanceTurn call.
   *
   * @returns {Promise<void>} Resolves once the manager is running.
   */
  async startRunning() {
    const spy = jest
      .spyOn(this.turnManager, 'advanceTurn')
      .mockImplementationOnce(async () => {});
    await this.turnManager.start();
    spy.mockRestore();
    this.resetMocks();
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
   * Clears all mocks and stops the TurnManager.
   *
   * @returns {Promise<void>}
   */
  async cleanup() {
    await super.cleanup();
  }

  /**
   * Stops the TurnManager after base cleanup.
   *
   * @protected
   * @returns {Promise<void>} Promise resolving when manager cleanup is complete.
   */
  async _afterCleanup() {
    if (this.turnManager && typeof this.turnManager.stop === 'function') {
      await this.turnManager.stop();
    }
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
 * Flushes pending promises and advances all Jest timers.
 *
 * @description Flushes pending promises and advances all Jest timers.
 * @returns {Promise<void>} Resolves after timers have run.
 */
export const flushPromisesAndTimers = async () => {
  await jest.runAllTimersAsync();
};

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
export function describeTurnManagerSuite(title, suiteFn, overrides = {}) {
  describe(title, () => {
    let testBed;
    beforeEach(() => {
      testBed = new TurnManagerTestBed(overrides);
    });
    afterEach(async () => {
      await testBed.cleanup();
    });
    suiteFn(() => testBed);
  });
}

export default TurnManagerTestBed;
