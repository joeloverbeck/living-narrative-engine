// src/components/positionComponent.js

import Component from './component.js'; // Assuming base class exists as provided

/**
 * Stores the location and coordinates of an entity.
 */
export class PositionComponent extends Component {
    /**
     * @param {object} config - Component configuration.
     * @param {string} config.locationId - The ID of the location entity where this entity resides.
     * @param {number} [config.x=0] - The x-coordinate within the location (optional).
     * @param {number} [config.y=0] - The y-coordinate within the location (optional).
     */
    constructor({locationId, x = 0, y = 0}) {
        super(); // Call base class constructor if necessary

        // Validate locationId
        if (typeof locationId !== 'string' || locationId.trim() === '') {
            throw new Error('PositionComponent requires a non-empty string for locationId.');
        }

        // Validate coordinates
        if (typeof x !== 'number') {
            console.warn(`PositionComponent: x coordinate is not a number (${x}), defaulting to 0.`);
            x = 0; // Or throw error if strictness is required
            // throw new Error('PositionComponent: x coordinate must be a number.');
        }
        if (typeof y !== 'number') {
            console.warn(`PositionComponent: y coordinate is not a number (${y}), defaulting to 0.`);
            y = 0; // Or throw error if strictness is required
            // throw new Error('PositionComponent: y coordinate must be a number.');
        }

        this.locationId = locationId;
        this.x = x;
        this.y = y;
    }

    /**
     * Updates the entity's location and coordinates.
     * @param {string} locationId - The new location ID.
     * @param {number} [x=0] - The new x-coordinate.
     * @param {number} [y=0] - The new y-coordinate.
     */
    setLocation(locationId, x = 0, y = 0) {
        // Validate locationId
        if (typeof locationId !== 'string' || locationId.trim() === '') {
            throw new Error('setLocation requires a non-empty string for locationId.');
        }

        // Validate coordinates
        if (typeof x !== 'number') {
            throw new Error('setLocation: x coordinate must be a number.');
        }
        if (typeof y !== 'number') {
            throw new Error('setLocation: y coordinate must be a number.');
        }

        this.locationId = locationId;
        this.x = x;
        this.y = y;
        // Optional: Consider emitting an event here if an event system is in place
        // e.g., this.entity.emit('positionChanged', { oldLocation: oldLoc, newLocation: newLoc });
    }

    /**
     * Get the current position details.
     * @returns {{locationId: string, x: number, y: number}}
     */
    getPosition() {
        return {
            locationId: this.locationId,
            x: this.x,
            y: this.y,
        };
    }
}