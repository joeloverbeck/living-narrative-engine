/**
 * @file Defines the interface for loading game data.
 */

/**
 * @interface ILoadService
 * @description Contract for a service that loads saved games.
 */
export class ILoadService {
  /**
   * Loads a saved game by identifier.
   *
   * @param {string} _identifier - Unique save identifier or path.
   * @returns {Promise<{success: boolean, error?: string}>}
   *   Result of the load attempt.
   */
  async load(_identifier) {
    throw new Error('ILoadService.load not implemented');
  }
}

export default ILoadService;
