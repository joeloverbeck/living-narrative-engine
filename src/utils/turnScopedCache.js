/**
 * @file A lightweight, turn-scoped cache mapping numeric indices → items, with O(1) add/get/clear and duplicate-index checking.
 * @see src/utils/turnScopedCache.js
 */

/**
 * A cache scoped to a single actor turn.
 *
 * @template T
 * @class
 */
export class TurnScopedCache {
  /**
   * @param {{ warn(message: string): void }} [logger]
   *   Optional logger; if provided, duplicate-index warnings go to `logger.warn(...)`.
   */
  constructor(logger) {
    /**
     * @private
     * @type {Map<number, T>}
     */
    this._map = new Map();

    /**
     * @private
     * @type {{ warn(message: string): void }|undefined}
     */
    this._logger = logger;
  }

  /**
   * Stores the given item under its `.index` property.
   *
   * @param {{ index: number }} item
   *   The item to cache; must have a numeric `index` field.
   * @throws {Error} If an item with the same `index` was already added.
   */
  add(item) {
    const idx = item.index;
    if (this._map.has(idx)) {
      const msg = `Duplicate index ${idx} in TurnScopedCache`;
      if (this._logger && typeof this._logger.warn === 'function') {
        this._logger.warn(msg);
      }
      throw new Error(msg);
    }
    this._map.set(idx, item);
  }

  /**
   * Retrieves the cached item for the given index.
   *
   * @param {number} index
   * @returns {T|undefined} The item, or `undefined` if none was stored.
   */
  get(index) {
    return this._map.get(index);
  }

  /**
   * Clears all entries; after this, `get(...)` always returns `undefined`.
   */
  clear() {
    this._map.clear();
  }
}
