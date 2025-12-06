/**
 * @file Proxy wrapper utilities for tests that throw on undefined property access.
 * Helps catch typos and incorrect property names while executing test scenarios.
 */

/**
 * Creates a strict proxy that throws when accessing undefined properties.
 *
 * @param {object} target - Object to wrap.
 * @param {string} [objectName] - Name for error messages.
 * @param {string[]} [allowedUndefined] - Properties allowed to be undefined.
 * @returns {Proxy} Proxied object.
 */
export function createStrictProxy(
  target,
  objectName = 'Object',
  allowedUndefined = []
) {
  return new Proxy(target, {
    get(obj, prop) {
      // Allow prototype chain and special properties
      if (
        prop === 'constructor' ||
        prop === '__proto__' ||
        prop === 'prototype'
      ) {
        return obj[prop];
      }

      // Allow Symbol properties (used by iterators, etc.)
      if (typeof prop === 'symbol') {
        return obj[prop];
      }

      // Allow Jest internal properties
      const propStr = String(prop);
      if (
        prop === 'toJSON' ||
        prop === '$$typeof' ||
        prop === 'asymmetricMatch' ||
        prop === 'nodeType' ||
        propStr.startsWith('@@') // Immutable.js properties used by Jest
      ) {
        return obj[prop];
      }

      const value = obj[prop];

      // If property exists or is in allowed list, return it
      if (prop in obj || allowedUndefined.includes(prop)) {
        return value;
      }

      // Property doesn't exist - throw descriptive error
      const availableProps = Object.keys(obj).join(', ');
      throw new Error(
        `❌ Property '${String(prop)}' does not exist on ${objectName}.\n` +
          `Available properties: [${availableProps}]\n` +
          `Did you mean: ${findSimilarProperty(String(prop), Object.keys(obj))}`
      );
    },
  });
}

/**
 * Find the most similar property name using Levenshtein distance.
 *
 * @param {string} target - Property that was accessed.
 * @param {string[]} available - Available property names.
 * @returns {string} Most similar property name.
 */
export function findSimilarProperty(target, available) {
  if (available.length === 0) return 'N/A';

  let minDistance = Infinity;
  let closest = available[0];

  for (const prop of available) {
    const distance = levenshteinDistance(
      target.toLowerCase(),
      prop.toLowerCase()
    );
    if (distance < minDistance) {
      minDistance = distance;
      closest = prop;
    }
  }

  return minDistance <= 3 ? closest : 'N/A (no close matches)';
}

/**
 * Calculate Levenshtein distance between two strings.
 *
 * @param {string} a - First string.
 * @param {string} b - Second string.
 * @returns {number} Edit distance.
 */
function levenshteinDistance(a, b) {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}
