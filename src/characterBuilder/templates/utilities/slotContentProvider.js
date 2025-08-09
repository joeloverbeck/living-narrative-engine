/**
 * @file Slot Content Provider for template composition
 * @module characterBuilder/templates/utilities/slotContentProvider
 * @description Manages slot content for template composition with support for named and default slots
 */

/**
 * Manages slot content for template composition
 */
export class SlotContentProvider {
  #slots;
  #defaultSlot;

  constructor() {
    this.#slots = new Map();
    this.#defaultSlot = null;
  }

  /**
   * Register slot content
   *
   * @param {string|null} name - Slot name (null for default)
   * @param {string|Function} content - Slot content
   */
  setSlot(name, content) {
    if (name === null || name === undefined || name === '') {
      this.#defaultSlot = this.#processContent(content);
    } else {
      if (typeof name !== 'string') {
        throw new Error('Slot name must be a string or null for default slot');
      }
      this.#slots.set(name, this.#processContent(content));
    }
  }

  /**
   * Get slot content by name
   *
   * @param {string|null} name - Slot name
   * @param {*} fallback - Fallback content
   * @returns {string} Slot content
   */
  getSlot(name, fallback = '') {
    if (name === null || name === undefined || name === '') {
      return this.#defaultSlot !== null
        ? this.#defaultSlot
        : this.#processContent(fallback);
    }

    if (this.#slots.has(name)) {
      return this.#slots.get(name);
    }

    return this.#processContent(fallback);
  }

  /**
   * Check if slot exists
   *
   * @param {string|null} name - Slot name
   * @returns {boolean}
   */
  hasSlot(name) {
    if (name === null || name === undefined || name === '') {
      return this.#defaultSlot !== null;
    }
    return this.#slots.has(name);
  }

  /**
   * Get all slot names (excluding default)
   *
   * @returns {Array<string>} Array of slot names
   */
  getSlotNames() {
    return Array.from(this.#slots.keys());
  }

  /**
   * Get all slots including default
   *
   * @returns {object} Object with all slots
   */
  getAllSlots() {
    const slots = {};

    if (this.#defaultSlot !== null) {
      slots.default = this.#defaultSlot;
    }

    for (const [name, content] of this.#slots.entries()) {
      slots[name] = content;
    }

    return slots;
  }

  /**
   * Remove a specific slot
   *
   * @param {string|null} name - Slot name to remove
   * @returns {boolean} True if slot was removed
   */
  removeSlot(name) {
    if (name === null || name === undefined || name === '') {
      if (this.#defaultSlot !== null) {
        this.#defaultSlot = null;
        return true;
      }
      return false;
    }

    return this.#slots.delete(name);
  }

  /**
   * Clear all slots
   */
  clear() {
    this.#slots.clear();
    this.#defaultSlot = null;
  }

  /**
   * Get the number of slots (including default if set)
   *
   * @returns {number} Total number of slots
   */
  get size() {
    return this.#slots.size + (this.#defaultSlot !== null ? 1 : 0);
  }

  /**
   * Check if provider has any slots
   *
   * @returns {boolean} True if any slots exist
   */
  get isEmpty() {
    return this.#slots.size === 0 && this.#defaultSlot === null;
  }

  /**
   * Process content (handle functions and strings)
   *
   * @private
   * @param {string|Function} content - Content to process
   * @returns {string} Processed content
   */
  #processContent(content) {
    if (content === null || content === undefined) {
      return '';
    }

    if (typeof content === 'function') {
      try {
        const result = content();
        return String(result);
      } catch (error) {
        console.error('Error executing slot content function:', error);
        return '';
      }
    }

    return String(content);
  }

  /**
   * Merge another SlotContentProvider into this one
   *
   * @param {SlotContentProvider} other - Other provider to merge
   * @param {boolean} overwrite - Whether to overwrite existing slots
   */
  merge(other, overwrite = true) {
    if (!(other instanceof SlotContentProvider)) {
      throw new Error(
        'Can only merge with another SlotContentProvider instance'
      );
    }

    // Merge default slot
    if (other.hasSlot(null)) {
      if (overwrite || !this.hasSlot(null)) {
        this.#defaultSlot = other.getSlot(null);
      }
    }

    // Merge named slots
    for (const name of other.getSlotNames()) {
      if (overwrite || !this.hasSlot(name)) {
        this.setSlot(name, other.getSlot(name));
      }
    }
  }

  /**
   * Clone this provider
   *
   * @returns {SlotContentProvider} New provider with same slots
   */
  clone() {
    const clone = new SlotContentProvider();

    if (this.#defaultSlot !== null) {
      clone.setSlot(null, this.#defaultSlot);
    }

    for (const [name, content] of this.#slots.entries()) {
      clone.setSlot(name, content);
    }

    return clone;
  }

  /**
   * Create a SlotContentProvider from a plain object
   *
   * @static
   * @param {object} obj - Object with slot data
   * @returns {SlotContentProvider} New provider instance
   */
  static fromObject(obj) {
    const provider = new SlotContentProvider();

    if (!obj || typeof obj !== 'object') {
      return provider;
    }

    for (const [key, value] of Object.entries(obj)) {
      if (key === 'default') {
        provider.setSlot(null, value);
      } else {
        provider.setSlot(key, value);
      }
    }

    return provider;
  }

  /**
   * Convert provider to plain object
   *
   * @returns {object} Plain object representation
   */
  toObject() {
    return this.getAllSlots();
  }
}

// Export utility functions for testing
export const __testUtils = {
  createTestProvider: () => new SlotContentProvider(),
};
