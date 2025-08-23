/**
 * @file Formats complex prompt data sections for template substitution
 * @description Handles formatting of arrays and complex data structures into strings
 */

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../types/perceptionLogTypes.js').RawPerceptionLogEntry} RawPerceptionLogEntry */

import { validateDependency } from '../utils/dependencyUtils.js';
import { SUBJECT_TYPES } from '../constants/subjectTypes.js';

/**
 * Maps subject types to display categories with prioritization
 */
const SUBJECT_TYPE_DISPLAY_MAPPING = {
  [SUBJECT_TYPES.CHARACTER]: {
    displayCategory: 'Characters',
    displayName: 'Characters',
    priority: 1,
  },
  [SUBJECT_TYPES.LOCATION]: {
    displayCategory: 'Locations',
    displayName: 'Locations',
    priority: 2,
  },
  [SUBJECT_TYPES.EVENT]: {
    displayCategory: 'Events',
    displayName: 'Events',
    priority: 3,
  },
  [SUBJECT_TYPES.ITEM]: {
    displayCategory: 'Items & Objects',
    displayName: 'Items & Objects',
    priority: 4,
  },
  [SUBJECT_TYPES.CREATURE]: {
    displayCategory: 'Creatures',
    displayName: 'Creatures',
    priority: 5,
  },
  [SUBJECT_TYPES.ORGANIZATION]: {
    displayCategory: 'Organizations',
    displayName: 'Organizations',
    priority: 6,
  },
  [SUBJECT_TYPES.QUEST]: {
    displayCategory: 'Quests & Tasks',
    displayName: 'Quests & Tasks',
    priority: 7,
  },
  [SUBJECT_TYPES.RELATIONSHIP]: {
    displayCategory: 'Relationships',
    displayName: 'Relationships',
    priority: 8,
  },
  [SUBJECT_TYPES.CONCEPT]: {
    displayCategory: 'Concepts & Ideas',
    displayName: 'Concepts & Ideas',
    priority: 9,
  },
  [SUBJECT_TYPES.SKILL]: {
    displayCategory: 'Skills & Abilities',
    displayName: 'Skills & Abilities',
    priority: 10,
  },
  [SUBJECT_TYPES.EMOTION]: {
    displayCategory: 'Emotions & Feelings',
    displayName: 'Emotions & Feelings',
    priority: 11,
  },
  [SUBJECT_TYPES.OTHER]: {
    displayCategory: 'Other',
    displayName: 'Other',
    priority: 999,
  },
};

/**
 * @class PromptDataFormatter
 * @description Formats complex data structures into strings for prompt templates
 */
export class PromptDataFormatter {
  /** @type {ILogger} */
  #logger;

  /**
   * @param {object} dependencies
   * @param {ILogger} dependencies.logger - Logger instance
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['debug', 'warn', 'error'],
    });
    this.#logger = logger;
    this.#logger.debug('PromptDataFormatter initialized');
  }

  /**
   * Format perception log entries with simplified format (no XML tags)
   *
   * @param {RawPerceptionLogEntry[]} perceptionLogArray - Array of perception log entries
   * @returns {string} Formatted perception log content
   */
  formatPerceptionLog(perceptionLogArray) {
    if (!Array.isArray(perceptionLogArray) || perceptionLogArray.length === 0) {
      this.#logger.debug(
        'PromptDataFormatter: No perception log entries to format'
      );
      return '';
    }

    const entries = perceptionLogArray
      .filter((entry) => entry && typeof entry === 'object')
      .map((entry) => {
        const content = entry.content || '';
        // Return simplified format - just the content without XML tags
        return content;
      })
      .filter((content) => content.trim().length > 0) // Remove empty entries
      .join('\n');

    this.#logger.debug(
      `PromptDataFormatter: Formatted ${perceptionLogArray.length} perception log entries with simplified format`
    );
    return entries;
  }

  /**
   * Format thoughts array
   *
   * @param {Array<{text: string, timestamp: string}>} thoughtsArray - Array of thoughts
   * @returns {string} Formatted thoughts content
   */
  formatThoughts(thoughtsArray) {
    if (!Array.isArray(thoughtsArray) || thoughtsArray.length === 0) {
      this.#logger.debug('PromptDataFormatter: No thoughts to format');
      return '';
    }

    const thoughts = thoughtsArray
      .filter((thought) => thought && thought.text)
      .map((thought) => `- ${thought.text}`)
      .join('\n');

    this.#logger.debug(
      `PromptDataFormatter: Formatted ${thoughtsArray.length} thoughts`
    );
    return thoughts;
  }

  /**
   * Format notes array
   *
   * @param {Array<{text: string, timestamp: string}>} notesArray - Array of notes
   * @param {object} options - Formatting options
   * @param {boolean} options.groupBySubject - Enable subject grouping (default: false for backward compatibility)
   * @param {boolean} options.showContext - Show context information (default: true)
   * @returns {string} Formatted notes content
   */
  formatNotes(notesArray, options = {}) {
    if (!Array.isArray(notesArray) || notesArray.length === 0) {
      this.#logger.debug('PromptDataFormatter: No notes to format');
      return '';
    }

    // Default options - grouped formatting enabled by default
    const opts = {
      groupBySubject: true,
      showContext: true,
      ...options,
    };

    // If grouping is disabled, use legacy flat formatting
    if (!opts.groupBySubject) {
      const notes = notesArray
        .filter((note) => note && note.text)
        .map((note) => `- ${note.text}`)
        .join('\n');

      this.#logger.debug(
        `PromptDataFormatter: Formatted ${notesArray.length} notes (legacy format)`
      );
      return notes;
    }

    // Use new grouped formatting
    return this.formatGroupedNotes(notesArray, opts);
  }

  /**
   * Get display information for a subject type
   *
   * @param {string} subjectType - The subject type to get display info for
   * @returns {{displayCategory: string, displayName: string, priority: number}} Display information
   */
  getSubjectTypeDisplayInfo(subjectType) {
    return (
      SUBJECT_TYPE_DISPLAY_MAPPING[subjectType] ||
      SUBJECT_TYPE_DISPLAY_MAPPING[SUBJECT_TYPES.OTHER]
    );
  }

  /**
   * Group notes by subject using explicit subject types
   *
   * @param {Array<{text: string, subject?: string, subjectType?: string, context?: string, timestamp?: string}>} notes - Array of structured notes
   * @returns {Map<string, {subjectType: string, displayCategory: string, priority: number, notes: Array}>}
   */
  groupNotesBySubject(notes) {
    const grouped = new Map();

    notes.forEach((note) => {
      const subject = note.subject || 'General';

      // If no subject is provided (fallback to 'General'), use OTHER as subjectType
      // Otherwise, use the note's subjectType or fallback to OTHER
      const subjectType = !note.subject
        ? SUBJECT_TYPES.OTHER
        : note.subjectType || SUBJECT_TYPES.OTHER;

      const displayInfo = this.getSubjectTypeDisplayInfo(subjectType);

      if (!grouped.has(subject)) {
        grouped.set(subject, {
          subjectType,
          displayCategory: displayInfo.displayCategory,
          priority: displayInfo.priority,
          notes: [],
        });
      }
      grouped.get(subject).notes.push(note);
    });

    return grouped;
  }

  /**
   * Format individual note with context and tags
   *
   * @param {{text: string, context?: string}} note - The note to format
   * @param {object} options - Formatting options
   * @param {boolean} options.showContext - Show context information
   * @returns {string} Formatted note string
   */
  formatNoteWithContext(note, options) {
    let formatted = `- ${note.text}`;

    if (options.showContext && note.context) {
      formatted += ` (${note.context})`;
    }

    return formatted;
  }

  /**
   * Sort categories and subjects for consistent display
   *
   * @param {Map} groupedNotes - Grouped notes map
   * @returns {Array<{displayCategory: string, subjects: Array}>} Sorted structure
   */
  sortNotesForDisplay(groupedNotes) {
    const categories = new Map();

    // Group by display category
    for (const [subject, data] of groupedNotes) {
      const displayCategory = data.displayCategory;
      if (!categories.has(displayCategory)) {
        categories.set(displayCategory, {
          priority: data.priority,
          subjects: [],
        });
      }
      categories.get(displayCategory).subjects.push({
        subject,
        notes: data.notes,
      });
    }

    // Sort categories by priority, subjects alphabetically
    return Array.from(categories.entries())
      .sort((a, b) => a[1].priority - b[1].priority)
      .map(([displayCategory, data]) => ({
        displayCategory,
        subjects: data.subjects.sort((a, b) =>
          a.subject.localeCompare(b.subject)
        ),
      }));
  }

  /**
   * Format notes with subject grouping and context display
   *
   * @param {Array<{text: string, subject?: string, subjectType?: string, context?: string, timestamp?: string}>} notesArray - Array of structured notes
   * @param {object} options - Formatting options
   * @returns {string} Formatted notes content with grouping
   */
  formatGroupedNotes(notesArray, options) {
    try {
      // Filter valid notes
      const validNotes = notesArray.filter((note) => {
        if (!note || typeof note !== 'object') {
          this.#logger.debug(
            'formatGroupedNotes: Skipping invalid note object'
          );
          return false;
        }

        if (!note.text || typeof note.text !== 'string') {
          this.#logger.debug(
            'formatGroupedNotes: Skipping note without valid text'
          );
          return false;
        }

        return true;
      });

      if (validNotes.length === 0) {
        this.#logger.debug('formatGroupedNotes: No valid notes to format');
        return '';
      }

      // Group notes by subject
      const groupedNotes = this.groupNotesBySubject(validNotes);

      // Sort for display
      const sortedCategories = this.sortNotesForDisplay(groupedNotes);

      // Format output
      const formattedSections = [];

      sortedCategories.forEach(({ displayCategory, subjects }) => {
        formattedSections.push(`## ${displayCategory}`);

        subjects.forEach(({ subject, notes }) => {
          formattedSections.push(`### ${subject}`);

          notes.forEach((note) => {
            const formattedNote = this.formatNoteWithContext(note, options);
            formattedSections.push(formattedNote);
          });
        });
      });

      const result = formattedSections.join('\n');

      this.#logger.debug(
        `PromptDataFormatter: Formatted ${validNotes.length} notes with grouping into ${sortedCategories.length} categories`
      );

      return result;
    } catch (error) {
      this.#logger.error(
        'formatGroupedNotes: Error during formatting, falling back to simple list',
        error
      );
      // Fallback to simple formatting
      return notesArray
        .filter((note) => note && note.text)
        .map((note) => `- ${note.text}`)
        .join('\n');
    }
  }

  /**
   * Format goals array
   *
   * @param {Array<{text: string, timestamp: string}>} goalsArray - Array of goals
   * @returns {string} Formatted goals content
   */
  formatGoals(goalsArray) {
    if (!Array.isArray(goalsArray) || goalsArray.length === 0) {
      this.#logger.debug('PromptDataFormatter: No goals to format');
      return '';
    }

    const goals = goalsArray
      .filter((goal) => goal && goal.text)
      .map((goal) => `- ${goal.text}`)
      .join('\n');

    this.#logger.debug(
      `PromptDataFormatter: Formatted ${goalsArray.length} goals`
    );
    return goals;
  }

  /**
   * Format thoughts section with conditional XML wrapper
   *
   * @param {Array<{text: string, timestamp: string}>} thoughtsArray - Array of thoughts
   * @returns {string} Complete thoughts section with XML tags or empty string
   */
  formatThoughtsSection(thoughtsArray) {
    const content = this.formatThoughts(thoughtsArray);
    if (!content) {
      return '';
    }
    return `<thoughts>\n${content}\n</thoughts>`;
  }

  /**
   * Format notes section with conditional XML wrapper
   *
   * @param {Array<{text: string, timestamp: string}>} notesArray - Array of notes
   * @param {object} options - Formatting options to pass through to formatNotes
   * @returns {string} Complete notes section with XML tags or empty string
   */
  formatNotesSection(notesArray, options = {}) {
    const content = this.formatNotes(notesArray, options);
    if (!content) {
      return '';
    }
    return `<notes>\n${content}\n</notes>`;
  }

  /**
   * Format goals section with conditional XML wrapper
   *
   * @param {Array<{text: string, timestamp: string}>} goalsArray - Array of goals
   * @returns {string} Complete goals section with XML tags or empty string
   */
  formatGoalsSection(goalsArray) {
    const content = this.formatGoals(goalsArray);
    if (!content) {
      return '';
    }
    return `<goals>\n${content}\n</goals>`;
  }

  /**
   * Format all complex prompt data into a flat object for template substitution
   *
   * @param {object} promptData - The prompt data object from AIPromptContentProvider
   * @returns {Record<string, string>} Formatted data ready for template substitution
   */
  formatPromptData(promptData) {
    if (!promptData || typeof promptData !== 'object') {
      this.#logger.error('PromptDataFormatter: Invalid prompt data provided');
      return {};
    }

    // Start with the simple string fields
    const formattedData = {
      taskDefinitionContent: promptData.taskDefinitionContent || '',
      characterPersonaContent: promptData.characterPersonaContent || '',
      portrayalGuidelinesContent: promptData.portrayalGuidelinesContent || '',
      contentPolicyContent: promptData.contentPolicyContent || '',
      worldContextContent: promptData.worldContextContent || '',
      availableActionsInfoContent: promptData.availableActionsInfoContent || '',
      userInputContent: promptData.userInputContent || '',
      finalInstructionsContent: promptData.finalInstructionsContent || '',
      assistantResponsePrefix: promptData.assistantResponsePrefix || '',
    };

    // Format complex sections (backwards compatibility - content only)
    formattedData.perceptionLogContent = this.formatPerceptionLog(
      promptData.perceptionLogArray || []
    );
    formattedData.thoughtsContent = this.formatThoughts(
      promptData.thoughtsArray || []
    );
    formattedData.notesContent = this.formatNotes(promptData.notesArray || []);
    formattedData.goalsContent = this.formatGoals(promptData.goalsArray || []);

    // New conditional section formatting (complete sections with XML tags)
    formattedData.thoughtsSection = this.formatThoughtsSection(
      promptData.thoughtsArray || []
    );
    formattedData.notesSection = this.formatNotesSection(
      promptData.notesArray || []
    );
    formattedData.goalsSection = this.formatGoalsSection(
      promptData.goalsArray || []
    );

    this.#logger.debug(
      'PromptDataFormatter: Successfully formatted all prompt data including conditional sections'
    );
    return formattedData;
  }
}

export default PromptDataFormatter;
