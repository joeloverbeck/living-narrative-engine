/**
 * @file Helper utilities for asserting action target parameters in tests.
 */

/**
 * @typedef {object} ExtractOptions
 * @property {string|null|undefined} [placeholder='primary'] - Specific placeholder bucket to extract.
 */

/**
 * @description Extracts target identifiers from an action's params while supporting both legacy
 * single-target payloads and the newer multi-target structure that groups identifiers by placeholder.
 * @param {object|null|undefined} params - Params object emitted by the formatting pipeline.
 * @param {ExtractOptions} [options] - Extraction options.
 * @returns {string[]} Ordered list of resolved target identifiers.
 */
export function extractTargetIds(params, { placeholder = 'primary' } = {}) {
  if (!params || typeof params !== 'object') {
    return [];
  }

  const ids = [];
  const { targetIds, targetId } = params;

  if (targetIds && typeof targetIds === 'object') {
    if (placeholder) {
      const bucket = targetIds[placeholder];
      appendValues(bucket, ids);
    } else {
      for (const bucket of Object.values(targetIds)) {
        appendValues(bucket, ids);
      }
    }
  }

  if (ids.length === 0 && typeof targetId === 'string' && targetId.length > 0) {
    ids.push(targetId);
  }

  return ids;
}

/**
 * @description Extracts the first available target identifier for convenience.
 * @param {object|null|undefined} params - Params object emitted by the formatting pipeline.
 * @param {ExtractOptions} [options] - Extraction options.
 * @returns {string|null} First resolved target identifier or null when none can be resolved.
 */
export function getFirstTargetId(params, options) {
  const [first] = extractTargetIds(params, options);
  return first ?? null;
}

/**
 * @description Appends normalized identifier values from a bucket into the accumulator array.
 * @param {unknown} bucket - Value stored in the params payload.
 * @param {string[]} accumulator - Destination list for normalized identifiers.
 * @returns {void}
 */
function appendValues(bucket, accumulator) {
  if (!bucket) {
    return;
  }

  if (Array.isArray(bucket)) {
    for (const value of bucket) {
      if (typeof value === 'string' && value.length > 0) {
        accumulator.push(value);
      }
    }
    return;
  }

  if (typeof bucket === 'string' && bucket.length > 0) {
    accumulator.push(bucket);
  }
}

export default {
  extractTargetIds,
  getFirstTargetId,
};
