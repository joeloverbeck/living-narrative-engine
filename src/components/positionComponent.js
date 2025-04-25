// src/components/positionComponent.js

import Component from './component.js'; // Assuming base class exists

/**
 * Stores the location and coordinates of an entity.
 * Allows locationId to be null for entities not currently in a specific world location (e.g., inventory).
 */
export class PositionComponent extends Component {
  /**
     * @param {object} config - Component configuration.
     * @param {string | null} config.locationId - The ID of the location entity where this entity resides, or null if not in a specific location.
     * @param {number} [config.x=0] - The x-coordinate within the location (optional, potentially meaningless if locationId is null).
     * @param {number} [config.y=0] - The y-coordinate within the location (optional, potentially meaningless if locationId is null).
     */
  constructor({locationId, x = 0, y = 0}) {
    super(); // Call base class constructor if necessary

    // Validate locationId: Allow null, but reject empty or whitespace-only strings.
    if (locationId !== null && (typeof locationId !== 'string' || locationId.trim() === '')) {
      throw new Error('PositionComponent: locationId must be a non-empty string or null.');
    }

    // Validate coordinates (using warnings and defaults for flexibility)
    if (typeof x !== 'number') {
      console.warn(`PositionComponent: x coordinate is not a number (${x}), defaulting to 0.`);
      x = 0;
    }
    if (typeof y !== 'number') {
      console.warn(`PositionComponent: y coordinate is not a number (${y}), defaulting to 0.`);
      y = 0;
    }

    this.locationId = locationId;
    // Note: x and y coordinates are stored even if locationId is null.
    // Their meaning in that context depends on how game systems interpret it.
    this.x = x;
    this.y = y;
  }

  /**
     * Updates the entity's location and coordinates.
     * @param {string | null} locationId - The new location ID, or null to indicate no specific location.
     * @param {number} [x=0] - The new x-coordinate (potentially meaningless if locationId is null).
     * @param {number} [y=0] - The new y-coordinate (potentially meaningless if locationId is null).
     */
  setLocation(locationId, x = 0, y = 0) {
    // Validate locationId: Allow null, but reject empty or whitespace-only strings.
    if (locationId !== null && (typeof locationId !== 'string' || locationId.trim() === '')) {
      throw new Error('setLocation: locationId must be a non-empty string or null.');
    }

    // Validate coordinates (using warnings and defaults for flexibility)
    if (typeof x !== 'number') {
      console.warn(`setLocation: x coordinate is not a number (${x}), defaulting to 0.`);
      x = 0;
      // Consider if throwing an error is more appropriate for setLocation
      // throw new Error('setLocation: x coordinate must be a number.');
    }
    if (typeof y !== 'number') {
      console.warn(`setLocation: y coordinate is not a number (${y}), defaulting to 0.`);
      y = 0;
      // Consider if throwing an error is more appropriate for setLocation
      // throw new Error('setLocation: y coordinate must be a number.');
    }

    // Store old values if needed for event emission
    // const oldLocationId = this.locationId;
    // const oldX = this.x;
    // const oldY = this.y;

    this.locationId = locationId;
    this.x = x;
    this.y = y;

    // Optional: Consider emitting an event here if an event system is in place
    // e.g., this.entity.emit('positionChanged', {
    //    oldPosition: { locationId: oldLocationId, x: oldX, y: oldY },
    //    newPosition: { locationId: this.locationId, x: this.x, y: this.y }
    // });
  }

  /**
     * Get the current position details.
     * @returns {{locationId: string | null, x: number, y: number}}
     */
  getPosition() {
    return {
      locationId: this.locationId,
      x: this.x,
      y: this.y,
    };
  }
}