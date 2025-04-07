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

        /** @type {Record<string, number>} Base attribute values */
        this.baseAttributes = {};

        // Validate and copy base attributes
        for (const attributeId in data.attributes) {
            if (Object.hasOwn(data.attributes, attributeId)) {
                const value = data.attributes[attributeId];
                if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
                    this.baseAttributes[attributeId] = value;
                } else {
                    console.warn(`StatsComponent: Invalid base value for attribute '${attributeId}' (${value}). Skipping.`);
                }
            }
        }

        /**
         * Stores temporary modifiers applied from external sources (e.g., equipment, status effects).
         * Key: Source ID (e.g., item ID, status effect ID)
         * Value: Array of modifier objects { stat: string, value: number }
         * @type {Record<string, Array<{stat: string, value: number}>>}
         */
        this.modifiers = {};
    }

    /**
     * Gets the base value of a specific attribute (ignoring modifiers).
     * @param {string} attributeId - The ID of the attribute (e.g., "core:attr_strength").
     * @param {number} [defaultValue=0] - The value to return if the attribute base is not found.
     * @returns {number} The attribute's base value or the default value.
     */
    getBaseAttributeValue(attributeId, defaultValue = 0) {
        return Object.hasOwn(this.baseAttributes, attributeId) ? this.baseAttributes[attributeId] : defaultValue;
    }

    /**
     * Calculates and returns the effective value of an attribute, including all active modifiers.
     * @param {string} attributeId - The ID of the attribute.
     * @param {number} [defaultValue=0] - The default value if base attribute doesn't exist.
     * @returns {number} The calculated effective attribute value.
     */
    getEffectiveAttributeValue(attributeId, defaultValue = 0) {
        let currentValue = this.getBaseAttributeValue(attributeId, defaultValue);

        // Apply modifiers
        for (const sourceId in this.modifiers) {
            if (Object.hasOwn(this.modifiers, sourceId)) {
                const mods = this.modifiers[sourceId];
                if (Array.isArray(mods)) {
                    for (const mod of mods) {
                        if (mod.stat === attributeId) {
                            currentValue += mod.value;
                        }
                    }
                }
            }
        }
        // Ensure stats don't drop below a minimum (e.g., 0 or 1) if desired
        return Math.max(0, currentValue); // Example: Prevent negative stats
    }


    /**
     * Sets or updates the *base* value of a specific attribute.
     * @param {string} attributeId - The ID of the attribute to set.
     * @param {number} value - The new base integer value for the attribute.
     * @throws {Error} If the value is not a non-negative integer.
     */
    setBaseAttributeValue(attributeId, value) {
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
            throw new Error(`StatsComponent: Invalid base value (${value}) provided for attribute '${attributeId}'. Must be a non-negative integer.`);
        }
        this.baseAttributes[attributeId] = value;
        // Maybe dispatch 'event:entity_stat_changed' here too
    }

    /**
     * Adds a list of modifiers from a specific source. If the source already exists, adds to its list.
     * @param {string} sourceId - A unique identifier for the source of the modifiers (e.g., item ID, spell ID).
     * @param {Array<{stat: string, value: number}>} modsToAdd - An array of modifier objects.
     */
    addModifier(sourceId, modsToAdd) {
        if (!this.modifiers[sourceId]) {
            this.modifiers[sourceId] = [];
        }
        // Simple add for now. Could check for duplicates if needed.
        this.modifiers[sourceId].push(...modsToAdd);
        // TODO: Consider dispatching 'event:entity_stat_changed' for each affected stat
    }

    /**
     * Removes all modifiers associated with a specific source ID.
     * @param {string} sourceId - The unique identifier of the source whose modifiers should be removed.
     * @returns {boolean} True if modifiers were found and removed, false otherwise.
     */
    removeModifier(sourceId) {
        if (Object.hasOwn(this.modifiers, sourceId)) {
            delete this.modifiers[sourceId];
            // TODO: Consider dispatching 'event:entity_stat_changed' for affected stats
            return true;
        }
        return false;
    }


    /**
     * Gets a copy of all base attributes stored in this component.
     * @returns {Record<string, number>} A shallow copy of the base attributes object.
     */
    getAllBaseAttributes() {
        return {...this.baseAttributes};
    }

    /**
     * Gets a copy of all current modifiers.
     * @returns {Record<string, Array<{stat: string, value: number}>>} A deep copy might be safer if mods are complex.
     */
    getAllModifiers() {
        // Simple shallow copy of outer layer, deeper copy of arrays needed for true safety
        const copy = {};
        for (const key in this.modifiers) {
            if (Object.hasOwn(this.modifiers, key) && Array.isArray(this.modifiers[key])) {
                copy[key] = [...this.modifiers[key]]; // Shallow copy of the array is usually sufficient
            }
        }
        return copy;
    }
}