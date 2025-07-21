/**
 * @file Mixin providing start and spy utilities for TurnManager tests.
 */

import { jest } from '@jest/globals';
import { flushPromisesAndTimers } from '../jestHelpers.js';

/**
 * @description Extends a test bed with helpers for starting the manager
 * and spying on lifecycle methods.
 * @param {typeof import('../baseTestBed.js').default} Base - Base class to extend.
 * @returns {typeof import('../baseTestBed.js').default} Extended class with start helpers.
 */
export function StartHelpersMixin(Base) {
  return class StartHelpers extends Base {
    /**
     * Executes start logic within {@link BaseTestBed#withReset}.
     *
     * @param {() => Promise<void>} startFn - Start callback.
     * @returns {Promise<void>} Resolves when start completes.
     * @private
     */
    async #startInternal(startFn) {
      await this.withReset(startFn);
    }

    /**
     * Adds entities then starts the manager.
     *
     * @param {...{ id: string }} entities - Entities to register.
     * @returns {Promise<void>} Resolves once started.
     */
    async startWithEntities(...entities) {
      await this.#startInternal(async () => {
        this.setActiveEntities(...entities);
        await this.turnManager.start();
      });
    }

    /**
     * Starts the manager without advancing the first turn.
     *
     * @returns {Promise<void>} Resolves once running.
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
     * Starts the manager then flushes timers and promises.
     *
     * @returns {Promise<void>} Resolves when flush completes.
     */
    async startAndFlush() {
      try {
        await this.#startInternal(async () => {
          await this.turnManager.start();
        });
        await flushPromisesAndTimers(5); // Use shorter iteration limit
      } catch (error) {
        console.warn('startAndFlush error:', error.message);
        throw error;
      }
    }

    /**
     * Adds entities, starts the manager and flushes timers.
     *
     * @param {...{ id: string }} entities - Entities to register.
     * @returns {Promise<void>} Resolves once flush completes.
     */
    async startWithEntitiesAndFlush(...entities) {
      try {
        await this.startWithEntities(...entities);
        await flushPromisesAndTimers(5); // Use shorter iteration limit
      } catch (error) {
        console.warn('startWithEntitiesAndFlush error:', error.message);
        throw error;
      }
    }

    /**
     * Starts with default actors and flushes pending tasks.
     *
     * @returns {Promise<{ ai1: object, ai2: object, player: object }>} Created actors.
     */
    async startWithDefaultActorsAndFlush() {
      try {
        const actors = this.addDefaultActors();
        await this.startAndFlush();
        return actors;
      } catch (error) {
        console.warn('startWithDefaultActorsAndFlush error:', error.message);
        throw error;
      }
    }

    /**
     * Calls advanceTurn then flushes timers/promises.
     *
     * @param {boolean} [suppressErrors] - Whether to suppress errors for error handling tests
     * @returns {Promise<void>} Resolves when flush completes.
     */
    async advanceAndFlush(suppressErrors = false) {
      try {
        // Call advanceTurn
        await this.turnManager.advanceTurn();

        // If using real timers, we need to wait for any setTimeout(0) callbacks
        if (!jest.isMockFunction(setTimeout)) {
          await new Promise((resolve) => setTimeout(resolve, 10)); // Wait for real timer
        }

        await flushPromisesAndTimers(5); // Use shorter iteration limit for better performance
      } catch (error) {
        if (!suppressErrors) {
          // Log error for debugging but don't silently fail
          console.warn('advanceAndFlush error:', error.message);
          throw error;
        }
        // For error handling tests, we expect errors so just continue
        // Flush additional times to ensure all error handling completes
        await flushPromisesAndTimers(10);
      }
    }

    /**
     * Spies on {@link import('../../../src/turns/turnManager.js').default.stop}.
     *
     * @returns {import('@jest/globals').Mock} Spy instance.
     */
    spyOnStop() {
      const spy = jest.spyOn(this.turnManager, 'stop');
      this.trackSpy(spy);
      return spy;
    }

    /**
     * Spies on {@link import('../../../src/turns/turnManager.js').default.stop}
     * and logs invocation.
     *
     * @returns {import('@jest/globals').Mock} Spy instance.
     */
    spyOnStopWithDebug() {
      const spy = this.spyOnStop();
      spy.mockImplementation(() => {
        this.mocks.logger.debug('Mocked instance.stop() called.');
      });
      return spy;
    }

    /**
     * Spies on {@link import('../../../src/turns/turnManager.js').default.stop}
     * resolving without side effects.
     *
     * @returns {import('@jest/globals').Mock} Spy instance.
     */
    spyOnStopNoOp() {
      const spy = this.spyOnStop();
      spy.mockResolvedValue();
      return spy;
    }

    /**
     * Spies on {@link import('../../../src/turns/turnManager.js').default.advanceTurn}.
     *
     * @returns {import('@jest/globals').Mock} Spy instance.
     */
    spyOnAdvanceTurn() {
      const spy = jest.spyOn(this.turnManager, 'advanceTurn');
      this.trackSpy(spy);
      return spy;
    }

    /**
     * Prepares the manager for {@link import('../../../src/turns/turnManager.js').default.start}.
     *
     * @returns {import('@jest/globals').Mock} Spy used during preparation.
     */
    prepareRunningManager() {
      this.setupMockHandlerResolver();
      const spy = this.spyOnAdvanceTurn();
      spy.mockResolvedValue(undefined);
      this.resetMocks();
      return spy;
    }

    /**
     * Forces {@link import('../../../src/turns/turnManager.js').default.start} to fail.
     *
     * @param {Error} [error] - Error to reject with.
     * @returns {import('@jest/globals').Mock} Rejecting spy.
     */
    mockStartFailure(error = new Error('Start failure')) {
      this.setupMockHandlerResolver();
      const spy = this.spyOnAdvanceTurn();
      spy.mockRejectedValue(error);
      this.resetMocks();
      return spy;
    }
  };
}

export default StartHelpersMixin;
