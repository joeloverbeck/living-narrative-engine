/**
 * @module turns/errors/aiStrategyErrors
 * @description
 * Defines strategy-specific error types for the orchestrator.
 */

/**
 * @class NoActionsDiscoveredError
 * @augments Error
 * @description Thrown when no valid actions are discovered for an actor.
 * @param {string} actorId - The ID of the actor for whom no actions were found.
 */
export class NoActionsDiscoveredError extends Error {
  constructor(actorId) {
    super(`No actions for actor ${actorId}`);
    this.name = 'NoActionsDiscoveredError';
  }
}

/**
 * @class InvalidIndexError
 * @augments Error
 * @description Thrown when a chosen index is out of bounds of the available actions.
 * @param {number} chosen - The index chosen by the LLM or user.
 * @param {number} max - The maximum valid index.
 */
export class InvalidIndexError extends Error {
  constructor(chosen, max) {
    super(`Index ${chosen} out of 1–${max}`);
    this.name = 'InvalidIndexError';
  }
}

/**
 * @class LLMTimeoutError
 * @augments Error
 * @description Thrown when an LLM call times out.
 */
export class LLMTimeoutError extends Error {
  constructor() {
    super('LLM call timed out');
    this.name = 'LLMTimeoutError';
  }
}
