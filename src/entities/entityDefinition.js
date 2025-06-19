import { deepFreeze } from '../utils'; // Assuming a utility for deep freezing

/**
 * Represents the immutable template/definition of an entity.
 * This object is intended to be shared by multiple EntityInstanceData objects.
 *
 * @module core/entities/entityDefinition
 */
class EntityDefinition {
  /**
   * The unique identifier for this entity definition (e.g., "core:goblin").
   *
   * @type {string}
   * @readonly
   */
  id;

  /**
   * A human-readable description of the entity type.
   *
   * @type {string | undefined}
   * @readonly
   */
  description;

  /**
   * A deep-frozen object containing the component data for this definition.
   * Keys are componentTypeIds, values are component data objects.
   *
   * @type {Readonly<Record<string, Readonly<object>>>}
   * @readonly
   */
  components;

  /**
   * Creates a new EntityDefinition instance.
   *
   * @param {string} id - The unique identifier for the entity definition.
   * @param {object} definitionData - The raw definition data, typically from a JSON file.
   * @param {string} [definitionData.description] - Optional description.
   * @param {Record<string, object>} definitionData.components - The component data.
   * @throws {Error} If id is not a valid string.
   * @throws {Error} If definitionData is not an object.
   */
  constructor(id, definitionData) {
    if (typeof id !== 'string' || !id.trim()) {
      throw new Error('EntityDefinition requires a valid string id.');
    }
    if (typeof definitionData !== 'object' || definitionData === null) {
      throw new Error(
        'EntityDefinition requires definitionData to be an object.'
      );
    }

    this.id = id;
    this.description = definitionData.description;

    const inputComponents = definitionData.components;

    const effectiveComponents =
      typeof inputComponents === 'object' && inputComponents !== null
        ? inputComponents
        : {};

    const frozenComponents = {};
    for (const [key, value] of Object.entries(effectiveComponents)) {
      frozenComponents[key] = deepFreeze(value);
    }
    this.components = deepFreeze(frozenComponents);
  }

  /**
   * Gets the mod ID (namespace) from the definition ID.
   * E.g., "core:goblin" -> "core"
   * @returns {string | undefined} The mod ID, or undefined if the ID format is unexpected.
   */
  get modId() {
    const parts = this.id.split(':');
    return parts.length > 1 ? parts[0] : undefined;
  }

  /**
   * Retrieves the template/data for a specific component type from this definition.
   *
   * @param {string} componentTypeId - The unique string identifier for the component type.
   * @returns {Readonly<object> | undefined} The component data object if found, otherwise undefined.
   */
  getComponentTemplate(componentTypeId) {
    return this.components[componentTypeId];
  }

  /**
   * Checks if this definition includes a specific component type.
   *
   * @param {string} componentTypeId - The unique string identifier for the component type.
   * @returns {boolean} True if the definition has this component type.
   */
  hasComponent(componentTypeId) {
    return componentTypeId in this.components;
  }
}

export default EntityDefinition;
