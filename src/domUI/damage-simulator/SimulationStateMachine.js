/**
 * @file SimulationStateMachine.js
 * @description Manages simulation lifecycle state with validated transitions.
 */

const SimulationState = Object.freeze({
  IDLE: 'IDLE',
  CONFIGURED: 'CONFIGURED',
  RUNNING: 'RUNNING',
  STOPPING: 'STOPPING',
  COMPLETED: 'COMPLETED',
  ERROR: 'ERROR',
});

const VALID_TRANSITIONS = Object.freeze({
  [SimulationState.IDLE]: [SimulationState.CONFIGURED],
  [SimulationState.CONFIGURED]: [SimulationState.RUNNING],
  [SimulationState.RUNNING]: [
    SimulationState.STOPPING,
    SimulationState.COMPLETED,
    SimulationState.ERROR,
  ],
  [SimulationState.STOPPING]: [SimulationState.COMPLETED, SimulationState.ERROR],
  [SimulationState.COMPLETED]: [
    SimulationState.RUNNING,
    SimulationState.CONFIGURED,
  ],
  [SimulationState.ERROR]: [SimulationState.RUNNING, SimulationState.CONFIGURED],
});

class SimulationStateMachine {
  #currentState;
  #onStateChange;

  /**
   * @param {Function} [onStateChange] - Optional callback for state changes
   */
  constructor(onStateChange = null) {
    this.#currentState = SimulationState.IDLE;
    this.#onStateChange = onStateChange;
  }

  get state() {
    return this.#currentState;
  }

  /**
   * Attempts transition to new state.
   * @param {string} newState - Target state
   * @throws {Error} If transition is invalid
   */
  transition(newState) {
    const validNextStates = VALID_TRANSITIONS[this.#currentState] || [];
    if (!validNextStates.includes(newState)) {
      throw new Error(
        `Invalid state transition: ${this.#currentState} -> ${newState}. ` +
          `Valid transitions: ${validNextStates.join(', ')}`
      );
    }
    const previousState = this.#currentState;
    this.#currentState = newState;
    this.#onStateChange?.(previousState, newState);
  }

  /**
   * Checks if transition is valid without performing it.
   * @param {string} newState - Target state
   * @returns {boolean}
   */
  canTransition(newState) {
    return VALID_TRANSITIONS[this.#currentState]?.includes(newState) ?? false;
  }

  // Convenience state checks
  get isIdle() {
    return this.#currentState === SimulationState.IDLE;
  }
  get isConfigured() {
    return this.#currentState === SimulationState.CONFIGURED;
  }
  get isRunning() {
    return this.#currentState === SimulationState.RUNNING;
  }
  get isStopping() {
    return this.#currentState === SimulationState.STOPPING;
  }
  get isCompleted() {
    return this.#currentState === SimulationState.COMPLETED;
  }
  get isError() {
    return this.#currentState === SimulationState.ERROR;
  }
  get isActive() {
    return this.isRunning || this.isStopping;
  }
}

export { SimulationStateMachine, SimulationState };
export default SimulationStateMachine;
