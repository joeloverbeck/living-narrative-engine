/**
 * @file JSON Logic variable path extraction utilities.
 * Provides reusable functions for extracting variable paths from JSON Logic expressions.
 */

/**
 * Extracts the variable path from a JSON Logic var node.
 * Handles both string format `{ "var": "path" }` and array format `{ "var": ["path", default] }`.
 *
 * @param {*} node - Potential var node to extract from
 * @returns {string|null} The variable path or null if not a var node
 */
export function extractVarPath(node) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    return null;
  }

  if (!Object.prototype.hasOwnProperty.call(node, 'var')) {
    return null;
  }

  const value = node.var;

  // String format: { "var": "emotions.joy" }
  if (typeof value === 'string') {
    return value;
  }

  // Array format with default: { "var": ["emotions.joy", 0] }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }

  return null;
}

/**
 * Recursively collects all variable paths from a JSON Logic expression.
 * Traverses the entire expression tree to find all `{ "var": "..." }` nodes.
 *
 * @param {*} node - JSON Logic node to traverse
 * @param {string[]} [paths] - Accumulator array for collected paths
 * @returns {string[]} Array of all variable paths found in the expression
 * @example
 * // Simple comparison
 * collectVarPaths({ ">=": [{ "var": "emotions.joy" }, 0.5] });
 * // Returns: ["emotions.joy"]
 * @example
 * // Complex AND logic
 * collectVarPaths({
 *   "and": [
 *     { ">=": [{ "var": "emotions.joy" }, 0.5] },
 *     { "<": [{ "var": "moodAxes.threat" }, 30] }
 *   ]
 * });
 * // Returns: ["emotions.joy", "moodAxes.threat"]
 */
export function collectVarPaths(node, paths = []) {
  if (node === null || node === undefined) {
    return paths;
  }

  // Handle arrays (e.g., operands in comparisons)
  if (Array.isArray(node)) {
    for (const entry of node) {
      collectVarPaths(entry, paths);
    }
    return paths;
  }

  // Non-objects are primitives, skip them
  if (typeof node !== 'object') {
    return paths;
  }

  // Check if this node is a var reference
  const directPath = extractVarPath(node);
  if (directPath) {
    paths.push(directPath);
    return paths;
  }

  // Recursively traverse all values in the object
  for (const value of Object.values(node)) {
    collectVarPaths(value, paths);
  }

  return paths;
}
