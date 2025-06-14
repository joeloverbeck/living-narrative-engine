// src/utils/mapManager.js

/**
 * @class MapManager
 * @description
 * Generic helper for managing an internal Map with basic add, get,
 * remove, and presence-check operations. Provides static ID validation
 * and allows subclasses to customise how invalid IDs are handled.
 */
class MapManager {
  /**
   * Initializes the internal Map storage.
   */
  constructor() {
    /**
     * Internal storage map.
     * @type {Map<string, any>}
     */
    this.items = new Map();
  }

  /**
   * Determine if a value is a non-empty string ID.
   *
   * @param {any} id
   * @returns {boolean}
   */
  static isValidId(id) {
    return typeof id === 'string' && id.trim() !== '';
  }

  /**
   * Hook called when an invalid ID is encountered. Subclasses may override
   * to customise behaviour (e.g., logging instead of throwing).
   *
   * @protected
   * @param {any} id
   * @param {string} operation
   */
  onInvalidId(id, operation) {
    throw new Error(
      `${this.constructor.name}.${operation}: Invalid id '${id}'.`
    );
  }

  /**
   * Add or overwrite a value for the given ID.
   *
   * @param {string} id
   * @param {any} value
   */
  add(id, value) {
    if (!MapManager.isValidId(id)) {
      this.onInvalidId(id, 'add');
      return;
    }
    this.items.set(id, value);
  }

  /**
   * Retrieve a value by its ID.
   *
   * @param {string} id
   * @returns {any}
   */
  get(id) {
    if (!MapManager.isValidId(id)) {
      this.onInvalidId(id, 'get');
      return undefined;
    }
    return this.items.get(id);
  }

  /**
   * Check if the map contains the given ID.
   *
   * @param {string} id
   * @returns {boolean}
   */
  has(id) {
    if (!MapManager.isValidId(id)) {
      this.onInvalidId(id, 'has');
      return false;
    }
    return this.items.has(id);
  }

  /**
   * Remove an entry by ID.
   *
   * @param {string} id
   * @returns {boolean}
   */
  remove(id) {
    if (!MapManager.isValidId(id)) {
      this.onInvalidId(id, 'remove');
      return false;
    }
    return this.items.delete(id);
  }

  /** @returns {IterableIterator<string>} */
  keys() {
    return this.items.keys();
  }

  /** @returns {IterableIterator<any>} */
  values() {
    return this.items.values();
  }

  /** @returns {IterableIterator<[string, any]>} */
  entries() {
    return this.items.entries();
  }

  /**
   * Remove all entries from the map.
   */
  clear() {
    this.items.clear();
  }
}

export default MapManager;
