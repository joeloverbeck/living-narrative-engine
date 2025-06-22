/**
 * @module ClosenessCircleService
 * @description A stateless domain helper for set-math operations related to "Closeness Circles".
 * Provides utilities for merging partner lists, ensuring uniqueness, and repairing lists for consistency.
 * This service is designed to be pure, with no external dependencies or side effects.
 * @see intimacy:closeness component
 * @see intimacy_handle_get_close rule
 * @see intimacy_handle_step_back rule
 */

/**
 * @typedef {string} EntityId - A unique identifier for an entity (e.g., "player", "npc_bob").
 * Refers to common.schema.json#/definitions/namespacedId
 */

/**
 * Deduplicates items in an array while preserving order of first appearance.
 *
 * @param {EntityId[]} items - The array of entity IDs to deduplicate.
 * @returns {EntityId[]} A new array containing only the unique items from the input.
 * @example
 * // returns ['a', 'b']
 * dedupe(['a', 'b', 'a'])
 */
function dedupe(items = []) {
  if (!Array.isArray(items)) {
    return [];
  }
  return [...new Set(items)];
}

/**
 * Merges multiple arrays of entity IDs into a single, deduplicated array.
 * This is used to calculate the full set of partners in a new or expanding Closeness Circle.
 *
 * @param {...EntityId[]} arrays - A variable number of arrays to merge.
 * @returns {EntityId[]} A new, single array containing all unique entity IDs from the provided arrays.
 * @example
 * const circle1 = ['a', 'b'];
 * const circle2 = ['b', 'c'];
 * // returns ['a', 'b', 'c']
 * merge(circle1, circle2)
 *
 * // returns ['a', 'b', 'c']
 * merge(['a'], ['b'], ['a', 'c'])
 */
function merge(...arrays) {
  const flattened = arrays.flat();
  return dedupe(flattened);
}

/**
 * "Repairs" a list of partners by ensuring it contains only unique, sorted entity IDs.
 * Sorting provides a canonical representation, making lists easier to compare.
 *
 * @param {EntityId[]} partners - The list of partner IDs to repair.
 * @returns {EntityId[]} A new array with unique and sorted partner IDs.
 * @example
 * // returns ['a', 'b', 'c']
 * repair(['c', 'a', 'c', 'b'])
 */
function repair(partners = []) {
  if (!Array.isArray(partners)) {
    return [];
  }
  const uniquePartners = dedupe(partners);
  // Sort for canonical representation
  return uniquePartners.sort();
}

export { dedupe, merge, repair };
