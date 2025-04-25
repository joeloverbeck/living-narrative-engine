// src/utils/objectUtils.js

/**
 * @fileoverview Utility functions for working with plain JavaScript objects.
 */

/**
 * Safely retrieves a potentially nested property value from an object using a dot-notation path string.
 * This function is purely generic and has no knowledge of specific application structures like Entities or Components.
 *
 * @param {Record<string, any> | any[] | null | undefined} obj - The object or array to retrieve the property from.
 * @param {string | null | undefined} propertyPath - The dot-separated path string (e.g., "a.b.c", "a.list.0.name").
 * @returns {any | undefined} The value found at the specified path, or undefined if:
 * - The input object `obj` is null or undefined.
 * - The `propertyPath` is not a non-empty string.
 * - Any intermediate property in the path does not exist.
 * - Any intermediate value in the path is null, undefined, or not an object/array (and thus cannot be further traversed).
 * - The path contains empty segments (e.g., "a..b").
 *
 * @example
 * const myObj = { a: { b: [ { name: 'first' }, { name: 'second' } ], c: 5 }, d: null };
 * getObjectPropertyByPath(myObj, 'a.b.1.name'); // Returns 'second'
 * getObjectPropertyByPath(myObj, 'a.c');       // Returns 5
 * getObjectPropertyByPath(myObj, 'a.b.0');      // Returns { name: 'first' }
 * getObjectPropertyByPath(myObj, 'd');          // Returns null
 * getObjectPropertyByPath(myObj, 'a.x.y');      // Returns undefined (x does not exist)
 * getObjectPropertyByPath(myObj, 'a.c.d');      // Returns undefined (cannot access 'd' on number 5)
 * getObjectPropertyByPath(myObj, 'd.e');        // Returns undefined (cannot access 'e' on null)
 * getObjectPropertyByPath(myObj, 'a..c');       // Returns undefined (empty segment)
 * getObjectPropertyByPath(null, 'a.b');       // Returns undefined
 * getObjectPropertyByPath(myObj, '');           // Returns undefined
 * getObjectPropertyByPath(myObj, null);         // Returns undefined
 */
export const getObjectPropertyByPath = (obj, propertyPath) => {
  // Validate inputs: object must exist and path must be a non-empty string
  if (obj === null || typeof obj === 'undefined' || typeof propertyPath !== 'string' || propertyPath === '') {
    return undefined;
  }

  const pathParts = propertyPath.split('.');
  let current = obj;

  for (let i = 0; i < pathParts.length; i++) {
    const part = pathParts[i];

    // Check for empty segments caused by double dots (e.g., "a..b") or leading/trailing dots
    if (part === '') {
      return undefined;
    }

    // Before attempting access, ensure 'current' is an object or array
    // Allow traversal into arrays using numeric indices
    const isObject = current !== null && typeof current === 'object'; // Includes arrays

    if (!isObject) {
      // Cannot traverse further into a primitive, null, or undefined value
      return undefined;
    }

    // Check if the property exists on the current object/array
    // Using `Object.prototype.hasOwnProperty.call` is safer for objects,
    // but `part in current` works for both own properties and array indices.
    // `current[part]` handles both object properties and array indices naturally.
    if (part in current) {
      current = current[part];
      // If the value found is undefined, and it's not the last part of the path,
      // we cannot continue traversal.
      if (current === undefined && i < pathParts.length - 1) {
        return undefined;
      }
    } else {
      // Property/index does not exist at this level
      return undefined;
    }
  }

  // If the loop completes, 'current' holds the final value
  return current;
};

// Add other generic object utilities here in the future if needed.