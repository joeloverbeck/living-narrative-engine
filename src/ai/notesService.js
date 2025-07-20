// src/ai/notesService.js

import { DEFAULT_SUBJECT_TYPE } from '../constants/subjectTypes.js';

/**
 * Normalizes note text for duplicate detection by trimming, lower-casing,
 * stripping punctuation, and collapsing internal whitespace.
 * For structured notes, includes subject and subjectType in normalization.
 *
 * @param {object} noteObject - The structured note object.
 * @returns {string} The normalized text.
 */
export function normalizeNoteText(noteObject) {
  if (typeof noteObject !== 'object' || noteObject === null) {
    return '';
  }

  // For structured notes, include subject and subjectType in normalization to avoid false duplicates
  const subjectType = noteObject.subjectType || DEFAULT_SUBJECT_TYPE;
  const text = noteObject.subject
    ? `${subjectType}:${noteObject.subject}:${noteObject.text}`
    : noteObject.text || '';

  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\s:]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Notes Service.
 * Manages the data within a `core:notes` component.
 * Supports structured note formats only.
 */
export default class NotesService {
  /**
   * Creates a new NotesService.
   */
  constructor() {
    // Service initialization
  }

  /**
   * Adds new notes to a notes component data object, skipping duplicates.
   * Supports structured note format only.
   *
   * @param {object} notesComp - The notes component data to update. This object is mutated in place.
   * @param {Array<{text: string, subject: string, subjectType?: string, context?: string, tags?: string[], timestamp?: string}>} notesComp.notes - The list of existing notes.
   * @param {object[]} newNotes - An array of new structured note objects to add.
   * @param {Date} [now] - The current date/time; defaults to new Date().
   * @returns {{wasModified: boolean, component: object, addedNotes: Array}} - An object containing the
   * mutated component, a modification flag, and an array of the newly added notes.
   */
  addNotes(notesComp, newNotes, now = new Date()) {
    if (!notesComp || !Array.isArray(notesComp.notes)) {
      throw new TypeError(
        'notesComp must be an object conforming to the core:notes schema with a `notes` array.'
      );
    }

    const addedNotes = [];
    if (!Array.isArray(newNotes)) {
      return { wasModified: false, component: notesComp, addedNotes };
    }

    // Build set of existing normalized notes
    const existingSet = new Set(
      notesComp.notes
        .filter((n) => n && typeof n.text === 'string')
        .map((n) => normalizeNoteText(n))
    );

    let wasModified = false;

    for (const note of newNotes) {
      // Handle structured notes only
      if (
        typeof note === 'object' &&
        note !== null &&
        note.text &&
        note.subject
      ) {
        const noteEntry = {
          text: note.text.trim(),
          subject: note.subject,
          subjectType: note.subjectType || DEFAULT_SUBJECT_TYPE,
          context: note.context,
          tags: note.tags,
          timestamp: note.timestamp || now.toISOString(),
        };

        if (noteEntry.text === '') {
          continue;
        }

        // Check for duplicates
        const normalizedIncoming = normalizeNoteText(noteEntry);
        if (existingSet.has(normalizedIncoming)) {
          continue;
        }

        // Add the note
        notesComp.notes.push(noteEntry);
        addedNotes.push(noteEntry);
        existingSet.add(normalizedIncoming);
        wasModified = true;
      }
      // Skip invalid notes - only structured format supported
    }

    return { wasModified, component: notesComp, addedNotes };
  }
}
