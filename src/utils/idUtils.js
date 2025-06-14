/**
 * @module IdUtils
 * @description Utility functions for working with namespaced IDs.
 */

/**
 * Extracts the base ID (without namespace) from a fully qualified ID string.
 * Accepts strings like "name" or "namespace:name". Returns `null` if the
 * extraction fails due to invalid format or empty values.
 *
 * @param {string} fullId - The ID string to parse.
 * @returns {string|null} The base ID, or `null` if it cannot be derived.
 */
export function extractBaseId(fullId) {
  if (typeof fullId !== 'string') {
    return null;
  }
  const trimmed = fullId.trim();
  if (trimmed === '') {
    return null;
  }
  const parts = trimmed.split(':');
  if (parts.length === 1) {
    return parts[0];
  }
  const namespacePart = parts[0].trim();
  const basePart = parts.slice(1).join(':').trim();
  if (namespacePart && basePart) {
    return basePart;
  }
  return null;
}
