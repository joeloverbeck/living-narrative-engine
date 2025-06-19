/**
 * @file processingGuard.js
 * @description Utility to manage the _isProcessing flag for ProcessingCommandState.
 */

/**
 * @class ProcessingGuard
 * @description Manages a boolean processing flag for a state instance.
 */
export class ProcessingGuard {
  /**
   * @param {{ _isProcessing: boolean }} owner - Object owning the flag.
   */
  constructor(owner) {
    this._owner = owner;
  }

  /**
   * @description Marks processing as started.
   * @returns {void}
   */
  start() {
    if (this._owner) {
      this._owner._isProcessing = true;
    }
  }

  /**
   * @description Marks processing as finished.
   * @returns {void}
   */
  finish() {
    if (this._owner) {
      this._owner._isProcessing = false;
    }
  }
}

export default ProcessingGuard;
