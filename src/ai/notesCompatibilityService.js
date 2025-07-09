import NotesMigrationService from '../migration/NotesMigrationService.js';

/**
 * Service for handling compatibility between old and new note formats
 */
class NotesCompatibilityService {
  constructor() {
    this.migrationService = new NotesMigrationService();
  }

  /**
   * Detects the format of a single note
   *
   * @param {*} note - The note to check
   * @returns {'string'|'legacy'|'structured'|'invalid'} - The detected format
   */
  detectNoteFormat(note) {
    if (typeof note === 'string') {
      return 'string';
    }

    if (typeof note === 'object' && note !== null) {
      if (note.subject) {
        return 'structured';
      }
      if (Object.prototype.hasOwnProperty.call(note, 'text')) {
        return 'legacy';
      }
    }

    return 'invalid';
  }

  /**
   * Detects the predominant format in a notes array
   *
   * @param {Array} notes - Array of notes
   * @returns {{format: 'empty' | 'string' | 'legacy' | 'structured' | 'mixed', stats: object}} - Format info
   */
  detectArrayFormat(notes) {
    if (!Array.isArray(notes) || notes.length === 0) {
      return { format: 'empty', stats: { total: 0 } };
    }

    const stats = {
      total: notes.length,
      string: 0,
      legacy: 0,
      structured: 0,
      invalid: 0,
    };

    for (const note of notes) {
      const format = this.detectNoteFormat(note);
      stats[format]++;
    }

    // Determine predominant format
    if (stats.structured === stats.total) {
      return { format: 'structured', stats };
    }
    if (stats.legacy === stats.total) {
      return { format: 'legacy', stats };
    }
    if (stats.string === stats.total) {
      return { format: 'string', stats };
    }

    return { format: 'mixed', stats };
  }

  /**
   * Validates a note against the appropriate schema
   *
   * @param {*} note - The note to validate
   * @returns {{valid: boolean, errors: string[], format: string}} - Validation result
   */
  validateNote(note) {
    const format = this.detectNoteFormat(note);
    const errors = [];

    switch (format) {
      case 'string':
        if (note.trim() === '') {
          errors.push('String note cannot be empty');
        }
        break;

      case 'legacy':
        if (
          !Object.prototype.hasOwnProperty.call(note, 'text') ||
          typeof note.text !== 'string'
        ) {
          errors.push('Legacy note must have a text field');
        } else if (note.text.trim() === '') {
          errors.push('Note text cannot be empty');
        }
        if (note.timestamp && typeof note.timestamp !== 'string') {
          errors.push('Timestamp must be a string');
        }
        break;

      case 'structured':
        if (
          !Object.prototype.hasOwnProperty.call(note, 'text') ||
          typeof note.text !== 'string'
        ) {
          errors.push('Structured note must have a text field');
        } else if (note.text.trim() === '') {
          errors.push('Note text cannot be empty');
        }
        if (
          !Object.prototype.hasOwnProperty.call(note, 'subject') ||
          typeof note.subject !== 'string'
        ) {
          errors.push('Structured note must have a subject field');
        } else if (note.subject.trim() === '') {
          errors.push('Subject cannot be empty');
        }
        if (note.context !== undefined && typeof note.context !== 'string') {
          errors.push('Context must be a string if provided');
        }
        if (note.tags !== undefined && !Array.isArray(note.tags)) {
          errors.push('Tags must be an array if provided');
        }
        if (note.timestamp && typeof note.timestamp !== 'string') {
          errors.push('Timestamp must be a string');
        }
        break;

      case 'invalid':
        errors.push('Note is not in a recognized format');
        break;
    }

    return {
      valid: errors.length === 0,
      errors,
      format,
    };
  }

  /**
   * Converts a note to the specified format
   *
   * @param {*} note - The note to convert
   * @param {'legacy'|'structured'} targetFormat - The target format
   * @returns {object | null} - The converted note or null if conversion failed
   */
  convertToFormat(note, targetFormat) {
    const currentFormat = this.detectNoteFormat(note);

    if (currentFormat === 'invalid') {
      return null;
    }

    // Convert to structured format
    if (targetFormat === 'structured') {
      if (currentFormat === 'structured') {
        return note; // Already in target format
      }
      return this.migrationService.migrateNote(note);
    }

    // Convert to legacy format
    if (targetFormat === 'legacy') {
      if (currentFormat === 'legacy') {
        return note; // Already in target format
      }

      if (currentFormat === 'string') {
        return {
          text: note,
          timestamp: new Date().toISOString(),
        };
      }

      if (currentFormat === 'structured') {
        // Downgrade structured to legacy
        return {
          text: note.text,
          timestamp: note.timestamp || new Date().toISOString(),
        };
      }
    }

    return null;
  }

  /**
   * Ensures all notes in an array are in the specified format
   *
   * @param {Array} notes - Array of notes
   * @param {'legacy'|'structured'} targetFormat - The target format
   * @returns {Array} - Array with all notes in target format
   */
  ensureFormat(notes, targetFormat) {
    if (!Array.isArray(notes)) {
      return [];
    }

    return notes
      .map((note) => this.convertToFormat(note, targetFormat))
      .filter((note) => note !== null);
  }

  /**
   * Checks if two notes are equivalent (same content, ignoring format differences)
   *
   * @param {*} note1 - First note
   * @param {*} note2 - Second note
   * @returns {boolean} - True if notes have equivalent content
   */
  areNotesEquivalent(note1, note2) {
    // Convert both to structured format for comparison
    const structured1 = this.convertToFormat(note1, 'structured');
    const structured2 = this.convertToFormat(note2, 'structured');

    if (!structured1 || !structured2) {
      return false;
    }

    // Compare text and subject (main content)
    return (
      structured1.text === structured2.text &&
      structured1.subject === structured2.subject
    );
  }

  /**
   * Merges notes from different sources, handling format differences
   *
   * @param {Array} notesArrays - Multiple arrays of notes to merge
   * @param {object} options - Merge options
   * @param {boolean} options.removeDuplicates - Whether to remove duplicate notes
   * @param {'legacy'|'structured'} options.targetFormat - Format for merged result
   * @returns {Array} - Merged array of notes
   */
  mergeNotes(notesArrays, options = {}) {
    const { removeDuplicates = true, targetFormat = 'structured' } = options;
    const allNotes = [];
    const seen = new Set();

    for (const notes of notesArrays) {
      if (!Array.isArray(notes)) {
        continue;
      }

      for (const note of notes) {
        const converted = this.convertToFormat(note, targetFormat);
        if (!converted) {
          continue;
        }

        if (removeDuplicates) {
          // Create a unique key for duplicate detection
          const key = `${converted.subject || 'unknown'}:${converted.text}`;
          if (seen.has(key)) {
            continue;
          }
          seen.add(key);
        }

        allNotes.push(converted);
      }
    }

    return allNotes;
  }
}

export default NotesCompatibilityService;
