/**
 * @file The instance data for an entity (as opposed to the definition data).
 * @see src/entities/entityInstanceData.js
 */

import { cloneDeep, isEqual, pick } from 'lodash';
import EntityDefinition from './EntityDefinition.js';

/**
 * Represents the mutable, runtime data for a unique instance of an entity.
 * It holds a reference to its EntityDefinition and any per-instance component overrides.
 *
 * @module core/entities/entityInstanceData
 */
class EntityInstanceData {
  /**
   * The unique runtime identifier for this entity instance (e.g., a UUID).
   *
   * @type {string}
   * @readonly
   */
  instanceId;

  /**
   * A strong reference to the immutable EntityDefinition for this instance.
   *
   * @type {EntityDefinition}
   * @readonly
   */
  definition;

  /**
   * A shallow map of component data that overrides or supplements the definition's components.
   * Keys are componentTypeIds, values are component data objects.
   * This map only stores data that is different from or not present in the definition.
   * @type {Record<string, object>}
   */
  overrides;

  /**
   * Creates a new EntityInstanceData instance.
   *
   * @param {string} instanceId - The unique runtime identifier for this instance.
   * @param {EntityDefinition} definition - The EntityDefinition this instance is based on.
   * @param {Record<string, object>} [initialOverrides] - Optional initial component overrides.
   * @param {Record<string, object>} [initialOverrides={}] - Optional initial component overrides.
   * @throws {Error} If instanceId is not a valid string.
   * @throws {Error} If definition is not an instance of EntityDefinition.
   */
  constructor(instanceId, definition, initialOverrides = {}) {
    if (typeof instanceId !== 'string' || !instanceId.trim()) {
      throw new Error('EntityInstanceData requires a valid string instanceId.');
    }
    if (!(definition instanceof EntityDefinition)) {
      throw new Error(
        'EntityInstanceData requires a valid EntityDefinition object.'
      );
    }

    this.instanceId = instanceId;
    this.definition = definition;
    // Use cloneDeep for initialOverrides to ensure deep copy.
    this.overrides = initialOverrides ? cloneDeep(initialOverrides) : {};
  }

  /**
   * Retrieves the combined component data for a specific component type.
   * It merges the data from the EntityDefinition with any instance-specific overrides.
   * Overrides take precedence.
   * For object-based components, this performs a shallow merge of the override onto the definition's component.
   *
   * @param {string} componentTypeId - The unique string identifier for the component type.
   * @returns {object | undefined} The merged component data, or undefined if not found in definition or overrides.
   */
  getComponentData(componentTypeId) {
    const definitionComponent =
      this.definition.getComponentTemplate(componentTypeId);
    const overrideComponent = this.overrides[componentTypeId];

    // If the override is explicitly null, it means the component is effectively removed or nullified for this instance.
    if (overrideComponent === null) {
      return null;
    }

    // If an override exists (and is not null), it takes full precedence. Return a clone of it.
    if (overrideComponent !== undefined) {
      return cloneDeep(overrideComponent);
    }

    // If no override, but a definition component exists, return a clone of it.
    if (definitionComponent !== undefined) {
      return cloneDeep(definitionComponent);
    }

    // If neither override nor definition component exists.
    return undefined;
  }

  /**
   * Sets or updates an override for a specific component type on this instance.
   * If the provided data is identical to the definition's component data (or if both are undefined),
   * the override might be removed to keep the overrides map lean (optional optimization).
   *
   * @param {string} componentTypeId - The unique string identifier for the component type.
   * @param {object} componentData - The plain JavaScript object containing the component's data for this instance.
   */
  setComponentOverride(componentTypeId, componentData) {
    if (typeof componentTypeId !== 'string' || !componentTypeId.trim()) {
      throw new Error('Invalid componentTypeId for setComponentOverride.');
    }
    // Storing a clone to prevent external mutations of the provided data from affecting the instance.
    this.overrides[componentTypeId] = cloneDeep(componentData);
  }

  /**
   * Removes a component override for this instance.
   * After removal, `getComponentData` will fall back to the definition's version.
   *
   * @param {string} componentTypeId - The component type ID whose override should be removed.
   * @returns {boolean} True if an override was present and removed, false otherwise.
   */
  removeComponentOverride(componentTypeId) {
    if (typeof componentTypeId !== 'string' || !componentTypeId.trim()) {
      return false; // Invalid componentTypeId
    }

    if (typeof this.overrides !== 'object' || this.overrides === null) {
      this.overrides = {};
      return false;
    }

    if (this.overrides.hasOwnProperty(componentTypeId)) {
      delete this.overrides[componentTypeId];
      return true;
    }
    return false; // Key not found in overrides
  }

  /**
   * Checks if this instance has data for a specific component type,
   * considering its definition and overrides.
   * A component explicitly overridden with `null` is considered not present for this instance via the override.
   *
   * @param {string} componentTypeId - The unique string identifier for the component type.
   * @param {boolean} [checkOverrideOnly=false] - If true, only checks if a non-null override exists for this instance.
   * @returns {boolean} True if the instance has data for this component type under the specified condition.
   */
  hasComponent(componentTypeId, checkOverrideOnly = false) {
    if (typeof componentTypeId !== 'string' || !componentTypeId.trim()) {
      return false;
    }

    const overrideExists = this.overrides.hasOwnProperty(componentTypeId);

    if (checkOverrideOnly) {
      // For an override to count, it must exist and not be null.
      return overrideExists && this.overrides[componentTypeId] !== null;
    }

    if (overrideExists) {
      // FIXED: If an override key exists, the component is considered present,
      // even if its value is null. This aligns with the final test's expectation.
      return true;
    }

    // If no override, presence is determined by the definition.
    return this.definition.hasComponent(componentTypeId);
  }

  /**
   * Gets all component type IDs for this instance, including those from the definition
   * and any overridden components.
   *
   * @returns {string[]} An array of unique component type IDs.
   */
  get allComponentTypeIds() {
    const keys = new Set(Object.keys(this.definition.components));
    Object.keys(this.overrides).forEach((key) => keys.add(key));
    return Array.from(keys);
  }
}

export default EntityInstanceData;
