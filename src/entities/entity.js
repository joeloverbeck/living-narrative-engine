// src/entities/entity.js

// import MapManager from '../utils/mapManagerUtils.js'; // No longer extends MapManager
import EntityInstanceData from './entityInstanceData.js'; // Added import
// import { IEntity } from '../interfaces/IEntity.js'; // Assuming IEntity is the correct interface

/**
 * Represents a game entity (player, NPC, item, etc.).
 * This class is now a wrapper around EntityInstanceData, providing an API
 * consistent with its previous role but backed by the new data structure.
 * It acts as a lightweight data container; component logic resides in Systems.
 *
 * @module core/entities/entity
 */
// class Entity extends MapManager { // No longer extends MapManager
class Entity {
  // Ensure it extends the correct interface if any
  /**
   * The underlying instance data for this entity.
   *
   * @type {EntityInstanceData}
   * @private
   */
  #data; // Correctly declared private field

  /**
   * The unique runtime identifier (typically a UUID) for this entity instance.
   *
   * @type {string}
   * @readonly
   */
  get id() {
    return this.#data.instanceId; // Use #data
  }

  /**
   * The identifier of the entity definition from which this instance was created
   * (e.g., "namespace:template_id").
   *
   * @type {string}
   * @readonly
   */
  get definitionId() {
    return this.#data.definition.id; // Use #data
  }

  /**
   * Creates a new Entity instance.
   *
   * @param {EntityInstanceData} instanceData - The data object for this entity instance.
   * @throws {Error} If no instanceData is provided or is not an instance of EntityInstanceData.
   */
  constructor(instanceData) {
    // super({ throwOnInvalidId: false }); // Removed as no longer extending MapManager
    // super(); // Call super constructor if extending an interface class that has one
    if (!(instanceData instanceof EntityInstanceData)) {
      throw new Error(
        'Entity must be initialized with an EntityInstanceData object.'
      );
    }
    this.#data = instanceData; // Assign to #data
    // console.log(`Entity created: ${this.id} (from definition: ${this.definitionId})`);
  }

  /**
   * Adds or updates a component override for this entity instance.
   * This effectively customizes the component data for this specific instance.
   *
   * @param {string} componentTypeId - The unique string identifier for the component type (e.g., "core:position").
   * @param {object} componentData - The plain JavaScript object containing the component's data for this instance.
   * @throws {Error} If componentTypeId is not a non-empty string.
   */
  addComponent(componentTypeId, componentData) {
    if (typeof componentTypeId !== 'string' || !componentTypeId.trim()) {
      throw new Error(
        `Invalid componentTypeId provided to addComponent for entity ${this.id}. Expected non-empty string.`
      );
    }
    // componentData validation (being an object) is implicitly handled by setComponentOverride or could be added here.
    this.#data.setComponentOverride(componentTypeId, componentData); // Use #data
    // console.log(`Entity ${this.id}: Added/Updated component override for "${componentTypeId}"`);
    return true; // Explicitly return true on success
  }

  /**
   * Retrieves the combined component data for a specific component type.
   * This data is a result of merging the definition's component with instance-specific overrides.
   *
   * @param {string} componentTypeId - The unique string identifier for the component type.
   * @returns {object | undefined} The component data object if found, otherwise undefined.
   */
  getComponentData(componentTypeId) {
    return this.#data.getComponentData(componentTypeId); // Use #data
  }

  /**
   * Checks if the entity has data for a specific component type ID,
   * considering both its definition and instance overrides.
   *
   * @param {string} componentTypeId - The unique string identifier for the component type.
   * @param {boolean} [checkOverrideOnly] - DEPRECATED. If true, only checks
   * instance overrides.
   * @returns {boolean} True if the entity has data for this component type, false otherwise.
   */
  hasComponent(componentTypeId, checkOverrideOnly = false) {
    if (arguments.length === 2) {
      // eslint-disable-next-line no-console
      console.warn(
        'Entity.hasComponent: The checkOverrideOnly flag is deprecated. Use hasComponentOverride(componentTypeId) instead.'
      );
      if (checkOverrideOnly) {
        return this.hasComponentOverride(componentTypeId);
      }
    }
    return this.#data.hasComponent(componentTypeId); // Use #data
  }

  /**
   * Checks if this entity has a non-null override for the given component type.
   *
   * @param {string} componentTypeId - The unique component type ID.
   * @returns {boolean} True if an override exists and is not null.
   */
  hasComponentOverride(componentTypeId) {
    return this.#data.hasComponentOverride(componentTypeId);
  }

  /**
   * Removes a component override for this specific instance.
   * After removal, calls to `getComponentData` for this `componentTypeId` will
   * fall back to the data from the `EntityDefinition` (if any).
   * Note: This does not remove the component from the definition, only the instance-specific override.
   *
   * @param {string} componentTypeId - The unique string identifier for the component type whose override is to be removed.
   * @returns {boolean} True if an override was found and removed, false otherwise.
   */
  removeComponent(componentTypeId) {
    // This now refers to removing an *override*.
    // The previous MapManager based remove is different.
    return this.#data.removeComponentOverride(componentTypeId); // Use #data
  }

  /**
   * Returns a string representation of the entity.
   *
   * @returns {string}
   */
  toString() {
    const componentTypeIds = this.#data.allComponentTypeIds.join(', '); // Use #data
    return `Entity[${this.id} (Def: ${this.definitionId})] Components: ${componentTypeIds || 'None'}`;
  }

  /**
   * Gets an array of all component type IDs effectively present on this entity
   * (considering definition and overrides).
   *
   * @returns {string[]} An array of the component type IDs.
   */
  get componentTypeIds() {
    return this.#data.allComponentTypeIds;
  }

  /**
   * Gets an array of all component data objects effectively present on this entity.
   *
   * @returns {object[]} An array of the component data objects.
   */
  get allComponentData() {
    return this.componentEntries.map(([, data]) => data);
  }

  /**
   * Gets an array of [componentTypeId, componentData] pairs effectively present on this entity.
   *
   * @returns {Array<[string, object]>} An array of the [ID, data] pairs.
   */
  get componentEntries() {
    return this.#data.allComponentTypeIds
      .map((typeId) => [typeId, this.getComponentData(typeId)])
      .filter(([, data]) => data !== undefined && data !== null);
  }

  /**
   * Provides direct access to the underlying EntityInstanceData.
   * Use with caution; direct modification of overrides should generally
   * go through entity.addComponent() or entity.removeComponent() if those
   * involve additional logic or events in the future.
   *
   * @returns {EntityInstanceData}
   */
  get instanceData() {
    // Exposes underlying data for compatibility with old code
    return this.#data; // Use #data
  }
}

export default Entity;
