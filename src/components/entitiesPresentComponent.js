// src/components/entitiesPresentComponent.js

import Component from "./component.js";

/**
 * Component attached to Location entities to list the IDs of
 * other entities currently present in that location.
 */
export class EntitiesPresentComponent extends Component {
    /**
     * @param {{ entityIds: string[] }} data - Object containing an array of entity IDs.
     */
    constructor(data) {
        super();
        if (!data || !Array.isArray(data.entityIds)) {
            throw new Error("EntitiesPresentComponent requires 'entityIds' array in data.");
        }
        // Ensure all IDs are strings (basic validation)
        if (!data.entityIds.every(id => typeof id === 'string' && id.length > 0)) {
            throw new Error("EntitiesPresentComponent 'entityIds' must contain only non-empty strings.");
        }
        /** @type {string[]} */
        this.entityIds = [...data.entityIds]; // Copy the array
    }

    /**
     * Adds an entity ID to the list if not already present.
     * @param {string} entityId
     * @returns {boolean} True if added, false if already present.
     */
    addEntity(entityId) {
        if (typeof entityId === 'string' && entityId.length > 0 && !this.entityIds.includes(entityId)) {
            this.entityIds.push(entityId);
            return true;
        }
        return false;
    }

    /**
     * Removes an entity ID from the list.
     * @param {string} entityId
     * @returns {boolean} True if removed, false if not found.
     */
    removeEntity(entityId) {
        const index = this.entityIds.indexOf(entityId);
        if (index > -1) {
            this.entityIds.splice(index, 1);
            return true;
        }
        return false;
    }
}