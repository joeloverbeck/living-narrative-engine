/**
 * @file Deterministic prototype name generator for prototype synthesis
 *
 * Generates unique names following the spec pattern: <modifier>_<base>
 * where modifier is up_<axis> or down_<axis> based on strongest importance.
 */

/**
 * Generate a deterministic prototype name following spec pattern.
 *
 * Algorithm:
 * 1. Base = anchorPrototypeId ?? 'prototype'
 * 2. Find axis with highest abs(importance) from targetSignature
 * 3. Modifier = 'up_<axis>' if direction > 0 else 'down_<axis>'
 * 4. Name = '<modifier>_<base>'
 * 5. If collision, append '_v2', '_v3', etc. deterministically
 *
 * @param {Map<string, {direction: number, importance: number}> | object} targetSignature - Axis to direction/importance mapping
 * @param {string|null} anchorPrototypeId - Base prototype ID to derive name from
 * @param {Set<string>|Array<string>} [existingNames] - Names to avoid collisions with
 * @returns {string} - Unique name in format <modifier>_<base>
 */
export function generatePrototypeName(
  targetSignature,
  anchorPrototypeId = null,
  existingNames = new Set()
) {
  // Convert existingNames to Set if array
  const existingSet =
    existingNames instanceof Set ? existingNames : new Set(existingNames);

  // Determine base name
  const base = anchorPrototypeId || 'prototype';

  // Find strongest axis by abs(importance)
  const strongestAxis = findStrongestAxis(targetSignature);

  // Generate modifier
  let modifier;
  if (strongestAxis) {
    const entry = getTargetSignatureEntry(targetSignature, strongestAxis);
    const direction = entry?.direction ?? 1;
    modifier = direction > 0 ? `up_${strongestAxis}` : `down_${strongestAxis}`;
  } else {
    // Fallback if no target signature
    modifier = 'synthesized';
  }

  // Build candidate name
  const baseName = `${modifier}_${base}`;

  // Handle collisions deterministically
  if (!existingSet.has(baseName)) {
    return baseName;
  }

  // Append version suffix until unique
  let version = 2;
  while (existingSet.has(`${baseName}_v${version}`)) {
    version++;
  }

  return `${baseName}_v${version}`;
}

/**
 * Find the axis with highest abs(importance) in the target signature.
 *
 * @param {Map<string, {direction: number, importance: number}> | object} targetSignature
 * @returns {string|null} - Axis name or null if empty
 */
function findStrongestAxis(targetSignature) {
  let strongestAxis = null;
  let maxAbsImportance = -Infinity;

  // Handle both Map and plain object
  const entries =
    targetSignature instanceof Map
      ? targetSignature.entries()
      : Object.entries(targetSignature || {});

  for (const [axis, entry] of entries) {
    const importance = entry?.importance ?? 0;
    const absImportance = Math.abs(importance);

    // Only consider axes with positive importance
    if (absImportance > 0 && absImportance > maxAbsImportance) {
      maxAbsImportance = absImportance;
      strongestAxis = axis;
    } else if (
      absImportance > 0 &&
      absImportance === maxAbsImportance &&
      axis < strongestAxis
    ) {
      // Deterministic tie-breaker: alphabetical order
      strongestAxis = axis;
    }
  }

  return strongestAxis;
}

/**
 * Get entry from target signature (handles both Map and Object).
 *
 * @param {Map<string, {direction: number, importance: number}> | object} targetSignature
 * @param {string} axis
 * @returns {{direction: number, importance: number}|undefined}
 */
function getTargetSignatureEntry(targetSignature, axis) {
  if (targetSignature instanceof Map) {
    return targetSignature.get(axis);
  }
  return targetSignature?.[axis];
}

export default generatePrototypeName;
