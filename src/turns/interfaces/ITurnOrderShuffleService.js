/**
 * @file Defines the interface for the Turn Order Shuffle Service.
 * @description This service handles randomization of turn order while preserving
 *              positions for specific entity types (e.g., human players).
 * @see specs/randomized-turn-ordering.md - Feature specification
 */

/** @typedef {import('./ITurnOrderQueue.js').Entity} Entity */

/**
 * @interface ITurnOrderShuffleService
 * @classdesc Defines the contract for a service that shuffles entity turn order
 *            while preserving positions for designated entities (typically human players).
 */
export class ITurnOrderShuffleService {
  /**
   * Shuffles the entities array while preserving human player positions.
   *
   * @function shuffleWithHumanPositionPreservation
   * @param {Entity[]} entities - Array of entities to shuffle
   * @param {string} strategy - Turn order strategy (e.g., 'round-robin', 'initiative')
   * @param {function(): number} [randomFn] - Optional random function for testing
   * @returns {Entity[]} Shuffled array (same reference, modified in place)
   */
  shuffleWithHumanPositionPreservation(entities, strategy, randomFn) {
    throw new Error(
      'ITurnOrderShuffleService.shuffleWithHumanPositionPreservation method not implemented.'
    );
  }

  /**
   * Checks if an entity is a human player.
   *
   * @function isHumanPlayer
   * @param {Entity} entity - Entity to check
   * @returns {boolean} True if the entity is a human player
   */
  isHumanPlayer(entity) {
    throw new Error(
      'ITurnOrderShuffleService.isHumanPlayer method not implemented.'
    );
  }
}

export {};
