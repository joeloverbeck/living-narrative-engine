/**
 * @file targetCandidateUtils.js
 * @description Utility helpers for working with resolved target candidates.
 */

/**
 * Extract the identifier for a resolved target candidate.
 *
 * @param {object|undefined|null} candidate - Target candidate to inspect.
 * @returns {string|null} Candidate entity identifier when available.
 */
export function extractCandidateId(candidate) {
  if (!candidate) {
    return null;
  }

  if (typeof candidate.id === 'string' && candidate.id.length > 0) {
    return candidate.id;
  }

  if (candidate.entity && typeof candidate.entity.id === 'string') {
    return candidate.entity.id;
  }

  return null;
}

export default {
  extractCandidateId,
};
