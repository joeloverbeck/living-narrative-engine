/**
 * @file Provides a minimal test bed for TurnManager unit tests.
 * @see tests/common/turns/turnManagerTestBed.js
 */

import { jest } from '@jest/globals';
import TurnManager from '../../../src/turns/turnManager.js';
import {
  createMockLogger,
  createMockEntityManager,
  createMockValidatedEventDispatcher,
} from '../mockFactories.js';

/**
 * @description Utility class that instantiates {@link TurnManager} with mocked
 * dependencies and exposes helpers for common test operations.
 * @class
 */
export class TurnManagerTestBed {
  /** @type {ReturnType<typeof createMockLogger>} */
  logger;
  /** @type {ReturnType<typeof createMockEntityManager>} */
  entityManager;
  /** @type {ReturnType<typeof createMockValidatedEventDispatcher> & { subscribe: jest.Mock, _triggerEvent: Function }} */
  dispatcher;
  /** @type {{ isEmpty: jest.Mock, getNextEntity: jest.Mock, startNewRound: jest.Mock, clearCurrentRound: jest.Mock }} */
  turnOrderService;
  /** @type {{ resolveHandler: jest.Mock }} */
  turnHandlerResolver;
  /** @type {TurnManager} */
  turnManager;
  /** @private */
  _handlers;

  constructor() {
    this.logger = createMockLogger();
    this.entityManager = createMockEntityManager();
    // Attach active entity map used by TurnManager
    this.entityManager.activeEntities = new Map();
    this.entityManager.getEntityInstance = jest.fn((id) =>
      this.entityManager.activeEntities.get(id)
    );
    this.entityManager.getActiveEntities.mockImplementation(() =>
      Array.from(this.entityManager.activeEntities.values())
    );

    this.turnOrderService = {
      isEmpty: jest.fn(),
      getNextEntity: jest.fn(),
      startNewRound: jest.fn(),
      clearCurrentRound: jest.fn(),
    };

    this.turnHandlerResolver = {
      resolveHandler: jest.fn(),
    };

    this._handlers = {};
    this.dispatcher = {
      ...createMockValidatedEventDispatcher(),
      subscribe: jest.fn((eventType, handler) => {
        if (!this._handlers[eventType]) {
          this._handlers[eventType] = [];
        }
        this._handlers[eventType].push(handler);
        return () => {
          this._handlers[eventType] = this._handlers[eventType].filter(
            (h) => h !== handler
          );
        };
      }),
      _triggerEvent: (eventType, payload) => {
        if (this._handlers[eventType]) {
          this._handlers[eventType].forEach((h) =>
            h({ type: eventType, payload })
          );
        }
      },
    };

    this.mocks = {
      turnOrderService: this.turnOrderService,
      entityManager: this.entityManager,
      logger: this.logger,
      dispatcher: this.dispatcher,
      turnHandlerResolver: this.turnHandlerResolver,
    };

    this.turnManager = new TurnManager({
      turnOrderService: this.turnOrderService,
      entityManager: this.entityManager,
      logger: this.logger,
      dispatcher: this.dispatcher,
      turnHandlerResolver: this.turnHandlerResolver,
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
    this.dispatcher._triggerEvent(eventType, payload);
  }

  /**
   * Clears all mocks and stops the TurnManager.
   *
   * @returns {Promise<void>}
   */
  async cleanup() {
    jest.clearAllMocks();
    if (this.turnManager && typeof this.turnManager.stop === 'function') {
      await this.turnManager.stop();
    }
  }
}

/**
 * Creates a new {@link TurnManagerTestBed} instance.
 *
 * @returns {TurnManagerTestBed} Test bed instance.
 */
export function createTurnManagerTestBed() {
  return new TurnManagerTestBed();
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

export default TurnManagerTestBed;
