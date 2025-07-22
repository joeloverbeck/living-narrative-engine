/**
 * @file Helper function to format structured note objects into readable strings for display.
 */

import { isNonBlankString } from '../../../utils/textUtils.js';

/**
 * @typedef {object} StructuredNote
 * @property {string} text - The note content.
 * @property {string} subject - Primary subject of the note.
 * @property {string} [subjectType] - Type of subject (character, location, etc).
 * @property {string} [context] - Where/how this was observed.
 * @property {string[]} [tags] - Additional categorization tags.
 * @property {string} [timestamp] - When the note was created.
 */

/**
 * Formats a single structured note object into a readable string.
 *
 * @param {StructuredNote} note - The note to format.
 * @returns {string} The formatted note string.
 */
function formatSingleNote(note) {
  if (!note || typeof note !== 'object') {
    return '';
  }

  const { text, subject, subjectType, context, tags } = note;

  if (!isNonBlankString(text)) {
    return '';
  }

  let formatted = text.trim();

  if (isNonBlankString(subject)) {
    formatted = `${subject.trim()}: ${formatted}`;
  }

  if (isNonBlankString(subjectType)) {
    formatted = `[${subjectType}] ${formatted}`;
  }

  if (isNonBlankString(context)) {
    formatted = `${formatted} (${context.trim()})`;
  }

  if (Array.isArray(tags) && tags.length > 0) {
    const validTags = tags.filter((tag) => isNonBlankString(tag));
    if (validTags.length > 0) {
      formatted = `${formatted} [${validTags.join(', ')}]`;
    }
  }

  return formatted;
}

/**
 * Formats structured notes (single note or array of notes) into a readable string for display.
 *
 * @param {StructuredNote|StructuredNote[]|null|undefined} notes - The notes to format.
 * @returns {string|null} The formatted notes string, or null if no valid notes.
 */
export function formatNotesForDisplay(notes) {
  if (!notes) {
    return null;
  }

  if (Array.isArray(notes)) {
    const formatted = notes
      .map((note) => formatSingleNote(note))
      .filter(Boolean);

    return formatted.length > 0 ? formatted.join('\n') : null;
  }

  if (typeof notes === 'object') {
    const formatted = formatSingleNote(notes);
    return formatted || null;
  }

  return null;
}

export default formatNotesForDisplay;
