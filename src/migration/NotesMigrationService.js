/**
 * Service for migrating notes from old format to new structured format
 */
class NotesMigrationService {
  /**
   * Extract subject from note text using pattern matching
   *
   * @param {string} text - The note text
   * @returns {string} - Extracted subject or "Unknown"
   */
  extractSubjectFromText(text) {
    if (!text || typeof text !== 'string') {
      return 'Unknown';
    }

    // Common patterns for extracting subjects
    const patterns = [
      // Possessive pattern "X's..." - extract just the name (check first to avoid capturing "X's Y" as verb pattern)
      { regex: /^([\w\s'-]+)'s\s+/i, type: 'possessive' },
      // "The X..." pattern - extract without "The"
      {
        regex: /^The\s+([\w\s'-]+)\s+(is|was|were|has|have|had)\s+/i,
        type: 'the',
      },
      // "X seems/appears/is/was/has..." pattern
      {
        regex:
          /^([\w\s'-]+)\s+(seems?|appears?|is|was|were|has|have|had|looks?|feels?|sounds?)\s+/i,
        type: 'verb',
      },
      // "Note/Info/Text about X" pattern
      { regex: /^[\w\s]+\s+about\s+([\w\s'-]+?)(?:\s|$)/i, type: 'about' },
      // Direct observation "Saw/Heard/Noticed X..."
      {
        regex:
          /^(?:Saw|Heard|Noticed|Observed|Found|Discovered)\s+((?:the\s+)?[\w\s'-]+?)(?:\s+(?:at|in|near|with|sleeping|walking|running|talking|sitting|standing)|\s*[,.]|\s*$)/i,
        type: 'observation',
      },
      // Location pattern "At/In the X..."
      {
        regex:
          /^(?:At|In|On|Near|Around)\s+(?:the\s+)?([\w\s'-]+?)(?:,|\s+today|\s+yesterday|\s+now|$)/i,
        type: 'location',
      },
    ];

    for (const patternObj of patterns) {
      const match = text.match(patternObj.regex);
      if (match && match[1]) {
        // Clean up the extracted subject
        let subject = match[1].trim();

        // For possessive patterns, the capture group already includes 's, so we don't need to remove it
        // The pattern captures up to but not including the apostrophe

        // Avoid overly generic subjects
        if (
          subject.length > 1 &&
          ![
            'a',
            'an',
            'the',
            'some',
            'any',
            'it',
            'he',
            'she',
            'they',
          ].includes(subject.toLowerCase())
        ) {
          return subject;
        }
      }
    }

    // Special handling for "It" at the beginning
    if (text.toLowerCase().startsWith('it ')) {
      return 'Unknown';
    }

    // Try to extract first noun-like word if no pattern matches
    const words = text.split(/\s+/);
    for (const word of words) {
      // Skip articles and common words
      if (
        [
          'a',
          'an',
          'the',
          'is',
          'was',
          'were',
          'has',
          'have',
          'had',
          'to',
          'in',
          'at',
          'on',
          'it',
        ].includes(word.toLowerCase())
      ) {
        continue;
      }
      // Return first substantial word
      if (word.length > 2) {
        return word;
      }
    }

    return 'Unknown';
  }

  /**
   * Infer tags from note content
   *
   * @param {string} text - The note text
   * @returns {string[]} - Array of inferred tags
   */
  inferTagsFromText(text) {
    const tags = [];

    if (!text || typeof text !== 'string') {
      return ['migrated'];
    }

    const lowerText = text.toLowerCase();

    // Emotion-related tags
    if (/nervous|anxious|worried|scared|frightened|afraid/.test(lowerText)) {
      tags.push('emotion', 'anxiety');
    } else if (/happy|joy|pleased|delighted|excited/.test(lowerText)) {
      tags.push('emotion', 'happiness');
    } else if (/angry|furious|mad|upset|annoyed/.test(lowerText)) {
      tags.push('emotion', 'anger');
    } else if (/sad|depressed|melancholy|sorrowful/.test(lowerText)) {
      tags.push('emotion', 'sadness');
    }

    // Activity tags
    if (/fight|combat|battle|attack|defend/.test(lowerText)) {
      tags.push('combat');
    }
    if (/trade|merchant|buy|sell|market|shop/.test(lowerText)) {
      tags.push('trade');
    }
    if (/politic|council|meeting|vote|election/.test(lowerText)) {
      tags.push('politics');
    }
    if (/magic|spell|enchant|ritual/.test(lowerText)) {
      tags.push('magic');
    }

    // Relationship tags
    if (/friend|ally|companion|trust/.test(lowerText)) {
      tags.push('relationship', 'positive');
    } else if (/enemy|rival|hate|distrust/.test(lowerText)) {
      tags.push('relationship', 'negative');
    }

    // Location tags
    if (/tavern|inn|bar/.test(lowerText)) {
      tags.push('location', 'tavern');
    } else if (/market|shop|store/.test(lowerText)) {
      tags.push('location', 'market');
    } else if (/home|house|dwelling/.test(lowerText)) {
      tags.push('location', 'residence');
    }

    // Add migrated tag to all
    tags.push('migrated');

    // Remove duplicates
    return [...new Set(tags)];
  }

  /**
   * Migrate a single note from old format to new format
   *
   * @param {string | object} oldNote - The note in old format (string or object with text)
   * @returns {object} - Note in new structured format
   */
  migrateNote(oldNote) {
    // Handle string format (very old format)
    if (typeof oldNote === 'string') {
      return {
        text: oldNote,
        subject: this.extractSubjectFromText(oldNote),
        context: 'legacy note',
        tags: this.inferTagsFromText(oldNote),
        timestamp: new Date().toISOString(),
      };
    }

    // Handle object format
    if (typeof oldNote === 'object' && oldNote !== null) {
      const text = oldNote.text || '';

      // Check if already in new format
      if (oldNote.subject) {
        return oldNote; // Already migrated
      }

      return {
        text: text,
        subject: this.extractSubjectFromText(text),
        context: 'legacy note',
        tags: this.inferTagsFromText(text),
        timestamp: oldNote.timestamp || new Date().toISOString(),
      };
    }

    // Fallback for unexpected formats
    return {
      text: String(oldNote),
      subject: 'Unknown',
      context: 'legacy note',
      tags: ['migrated', 'unexpected-format'],
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Migrate an array of notes
   *
   * @param {Array} notes - Array of notes in old or mixed format
   * @returns {Array} - Array of notes in new format
   */
  migrateNotes(notes) {
    if (!Array.isArray(notes)) {
      return [];
    }

    return notes.map((note) => this.migrateNote(note));
  }

  /**
   * Check if a note is in the old format
   *
   * @param {*} note - Note to check
   * @returns {boolean} - True if note is in old format
   */
  isOldFormat(note) {
    if (typeof note === 'string') {
      return true;
    }

    if (typeof note === 'object' && note !== null) {
      // New format has 'subject' field
      return !Object.prototype.hasOwnProperty.call(note, 'subject');
    }

    return false;
  }

  /**
   * Check if a notes array needs migration
   *
   * @param {Array} notes - Array of notes
   * @returns {boolean} - True if any note needs migration
   */
  needsMigration(notes) {
    if (!Array.isArray(notes)) {
      return false;
    }

    return notes.some((note) => this.isOldFormat(note));
  }

  /**
   * Get migration statistics for a notes array
   *
   * @param {Array} notes - Array of notes
   * @returns {object} - Migration statistics
   */
  getMigrationStats(notes) {
    if (!Array.isArray(notes)) {
      return {
        total: 0,
        oldFormat: 0,
        newFormat: 0,
        needsMigration: false,
      };
    }

    const oldFormat = notes.filter((note) => this.isOldFormat(note)).length;
    const newFormat = notes.length - oldFormat;

    return {
      total: notes.length,
      oldFormat,
      newFormat,
      needsMigration: oldFormat > 0,
    };
  }
}

export default NotesMigrationService;
