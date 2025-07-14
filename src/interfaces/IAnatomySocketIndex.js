/**
 * @file Interface for anatomy socket indexing and lookup
 * @see src/anatomy/services/anatomySocketIndex.js
 */

/**
 * @interface IAnatomySocketIndex
 * @description Provides O(1) socket lookup and indexing for anatomy entities
 */
export class IAnatomySocketIndex {
  /**
   * Builds or rebuilds the socket index for a root entity
   *
   * @param {string} _rootEntityId - The root entity to index
   * @returns {Promise<void>}
   */
  async buildIndex(_rootEntityId) {
    throw new Error('Interface method');
  }

  /**
   * Finds the entity that contains a specific socket
   *
   * @param {string} _rootEntityId - The root entity to search within
   * @param {string} _socketId - The socket ID to find
   * @returns {Promise<string|null>} The entity ID that contains the socket, or null if not found
   */
  async findEntityWithSocket(_rootEntityId, _socketId) {
    throw new Error('Interface method');
  }

  /**
   * Gets all sockets for a specific entity
   *
   * @param {string} _entityId - The entity to get sockets for
   * @returns {Promise<Array<{id: string, orientation: string}>>} Array of socket objects
   */
  async getEntitySockets(_entityId) {
    throw new Error('Interface method');
  }

  /**
   * Gets all entities that have sockets within a root entity hierarchy
   *
   * @param {string} _rootEntityId - The root entity to search within
   * @returns {Promise<string[]>} Array of entity IDs that have sockets
   */
  async getEntitiesWithSockets(_rootEntityId) {
    throw new Error('Interface method');
  }

  /**
   * Invalidates the index for a specific root entity
   *
   * @param {string} _rootEntityId - The root entity to invalidate
   * @returns {void}
   */
  invalidateIndex(_rootEntityId) {
    throw new Error('Interface method');
  }

  /**
   * Clears all cached indexes
   *
   * @returns {void}
   */
  clearCache() {
    throw new Error('Interface method');
  }
}
