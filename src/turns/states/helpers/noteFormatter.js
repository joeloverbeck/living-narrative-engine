/**
 * @file Helper function to format structured note objects into readable strings for display.
 */

import { isNonBlankString } from '../../../utils/textUtils.js';

/**
 * @typedef {object} SimpleNote
 * @property {string} text - The note content.
 * @property {string} [timestamp] - When the note was created.
 */

/**
 * @typedef {object} StructuredNote
 * @property {string} text - The note content.
 * @property {string} subject - Primary subject of the note.
 * @property {string} [context] - Where/how this was observed.
 * @property {string[]} [tags] - Additional categorization tags.
 * @property {string} [timestamp] - When the note was created.
 */

/**
 * @typedef {SimpleNote|StructuredNote} NoteObject
 */

/**
 * Formats a single note object into a readable string.
 *
 * @param {NoteObject|string} note - The note to format.
 * @returns {string} The formatted note string.
 */
function formatSingleNote(note) {
  if (typeof note === 'string') {
    return note.trim();
  }

  if (!note || typeof note !== 'object') {
    return '';
  }

  const { text, subject, context, tags } = note;

  if (!isNonBlankString(text)) {
    return '';
  }

  let formatted = text.trim();

  if (isNonBlankString(subject)) {
    formatted = `${subject.trim()}: ${formatted}`;
  }

  if (isNonBlankString(context)) {
    formatted = `${formatted} (${context.trim()})`;
  }

  if (Array.isArray(tags) && tags.length > 0) {
    const validTags = tags.filter(tag => isNonBlankString(tag));
    if (validTags.length > 0) {
      formatted = `${formatted} [${validTags.join(', ')}]`;
    }
  }

  return formatted;
}

/**
 * Formats notes (single note, array of notes, or string) into a readable string for display.
 *
 * @param {NoteObject|NoteObject[]|string|null|undefined} notes - The notes to format.
 * @returns {string|null} The formatted notes string, or null if no valid notes.
 */
export function formatNotesForDisplay(notes) {
  if (!notes) {
    return null;
  }

  if (typeof notes === 'string') {
    return isNonBlankString(notes) ? notes.trim() : null;
  }

  if (Array.isArray(notes)) {
    const formatted = notes
      .map(note => formatSingleNote(note))
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