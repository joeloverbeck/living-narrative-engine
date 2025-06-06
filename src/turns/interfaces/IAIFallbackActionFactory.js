// src/turns/interfaces/IAIFallbackActionFactory.js
// --- FILE START ---

/** @typedef {import('./IActorTurnStrategy.js').ITurnAction} ITurnAction */

/**
 * @interface IAIFallbackActionFactory
 * @description Defines the contract for creating fallback actions when
 * AI decision-making fails.
 */
export class IAIFallbackActionFactory {
  /**
   * Creates a fallback ITurnAction for the given failure context.
   *
   * @param {string} failureContext - Where the failure occurred.
   * @param {Error} error - The error that triggered the fallback.
   * @param {string} actorId - ID of the affected actor.
   * @returns {ITurnAction} The constructed fallback action.
   * @throws {Error} If not implemented by a subclass.
   */
  create(failureContext, error, actorId) {
    throw new Error('Method "create" must be implemented by concrete classes.');
  }
}

// --- FILE END ---
