/**
 * @file processingGuard.js
 * @description Utility to manage the processing flag for ProcessingCommandState.
 */

/**
 * @class ProcessingGuard
 * @description Manages a boolean processing flag for a state instance.
 */
export class ProcessingGuard {
  /**
   * @param {{ _setProcessing: function(boolean): void }} owner -
   *   Object owning the flag and exposing a setter.
   */
  constructor(owner) {
    this._owner = owner;
  }

  /**
   * @description Marks processing as started.
   * @returns {void}
   */
  start() {
    if (this._owner && typeof this._owner._setProcessing === 'function') {
      this._owner._setProcessing(true);
    }
  }

  /**
   * @description Marks processing as finished.
   * @returns {void}
   */
  finish() {
    if (this._owner && typeof this._owner._setProcessing === 'function') {
      this._owner._setProcessing(false);
    }
  }
}

export default ProcessingGuard;
