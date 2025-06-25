/**
 * @file Defines the interface for saving game data.
 */

/**
 * @interface ISaveService
 * @description Contract for a service that saves the game.
 */
export class ISaveService {
  /**
   * Saves the current game state to a slot.
   *
   * @param {number} _slotId - Numeric slot identifier.
   * @param {string} _name - User provided save name.
   * @returns {Promise<{success: boolean, error?: string, filePath?: string}>}
   *   Result information from the save attempt.
   */
  async save(_slotId, _name) {
    throw new Error('ISaveService.save not implemented');
  }
}

export default ISaveService;
