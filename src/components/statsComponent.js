// src/components/statsComponent.js

import Component from "./component.js";

/**
 * Represents core character attributes like Strength, Agility, etc.
 *
 * Core Attribute IDs (Examples - Define more as needed):
 * - core:attr_strength
 * - core:attr_agility
 * - core:attr_intelligence
 * - core:attr_constitution
 * - core:attr_perception (Optional Phase 2)
 * - core:attr_charisma (Optional Phase 2)
 */
export class StatsComponent extends Component {
    /**
     * @param {{attributes: Record<string, number>}} data - The JSON data for the component.
     */
    constructor(data) {
        super();
        if (!data || typeof data.attributes !== 'object' || data.attributes === null) {
            throw new Error("StatsComponent requires an 'attributes' object in data.");
        }

        /** @type {Record<string, number>} */
        this.attributes = {};

        // Validate and copy attributes
        for (const attributeId in data.attributes) {
            // Ensure the key is directly on the object, not from prototype chain
            if (Object.hasOwn(data.attributes, attributeId)) {
                const value = data.attributes[attributeId];
                if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
                    this.attributes[attributeId] = value;
                } else {
                    console.warn(`StatsComponent: Invalid value for attribute '${attributeId}' (${value}). Must be a non-negative integer. Skipping.`);
                }
            }
        }
    }

    /**
     * Gets the value of a specific attribute.
     * @param {string} attributeId - The ID of the attribute (e.g., "core:attr_strength").
     * @param {number} [defaultValue=0] - The value to return if the attribute is not found.
     * @returns {number} The attribute's value or the default value.
     */
    getAttributeValue(attributeId, defaultValue = 0) {
        // Use hasOwnProperty check for safety, though typically keys come from validated JSON
        return Object.hasOwn(this.attributes, attributeId) ? this.attributes[attributeId] : defaultValue;
    }

    /**
     * Sets or updates the value of a specific attribute.
     * Use this for temporary effects (buffs/debuffs) or permanent changes.
     * @param {string} attributeId - The ID of the attribute to set.
     * @param {number} value - The new integer value for the attribute.
     * @throws {Error} If the value is not a non-negative integer.
     */
    setAttributeValue(attributeId, value) {
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
            throw new Error(`StatsComponent: Invalid value (${value}) provided for attribute '${attributeId}'. Must be a non-negative integer.`);
        }
        this.attributes[attributeId] = value;
        // Consider dispatching an event here if other systems need to react to stat changes immediately
        // e.g., eventBus.dispatch('event:entity_stat_changed', { entityId: this.parentEntity.id, attributeId, newValue: value });
        // (Requires linking component to entity or passing entityId differently)
    }

    /**
     * Gets a copy of all attributes stored in this component.
     * @returns {Record<string, number>} A shallow copy of the attributes object.
     */
    getAllAttributes() {
        // Return a shallow copy to prevent external modification of the internal state
        return {...this.attributes};
    }
}