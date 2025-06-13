// src/utils/conditionContextUtils.js

import { getObjectPropertyByPath } from './objectUtils.js';

// --- JSDoc Typedefs ---
// Using JSDoc typedefs for clarity, assuming these types are defined elsewhere
// and accessible via these paths in a real project. Adjust paths as needed.

/**
 * @typedef {object} ConditionDataAccess
 * Interface providing methods to access game data during condition evaluation.
 * @property {(key: string) => (typeof Component | undefined)} getComponentClassByKey
 */

/**
 * @typedef {import('../entities/entity.js').default} Entity
 * Represents an entity in the game/engine, expected to have a `getComponent` method.
 * Should have at least: { getComponent: (componentClass: typeof Component) => Component | undefined }
 */

/**
 * @typedef {object} Connection
 * Represents a connection object used as context in some conditions.
 */

/**
 * @typedef {object} Component
 * The base class for all components.
 */

// --- Function Implementation ---

/**
 * Retrieves a value from a condition evaluation target (context object) based on a property path.
 * This function centralizes context property access logic, handling the special case of
 * accessing components and their properties on Entity objects via the ConditionDataAccess service.
 * For non-Entity targets or direct properties on Entities, it falls back to generic nested
 * property access.
 *
 * This function is intended to replace the Entity/Component-specific logic previously
 * embedded within older utility functions like `getNestedProperty`.
 *
 * @param {Entity | Connection | any | null | undefined} target - The context object from which to retrieve the value
 * (e.g., an Entity instance, a Connection object, or potentially other data structures).
 * @param {string | null | undefined} propertyPath - A dot-separated string representing the path to the desired property.
 * Examples: "id", "state", "Health", "Health.current", "Transform.position.x".
 * @param {ConditionDataAccess | null | undefined} dataAccess - An instance of the ConditionDataAccess service,
 * required *only* if the target might be an Entity and the propertyPath might refer to a component
 * (e.g., "Health" or "Health.current"). Provides `getComponentClassByKey`.
 * @returns {any | undefined} The value found at the specified path within the target context.
 * Returns `undefined` if:
 * - `target` is null or undefined.
 * - `propertyPath` is not a non-empty string.
 * - The path cannot be resolved (e.g., intermediate property missing, component not found).
 * - `dataAccess` is required for component lookup but not provided.
 * @example
 * // Assume 'entity' is an Entity instance, 'connection' is a Connection object,
 * // and 'dataAccess' provides component lookups.
 *
 * // --- Entity Examples ---
 * // Get Entity ID (direct property)
 * getContextValue(entity, 'id', dataAccess);
 * // Result: (entity's ID, e.g., "player-1")
 *
 * // Get Health component instance itself
 * getContextValue(entity, 'Health', dataAccess);
 * // Result: (the Health component instance on the entity, or undefined if none)
 *
 * // Get 'current' property of the Health component
 * getContextValue(entity, 'Health.current', dataAccess);
 * // Result: (value of entity.getComponent(Health).current, or undefined if Health component or 'current' property missing)
 *
 * // Get nested property 'x' from Position component
 * getContextValue(entity, 'Position.coords.x', dataAccess);
 * // Result: (value of entity.getComponent(Position).coords.x)
 *
 * // Get direct property even if it matches a component key pattern (if component access fails or dataAccess missing)
 * const entityWithDirectProp = { id: 'e1', Health: 'direct-value', getComponent: () => undefined };
 * getContextValue(entityWithDirectProp, 'Health', null); // No dataAccess
 * // Result: 'direct-value' (falls back to direct access)
 *
 * // --- Connection Example ---
 * // Get 'state' property from a connection object
 * const connection = { id: 'c1', state: 'active', targetEntityId: 'e2' };
 * getContextValue(connection, 'state', dataAccess); // dataAccess ignored for non-entities
 * // Result: 'active'
 *
 * // --- Invalid/Missing Cases ---
 * getContextValue(null, 'id', dataAccess);
 * // Result: undefined
 * getContextValue(entity, '', dataAccess);
 * // Result: undefined
 * getContextValue(entity, 'NonExistentComponent.value', dataAccess);
 * // Result: undefined (if NonExistentComponent class not found via dataAccess)
 * getContextValue(entity, 'Health.nonExistentProperty', dataAccess);
 * // Result: undefined (if Health component exists but nonExistentProperty doesn't)
 * getContextValue(entity, 'Health', null); // Attempt component access without dataAccess
 * // Result: Depends on whether entity itself has a direct property 'Health'. If not, undefined.
 */
export const getContextValue = (target, propertyPath, dataAccess) => {
  // 1. --- Input Validation ---
  if (target === null || typeof target === 'undefined') {
    // console.warn('getContextValue: Target object is null or undefined.');
    return undefined;
  }
  if (typeof propertyPath !== 'string' || propertyPath === '') {
    // console.warn('getContextValue: Property path is not a valid non-empty string.');
    return undefined;
  }

  // 2. --- Entity/Component Logic ---
  // Check if the target looks like an Entity (has getComponent method) AND dataAccess is provided.
  // Optional chaining target?.getComponent is safer if target structure is uncertain.
  const isPotentialEntity = typeof target?.getComponent === 'function';

  if (isPotentialEntity && dataAccess) {
    /** @type {Entity} */
    const entityTarget = target; // Cast for clarity/potential type checking
    const pathParts = propertyPath.split('.');
    const componentKey = pathParts[0];

    // Check if the first part of the path *could* be a component key.
    // An empty componentKey shouldn't happen due to prior validation, but check just in case.
    if (componentKey) {
      const ComponentClass = dataAccess.getComponentClassByKey(componentKey);

      if (ComponentClass) {
        // Found a component class matching the first part of the path.
        const componentInstance = entityTarget.getComponent(ComponentClass);

        if (componentInstance) {
          // Component instance exists on the entity.
          if (pathParts.length === 1) {
            // The path was just the component key (e.g., "Health"). Return the instance.
            return componentInstance;
          } else {
            // The path has more parts (e.g., "Health.current.value").
            // Create the remaining path to access within the component.
            const remainingPath = pathParts.slice(1).join('.');
            // Use the generic getter on the component instance.
            return getObjectPropertyByPath(componentInstance, remainingPath);
          }
        } else {
          // Component class exists, but the entity doesn't have an instance of it.
          return undefined;
        }
      }
      // Else (ComponentClass not found): Fall through to the generic property access below.
      // This allows accessing direct entity properties like 'entity.id' or 'entity.customProp'
      // even if 'customProp' isn't a registered component key.
    }
    // Else (componentKey was empty - shouldn't happen): Fall through.
  }

  // 3. --- Fallback / Non-Entity / Direct Property Logic ---
  // Use the generic getter if:
  // - Target is not an Entity.
  // - Target is an Entity, but dataAccess was not provided.
  // - Target is an Entity, dataAccess was provided, but the first path part
  //   did not resolve to a known ComponentClass via dataAccess.getComponentClassByKey.
  return getObjectPropertyByPath(target, propertyPath);
};
