// src/components/equipmentComponent.js
import Component from './component.js';

/**
 * Tracks items equipped by the entity in specific body slots.
 */
export class EquipmentComponent extends Component {
  /**
     * @param {{slots: Record<string, string | null>}} data - The JSON data for the component.
     */
  constructor(data) {
    super();
    if (!data || typeof data.slots !== 'object' || data.slots === null) {
      // Initialize with common slots if data is missing/invalid? Or throw?
      console.warn("EquipmentComponent: Invalid or missing 'slots' object in data. Initializing empty.");
      this.slots = {}; // Start empty or define default slots here if preferred
    } else {
      // Directly use the provided slots object (assuming validation via schema)
      // Make a shallow copy to prevent external modification? Good practice.
      this.slots = {...data.slots};
    }
  }

  /**
     * Equips an item into a specified slot. Assumes validation (slot exists, item is valid) happens before calling.
     * Overwrites any item currently in the slot.
     * @param {string} slotId - The ID of the slot to equip into.
     * @param {string} itemId - The ID of the item to equip.
     * @returns {boolean} True if the slot exists, false otherwise.
     */
  equipItem(slotId, itemId) {
    if (Object.hasOwn(this.slots, slotId)) {
      this.slots[slotId] = itemId;
      return true;
    }
    console.warn(`EquipmentComponent: Attempted to equip into non-existent slot '${slotId}'.`);
    return false;
  }

  /**
     * Unequips the item from a specified slot.
     * @param {string} slotId - The ID of the slot to unequip from.
     * @returns {string | null} The ID of the item that was unequipped, or null if the slot was empty or doesn't exist.
     */
  unequipItem(slotId) {
    if (Object.hasOwn(this.slots, slotId)) {
      const itemId = this.slots[slotId];
      this.slots[slotId] = null; // Set slot to empty
      return itemId; // Return the ID of the item removed (or null if it was already empty)
    }
    console.warn(`EquipmentComponent: Attempted to unequip from non-existent slot '${slotId}'.`);
    return null;
  }

  /**
     * Gets the ID of the item currently equipped in a specific slot.
     * @param {string} slotId - The ID of the slot to check.
     * @returns {string | null | undefined} The item ID if equipped, null if empty, undefined if slot doesn't exist.
     */
  getEquippedItem(slotId) {
    if (Object.hasOwn(this.slots, slotId)) {
      return this.slots[slotId];
    }
    return undefined; // Indicate slot doesn't exist
  }

  /**
     * Gets a copy of the entire slots mapping.
     * @returns {Record<string, string | null>} A shallow copy of the slots object.
     */
  getAllEquipped() {
    return {...this.slots};
  }

  /**
     * Finds the slot ID where a specific item is equipped.
     * @param {string} itemId - The ID of the item to find.
     * @returns {string | null} The slot ID if found, otherwise null.
     */
  findSlotForItem(itemId) {
    for (const slotId in this.slots) {
      if (Object.hasOwn(this.slots, slotId) && this.slots[slotId] === itemId) {
        return slotId;
      }
    }
    return null;
  }

  /**
     * Checks if a specific slot exists in this component.
     * @param {string} slotId
     * @returns {boolean}
     */
  hasSlot(slotId) {
    return Object.hasOwn(this.slots, slotId);
  }
}