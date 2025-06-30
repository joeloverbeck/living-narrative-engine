// src/utils/safeStringify.js

/**
 * Safely stringifies a value that may contain circular references.
 *
 * @description
 * Uses a WeakSet to track visited objects and replaces circular
 * references with the string "[Circular]".
 * This mirrors JSON.stringify behavior for non-cyclic structures
 * but avoids throwing errors when cycles are present.
 * @param {any} value - The value to stringify.
 * @returns {string} The JSON string representation.
 */
export function safeStringify(value) {
  const seen = new WeakSet();
  return JSON.stringify(value, (key, val) => {
    if (val && typeof val === 'object') {
      if (seen.has(val)) {
        return '[Circular]';
      }
      seen.add(val);
    }
    return val;
  });
}
