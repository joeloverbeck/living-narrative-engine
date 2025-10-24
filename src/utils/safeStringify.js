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
 * @returns {string} The JSON string representation. When the input has no
 * JSON representation (e.g., `undefined`, functions, symbols), a string
 * fallback is returned to guarantee a string result.
 */
export function safeStringify(value) {
  const seen = new WeakSet();
  const replacer = (key, val) => {
    if (typeof val === 'bigint') {
      return val.toString();
    }

    if (val && typeof val === 'object') {
      if (seen.has(val)) {
        return '[Circular]';
      }
      seen.add(val);
    }

    return val;
  };

  const sanitizedRoot =
    typeof value === 'bigint' ? value.toString() : value;

  const jsonResult = JSON.stringify(sanitizedRoot, replacer);

  if (typeof jsonResult === 'string') {
    return jsonResult;
  }

  // JSON.stringify returns undefined for primitives like undefined, functions,
  // and symbols. Ensure callers still receive a string result by falling back
  // to their string representation.
  if (sanitizedRoot === undefined) {
    return 'undefined';
  }

  return String(sanitizedRoot);
}
