// src/services/promptElementAssemblers/PerceptionLogAssembler.js

import { IPromptElementAssembler } from '../../interfaces/IPromptElementAssembler.js';

// TODO: PB-REFACTOR-007: PERCEPTION_LOG_ENTRY_KEY should be imported from a shared constants file.
// Defined locally for now to satisfy the current ticket's scope, as modifying other files
// to export it (e.g., PromptBuilder.js or creating a new constants file) is out of scope for PB-REFACTOR-011.
const PERCEPTION_LOG_ENTRY_KEY = 'perception_log_entry';

/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 */
/**
 * @typedef {import('../promptBuilder.js').PromptElement} PromptElement
 * @description The configuration object for a specific prompt element.
 */
/**
 * @typedef {import('../promptBuilder.js').PromptData} PromptData
 * @description The global PromptData object containing all raw content and flags.
 */
/**
 * @typedef {import('../promptBuilder.js').PerceptionLogEntry} PerceptionLogEntry
 * @description Represents a single entry in a perception log array.
 */

/**
 * @typedef {import('../../utils/placeholderResolver.js').PlaceholderResolver} PlaceholderResolver
 * @description An instance of the PlaceholderResolver utility.
 */

/**
 * @class PerceptionLogAssembler
 * @implements {IPromptElementAssembler}
 * @description Assembles prompt elements of type 'perception_log_wrapper'.
 * This class encapsulates the logic for iterating over perception log entries,
 * applying specific formatting rules (like cleaning timestamp attributes from entry prefixes/suffixes),
 * resolving placeholders for both the wrapper and individual entries, and constructing
 * the final string representation for the perception log block.
 */
export class PerceptionLogAssembler extends IPromptElementAssembler {
  /**
   * @private
   * @type {ILogger}
   * @description Logger instance.
   */
  #logger;

  /**
   * Removes 'timestamp="value"' attributes from a string and cleans up surrounding spaces.
   * This method is designed to clean attributes from HTML/XML-like tag structures within
   * prefix or suffix strings of perception log entries before placeholder resolution.
   * Example: '<obs timestamp="123">text</obs>' -> '<obs>text</obs>'
   * Example: '<prefix timestamp="any val" other="val">' -> '<prefix other="val">'
   *
   * @private
   * @static
   * @param {string} str - The string to clean.
   * @returns {string} The cleaned string. Returns an empty string if the input is falsy.
   */
  static #cleanTimestampAttributes(str) {
    if (!str) return '';
    const originalString = str;
    // Regex to find timestamp attributes with various quote types or no quotes.
    // It captures: timestamp, optional whitespace, =, optional whitespace, and then the value part.
    // Value part: "(?:[^"\\]|\\.)*" for double-quoted, '(?:[^'\\]|\\.)*' for single-quoted,
    // or [^\s>]+ for unquoted values.
    let newStr = str.replace(
      /timestamp\s*=\s*(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^\s>]+)/gi,
      ''
    );

    // Only perform further space cleanup if the string was actually modified.
    if (newStr !== originalString) {
      newStr = newStr.replace(/\s\s+/g, ' '); // Replace multiple spaces with a single space.
      // Remove spaces specifically before a closing angle bracket if they resulted from attribute removal.
      // E.g., <tag attribute="value" > -> <tag > (after attribute removal) -> <tag>
      newStr = newStr.replace(/\s+>/g, '>');
      newStr = newStr.trim(); // Trim leading/trailing whitespace from the string.
    }
    return newStr;
  }

  /**
   * Initializes a new instance of the PerceptionLogAssembler.
   *
   * @param {object} [options] - Optional parameters.
   * @param {ILogger} [options.logger] - An ILogger instance. Defaults to the global console.
   */
  constructor({ logger = console } = {}) {
    super();
    this.#logger = logger;
  }

  /**
   * Assembles the 'perception_log_wrapper' element.
   * This involves resolving placeholders for the wrapper's prefix and suffix,
   * iterating through `promptData.perceptionLogArray`, formatting each entry
   * (including cleaning timestamp attributes from entry config's prefix/suffix and resolving entry-specific placeholders),
   * and then combining these parts into a single string.
   *
   * @param {PromptElement} elementConfig - The configuration for the 'perception_log_wrapper' element.
   * @param {PromptData} promptData - The global prompt data, expected to contain `perceptionLogArray`.
   * @param {PlaceholderResolver} placeholderResolver - Utility for resolving placeholders.
   * @param {Map<string, PromptElement>} allPromptElementsMap - A map of all prompt element configurations,
   * used to retrieve the configuration for individual 'perception_log_entry' elements.
   * @returns {string} The assembled string for the perception log block. Returns an empty string
   * if the log array is empty and the wrapper has no prefix/suffix, or if other critical
   * configurations are missing leading to no content.
   */
  assemble(
    elementConfig,
    promptData,
    placeholderResolver,
    allPromptElementsMap
  ) {
    if (
      !elementConfig ||
      !promptData ||
      !placeholderResolver ||
      !allPromptElementsMap
    ) {
      this.#logger.error(
        'PerceptionLogAssembler.assemble: Missing required parameters.',
        {
          elementConfigProvided: !!elementConfig,
          promptDataProvider: !!promptData,
          placeholderResolverProvided: !!placeholderResolver,
          allPromptElementsMapProvided: !!allPromptElementsMap,
        }
      );
      return '';
    }

    const wrapperPrefix = placeholderResolver.resolve(
      elementConfig.prefix || '',
      promptData
    );
    const wrapperSuffix = placeholderResolver.resolve(
      elementConfig.suffix || '',
      promptData
    );

    const perceptionLogArray = promptData.perceptionLogArray;

    if (
      !perceptionLogArray ||
      !Array.isArray(perceptionLogArray) ||
      perceptionLogArray.length === 0
    ) {
      this.#logger.debug(
        `PerceptionLogAssembler: Perception log array for '${elementConfig.key}' missing or empty in PromptData. Skipping wrapper content assembly.`
      );
      // Return wrapper prefix/suffix only if they are non-empty, otherwise empty string.
      return wrapperPrefix || wrapperSuffix
        ? `${wrapperPrefix}${wrapperSuffix}`
        : '';
    }

    const pLogEntryConfig = allPromptElementsMap.get(PERCEPTION_LOG_ENTRY_KEY);
    let assembledLogEntries = '';

    if (!pLogEntryConfig) {
      this.#logger.warn(
        `PerceptionLogAssembler: Missing '${PERCEPTION_LOG_ENTRY_KEY}' config for perception log (wrapper key: '${elementConfig.key}'). Entries will not be formatted with specific prefix/suffix.`
      );
      // According to ticket: "The original logic implies if perceptionLogEntryConfig is missing,
      // assembledLogEntries remains empty as the inner formatting block is skipped."
      // Entries will be processed, but only their raw content will be used if that was the fallback.
      // However, the ticket indicates that if pLogEntryConfig is missing, assembledLogEntries remains empty.
      // This means we effectively don't add entry.content either if the config for formatting is absent.
      // Let's adhere to this: if no pLogEntryConfig, entries are not added to assembledLogEntries.
    }

    for (const entry of perceptionLogArray) {
      if (typeof entry !== 'object' || entry === null) {
        this.#logger.warn(
          `PerceptionLogAssembler: Invalid perception log entry encountered in array for '${elementConfig.key}'. Skipping this entry.`,
          { entry }
        );
        continue;
      }

      // Ensure entry.content is a string, defaulting to empty string if null/undefined.
      const entryContent =
        entry.content !== null && entry.content !== undefined
          ? String(entry.content)
          : '';

      if (pLogEntryConfig) {
        // Create a copy of the entry data for placeholder resolution,
        // excluding the 'timestamp' property from being resolvable as a placeholder.
        const entryForResolution = { ...entry };
        delete entryForResolution.timestamp;

        // Clean timestamp attributes from the perception_log_entry config's prefix and suffix
        // *before* resolving other placeholders in them.
        const entryConfigPrefixCleaned =
          PerceptionLogAssembler.#cleanTimestampAttributes(
            pLogEntryConfig.prefix || ''
          );
        const entryConfigSuffixCleaned =
          PerceptionLogAssembler.#cleanTimestampAttributes(
            pLogEntryConfig.suffix || ''
          );

        // Resolve placeholders in the (now cleaned) entry prefix and suffix.
        // Use `entryForResolution` for entry-specific placeholders, and `promptData` for global ones.
        const resolvedEntryPrefix = placeholderResolver.resolve(
          entryConfigPrefixCleaned,
          entryForResolution,
          promptData
        );
        const resolvedEntrySuffix = placeholderResolver.resolve(
          entryConfigSuffixCleaned,
          entryForResolution,
          promptData
        );

        assembledLogEntries += `${resolvedEntryPrefix}${entryContent}${resolvedEntrySuffix}`;
      } else {
        // If pLogEntryConfig is missing, the ticket implies entries are not formatted and effectively skipped
        // in terms of adding to assembledLogEntries. If the desired behavior was to append raw content,
        // this else block would be: assembledLogEntries += entryContent;
        // But based on "assembledLogEntries remains empty", we do nothing here.
      }
    }

    // Logging based on the state of assembledLogEntries and pLogEntryConfig
    if (assembledLogEntries === '') {
      if (!pLogEntryConfig) {
        this.#logger.debug(
          `PerceptionLogAssembler: Perception log wrapper for '${elementConfig.key}' processed. Entries were not formatted or added to output due to missing '${PERCEPTION_LOG_ENTRY_KEY}' config.`
        );
      } else {
        this.#logger.debug(
          `PerceptionLogAssembler: Perception log wrapper for '${elementConfig.key}' processed, but all log entries resulted in empty strings (e.g., empty content and/or empty resolved prefixes/suffixes).`
        );
      }
    } else {
      // assembledLogEntries !== ""
      this.#logger.debug(
        `PerceptionLogAssembler: Perception log wrapper for '${elementConfig.key}' processed with formatted entries.`
      );
    }

    return `${wrapperPrefix}${assembledLogEntries}${wrapperSuffix}`;
  }
}
