// src/turns/interfaces/ITurnStateHost.js
// ──────────────────────────────────────────────────────────────────────────────

/**
 * @interface ITurnStateHost
 * @description
 * Minimal contract implemented by whatever object owns the turn-state
 * machine (today that is `BaseTurnHandler`).  Deliberately “string-typed”
 * to avoid any import that could create a dependency cycle.
 */
export class ITurnStateHost {
  /**
   * Low-level helper used by the state machine to switch states.
   *
   * @param {object} newState
   *        An object that *conforms* to {@link ITurnState}.  We keep the
   *        parameter loosely typed here to eliminate the `Host → State`
   *        edge that created the cycle.  Concrete hosts should still
   *        validate the instance at runtime.
   * @returns {Promise<void>}
   */
  async _transitionToState(newState) {
    throw new Error('ITurnStateHost._transitionToState must be implemented.');
  }

  /**
   * Retrieves the current turn context, if any.
   *
   * @returns {unknown|null}  (Implements ITurnContext in concrete classes.)
   */
  getTurnContext() {
    throw new Error('ITurnStateHost.getTurnContext must be implemented.');
  }

  // ───────────────────────────────────────────
  // Higher-level helpers invoked by states
  // ───────────────────────────────────────────

  /** @returns {Promise<void>} */
  async requestIdleStateTransition() {
    throw new Error(
      'ITurnStateHost.requestIdleStateTransition not implemented.'
    );
  }

  /** @returns {Promise<void>} */
  async requestAwaitingInputStateTransition() {
    throw new Error(
      'ITurnStateHost.requestAwaitingInputStateTransition not implemented.'
    );
  }

  /**
   * @param {string} commandString
   * @param {unknown} turnAction   (Implements ITurnAction in concrete code.)
   * @returns {Promise<void>}
   */
  async requestProcessingCommandStateTransition(commandString, turnAction) {
    throw new Error(
      'ITurnStateHost.requestProcessingCommandStateTransition not implemented.'
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────────
