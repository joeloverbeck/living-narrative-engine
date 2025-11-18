/**
 * @file Helper for building sanitized ENTITY_THOUGHT_ID payloads.
 */

/**
 * @typedef {object} DecisionMeta
 * @property {*} [speech] - Raw speech value.
 * @property {*} [thoughts] - Raw thoughts value.
 * @property {*} [notes] - Raw notes value.
 */

import { isNonBlankString } from '../../../utils/textUtils.js';

/**
 * Builds a sanitized payload from decision metadata for ENTITY_THOUGHT_ID.
 * This is used when an entity has thoughts (and possibly notes) but no speech.
 *
 * @param {DecisionMeta} decisionMeta - Metadata from the actor decision.
 * @param entityId
 * @returns {{entityId: string, thoughts: string, notes?: *}|null} The sanitized payload, or null if thoughts are absent/invalid.
 */
export function buildThoughtPayload(decisionMeta, entityId) {
  const { thoughts: thoughtsRaw, notes } = decisionMeta || {};

  const thoughts = isNonBlankString(thoughtsRaw) ? thoughtsRaw.trim() : null;

  if (!thoughts) {
    return null;
  }

  const payload = {
    entityId,
    thoughts,
    ...(notes ? { notes } : {}),
  };

  return payload;
}

export default buildThoughtPayload;
