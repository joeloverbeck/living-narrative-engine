/**
 * @file Formats complex prompt data sections for template substitution
 * @description Handles formatting of arrays and complex data structures into strings
 */

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../types/perceptionLogTypes.js').RawPerceptionLogEntry} RawPerceptionLogEntry */
/** @typedef {import('../turns/dtos/actionComposite.js').ActionComposite} ActionComposite */

import { validateDependency } from '../utils/dependencyUtils.js';

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
   * Format perception log entries
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
        const type = entry.type || 'unknown';
        return `<entry type="${type}">\n${content}\n</entry>`;
      })
      .join('\n');

    this.#logger.debug(
      `PromptDataFormatter: Formatted ${perceptionLogArray.length} perception log entries`
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
   * @returns {string} Formatted notes content
   */
  formatNotes(notesArray) {
    if (!Array.isArray(notesArray) || notesArray.length === 0) {
      this.#logger.debug('PromptDataFormatter: No notes to format');
      return '';
    }

    const notes = notesArray
      .filter((note) => note && note.text)
      .map((note) => `- ${note.text}`)
      .join('\n');

    this.#logger.debug(
      `PromptDataFormatter: Formatted ${notesArray.length} notes`
    );
    return notes;
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
   * Format indexed choices array
   *
   * @param {ActionComposite[]} indexedChoicesArray - Array of available actions
   * @returns {string} Formatted indexed choices content
   */
  formatIndexedChoices(indexedChoicesArray) {
    if (
      !Array.isArray(indexedChoicesArray) ||
      indexedChoicesArray.length === 0
    ) {
      this.#logger.debug('PromptDataFormatter: No indexed choices to format');
      return '';
    }

    const choices = indexedChoicesArray
      .filter((choice) => choice && choice.index)
      .map((choice) => {
        const index = choice.index;
        const command = choice.commandString || choice.displayName || 'unknown';
        const description = choice.description || '';
        return `[${index}] ${command}: ${description}`.trim();
      })
      .join('\n');

    this.#logger.debug(
      `PromptDataFormatter: Formatted ${indexedChoicesArray.length} indexed choices`
    );
    return choices;
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

    // Format complex sections
    formattedData.perceptionLogContent = this.formatPerceptionLog(
      promptData.perceptionLogArray || []
    );
    formattedData.thoughtsContent = this.formatThoughts(
      promptData.thoughtsArray || []
    );
    formattedData.notesContent = this.formatNotes(promptData.notesArray || []);
    formattedData.goalsContent = this.formatGoals(promptData.goalsArray || []);
    formattedData.indexedChoicesContent = this.formatIndexedChoices(
      promptData.indexedChoicesArray || []
    );

    this.#logger.debug(
      'PromptDataFormatter: Successfully formatted all prompt data'
    );
    return formattedData;
  }
}

export default PromptDataFormatter;
