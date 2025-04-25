// src/components/passageDetailsComponent.js

import Component from './component.js';

/**
 * Component holding runtime data for bi-directional passages (connections) between locations.
 * Corresponds to the PassageDetailsComponent schema.
 */
export class PassageDetailsComponent extends Component  {
  #isHidden;

  /**
     * @param {object} data - The data object conforming to the PassageDetailsComponent schema.
     * @param {string} data.locationAId - The ID of the first location.
     * @param {string} data.locationBId - The ID of the second location.
     * @param {string} data.directionAtoB - Command/label to travel from A to B.
     * @param {string} data.directionBtoA - Command/label to travel from B to A.
     * @param {string | null} [data.blockerEntityId=null] - Optional ID of a blocking entity.
     * @param {string} [data.type='passage'] - The type of passage (e.g., 'doorway', 'path').
     * @param {boolean} [data.isHidden=false] - Whether the passage is initially hidden.
     * @param {string | undefined} [data.state] - Optional state of the passage itself (e.g., 'open', 'closed').
     * @param {string | undefined} [data.descriptionOverrideAtoB] - Optional description when looking from A to B.
     * @param {string | undefined} [data.descriptionOverrideBtoA] - Optional description when looking from B to A.
     */
  constructor({
    locationAId,
    locationBId,
    directionAtoB,
    directionBtoA,
    blockerEntityId = null, // Default from schema
    type = 'passage',       // Default from schema
    isHidden = false,      // Default from schema
    state = undefined,       // Optional, no default
    descriptionOverrideAtoB = undefined, // Optional
    descriptionOverrideBtoA = undefined  // Optional
  }) {
    super();
    // Basic validation for required fields (could be more robust)
    if (!locationAId || !locationBId || !directionAtoB || !directionBtoA) {
      throw new Error('PassageDetailsComponent requires locationAId, locationBId, directionAtoB, and directionBtoA.');
    }
    if (locationAId === locationBId) {
      console.warn(`PassageDetailsComponent created with identical location IDs: ${locationAId}`);
    }

    this.locationAId = locationAId;
    this.locationBId = locationBId;
    this.directionAtoB = directionAtoB;
    this.directionBtoA = directionBtoA;
    this.blockerEntityId = blockerEntityId;
    this.type = type;
    this.#isHidden = isHidden;
    this.state = state;
    this.descriptionOverrideAtoB = descriptionOverrideAtoB;
    this.descriptionOverrideBtoA = descriptionOverrideBtoA;
  }

  /**
     * Gets the IDs of the two locations connected by this passage.
     * @returns {[string, string]} An array containing [locationAId, locationBId].
     */
  getLocations() {
    return [this.locationAId, this.locationBId];
  }

  /**
     * Given one location ID, returns the ID of the location on the other side of the passage.
     * @param {string} fromLocationId - The ID of the location you are currently in.
     * @returns {string} The ID of the connected location.
     * @throws {Error} If the provided fromLocationId is not part of this passage.
     */
  getOtherLocationId(fromLocationId) {
    if (fromLocationId === this.locationAId) {
      return this.locationBId;
    } else if (fromLocationId === this.locationBId) {
      return this.locationAId;
    } else {
      throw new Error(`Location ID '${fromLocationId}' is not part of this passage (${this.locationAId} <-> ${this.locationBId}).`);
    }
  }

  /**
     * Gets the direction command/label required to travel *from* the specified location
     * *through* this passage.
     * @param {string} fromLocationId - The ID of the starting location.
     * @returns {string} The direction command/label (e.g., 'north', 'enter doorway').
     * @throws {Error} If the provided fromLocationId is not part of this passage.
     */
  getDirectionFrom(fromLocationId) {
    if (fromLocationId === this.locationAId) {
      return this.directionAtoB;
    } else if (fromLocationId === this.locationBId) {
      return this.directionBtoA;
    } else {
      throw new Error(`Location ID '${fromLocationId}' is not part of this passage (${this.locationAId} <-> ${this.locationBId}).`);
    }
  }

  /**
     * Gets the direction command/label that leads *to* the specified target location
     * *through* this passage.
     * @param {string} targetLocationId - The ID of the destination location.
     * @returns {string} The direction command/label (e.g., 'north', 'enter doorway').
     * @throws {Error} If the provided targetLocationId is not part of this passage.
     */
  getDirectionTo(targetLocationId) {
    if (targetLocationId === this.locationBId) {
      return this.directionAtoB; // Direction from A leads TO B
    } else if (targetLocationId === this.locationAId) {
      return this.directionBtoA; // Direction from B leads TO A
    } else {
      throw new Error(`Target location ID '${targetLocationId}' is not part of this passage (${this.locationAId} <-> ${this.locationBId}).`);
    }
  }

  /**
     * Gets the ID of the entity blocking this passage, if any.
     * @returns {string | null} The blocker entity ID or null if there is no blocker.
     */
  getBlockerId() {
    return this.blockerEntityId;
  }

  /**
     * Gets the type of the passage.
     * @returns {string} The passage type (e.g., 'passage', 'doorway').
     */
  getType() {
    return this.type;
  }

  /**
     * Gets the current state of the passage itself (distinct from any blocker).
     * @returns {string | undefined} The state string (e.g., 'open', 'collapsed') or undefined if no state is set.
     */
  getState() {
    return this.state;
  }

  /**
     * Checks if the passage is currently hidden.
     * @returns {boolean} True if the passage is hidden, false otherwise.
     */
  isHidden() {
    return this.#isHidden;
  }

  /**
     * Gets the specific description override for the passage entrance when viewed
     * *from* the specified location.
     * @param {string} fromLocationId - The ID of the location from which the passage is being viewed.
     * @returns {string | undefined} The description override string, or undefined if none is set for this direction.
     * @throws {Error} If the provided fromLocationId is not part of this passage.
     */
  getDescriptionFrom(fromLocationId) {
    if (fromLocationId === this.locationAId) {
      return this.descriptionOverrideAtoB;
    } else if (fromLocationId === this.locationBId) {
      return this.descriptionOverrideBtoA;
    } else {
      throw new Error(`Location ID '${fromLocationId}' is not part of this passage (${this.locationAId} <-> ${this.locationBId}).`);
    }
  }
}