/**
 * Service for querying and filtering notes based on various criteria
 */
class NotesQueryService {
  constructor() {}

  /**
   * Query notes by subject
   *
   * @param {Array} notes - Array of notes
   * @param {string} subject - Subject to search for (case-insensitive)
   * @param {object} options - Query options
   * @param {boolean} options.exact - If true, requires exact match; if false, partial match
   * @returns {Array} - Filtered notes matching the subject
   */
  queryBySubject(notes, subject, options = {}) {
    if (!Array.isArray(notes) || !subject) {
      return [];
    }

    const { exact = false } = options;
    const searchSubject = subject.toLowerCase();

    return notes.filter((note) => {
      if (!note.subject) {
        return false;
      }

      const noteSubject = note.subject.toLowerCase();
      return exact
        ? noteSubject === searchSubject
        : noteSubject.includes(searchSubject);
    });
  }

  /**
   * Query notes by context
   *
   * @param {Array} notes - Array of notes
   * @param {string} context - Context to search for (case-insensitive)
   * @param {object} options - Query options
   * @param {boolean} options.exact - If true, requires exact match; if false, partial match
   * @returns {Array} - Filtered notes matching the context
   */
  queryByContext(notes, context, options = {}) {
    if (!Array.isArray(notes) || !context) {
      return [];
    }

    const { exact = false } = options;
    const searchContext = context.toLowerCase();

    return notes.filter((note) => {
      if (!note.context) {
        return false;
      }

      const noteContext = note.context.toLowerCase();
      return exact
        ? noteContext === searchContext
        : noteContext.includes(searchContext);
    });
  }

  /**
   * Query notes by tags
   *
   * @param {Array} notes - Array of notes
   * @param {string|string[]} tags - Tag(s) to search for
   * @param {object} options - Query options
   * @param {boolean} options.requireAll - If true, note must have all tags; if false, any tag matches
   * @returns {Array} - Filtered notes matching the tags
   */
  queryByTags(notes, tags, options = {}) {
    if (!Array.isArray(notes) || !tags) {
      return [];
    }

    const { requireAll = false } = options;
    const searchTags = Array.isArray(tags) ? tags : [tags];
    const normalizedSearchTags = searchTags.map((tag) => tag.toLowerCase());

    return notes.filter((note) => {
      if (!Array.isArray(note.tags) || note.tags.length === 0) {
        return false;
      }

      const normalizedNoteTags = note.tags.map((tag) => tag.toLowerCase());

      if (requireAll) {
        // Note must have all search tags
        return normalizedSearchTags.every((searchTag) =>
          normalizedNoteTags.includes(searchTag)
        );
      } else {
        // Note must have at least one search tag
        return normalizedSearchTags.some((searchTag) =>
          normalizedNoteTags.includes(searchTag)
        );
      }
    });
  }

  /**
   * Query notes by text content
   *
   * @param {Array} notes - Array of notes
   * @param {string} searchText - Text to search for (case-insensitive)
   * @param {object} options - Query options
   * @param {boolean} options.exact - If true, requires exact match; if false, partial match
   * @param {boolean} options.searchSubject - Also search in subject field
   * @param {boolean} options.searchContext - Also search in context field
   * @returns {Array} - Filtered notes containing the search text
   */
  queryByText(notes, searchText, options = {}) {
    if (!Array.isArray(notes) || !searchText) {
      return [];
    }

    const {
      exact = false,
      searchSubject = false,
      searchContext = false,
    } = options;

    const normalizedSearch = searchText.toLowerCase();

    return notes.filter((note) => {
      const noteText = (note.text || '').toLowerCase();

      // Check main text
      let textMatches = exact
        ? noteText === normalizedSearch
        : noteText.includes(normalizedSearch);

      // Check subject if requested
      if (!textMatches && searchSubject && note.subject) {
        const noteSubject = note.subject.toLowerCase();
        textMatches = exact
          ? noteSubject === normalizedSearch
          : noteSubject.includes(normalizedSearch);
      }

      // Check context if requested
      if (!textMatches && searchContext && note.context) {
        const noteContext = note.context.toLowerCase();
        textMatches = exact
          ? noteContext === normalizedSearch
          : noteContext.includes(normalizedSearch);
      }

      return textMatches;
    });
  }

  /**
   * Query notes within a time range
   *
   * @param {Array} notes - Array of notes
   * @param {Date|string} startDate - Start of time range (inclusive)
   * @param {Date|string} endDate - End of time range (inclusive)
   * @returns {Array} - Filtered notes within the time range
   */
  queryByTimeRange(notes, startDate, endDate) {
    if (!Array.isArray(notes) || !startDate || !endDate) {
      return [];
    }

    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();

    if (isNaN(start) || isNaN(end)) {
      return [];
    }

    return notes.filter((note) => {
      if (!note.timestamp) {
        return false;
      }

      const noteTime = new Date(note.timestamp).getTime();
      return !isNaN(noteTime) && noteTime >= start && noteTime <= end;
    });
  }

  /**
   * Complex query combining multiple criteria
   *
   * @param {Array} notes - Array of notes
   * @param {object} criteria - Query criteria
   * @param {string} criteria.subject - Subject to search for
   * @param {string} criteria.context - Context to search for
   * @param {string|string[]} criteria.tags - Tags to search for
   * @param {string} criteria.text - Text to search for
   * @param {Date|string} criteria.startDate - Start of time range
   * @param {Date|string} criteria.endDate - End of time range
   * @param {object} criteria.options - Options for each criterion
   * @returns {Array} - Filtered notes matching all specified criteria
   */
  query(notes, criteria = {}) {
    if (!Array.isArray(notes)) {
      return [];
    }

    let results = [...notes];

    // Apply subject filter
    if (criteria.subject) {
      results = this.queryBySubject(
        results,
        criteria.subject,
        criteria.options?.subject
      );
    }

    // Apply context filter
    if (criteria.context) {
      results = this.queryByContext(
        results,
        criteria.context,
        criteria.options?.context
      );
    }

    // Apply tags filter
    if (criteria.tags) {
      results = this.queryByTags(
        results,
        criteria.tags,
        criteria.options?.tags
      );
    }

    // Apply text filter
    if (criteria.text) {
      results = this.queryByText(
        results,
        criteria.text,
        criteria.options?.text
      );
    }

    // Apply time range filter
    if (criteria.startDate && criteria.endDate) {
      results = this.queryByTimeRange(
        results,
        criteria.startDate,
        criteria.endDate
      );
    }

    return results;
  }

  /**
   * Get all unique subjects from notes
   *
   * @param {Array} notes - Array of notes
   * @returns {Array<string>} - Sorted array of unique subjects
   */
  getAllSubjects(notes) {
    if (!Array.isArray(notes)) {
      return [];
    }

    const subjects = new Set();

    notes.forEach((note) => {
      if (note.subject) {
        subjects.add(note.subject);
      }
    });

    return Array.from(subjects).sort();
  }

  /**
   * Get all unique tags from notes
   *
   * @param {Array} notes - Array of notes
   * @returns {Array<string>} - Sorted array of unique tags
   */
  getAllTags(notes) {
    if (!Array.isArray(notes)) {
      return [];
    }

    const tags = new Set();

    notes.forEach((note) => {
      if (Array.isArray(note.tags)) {
        note.tags.forEach((tag) => tags.add(tag));
      }
    });

    return Array.from(tags).sort();
  }

  /**
   * Get all unique contexts from notes
   *
   * @param {Array} notes - Array of notes
   * @returns {Array<string>} - Sorted array of unique contexts
   */
  getAllContexts(notes) {
    if (!Array.isArray(notes)) {
      return [];
    }

    const contexts = new Set();

    notes.forEach((note) => {
      if (note.context) {
        contexts.add(note.context);
      }
    });

    return Array.from(contexts).sort();
  }

  /**
   * Get statistics about notes
   *
   * @param {Array} notes - Array of notes
   * @returns {object} - Statistics object
   */
  getStatistics(notes) {
    if (!Array.isArray(notes)) {
      return {
        total: 0,
        bySubject: {},
        byTag: {},
        byContext: {},
        structured: 0,
        legacy: 0,
      };
    }

    const stats = {
      total: notes.length,
      bySubject: {},
      byTag: {},
      byContext: {},
      structured: 0,
      legacy: 0,
    };

    notes.forEach((note) => {
      // Count structured vs legacy
      if (note.subject) {
        stats.structured++;

        // Count by subject
        stats.bySubject[note.subject] =
          (stats.bySubject[note.subject] || 0) + 1;
      } else {
        stats.legacy++;
      }

      // Count by context
      if (note.context) {
        stats.byContext[note.context] =
          (stats.byContext[note.context] || 0) + 1;
      }

      // Count by tags
      if (Array.isArray(note.tags)) {
        note.tags.forEach((tag) => {
          stats.byTag[tag] = (stats.byTag[tag] || 0) + 1;
        });
      }
    });

    return stats;
  }
}

export default NotesQueryService;
