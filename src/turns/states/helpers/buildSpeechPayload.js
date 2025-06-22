/**
 * @file Helper for building sanitized ENTITY_SPOKE_ID payloads.
 */

/**
 * @typedef {object} DecisionMeta
 * @property {*} [speech] - Raw speech value.
 * @property {*} [thoughts] - Raw thoughts value.
 * @property {*} [notes] - Raw notes value.
 */
import { isNonBlankString } from '../../../utils/textUtils.js';

/**
 * Builds a sanitized payload from decision metadata for ENTITY_SPOKE_ID.
 *
 * @param {DecisionMeta} decisionMeta - Metadata from the actor decision.
 * @returns {{speechContent: string, thoughts?: string, notes?: string}|null} The sanitized payload, or null if speech is absent/invalid.
 */
export function buildSpeechPayload(decisionMeta) {
  const {
    speech: speechRaw,
    thoughts: thoughtsRaw,
    notes: notesRaw,
  } = decisionMeta || {};

  const speech = isNonBlankString(speechRaw) ? speechRaw.trim() : null;
  if (!speech) {
    return null;
  }

  const thoughts = isNonBlankString(thoughtsRaw)
    ? thoughtsRaw.trim()
    : undefined;

  let notes;
  if (Array.isArray(notesRaw)) {
    const joined = notesRaw
      .map((n) => (isNonBlankString(n) ? n.trim() : ''))
      .filter(Boolean)
      .join('\n');
    if (joined) {
      notes = joined;
    }
  } else if (isNonBlankString(notesRaw)) {
    notes = notesRaw.trim();
  }

  const payload = {
    speechContent: speech,
    ...(thoughts ? { thoughts } : {}),
    ...(notes ? { notes } : {}),
  };

  return payload;
}

export default buildSpeechPayload;
