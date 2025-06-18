// src/entities/entity.js

// import MapManager from '../utils/mapManagerUtils.js'; // No longer extends MapManager
import EntityInstanceData from './EntityInstanceData.js'; // Added import

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
  /**
   * The underlying instance data for this entity.
   * @type {EntityInstanceData}
   * @private
   */
  _instanceData;

  /**
   * The unique runtime identifier (typically a UUID) for this entity instance.
   *
   * @type {string}
   * @readonly
   */
  get id() {
    return this._instanceData.instanceId;
  }

  /**
   * The identifier of the entity definition from which this instance was created
   * (e.g., "namespace:template_id").
   *
   * @type {string}
   * @readonly
   */
  get definitionId() {
    return this._instanceData.definition.id;
  }

  /**
   * Creates a new Entity instance.
   *
   * @param {EntityInstanceData} instanceData - The data object for this entity instance.
   * @throws {Error} If no instanceData is provided or is not an instance of EntityInstanceData.
   */
  constructor(instanceData) {
    // super({ throwOnInvalidId: false }); // Removed as no longer extending MapManager
    if (!(instanceData instanceof EntityInstanceData)) {
      throw new Error('Entity must be initialized with an EntityInstanceData object.');
    }
    this._instanceData = instanceData;
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
    this._instanceData.setComponentOverride(componentTypeId, componentData);
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
    return this._instanceData.getComponentData(componentTypeId);
  }

  /**
   * Checks if the entity has data for a specific component type ID,
   * considering both its definition and instance overrides.
   *
   * @param {string} componentTypeId - The unique string identifier for the component type.
   * @returns {boolean} True if the entity has data for this component type, false otherwise.
   */
  hasComponent(componentTypeId) {
    return this._instanceData.hasComponent(componentTypeId);
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
    return this._instanceData.removeComponentOverride(componentTypeId);
  }

  /**
   * Returns a string representation of the entity.
   *
   * @returns {string}
   */
  toString() {
    const componentTypeIds = this._instanceData.allComponentTypeIds.join(', ');
    return `Entity[${this.id} (Def: ${this.definitionId})] Components: ${componentTypeIds || 'None'}`;
  }

  /**
   * Gets an iterable of all component type IDs effectively present on this entity
   * (considering definition and overrides).
   *
   * @returns {IterableIterator<string>} An iterator over the component type IDs.
   */
  get componentTypeIds() {
    // Convert array to an iterator if strict API compatibility is needed,
    // or change consuming code to expect an array. For now, returning array.
    return this._instanceData.allComponentTypeIds[Symbol.iterator]();
  }

  /**
   * Gets an iterable of all component data objects effectively present on this entity.
   *
   * @returns {IterableIterator<object>} An iterator over the component data objects.
   */
  get allComponentData() {
    const instance = this; // to use 'this' inside map function of the generator
    // This needs to be a generator because we resolve data on demand
    // eslint-disable-next-line func-style
    function* componentDataGenerator() {
      for (const typeId of instance._instanceData.allComponentTypeIds) {
        const data = instance.getComponentData(typeId);
        if (data !== undefined && data !== null) { // Ensure component exists (e.g. override wasn't null)
            yield data;
        }
      }
    }
    return componentDataGenerator();
  }

  /**
   * Gets an iterable of [componentTypeId, componentData] pairs effectively present on this entity.
   *
   * @returns {IterableIterator<[string, object]>} An iterator over the [ID, data] pairs.
   */
  get componentEntries() {
    const instance = this; // to use 'this' inside map function of the generator
    // This needs to be a generator because we resolve data on demand
    // eslint-disable-next-line func-style
    function* componentEntriesGenerator() {
      for (const typeId of instance._instanceData.allComponentTypeIds) {
        const data = instance.getComponentData(typeId);
         if (data !== undefined && data !== null) { // Ensure component exists
            yield [typeId, data];
        }
      }
    }
    return componentEntriesGenerator();
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
    return this._instanceData;
  }
}

export default Entity;
