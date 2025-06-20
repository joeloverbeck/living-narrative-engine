/**
 * @file Provides a minimal test bed for TurnManager unit tests.
 * @see tests/common/turns/turnManagerTestBed.js
 */

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
    const logger = overrides.logger ?? createMockLogger();
    const entityManager = overrides.entityManager ?? createMockEntityManager();
    // Attach active entity map used by TurnManager
    entityManager.activeEntities = new Map();
    entityManager.getEntityInstance = jest.fn((id) =>
      entityManager.activeEntities.get(id)
    );
    entityManager.getActiveEntities.mockImplementation(() =>
      Array.from(entityManager.activeEntities.values())
    );

    const turnOrderService = overrides.turnOrderService ?? {
      isEmpty: jest.fn(),
      getNextEntity: jest.fn(),
      startNewRound: jest.fn(),
      clearCurrentRound: jest.fn(),
    };

    const turnHandlerResolver = overrides.turnHandlerResolver ?? {
      resolveHandler: jest.fn(),
    };

    const dispatcher = overrides.dispatcher ?? createMockValidatedEventBus();

    const mocks = {
      turnOrderService,
      entityManager,
      logger,
      dispatcher,
      turnHandlerResolver,
    };
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
   * Clears all mocks and stops the TurnManager.
   *
   * @returns {Promise<void>}
   */
  async cleanup() {
    await super.cleanup();
    if (this.turnManager && typeof this.turnManager.stop === 'function') {
      await this.turnManager.stop();
    }
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
