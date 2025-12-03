/**
 * @file Shared utilities for hit probability weight handling
 * Ensures consistent weight resolution across all handlers that perform
 * weighted random selection of body parts (e.g., RESOLVE_HIT_LOCATION, APPLY_DAMAGE)
 */

/**
 * Default weight for parts without explicit hit_probability_weight.
 * Matches the schema default in part.component.json.
 * @type {number}
 */
export const DEFAULT_HIT_PROBABILITY_WEIGHT = 1.0;

/**
 * Resolves the effective hit probability weight from a part component.
 * - Returns 0 for null/undefined components (part doesn't exist)
 * - Returns the explicit weight if set as a number (respecting 0 for internal organs)
 * - Returns DEFAULT_HIT_PROBABILITY_WEIGHT (1.0) for parts without explicit weight
 *
 * @param {object|null|undefined} partComponent - The anatomy:part component data
 * @returns {number} The effective weight (>= 0)
 */
export function getEffectiveHitWeight(partComponent) {
  if (!partComponent) {
    return 0;
  }

  const weight = partComponent.hit_probability_weight;

  // Explicit weight takes precedence (including 0 for internal organs)
  if (typeof weight === 'number') {
    return Math.max(0, weight);
  }

  // Default to 1.0 for parts without explicit weight (schema default)
  return DEFAULT_HIT_PROBABILITY_WEIGHT;
}

/**
 * Filters an array of parts to only those eligible for random hit selection.
 * Excludes parts with weight <= 0 (internal organs, equipment mounts, etc.)
 *
 * @param {Array<{id: string, component: object|null}>} parts - Array of part objects with id and component
 * @returns {Array<{id: string, weight: number}>} Filtered array with resolved weights
 */
export function filterEligibleHitTargets(parts) {
  const eligible = [];

  for (const { id, component } of parts) {
    const weight = getEffectiveHitWeight(component);
    if (weight > 0) {
      eligible.push({ id, weight });
    }
  }

  return eligible;
}
