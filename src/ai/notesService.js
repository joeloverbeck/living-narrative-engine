// src/ai/notesService.js

/**
 * Normalizes note text for duplicate detection by trimming, lower-casing,
 * stripping punctuation, and collapsing internal whitespace.
 *
 * @param {string} text - The original note text.
 * @returns {string} The normalized text.
 */
function normalizeNoteText(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]|/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Notes Service.
 * Manages the data within a `core:notes` component.
 */
export default class NotesService {
  /**
   * Creates a new NotesService.
   *
   * @param {object} [_options] - Configuration options. Currently unused.
   */
  constructor(_options = {}) {
    // No options needed yet, but keeping for future-proofing.
  }

  /**
   * Adds new notes to a notes component data object, skipping duplicates.
   *
   * @param {object} notesComp - The notes component data to update.
   * @param {Array<{text: string, timestamp: string}>} notesComp.notes - The list of existing notes.
   * @param {string[]} newNotesText - An array of new note strings to add.
   * @param {Date} [now] - The current date/time; defaults to new Date().
   * @returns {{wasModified: boolean, component: object, addedNotes: Array<{text: string, timestamp: string}>}} - An object containing the
   * mutated component, a modification flag, and an array of the newly added notes.
   */
  addNotes(notesComp, newNotesText, now = new Date()) {
    if (!notesComp || !Array.isArray(notesComp.notes)) {
      throw new TypeError(
        'notesComp must be an object conforming to the core:notes schema with a `notes` array.'
      );
    }

    const addedNotes = [];
    if (!Array.isArray(newNotesText)) {
      return { wasModified: false, component: notesComp, addedNotes };
    }

    const existingSet = new Set(
      notesComp.notes
        .filter((n) => typeof n.text === 'string')
        .map((n) => normalizeNoteText(n.text))
    );

    let wasModified = false;

    for (const noteText of newNotesText) {
      const trimmedText = noteText.trim();
      if (typeof noteText !== 'string' || trimmedText === '') {
        continue;
      }

      const normalisedIncoming = normalizeNoteText(trimmedText);
      if (existingSet.has(normalisedIncoming)) {
        continue;
      }

      const timestamp = now.toISOString();
      const newEntry = { text: trimmedText, timestamp };

      notesComp.notes.push(newEntry);
      addedNotes.push(newEntry);
      existingSet.add(normalisedIncoming);
      wasModified = true;
    }

    return { wasModified, component: notesComp, addedNotes };
  }
}
