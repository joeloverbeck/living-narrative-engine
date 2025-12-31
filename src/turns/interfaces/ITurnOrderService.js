// src/interfaces/ITurnOrderService.js

/**
 * @file Defines the interface for the Turn Order Service.
 * This service manages the flow of turns within a round of combat or other turn-based activity.
 */

// Ensure consistent Entity type definition across files
/**
 * Represents an entity in the game (e.g., player, NPC).
 * Implementations will likely use a more concrete class or interface.
 *
 * @typedef {import('./ITurnOrderQueue.js').Entity} Entity
 */

/**
 * @typedef {'round-robin'} TurnOrderStrategy
 * Defines the possible strategies for determining turn order.
 * - 'round-robin': Entities take turns in a fixed sequence.
 */

/**
 * @interface ITurnOrderService
 * @classdesc Defines the contract for a service that manages the overall turn order for a round or encounter.
 * It uses an underlying queue structure (ITurnOrderQueue) based on the selected strategy.
 */
export class ITurnOrderService {
  /**
   * Initializes and starts a new round of turns. This typically clears any previous round's state.
   *
   * @function startNewRound
   * @param {Array<Entity>} entities - An array of entity objects participating in this round.
   * @param {TurnOrderStrategy} strategy - The strategy to use for ordering turns ('round-robin').
   * @returns {void}
   * @throws {Error} Implementations might throw if entities array is empty or invalid.
   */
  startNewRound(entities, strategy) {
    throw new Error('ITurnOrderService.startNewRound method not implemented.');
  }

  /**
   * Gets the next entity whose turn it is and advances the turn order.
   * This effectively consumes the turn from the underlying queue.
   *
   * @function getNextEntity
   * @returns {Entity | null} The entity whose turn is next, or null if the round is over or the queue is empty.
   */
  getNextEntity() {
    throw new Error('ITurnOrderService.getNextEntity method not implemented.');
  }

  /**
   * Returns the next entity in the turn order without advancing the turn.
   * Useful for predicting who is next without changing the state.
   *
   * @function peekNextEntity
   * @returns {Entity | null} The entity whose turn is next, or null if the round is over or the queue is empty.
   */
  peekNextEntity() {
    throw new Error('ITurnOrderService.peekNextEntity method not implemented.');
  }

  /**
   * Adds an entity to the current round's turn order dynamically (e.g., a summoned creature).
   * The entity is added at the end of the round-robin queue.
   *
   * @function addEntity
   * @param {Entity} entity - The entity to add.
   * @returns {void}
   * @throws {Error} Implementations might throw if the entity is invalid or cannot be added (e.g., already present).
   */
  addEntity(entity) {
    throw new Error('ITurnOrderService.addEntity method not implemented.');
  }

  /**
   * Removes an entity from the current round's turn order (e.g., if defeated or removed from combat).
   *
   * @function removeEntity
   * @param {string} entityId - The unique ID of the entity to remove.
   * @returns {void}
   * // Note: Implementation should decide if removing an entity that doesn't exist is an error or a no-op.
   */
  removeEntity(entityId) {
    throw new Error('ITurnOrderService.removeEntity method not implemented.');
  }

  /**
   * Checks if the turn order queue for the current round is empty (meaning all entities have taken their turn this round, or the round hasn't started/was cleared).
   *
   * @function isEmpty
   * @returns {boolean} True if the turn order is complete or empty, false otherwise.
   */
  isEmpty() {
    throw new Error('ITurnOrderService.isEmpty method not implemented.');
  }

  /**
   * Gets a list of entities currently remaining in the turn order for this round.
   * This list should be treated as read-only by consumers. The order reflects the *remaining* turn sequence.
   *
   * @function getCurrentOrder
   * @returns {ReadonlyArray<Entity>} A read-only array of entities remaining in the turn order. Returns an empty array `[]` if none remain.
   * (Note: JSDoc uses `Array<Entity>`, the `ReadonlyArray` implies intent).
   */
  getCurrentOrder() {
    throw new Error(
      'ITurnOrderService.getCurrentOrder method not implemented.'
    );
  }

  /**
   * Clears the current turn order queue and resets any round-specific state.
   * Typically called when a round ends or is explicitly stopped.
   *
   * @function clearCurrentRound
   * @returns {void}
   */
  clearCurrentRound() {
    throw new Error(
      'ITurnOrderService.clearCurrentRound method not implemented.'
    );
  }

  // As per ticket instructions, setStrategy is omitted for now, assuming it's only set via startNewRound.
  // /**
  //  * (Optional) Sets the turn order strategy for subsequent rounds or potentially mid-round if supported.
  //  * @function setStrategy
  //  * @param {TurnOrderStrategy} strategy - The new strategy to use.
  //  * @returns {void}
  //  */
  // setStrategy(strategy) {
  //     throw new Error('ITurnOrderService.setStrategy method not implemented.');
  // }
}

// --- Boilerplate to ensure this file is treated as a module ---
export {};
