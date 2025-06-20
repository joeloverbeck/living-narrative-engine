/**
 * @file IDataRegistry.js
 * @description Interface for data registry services that manage game data storage and retrieval.
 */

/**
 * @interface IDataRegistry
 * @description Interface for data registry services that provide centralized access to game data.
 */
export class IDataRegistry {
  /**
   * Registers data with the registry.
   *
   * @param {string} key - The key to register the data under.
   * @param {any} data - The data to register.
   * @returns {void}
   */
  register(key, data) {
    throw new Error('IDataRegistry.register() must be implemented');
  }

  /**
   * Retrieves data from the registry.
   *
   * @param {string} key - The key to retrieve data for.
   * @returns {any} The registered data or undefined if not found.
   */
  get(key) {
    throw new Error('IDataRegistry.get() must be implemented');
  }

  /**
   * Checks if data exists in the registry.
   *
   * @param {string} key - The key to check.
   * @returns {boolean} True if data exists for the key.
   */
  has(key) {
    throw new Error('IDataRegistry.has() must be implemented');
  }

  /**
   * Removes data from the registry.
   *
   * @param {string} key - The key to remove.
   * @returns {boolean} True if data was removed, false if not found.
   */
  remove(key) {
    throw new Error('IDataRegistry.remove() must be implemented');
  }

  /**
   * Clears all data from the registry.
   *
   * @returns {void}
   */
  clear() {
    throw new Error('IDataRegistry.clear() must be implemented');
  }

  /**
   * Gets all registered keys.
   *
   * @returns {string[]} Array of all registered keys.
   */
  keys() {
    throw new Error('IDataRegistry.keys() must be implemented');
  }

  /**
   * Gets all registered values.
   *
   * @returns {any[]} Array of all registered values.
   */
  values() {
    throw new Error('IDataRegistry.values() must be implemented');
  }

  /**
   * Gets all registered key-value pairs.
   *
   * @returns {Array<[string, any]>} Array of key-value pairs.
   */
  entries() {
    throw new Error('IDataRegistry.entries() must be implemented');
  }
} 