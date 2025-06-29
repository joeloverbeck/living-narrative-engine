/**
 * Safely sets a nested value on an object using a dot-separated path.
 *
 * @description Creates intermediate objects as needed but will not overwrite
 *  non-object values along the path.
 * @param {object} root - Object to modify.
 * @param {string} path - Dot-separated path (e.g., 'a.b.c').
 * @param {*} value - Value to assign.
 * @returns {boolean} True if the assignment succeeded, false otherwise.
 */
export function setByPath(root, path, value) {
  const parts = path.split('.').filter(Boolean);
  let cur = root;
  for (let i = 0; i < parts.length; i++) {
    const key = parts[i];
    if (key === '__proto__' || key === 'constructor') {
      throw new Error(`Unsafe property name detected: ${key}`);
    }
    if (i === parts.length - 1) {
      cur[key] = value;
      return true;
    }
    if (cur[key] === null || cur[key] === undefined) cur[key] = {};
    if (typeof cur[key] !== 'object') return false;
    cur = cur[key];
  }
  return false;
}
