/**
 * @file The instance data for an entity (as opposed to the definition data).
 * @see src/entities/entityInstanceData.js
 */

import lodash from 'lodash';
const { cloneDeep } = lodash;
import { freeze } from '../utils/cloneUtils.js';
import { validateDependency } from '../utils/dependencyUtils.js';
import { ensureValidLogger } from '../utils/loggerUtils.js';
import EntityDefinition from './entityDefinition.js';

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Represents the mutable, runtime data for a unique instance of an entity.
 * It holds a reference to its EntityDefinition and any per-instance component overrides.
 *
 * @module core/entities/entityInstanceData
 */
class EntityInstanceData {
  /**
   * Logger used for warnings and debug output.
   *
   * @type {ILogger}
   * @private
   */
  #logger;
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
   * This property is frozen after construction and whenever overrides are
   * updated. Treat it as immutable and avoid direct mutation.
   *
   * @type {Readonly<Record<string, object>>}
   * @private
   */
  #overrides;

  /**
   * Creates a new EntityInstanceData instance.
   *
   * @param {string} instanceId - The unique runtime identifier for this instance.
   * @param {EntityDefinition} definition - The EntityDefinition this instance is based on.
   * @param {Record<string, object>} [initialOverrides] - Optional initial component overrides.
   * @param {ILogger} [logger] - Logger conforming to {@link ILogger} for warnings and diagnostics.
   * @throws {Error} If instanceId is not a valid string.
   * @throws {Error} If definition is not an instance of EntityDefinition.
   */
  constructor(instanceId, definition, initialOverrides = {}, logger = console) {
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
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    this.#logger = ensureValidLogger(logger, 'EntityInstanceData');

    // Use cloneDeep for initialOverrides to ensure deep copy and freeze to
    // discourage external mutation.
    this.#overrides = freeze(
      initialOverrides ? cloneDeep(initialOverrides) : {}
    );
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
    const overrideComponent = this.#overrides[componentTypeId];

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
    if (typeof componentData !== 'object' || componentData === null) {
      throw new TypeError('componentData must be a non-null object.');
    }
    // Replace overrides object to keep it immutable for external consumers.
    const updated = {
      ...this.#overrides,
      [componentTypeId]: cloneDeep(componentData),
    };
    this.#overrides = freeze(updated);
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

    if (typeof this.#overrides !== 'object' || this.#overrides === null) {
      this.#overrides = freeze({});
      return false;
    }

    if (
      Object.prototype.hasOwnProperty.call(this.#overrides, componentTypeId)
    ) {
      const updated = { ...this.#overrides };
      delete updated[componentTypeId];
      this.#overrides = freeze(updated);
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
   * @param {boolean} [checkOverrideOnly] - DEPRECATED. If true, only checks if
   * a non-null override exists for this instance.
   * @returns {boolean} True if the instance has data for this component type under the specified condition.
   */
  hasComponent(componentTypeId, checkOverrideOnly = false) {
    if (arguments.length === 2) {
      this.#logger.warn(
        'EntityInstanceData.hasComponent: The checkOverrideOnly flag is deprecated. Use hasComponentOverride(componentTypeId) instead.'
      );
      if (checkOverrideOnly) {
        return this.hasComponentOverride(componentTypeId);
      }
    }

    if (typeof componentTypeId !== 'string' || !componentTypeId.trim()) {
      return false;
    }

    const overrideExists = Object.prototype.hasOwnProperty.call(
      this.#overrides,
      componentTypeId
    );

    if (overrideExists) {
      // If an override key exists, the component is considered present,
      // even if its value is null. This aligns with legacy expectations.
      return true;
    }

    // If no override, presence is determined by the definition.
    return this.definition.hasComponent(componentTypeId);
  }

  /**
   * Checks if this instance has a non-null component override for the
   * specified type.
   *
   * @param {string} componentTypeId - The unique component type ID.
   * @returns {boolean} True if an override exists and is not null.
   */
  hasComponentOverride(componentTypeId) {
    if (typeof componentTypeId !== 'string' || !componentTypeId.trim()) {
      return false;
    }

    const overrideExists = Object.prototype.hasOwnProperty.call(
      this.#overrides,
      componentTypeId
    );
    return overrideExists && this.#overrides[componentTypeId] !== null;
  }

  /**
   * Provides read-only access to the component overrides for this instance.
   *
   * @returns {Readonly<Record<string, object>>}
   */
  get overrides() {
    return this.#overrides;
  }

  /**
   * Gets all component type IDs for this instance, including those from the definition
   * and any overridden components.
   *
   * @returns {string[]} An array of unique component type IDs.
   */
  get allComponentTypeIds() {
    const keys = new Set(Object.keys(this.definition.components));
    Object.keys(this.#overrides).forEach((key) => keys.add(key));
    const result = Array.from(keys);

    // Debug logging for park bench issue
    if (this.instanceId === 'p_erotica:park_bench_instance') {
      this.#logger.info(
        `[DEBUG] EntityInstanceData.allComponentTypeIds for park bench:`,
        {
          instanceId: this.instanceId,
          definitionComponents: Object.keys(this.definition.components),
          overrides: Object.keys(this.#overrides),
          result: result,
        }
      );
    }

    return result;
  }
}

export default EntityInstanceData;
