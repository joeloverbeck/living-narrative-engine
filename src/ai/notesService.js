// src/ai/notesService.js

import NotesMigrationService from '../migration/NotesMigrationService.js';

/**
 * Normalizes note text for duplicate detection by trimming, lower-casing,
 * stripping punctuation, and collapsing internal whitespace.
 * For structured notes, includes subject in normalization.
 *
 * @param {string | object} noteOrText - The note text or structured note object.
 * @returns {string} The normalized text.
 */
export function normalizeNoteText(noteOrText) {
  let text = '';

  if (typeof noteOrText === 'string') {
    text = noteOrText;
  } else if (typeof noteOrText === 'object' && noteOrText !== null) {
    // For structured notes, include subject in normalization to avoid false duplicates
    text = noteOrText.subject
      ? `${noteOrText.subject}:${noteOrText.text}`
      : noteOrText.text || '';
  }

  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\s:]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Notes Service.
 * Manages the data within a `core:notes` component.
 * Supports both legacy (text-only) and structured note formats.
 */
export default class NotesService {
  /**
   * Creates a new NotesService.
   *
   * @param {object} [options] - Configuration options.
   * @param {boolean} [options.autoMigrate] - Whether to automatically migrate old format notes.
   */
  constructor(options = {}) {
    this.autoMigrate = options.autoMigrate !== false;
    this.migrationService = new NotesMigrationService();
  }

  /**
   * Adds new notes to a notes component data object, skipping duplicates.
   * Supports both legacy string format and new structured format.
   *
   * @param {object} notesComp - The notes component data to update. This object is mutated in place.
   * @param {Array<{text: string, timestamp?: string}|{text: string, subject: string, context?: string, tags?: string[], timestamp?: string}>} notesComp.notes - The list of existing notes.
   * @param {(string | object)[]} newNotes - An array of new notes to add (strings or structured objects).
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

    // Auto-migrate existing notes if enabled
    if (
      this.autoMigrate &&
      this.migrationService.needsMigration(notesComp.notes)
    ) {
      notesComp.notes = this.migrationService.migrateNotes(notesComp.notes);
    }

    // Build set of existing normalized notes
    const existingSet = new Set(
      notesComp.notes
        .filter((n) => n && typeof n.text === 'string')
        .map((n) => normalizeNoteText(n))
    );

    let wasModified = false;

    for (const note of newNotes) {
      let noteEntry;

      // Handle string notes (legacy format)
      if (typeof note === 'string') {
        const trimmedText = note.trim();
        if (trimmedText === '') {
          continue;
        }

        // Convert to structured format if auto-migrate is enabled
        if (this.autoMigrate) {
          noteEntry = this.migrationService.migrateNote(trimmedText);
        } else {
          noteEntry = { text: trimmedText, timestamp: now.toISOString() };
        }
      }
      // Handle structured notes (new format)
      else if (
        typeof note === 'object' &&
        note !== null &&
        note.text &&
        note.subject
      ) {
        noteEntry = {
          text: note.text.trim(),
          subject: note.subject,
          context: note.context,
          tags: note.tags,
          timestamp: note.timestamp || now.toISOString(),
        };

        if (noteEntry.text === '') {
          continue;
        }
      }
      // Skip invalid notes
      else {
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

    return { wasModified, component: notesComp, addedNotes };
  }
}
