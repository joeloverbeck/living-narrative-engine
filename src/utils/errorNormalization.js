/**
 * @file Error normalization utilities for consistent error handling.
 * Provides a single source of truth for converting non-Error values to Error instances
 * and safely augmenting errors with additional properties.
 */

/**
 * @typedef {Error & { context?: string }} NormalizedError
 */

/**
 * Normalizes any thrown value to an Error instance.
 * Use at catch boundaries, not at throw sites.
 *
 * @param {unknown} err - The caught value
 * @param {string} [context] - Optional context string to attach
 * @returns {NormalizedError} Always returns an Error instance
 */
export function normalizeError(err, context = '') {
  if (err instanceof Error) return err;
  let message;
  try {
    message = String(err);
  } catch {
    message = '[object with non-callable toString]';
  }
  /** @type {NormalizedError} */
  const normalized = new Error(message);
  if (context) normalized.context = context;
  return normalized;
}

/**
 * Safely augments an Error with additional properties.
 * Handles frozen objects, non-writable properties, etc.
 *
 * @param {Error} error - The Error to augment
 * @param {string} propName - Property name to set
 * @param {unknown} value - Value to assign
 * @returns {boolean} True if augmentation succeeded
 */
export function safeAugmentError(error, propName, value) {
  try {
    /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (error))[
      propName
    ] = value;
    // Verify assignment succeeded (handles silent failures like __proto__ on frozen objects)
    return (
      Object.prototype.hasOwnProperty.call(error, propName) &&
      /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (error))[
        propName
      ] === value
    );
  } catch {
    return false;
  }
}
