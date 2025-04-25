// src/components/inventoryComponent.js

import Component from './component.js';

export class InventoryComponent extends Component {
  /** @param {{items: string[]}} data */
  constructor(data) {
    super();
    // Default to empty array if items property is missing or not an array
    this.items = (data && Array.isArray(data.items)) ? [...data.items] : [];
  }

  /**
     * Adds an item ID to the inventory. For MVP, does not check for duplicates.
     * @param {string} itemId - The ID of the item to add.
     */
  addItem(itemId) {
    if (typeof itemId === 'string' && itemId.length > 0) {
      this.items.push(itemId);
      // console.log(`InventoryComponent: Added item ${itemId}. Current items: ${this.items.join(', ')}`); // Optional debug log
    } else {
      console.warn(`InventoryComponent: Attempted to add invalid itemId: ${itemId}`);
    }
  }

  /**
     * Removes the first occurrence of an item ID from the inventory.
     * @param {string} itemId - The ID of the item to remove.
     * @returns {boolean} True if the item was found and removed, false otherwise.
     */
  removeItem(itemId) {
    const index = this.items.indexOf(itemId);
    if (index > -1) {
      this.items.splice(index, 1);
      // console.log(`InventoryComponent: Removed item ${itemId}. Current items: ${this.items.join(', ')}`); // Optional debug log
      return true;
    }
    return false;
  }

  /**
     * Checks if the inventory contains a specific item ID.
     * @param {string} itemId - The ID of the item to check for.
     * @returns {boolean} True if the item is present, false otherwise.
     */
  hasItem(itemId) {
    return this.items.includes(itemId);
  }

  /**
     * Gets a copy of the list of item IDs currently in the inventory.
     * @returns {string[]} A new array containing the item IDs.
     */
  getItems() {
    return [...this.items]; // Return a copy to prevent external modification
  }
}