// src/utils/geometryUtils.js

/**
 * @fileoverview Geometry utility functions.
 */

/**
 * Calculates the squared Euclidean distance between two points in 2D space.
 * Using squared distance avoids the need for Math.sqrt, which can be computationally
 * more expensive and is often unnecessary if only comparing distances.
 *
 * @param {number} x1 - The x-coordinate of the first point.
 * @param {number} y1 - The y-coordinate of the first point.
 * @param {number} x2 - The x-coordinate of the second point.
 * @param {number} y2 - The y-coordinate of the second point.
 * @returns {number} The squared distance between the two points.
 * @throws {TypeError} If any input coordinate is not a valid number (including NaN).
 */
export const calculateDistanceSquaredCoords = (x1, y1, x2, y2) => {
  // Check if any coordinate is not a number OR is NaN
  if (typeof x1 !== 'number' || Number.isNaN(x1) ||
        typeof y1 !== 'number' || Number.isNaN(y1) ||
        typeof x2 !== 'number' || Number.isNaN(x2) ||
        typeof y2 !== 'number' || Number.isNaN(y2)) {
    // Updated error message slightly for clarity
    throw new TypeError('All coordinates must be valid numbers (not NaN) for distance calculation.');
  }
  const dx = x1 - x2;
  const dy = y1 - y2;
  return dx * dx + dy * dy;
};

/**
 * Calculates the squared Euclidean distance between two position objects.
 * Assumes position objects have 'x' and 'y' properties. Provides default 0 if missing.
 *
 * @param {{ x?: number, y?: number }} posA - The first position object.
 * @param {{ x?: number, y?: number }} posB - The second position object.
 * @returns {number} The squared distance between the two positions. Returns NaN if inputs are invalid non-objects.
 */
export const calculateDistanceSquared = (posA, posB) => {
  if (typeof posA !== 'object' || posA === null || typeof posB !== 'object' || posB === null) {
    console.warn('Invalid input for calculateDistanceSquared: Expected objects.');
    return NaN; // Indicate error
  }
  const x1 = posA.x ?? 0;
  const y1 = posA.y ?? 0;
  const x2 = posB.x ?? 0;
  const y2 = posB.y ?? 0;

  // Directly calculate since defaults handle undefined/null,
  // but ensure the result isn't NaN from bad inputs (like NaN properties)
  const dx = x1 - x2;
  const dy = y1 - y2;
  const distSq = dx * dx + dy * dy;

  // Optional: Add a check here if posA.x or posB.x could potentially be NaN
  // If x1, y1, x2, y2 could be NaN after the ?? 0 step (e.g., if posA.x was NaN),
  // the result `distSq` would be NaN. Depending on desired behavior, you might
  // want calculateDistanceSquared to return NaN in that case too, which it will implicitly.
  // If you wanted it to throw, you'd call calculateDistanceSquaredCoords here.
  // For now, assume the ?? 0 handles the structure correctly and propagation of NaN is acceptable.
  // Example of delegation (if stricter NaN handling needed in calculateDistanceSquared too):
  // try {
  //     return calculateDistanceSquaredCoords(x1, y1, x2, y2);
  // } catch (e) {
  //     console.error("Error during distance calculation:", e);
  //     return NaN;
  // }

  return distSq;
};