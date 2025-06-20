/**
 * @file Helper for building sanitized ENTITY_SPOKE_ID payloads.
 */

/**
 * @typedef {object} DecisionMeta
 * @property {*} [speech] - Raw speech value.
 * @property {*} [thoughts] - Raw thoughts value.
 * @property {*} [notes] - Raw notes value.
 */

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
  const speech =
    typeof speechRaw === 'string' && speechRaw.trim() ? speechRaw.trim() : null;
  if (!speech) {
    return null;
  }
  const payload = { speechContent: speech };
  if (typeof thoughtsRaw === 'string' && thoughtsRaw.trim()) {
    payload.thoughts = thoughtsRaw.trim();
  }
  if (Array.isArray(notesRaw)) {
    const joined = notesRaw
      .map((n) => (typeof n === 'string' ? n.trim() : ''))
      .filter(Boolean)
      .join('\n');
    if (joined) {
      payload.notes = joined;
    }
  } else if (typeof notesRaw === 'string' && notesRaw.trim()) {
    payload.notes = notesRaw.trim();
  }
  return payload;
}

export default buildSpeechPayload;
