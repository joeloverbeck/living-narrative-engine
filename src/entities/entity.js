// src/entities/entity.js

import MapManager from '../utils/mapManagerUtils.js';

/**
 * Represents a game entity (player, NPC, item, etc.).
 * An entity is primarily an identifier associated with a collection of
 * raw component data objects, indexed by their unique component type ID string.
 * It acts as a lightweight data container; component logic resides in Systems.
 *
 * @module core/entities/entity
 */
class Entity extends MapManager {
  /**
   * The unique runtime identifier (typically a UUID) for this entity instance.
   *
   * @type {string}
   * @readonly
   */
  id;

  /**
   * The identifier of the entity definition from which this instance was created
   * (e.g., "namespace:template_id").
   *
   * @type {string}
   * @readonly
   */
  definitionId;

  /**
   * Creates a new Entity instance.
   *
   * @param {string} instanceId - The unique runtime identifier (UUID) for this entity instance.
   * @param {string} definitionId - The identifier of the entity definition (e.g., "isekai:hero").
   * @throws {Error} If no instanceId is provided or is not a string.
   * @throws {Error} If no definitionId is provided or is not a string.
   */
  constructor(instanceId, definitionId) {
    if (!MapManager.isValidId(instanceId)) {
      throw new Error('Entity must have a valid string instanceId.');
    }
    if (!MapManager.isValidId(definitionId)) {
      // Depending on design, definitionId could be optional if entities can be created purely procedurally.
      // For now, making it mandatory for clarity based on current usage.
      throw new Error('Entity must have a valid string definitionId.');
    }
    super({ throwOnInvalidId: false });
    this.id = instanceId;
    this.definitionId = definitionId;
    // console.log(`Entity created: ${this.id} (from definition: ${this.definitionId})`);
  }

  /**
   * Adds or updates the raw data for a specific component type on this entity.
   * If a component with the same typeId already exists, its data will be overwritten.
   *
   * @param {string} componentTypeId - The unique string identifier for the component type (e.g., "core:position").
   * @param {object} componentData - The plain JavaScript object containing the component's data.
   * @throws {Error} If componentTypeId is not a non-empty string.
   * @throws {Error} If componentData is not an object.
   */
  addComponent(componentTypeId, componentData) {
    if (!MapManager.isValidId(componentTypeId)) {
      throw new Error(
        `Invalid componentTypeId provided to addComponent for entity ${this.id}. Expected non-empty string.`
      );
    }
    if (typeof componentData !== 'object' || componentData === null) {
      throw new Error(
        `Invalid componentData provided for component ${componentTypeId} on entity ${this.id}. Expected an object.`
      );
    }

    if (this.has(componentTypeId)) {
      // Optional: Log overwrite, can be commented out for performance
      // console.warn(`Entity ${this.id}: Overwriting component data for type ID "${componentTypeId}".`);
    }
    this.add(componentTypeId, componentData);
    // console.log(`Entity ${this.id}: Added/Updated component "${componentTypeId}"`); // Keep or remove logging
  }

  /**
   * Retrieves the raw data object for a specific component type.
   *
   * @param {string} componentTypeId - The unique string identifier for the component type.
   * @returns {object | undefined} The component data object if found, otherwise undefined.
   */
  getComponentData(componentTypeId) {
    return this.get(componentTypeId);
  }

  /**
   * Checks if the entity has data associated with a specific component type ID.
   *
   * @param {string} componentTypeId - The unique string identifier for the component type.
   * @returns {boolean} True if the entity has data for this component type, false otherwise.
   */
  hasComponent(componentTypeId) {
    return this.has(componentTypeId);
  }

  /**
   * Removes the data associated with a specific component type ID from the entity.
   *
   * @param {string} componentTypeId - The unique string identifier for the component type to remove.
   * @returns {boolean} True if component data was found and removed, false otherwise.
   */
  removeComponent(componentTypeId) {
    const deleted = this.remove(componentTypeId);
    // if (deleted) {
    //     console.log(`Entity ${this.id}: Removed component "${componentTypeId}"`); // Keep or remove logging
    // }
    return deleted;
  }

  /**
   * Returns a string representation of the entity, listing its component type IDs.
   *
   * @returns {string}
   */
  toString() {
    const componentTypeIds = Array.from(this.keys()).join(', ');
    return `Entity[${this.id} (Def: ${this.definitionId})] Components: ${componentTypeIds || 'None'}`;
  }

  /**
   * Gets an iterable of all component type IDs currently attached to the entity.
   *
   * @returns {IterableIterator<string>} An iterator over the component type IDs.
   */
  get componentTypeIds() {
    return this.keys();
  }

  /**
   * Gets an iterable of all component data objects currently attached to the entity.
   *
   * @returns {IterableIterator<object>} An iterator over the component data objects.
   */
  get allComponentData() {
    return this.values();
  }

  /**
   * Gets an iterable of [componentTypeId, componentData] pairs.
   *
   * @returns {IterableIterator<[string, object]>} An iterator over the [ID, data] pairs.
   */
  get componentEntries() {
    return this.entries();
  }
}

export default Entity;
