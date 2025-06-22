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

/**
 * @description Extracts the namespace or mod ID from a fully qualified ID.
 * Similar to {@link module:EntityDefinition.modId} but usable independently.
 * @param {string} fullId - ID in the format 'modId:entityName'.
 * @returns {string|undefined} The mod ID, or `undefined` if none is present or invalid.
 */
export function extractModId(fullId) {
  if (typeof fullId !== 'string') {
    return undefined;
  }
  const trimmed = fullId.trim();
  if (trimmed === '') {
    return undefined;
  }
  const parts = trimmed.split(':');
  return parts.length > 1 && parts[0] !== '' ? parts[0] : undefined;
}

/**
 * Parses and validates an ID property from a data object.
 * Ensures the ID exists and is a non-empty string, then attempts to
 * derive the base ID using {@link extractBaseId}.
 *
 * If `allowFallback` is `true` and base extraction fails, the trimmed full ID
 * will be used as the base ID with a warning.
 *
 * @param {object} data - The object containing the ID property.
 * @param {string} idProp - The property name of the ID within the object.
 * @param {string} modId - ID of the mod that owns the data.
 * @param {string} filename - Filename for logging context.
 * @param {import('../interfaces/coreServices.js').ILogger} logger - Logger used for messages.
 * @param {{ allowFallback?: boolean }} options - Options object.
 * @returns {{ fullId: string, baseId: string }} Parsed IDs.
 * @throws {Error} If the ID is missing/invalid or base extraction fails without fallback.
 */
export function parseAndValidateId(
  data,
  idProp,
  modId,
  filename,
  logger,
  { allowFallback = false } = {}
) {
  const rawId = data?.[idProp];

  if (typeof rawId !== 'string' || rawId.trim() === '') {
    // DO NOT LOG HERE. The calling wrapper is responsible for catching and logging.
    throw new Error(
      `Invalid or missing '${idProp}' in ${filename} for mod '${modId}'.`
    );
  }

  const trimmedId = rawId.trim();
  const baseId = extractBaseId(trimmedId);

  if (!baseId) {
    if (allowFallback) {
      logger.warn(
        `Could not extract base ID from '${trimmedId}' in file '${filename}'. Falling back to full ID.`,
        { modId, filename, receivedId: trimmedId }
      );
      return { fullId: trimmedId, baseId: trimmedId };
    }
    throw new Error(
      `Could not extract base ID from '${trimmedId}' in ${filename}. Invalid format.`
    );
  }

  return { fullId: trimmedId, baseId };
}

/**
 * Extracts a base identifier from a filename by removing directory segments,
 * the final extension, and an optional list of suffixes.
 *
 * @param {string} filename - The filename to parse.
 * @param {string[]} suffixes - Suffixes to strip from the filename.
 * @returns {string} The base identifier or an empty string if it cannot be derived.
 */
export function extractBaseIdFromFilename(filename, suffixes = []) {
  if (typeof filename !== 'string') {
    return '';
  }

  let name = filename.trim();
  if (name === '') {
    return '';
  }

  // Normalize separators and remove directory segments
  name = name.replace(/\\/g, '/');
  if (name.includes('/')) {
    name = name.substring(name.lastIndexOf('/') + 1);
  }

  // Strip the final extension
  if (name.includes('.')) {
    name = name.substring(0, name.lastIndexOf('.'));
  }

  // Remove any provided suffix
  for (const suffix of suffixes) {
    if (
      typeof suffix === 'string' &&
      name.toLowerCase().endsWith(suffix.toLowerCase())
    ) {
      name = name.substring(0, name.length - suffix.length);
      break;
    }
  }

  return name;
}
