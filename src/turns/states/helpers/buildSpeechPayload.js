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
import { formatNotesForDisplay } from './noteFormatter.js';

/**
 * Builds a sanitized payload from decision metadata for ENTITY_SPOKE_ID.
 *
 * @param {DecisionMeta} decisionMeta - Metadata from the actor decision.
 * @returns {{speechContent: string, thoughts?: string, notes?: string, notesRaw?: *}|null} The sanitized payload, or null if speech is absent/invalid.
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

  const notes = formatNotesForDisplay(notesRaw);

  const payload = {
    speechContent: speech,
    ...(thoughts ? { thoughts } : {}),
    ...(notes ? { notes } : {}),
    ...(notesRaw ? { notesRaw } : {}),
  };

  return payload;
}

export default buildSpeechPayload;
