/**
 * @file Dual Format State Builder for GOAP Numeric Goal Planning Tests
 * Creates state structure that works with both:
 * - JSON Logic variable resolution (for goal evaluation)
 * - GOAP planning operations (for effect simulation)
 * 
 * The challenge: Component IDs contain colons (e.g., 'core:needs') which JSON Logic
 * cannot parse in dot notation paths like 'state.actor.components.core:needs.hunger'.
 * 
 * Solution: Create flattened component access paths that replace colons with underscores,
 * while maintaining the original colon-based keys for GOAP operations.
 */

/**
 * Build state with dual format required for numeric goals
 * 
 * Creates three representations:
 * 1. Flat hash format: 'actorId:componentId' -> component data (for GOAP operations)
 * 2. Nested format with colons: state.actor.components['core:needs'] (original structure)
 * 3. Flattened aliases: state.actor.components.core_needs (for JSON Logic paths)
 * 
 * @param {object} actor - Actor entity with id and components
 * @param {string} actor.id - Actor ID
 * @param {object} actor.components - Components map (keys may contain colons)
 * @returns {object} State object with all three formats
 * 
 * @example
 * const state = setup.buildPlanningState({
 *   id: 'test_actor',
 *   components: { 'core:needs': { hunger: 100 } }
 * });
 * 
 * // All three work:
 * state['test_actor:core:needs'].hunger // => 100 (flat hash)
 * state.actor.components['core:needs'].hunger // => 100 (nested with colon)
 * state.actor.components.core_needs.hunger // => 100 (flattened alias)
 */
export function buildDualFormatState(actor) {
  const state = {
    // Nested format for JSON Logic
    actor: {
      id: actor.id,
      components: {},
    },
  };

  // Process each component
  Object.keys(actor.components).forEach((componentId) => {
    const componentData = { ...actor.components[componentId] };
    
    // 1. Flat hash format for GOAP operations
    const flatKey = `${actor.id}:${componentId}`;
    state[flatKey] = componentData;
    
    // 2. Nested format with original colon-based key
    state.actor.components[componentId] = componentData;
    
    // 3. Flattened alias (replace colons with underscores for JSON Logic compatibility)
    const flattenedKey = componentId.replace(/:/g, '_');
    state.actor.components[flattenedKey] = componentData;
  });

  return state;
}

/**
 * Convert component ID with colons to flattened format for JSON Logic paths
 * 
 * @param {string} componentId - Component ID (may contain colons)
 * @returns {string} Flattened ID with underscores
 * 
 * @example
 * flattenComponentId('core:needs') // => 'core_needs'
 * flattenComponentId('mod:category:component') // => 'mod_category_component'
 */
export function flattenComponentId(componentId) {
  return componentId.replace(/:/g, '_');
}

/**
 * Build JSON Logic variable path for component field access
 * Converts colon-based component IDs to underscore format for JSON Logic compatibility
 * 
 * @param {string} componentId - Component ID (may contain colons)
 * @param {string} field - Field name within component
 * @returns {string} JSON Logic compatible path
 * 
 * @example
 * buildComponentFieldPath('core:needs', 'hunger')
 * // => 'state.actor.components.core_needs.hunger'
 * 
 * buildComponentFieldPath('core:stats', 'health')
 * // => 'state.actor.components.core_stats.health'
 */
export function buildComponentFieldPath(componentId, field) {
  const flattenedId = flattenComponentId(componentId);
  return `state.actor.components.${flattenedId}.${field}`;
}
