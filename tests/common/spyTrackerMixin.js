/**
 * @file Mixin providing automatic restoration for jest spies in test beds.
 */

/**
 * @description Extends a base test bed class with spy tracking utilities.
 * @param {typeof import('./baseTestBed.js').default} Base - Base class to extend.
 * @returns {typeof import('./baseTestBed.js').default} Extended class with spy tracking.
 */
export function SpyTrackerMixin(Base) {
  return class SpyTracker extends Base {
    /**
     * Collection of tracked spies to be restored after each test.
     *
     * @type {Array<import('@jest/globals').Mock>}
     */
    _spies = [];

    /**
     * Registers a spy to be automatically restored during cleanup.
     *
     * @param {import('@jest/globals').Mock} spy - Spy instance to track.
     * @returns {void}
     */
    trackSpy(spy) {
      this._spies.push(spy);
    }

    /**
     * Restores all tracked spies then delegates to the base cleanup.
     *
     * @protected
     * @override
     * @returns {Promise<void>} Promise resolving when cleanup completes.
     */
    async _afterCleanup() {
      for (const spy of this._spies) {
        spy.mockRestore();
      }
      this._spies.length = 0;
      await super._afterCleanup();
    }
  };
}

export default SpyTrackerMixin;
