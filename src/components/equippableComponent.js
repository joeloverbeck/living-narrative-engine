// src/components/equippableComponent.js

import Component from "./component.js";

/**
 * Component holding data specific to an item's ability to be equipped.
 * Contains the target equipment slot and effects granted while equipped.
 * This component's presence indicates an item *can* be equipped.
 */
export class EquippableComponent extends Component {
    /**
     * @param {object} data - The component data from JSON entity definition.
     * @param {string} data.slotId - The ID of the equipment slot this item uses (e.g., 'core:slot_main_hand'). *Required*.
     * @param {object[]} [data.equipEffects=[]] - Optional array of effects applied to the wearer when equipped (e.g., stat modifiers). Defaults to empty array.
     */
    constructor(data) {
        super();

        // --- Validate Required Fields ---
        if (!data || typeof data.slotId !== 'string' || data.slotId.trim() === '') {
            console.error("EquippableComponent: Invalid or missing required 'slotId' provided.", data);
            throw new Error("EquippableComponent requires a valid, non-empty 'slotId'.");
        }

        this.slotId = data.slotId;

        // --- Handle Optional Fields with Defaults ---
        if (data.equipEffects !== undefined && data.equipEffects !== null && !Array.isArray(data.equipEffects)) {
            console.warn(`EquippableComponent: 'equipEffects' was provided but was not an array. Defaulting to empty array. Data received:`, data.equipEffects);
            this.equipEffects = [];
        } else {
            // Use provided array (including if it's empty) or default to empty array if null/undefined
            this.equipEffects = Array.isArray(data.equipEffects) ? [...data.equipEffects] : []; // Store a shallow copy
        }

        // console.log("EquippableComponent created:", this); // Optional debug
    }

    /**
     * Gets the ID of the equipment slot this item occupies.
     * @returns {string} The equipment slot ID.
     */
    getSlotId() {
        return this.slotId;
    }

    /**
     * Gets the array of effects applied when this item is equipped.
     * @returns {object[]} The array of effect objects (could be empty).
     */
    getEquipEffects() {
        // Return the stored array (or a copy if mutation is a concern,
        // but typically component data is treated as immutable after creation)
        return this.equipEffects;
    }
}