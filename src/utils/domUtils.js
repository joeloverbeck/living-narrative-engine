/**
 * Safely sets a potentially nested property on an object using a dot-separated path.
 *
 * @param {object} obj - The target object.
 * @param {string} path - The dot-separated path (e.g., "style.color", "dataset.userId").
 * @param {*} value - The value to set.
 * @returns {boolean} True if the value was set successfully, false otherwise.
 */
export function setPropertyByPath(obj, path, value) {
  if (!obj || typeof path !== 'string') return false;

  const parts = path.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (
      current === null ||
      current === undefined ||
      typeof current !== 'object'
    ) {
      // Cannot traverse further down a non-object or null/undefined
      return false;
    }
    if (
      !Object.prototype.hasOwnProperty.call(current, key) ||
      current[key] == null
    ) {
      // If part of the path doesn't exist or is null/undefined, cannot set nested property safely
      // Could alternatively create missing objects: current[key] = {}; but safer not to by default.
      return false;
    }
    current = current[key];
  }

  const finalKey = parts[parts.length - 1];
  if (
    current === null ||
    current === undefined ||
    typeof current !== 'object'
  ) {
    // Cannot set property on final non-object
    return false;
  }

  try {
    current[finalKey] = value;
    return true;
  } catch (e) {
    // Handle potential errors during assignment (e.g., readonly properties)
    console.error(`Error setting property '${finalKey}' on path '${path}':`, e);
    return false;
  }
}
