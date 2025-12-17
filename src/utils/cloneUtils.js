// src/utils/cloneUtils.js

/**
 * @file Utility functions for cloning and freezing objects.
 * @description Re-exported from {@link src/utils/index.js}. Import from there
 * for convenience.
 */

/**
 * Freezes an object to make it immutable.
 *
 * @description
 * Immutability ensures that value objects cannot be modified after creation,
 * which helps prevent unintended side-effects and makes state management
 * more predictable.
 * @template T
 * @param {T} o - The object to freeze.
 * @returns {Readonly<T>} The frozen object.
 */
export function freeze(o) {
  return Object.freeze(o);
}

/**
 * Creates a deep clone of a plain object or array using JSON
 * serialization.
 *
 * @description
 * Suitable for cloning simple data structures that do not contain
 * functions or circular references. When `structuredClone` is not available
 * and JSON serialization is used, function values are omitted and
 * properties that cannot be stringified are silently dropped. Circular
 * references will cause an error to be thrown.
 * @template T
 * @param {T} value - The value to clone.
 * @returns {T} The cloned value or the original primitive.
 * @throws {Error} If the value cannot be stringified (e.g. circular structure).
 */
export function deepClone(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

/**
 * Deeply freezes an object and all its nested properties that are objects.
 * This makes the object and its content immutable.
 *
 * @template T
 * @param {T} object - The object to deep freeze.
 * @returns {Readonly<T>} The deeply frozen object.
 */
export function deepFreeze(object) {
  if (object && typeof object === 'object') {
    // Freeze properties before freezing self
    Object.keys(object).forEach((key) => {
      const value = object[key];
      // Recurse for nested objects
      if (value && typeof value === 'object') {
        deepFreeze(value);
      }
    });
    Object.freeze(object);
  }
  return object;
}

/**
 * Creates a read-only wrapper around a Map and deeply freezes its values.
 *
 * @description The returned Map behaves like the original but will throw a
 *   {@link TypeError} if mutating methods like `set`, `delete`, or `clear` are
 *   called. Each stored value is deep-frozen to prevent external mutation.
 * @template K
 * @template V
 * @param {Map<K, V>} map - The Map to freeze.
 * @returns {ReadonlyMap<K, V>} A proxy that prevents mutation.
 */
export function freezeMap(map) {
  for (const value of map.values()) {
    if (value && typeof value === 'object') {
      deepFreeze(value);
    }
  }

  Object.freeze(map);

  return new Proxy(map, {
    get(target, prop) {
      if (['set', 'delete', 'clear'].includes(prop)) {
        return () => {
          throw new TypeError('Cannot modify frozen map');
        };
      }
      // Use target as receiver to ensure Map getters/methods work correctly
      const result = Reflect.get(target, prop, target);
      return typeof result === 'function' ? result.bind(target) : result;
    },
  });
}

// Add other clone-related utilities here in the future if needed.
