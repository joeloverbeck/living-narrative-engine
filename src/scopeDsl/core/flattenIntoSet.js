/**
 * Flattens an iterable of values (which may contain arrays) into a single Set.
 * Recursively processes arrays to extract all non-array values.
 *
 * @param {Iterable} iterable - An iterable containing values and/or arrays
 * @returns {Set} A Set containing all non-array values from the input
 */
export default function flattenIntoSet(iterable) {
  const result = new Set();

  for (const value of iterable) {
    if (Array.isArray(value)) {
      // Recursively flatten arrays
      const flattened = flattenIntoSet(value);
      for (const item of flattened) {
        result.add(item);
      }
    } else {
      result.add(value);
    }
  }

  return result;
}
